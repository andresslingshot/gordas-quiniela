"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ROUNDS, ROUND_LABELS, ROUND_MATCH_COUNT, ROUND_POINTS,
  isBracketLocked, BRACKET_LOCK_UTC,
  FEEDER, BracketMatch, BracketPick, KnockoutRound,
} from "@/lib/bracket";
import { formatKickoff } from "@/lib/timezones";

const FLAGS: Record<string, string> = {
  "Mexico":"🇲🇽","South Africa":"🇿🇦","South Korea":"🇰🇷","Czechia":"🇨🇿",
  "Canada":"🇨🇦","Bosnia & Herzegovina":"🇧🇦","Qatar":"🇶🇦","Switzerland":"🇨🇭",
  "Brazil":"🇧🇷","Morocco":"🇲🇦","Haiti":"🇭🇹","Scotland":"🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  "USA":"🇺🇸","Paraguay":"🇵🇾","Australia":"🇦🇺","Türkiye":"🇹🇷",
  "Germany":"🇩🇪","Curaçao":"🇨🇼","Netherlands":"🇳🇱","Japan":"🇯🇵",
  "Ivory Coast":"🇨🇮","Ecuador":"🇪🇨","Tunisia":"🇹🇳","Sweden":"🇸🇪",
  "Spain":"🇪🇸","Cape Verde":"🇨🇻","Belgium":"🇧🇪","Egypt":"🇪🇬",
  "Saudi Arabia":"🇸🇦","Uruguay":"🇺🇾","Iran":"🇮🇷","New Zealand":"🇳🇿",
  "France":"🇫🇷","Senegal":"🇸🇳","Iraq":"🇮🇶","Norway":"🇳🇴",
  "Argentina":"🇦🇷","Algeria":"🇩🇿","Austria":"🇦🇹","Jordan":"🇯🇴",
  "Portugal":"🇵🇹","Congo DR":"🇨🇩","England":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","Croatia":"🇭🇷",
  "Ghana":"🇬🇭","Panama":"🇵🇦","Colombia":"🇨🇴","Uzbekistan":"🇺🇿",
};

function flag(team: string | null) { return team ? (FLAGS[team] ?? "🏳️") : "❓"; }

type ViewMode = "picks" | "bracket" | "reorder";

function resolveTeam(
  slot: string, side: "home" | "away",
  matchMap: Map<string, BracketMatch>, picks: Map<string, string>
): string | null {
  const m = matchMap.get(slot);
  if (!m) return null;
  if (m.round === "r32") return side === "home" ? m.home_team : m.away_team;
  const feeders = FEEDER[slot];
  if (!feeders) return null;
  const feederSlot = side === "home" ? feeders.home : feeders.away;
  const feeder = matchMap.get(feederSlot);
  if (!feeder) return null;
  if (feeder.actual_winner) return feeder.actual_winner;
  return picks.get(feederSlot) ?? null;
}

export default function BracketPage() {
  const router = useRouter();
  const [player, setPlayer] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [matches, setMatches] = useState<Map<string, BracketMatch>>(new Map());
  const [picks, setPicks] = useState<Map<string, string>>(new Map());
  const [activeRound, setActiveRound] = useState<KnockoutRound>("r32");
  const [viewMode, setViewMode] = useState<ViewMode>("picks");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSlots, setSavedSlots] = useState<Set<string>>(new Set());
  const locked = isBracketLocked();

  useEffect(() => {
    const stored = localStorage.getItem("gq_player");
    if (!stored) { router.replace("/"); return; }
    setPlayer(stored);
    setCanEdit(localStorage.getItem("gq_can_edit") === "true");

    async function load() {
      const [matchRes, pickRes] = await Promise.all([
        supabase.from("bracket_matches").select("*").order("position"),
        supabase.from("bracket_picks").select("slot, picked_winner").eq("player_name", stored!),
      ]);
      const mMap = new Map<string, BracketMatch>();
      (matchRes.data ?? []).forEach((m: BracketMatch) => mMap.set(m.slot, m));
      setMatches(mMap);
      const pMap = new Map<string, string>();
      (pickRes.data ?? []).forEach((p: { slot: string; picked_winner: string }) => pMap.set(p.slot, p.picked_winner));
      setPicks(pMap);
      setSavedSlots(new Set(pMap.keys()));
      setLoading(false);
    }
    load();
  }, [router]);

  async function saveActualResult(slot: string, winner: string) {
    const updated = new Map(matches);
    const m = updated.get(slot);
    if (!m) return;
    updated.set(slot, { ...m, actual_winner: winner || null });
    setMatches(updated);
    await supabase.from("bracket_matches")
      .update({ actual_winner: winner || null })
      .eq("slot", slot);
  }

  async function savePick(slot: string, winner: string) {
    if (!player || !canEdit || locked) return;
    setPicks((prev) => new Map(prev).set(slot, winner));
    setSavedSlots((prev) => { const n = new Set(prev); n.delete(slot); return n; });
    setSaving(true);
    await supabase.from("bracket_picks").upsert(
      { player_name: player, slot, picked_winner: winner },
      { onConflict: "player_name,slot" }
    );
    setSavedSlots((prev) => new Set(prev).add(slot));
    setSaving(false);
  }

  async function swapMatches(slotA: string, slotB: string) {
    const a = matches.get(slotA);
    const b = matches.get(slotB);
    if (!a || !b) return;
    const updated = new Map(matches);
    updated.set(slotA, { ...a, home_team: b.home_team, away_team: b.away_team });
    updated.set(slotB, { ...b, home_team: a.home_team, away_team: a.away_team });
    setMatches(updated);
    await Promise.all([
      supabase.from("bracket_matches").update({ home_team: b.home_team, away_team: b.away_team }).eq("slot", slotA),
      supabase.from("bracket_matches").update({ home_team: a.home_team, away_team: a.away_team }).eq("slot", slotB),
    ]);
  }

  const roundMatches = ROUNDS.reduce((acc, r) => {
    const count = ROUND_MATCH_COUNT[r];
    acc[r] = Array.from({ length: count }, (_, i) => {
      const slot = r === "final" ? "final" : `${r}_${i + 1}`;
      return matches.get(slot) ?? { slot, round: r, position: i + 1, home_team: null, away_team: null, actual_winner: null };
    });
    return acc;
  }, {} as Record<KnockoutRound, BracketMatch[]>);

  const r32Ready = roundMatches.r32.some((m) => m.home_team !== null);

  if (!player) return null;

  if (!loading && !r32Ready) {
    return (
      <div className="flex flex-col gap-6 py-4">
        <div className="text-center">
          <div className="text-5xl mb-3">🗂️</div>
          <h2 className="text-2xl font-black gold-text mb-1">Bracket Setup</h2>
          <p className="text-slate-400 text-sm">Picks lock {formatKickoff(BRACKET_LOCK_UTC, "ET")} ET</p>
        </div>
        {canEdit
          ? <R32Setup onSaved={async () => {
              const { data } = await supabase.from("bracket_matches").select("*").order("position");
              const mMap = new Map<string, BracketMatch>();
              (data ?? []).forEach((m: BracketMatch) => mMap.set(m.slot, m));
              setMatches(mMap);
            }} />
          : <p className="text-center text-slate-400 text-sm">The organizer is setting up the bracket — check back soon!</p>
        }
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-black gold-text">Bracket</h2>
          <p className="text-slate-400 text-xs">
            {locked ? "🔒 Locked" : `Open until ${formatKickoff(BRACKET_LOCK_UTC, "ET")} ET`}
          </p>
        </div>
        {saving && <span className="text-xs text-yellow-400 animate-pulse">Saving…</span>}
      </div>

      {/* View mode toggle */}
      <div className="flex gap-1 bg-slate-800 rounded-full p-1">
        {([
          { id: "picks" as ViewMode, label: "⚽ Picks" },
          { id: "bracket" as ViewMode, label: "🗂️ Full Bracket" },
          ...(canEdit ? [{ id: "reorder" as ViewMode, label: "↕ Reorder" }] : []),
        ]).map(({ id, label }) => (
          <button key={id} onClick={() => setViewMode(id)}
            className={`flex-1 py-1.5 rounded-full text-xs font-bold transition-all
              ${viewMode === id ? "bg-yellow-400 text-black" : "text-slate-400 hover:text-white"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── PICKS MODE ───────────────────────────────────────────────────── */}
      {viewMode === "picks" && (
        <>
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            {ROUNDS.map((r) => {
              const picked = roundMatches[r].filter((m) => picks.has(m.slot)).length;
              const total = ROUND_MATCH_COUNT[r];
              return (
                <button key={r} onClick={() => setActiveRound(r)}
                  className={`shrink-0 flex flex-col items-center px-3 py-2 rounded-xl text-xs font-bold transition-all
                    ${activeRound === r ? "bg-yellow-400 text-black"
                      : picked === total ? "bg-green-800/60 text-green-300"
                      : "bg-slate-700 text-slate-300"}`}>
                  <span>{r === "final" ? "🏆" : ROUND_LABELS[r].split(" ").pop()}</span>
                  <span className="opacity-75">{picked}/{total}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between bg-slate-800/60 border border-yellow-500/20 rounded-xl px-4 py-3">
            <div>
              <p className="font-bold text-white">{ROUND_LABELS[activeRound]}</p>
              <p className="text-xs text-slate-400">
                {roundMatches[activeRound].filter(m => picks.has(m.slot)).length}/{ROUND_MATCH_COUNT[activeRound]} picked ·{" "}
                <span className="text-yellow-400">{ROUND_POINTS[activeRound]} pts</span> per correct pick
              </p>
            </div>
            {canEdit && (
              <button onClick={() => setViewMode("reorder")}
                className="text-xs px-3 py-1.5 rounded-full bg-slate-700 text-slate-300 font-bold">
                Enter results
              </button>
            )}
          </div>

          {loading
            ? <div className="flex flex-col gap-3">{[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-slate-800/50 rounded-xl animate-pulse" />)}</div>
            : <div className="flex flex-col gap-3">
                {roundMatches[activeRound].map((match) => (
                  <MatchCard key={match.slot} match={match} matchMap={matches} picks={picks}
                    playerPick={picks.get(match.slot) ?? null} isSaved={savedSlots.has(match.slot)}
                    locked={locked || !canEdit} adminMode={false}
                    onPick={savePick} onResult={saveActualResult} />
                ))}
              </div>
          }
          {!canEdit && !locked && (
            <p className="text-center text-xs text-orange-400">👁 View only — enter the PIN to submit picks</p>
          )}
        </>
      )}

      {/* ── BRACKET VIEW ─────────────────────────────────────────────────── */}
      {viewMode === "bracket" && (
        <BracketVisual matchMap={matches} picks={picks} />
      )}

      {/* ── REORDER + RESULT ENTRY (admin) ───────────────────────────────── */}
      {viewMode === "reorder" && canEdit && (
        <ReorderAndResults
          roundMatches={roundMatches}
          matchMap={matches}
          picks={picks}
          onSwap={swapMatches}
          onResult={saveActualResult}
          onPicksMode={() => setViewMode("picks")}
        />
      )}
    </div>
  );
}

// ── Match Card ────────────────────────────────────────────────────────────────

interface CardProps {
  match: BracketMatch;
  matchMap: Map<string, BracketMatch>;
  picks: Map<string, string>;
  playerPick: string | null;
  isSaved: boolean;
  locked: boolean;
  adminMode: boolean;
  onPick: (slot: string, winner: string) => void;
  onResult: (slot: string, winner: string) => void;
}

function MatchCard({ match, matchMap, picks, playerPick, isSaved, locked, adminMode, onPick, onResult }: CardProps) {
  const home = resolveTeam(match.slot, "home", matchMap, picks);
  const away = resolveTeam(match.slot, "away", matchMap, picks);
  const actual = match.actual_winner;

  return (
    <div className={`rounded-xl border p-4 transition-all
      ${actual && playerPick === actual ? "bg-green-900/20 border-green-500/40"
        : "bg-slate-800/70 border-yellow-500/20"}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-bold text-slate-500 uppercase">Match {match.position}</span>
        {actual && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">Result in</span>}
        {playerPick && isSaved && !actual && <span className="text-xs text-green-400">✓ Saved</span>}
      </div>

      <div className="flex flex-col gap-2">
        {([["home", home], ["away", away]] as const).map(([side, team]) => {
          const isPick = playerPick === team;
          const isWinner = actual === team;
          const isLoser = !!actual && !!team && team !== actual;
          return (
            <button key={side} disabled={locked || !team || !!actual}
              onClick={() => team && onPick(match.slot, team)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left w-full
                ${isWinner ? "bg-green-800/40 border-green-500/60 text-white"
                  : isPick && !actual ? "bg-yellow-400/20 border-yellow-400 text-white"
                  : isLoser ? "bg-slate-800/30 border-slate-700/20 text-slate-500"
                  : !team ? "bg-slate-800/20 border-slate-700/20 text-slate-600 cursor-default"
                  : locked || !!actual ? "bg-slate-800/40 border-slate-700/30 text-slate-300 cursor-default"
                  : "bg-slate-700/50 border-slate-600/50 text-slate-200 hover:border-yellow-500/50"}`}>
              <span className="text-2xl shrink-0">{flag(team)}</span>
              <span className="font-bold text-sm flex-1 truncate">{team ?? "TBD"}</span>
              {isWinner && <span className="text-green-400">🏆</span>}
              {isPick && !actual && <span className="text-yellow-400">✓</span>}
            </button>
          );
        })}
      </div>

      {actual && playerPick && (
        <p className={`text-xs mt-2 text-center font-semibold ${playerPick === actual ? "text-green-400" : "text-slate-500"}`}>
          {playerPick === actual ? `⭐ Correct! +${ROUND_POINTS[match.round]} pts` : `You picked ${flag(playerPick)} ${playerPick}`}
        </p>
      )}
    </div>
  );
}

// ── Visual Bracket ────────────────────────────────────────────────────────────

const UNIT = 60;
const CARD_H = 46;
const CARD_W = 118;
const COL_W = 148;
const ROUNDS_ORDER: KnockoutRound[] = ["r32", "r16", "qf", "sf", "final"];

function matchCenterY(round: KnockoutRound, pos: number) {
  const scale = Math.pow(2, ROUNDS_ORDER.indexOf(round));
  return (pos + 0.5) * scale * UNIT;
}
function matchTopY(round: KnockoutRound, pos: number) {
  return matchCenterY(round, pos) - CARD_H / 2;
}
function colX(round: KnockoutRound) {
  return ROUNDS_ORDER.indexOf(round) * COL_W;
}

function BracketVisual({ matchMap, picks }: { matchMap: Map<string, BracketMatch>; picks: Map<string, string> }) {
  const totalH = 16 * UNIT;
  const totalW = 5 * COL_W + CARD_W;

  const slots: Record<KnockoutRound, string[]> = {
    r32:   Array.from({ length: 16 }, (_, i) => `r32_${i + 1}`),
    r16:   Array.from({ length: 8 },  (_, i) => `r16_${i + 1}`),
    qf:    Array.from({ length: 4 },  (_, i) => `qf_${i + 1}`),
    sf:    Array.from({ length: 2 },  (_, i) => `sf_${i + 1}`),
    final: ["final"],
  };

  // SVG paths for bracket lines
  const lines: React.ReactNode[] = [];
  Object.entries(FEEDER).forEach(([slot, { home: hSlot, away: aSlot }]) => {
    const round = (slot === "final" ? "final" : slot.replace(/_\d+$/, "")) as KnockoutRound;
    const pos = slot === "final" ? 0 : parseInt(slot.split("_").pop()!) - 1;
    const prevRound = ROUNDS_ORDER[ROUNDS_ORDER.indexOf(round) - 1];
    const hPos = parseInt(hSlot.split("_").pop()!) - 1;
    const aPos = parseInt(aSlot.split("_").pop()!) - 1;

    const x1 = colX(prevRound) + CARD_W;
    const x2 = colX(round);
    const xMid = x1 + (x2 - x1) * 0.5;
    const yH = matchCenterY(prevRound, hPos);
    const yA = matchCenterY(prevRound, aPos);
    const yOut = matchCenterY(round, pos);

    lines.push(
      <g key={slot} stroke="#334155" strokeWidth={1.5} fill="none">
        <path d={`M ${x1} ${yH} H ${xMid}`} />
        <path d={`M ${x1} ${yA} H ${xMid}`} />
        <path d={`M ${xMid} ${yH} V ${yA}`} />
        <path d={`M ${xMid} ${yOut} H ${x2}`} />
      </g>
    );
  });

  return (
    <div className="overflow-auto rounded-xl border border-slate-700/40 bg-slate-900/60 p-2" style={{ maxHeight: "72vh" }}>
      <p className="text-xs text-slate-500 mb-2 text-center">← Scroll to see full bracket →</p>
      <div className="relative" style={{ width: totalW, height: totalH }}>
        <svg className="absolute inset-0 pointer-events-none" width={totalW} height={totalH}>
          {lines}
        </svg>

        {ROUNDS_ORDER.flatMap((round) =>
          slots[round].map((slot, i) => {
            const m = matchMap.get(slot);
            const home = resolveTeam(slot, "home", matchMap, picks);
            const away = resolveTeam(slot, "away", matchMap, picks);
            const pick = picks.get(slot);
            const actual = m?.actual_winner ?? null;

            return (
              <div key={slot} className="absolute rounded-lg overflow-hidden border border-slate-700 bg-slate-800"
                style={{ left: colX(round), top: matchTopY(round, i), width: CARD_W, height: CARD_H }}>
                {([home, away] as const).map((team, ti) => {
                  const isPick = pick === team;
                  const isWinner = actual === team;
                  const isLoser = !!actual && !!team && team !== actual;
                  return (
                    <div key={ti} className={`flex items-center gap-1 px-1.5 h-1/2 text-xs overflow-hidden
                      ${isWinner ? "bg-green-900/60 text-white font-black"
                        : isPick && !actual ? "bg-yellow-400/25 text-yellow-200 font-bold"
                        : isLoser ? "text-slate-600"
                        : "text-slate-300"}`}>
                      <span className="text-sm shrink-0">{flag(team)}</span>
                      <span className="truncate leading-none">{team ?? "TBD"}</span>
                      {isWinner && <span className="ml-auto shrink-0 text-xs">🏆</span>}
                      {isPick && !actual && <span className="ml-auto shrink-0 text-yellow-400 text-xs">✓</span>}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Reorder + Results ─────────────────────────────────────────────────────────

function ReorderAndResults({ roundMatches, matchMap, picks, onSwap, onResult, onPicksMode }: {
  roundMatches: Record<KnockoutRound, BracketMatch[]>;
  matchMap: Map<string, BracketMatch>;
  picks: Map<string, string>;
  onSwap: (a: string, b: string) => void;
  onResult: (slot: string, winner: string) => void;
  onPicksMode: () => void;
}) {
  const [activeRound, setActiveRound] = useState<KnockoutRound>("r32");
  const [resultMode, setResultMode] = useState(false);

  const current = roundMatches[activeRound];

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-yellow-400/10 border border-yellow-500/30 rounded-xl p-3">
        <p className="text-sm font-bold text-yellow-200 mb-1">👑 Admin mode</p>
        <p className="text-xs text-yellow-300/70">
          Use ↕ Reorder to fix the bracket order. Toggle "Enter results" to mark match winners.
        </p>
      </div>

      <div className="flex gap-2 items-center">
        <div className="flex gap-1 bg-slate-800 rounded-full p-1 flex-1">
          {ROUNDS.map((r) => (
            <button key={r} onClick={() => setActiveRound(r)}
              className={`flex-1 py-1 rounded-full text-xs font-bold transition-all
                ${activeRound === r ? "bg-yellow-400 text-black" : "text-slate-400"}`}>
              {r === "final" ? "🏆" : r.toUpperCase()}
            </button>
          ))}
        </div>
        <button onClick={() => setResultMode(v => !v)}
          className={`shrink-0 px-3 py-2 rounded-full text-xs font-bold transition-all
            ${resultMode ? "bg-red-500 text-white" : "bg-slate-700 text-slate-300"}`}>
          {resultMode ? "✓ Results" : "Results"}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {current.map((match, idx) => {
          const home = resolveTeam(match.slot, "home", matchMap, picks);
          const away = resolveTeam(match.slot, "away", matchMap, picks);
          const actual = match.actual_winner;

          return (
            <div key={match.slot} className="bg-slate-800/70 border border-slate-700/50 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-slate-400 font-bold">Match {match.position}</span>
                {actual && <span className="text-xs text-green-400">✓ {flag(actual)} {actual}</span>}
                {/* Reorder arrows — only R32 */}
                {activeRound === "r32" && (
                  <div className="ml-auto flex gap-1">
                    <button disabled={idx === 0}
                      onClick={() => onSwap(match.slot, current[idx - 1].slot)}
                      className="w-7 h-7 rounded-lg bg-slate-700 text-slate-300 flex items-center justify-center text-xs disabled:opacity-30 hover:bg-slate-600">
                      ↑
                    </button>
                    <button disabled={idx === current.length - 1}
                      onClick={() => onSwap(match.slot, current[idx + 1].slot)}
                      className="w-7 h-7 rounded-lg bg-slate-700 text-slate-300 flex items-center justify-center text-xs disabled:opacity-30 hover:bg-slate-600">
                      ↓
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                {([["home", home], ["away", away]] as const).map(([side, team]) => (
                  <div key={side} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                    ${resultMode && team ? "cursor-pointer hover:bg-yellow-400/20 border border-transparent hover:border-yellow-500/40" : ""}
                    ${actual === team ? "bg-green-800/30 border border-green-500/30" : "bg-slate-700/40"}`}
                    onClick={() => resultMode && team && onResult(match.slot, actual === team ? "" : team)}>
                    <span className="text-xl">{flag(team)}</span>
                    <span className={`font-bold flex-1 ${!team ? "text-slate-500" : "text-white"}`}>{team ?? "TBD"}</span>
                    {actual === team && <span className="text-green-400 text-xs font-bold">WINNER ✓</span>}
                    {resultMode && team && actual !== team && <span className="text-slate-500 text-xs">tap to mark</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <button onClick={onPicksMode}
        className="text-sm text-yellow-400 text-center py-2">
        ← Back to picks
      </button>
    </div>
  );
}

// ── R32 Setup ─────────────────────────────────────────────────────────────────

const ALL_48 = [
  { name: "Mexico", flag: "🇲🇽", group: "A" }, { name: "South Korea", flag: "🇰🇷", group: "A" },
  { name: "Czechia", flag: "🇨🇿", group: "A" }, { name: "South Africa", flag: "🇿🇦", group: "A" },
  { name: "Canada", flag: "🇨🇦", group: "B" }, { name: "Qatar", flag: "🇶🇦", group: "B" },
  { name: "Switzerland", flag: "🇨🇭", group: "B" }, { name: "Bosnia & Herzegovina", flag: "🇧🇦", group: "B" },
  { name: "Brazil", flag: "🇧🇷", group: "C" }, { name: "Morocco", flag: "🇲🇦", group: "C" },
  { name: "Haiti", flag: "🇭🇹", group: "C" }, { name: "Scotland", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", group: "C" },
  { name: "USA", flag: "🇺🇸", group: "D" }, { name: "Paraguay", flag: "🇵🇾", group: "D" },
  { name: "Australia", flag: "🇦🇺", group: "D" }, { name: "Türkiye", flag: "🇹🇷", group: "D" },
  { name: "Germany", flag: "🇩🇪", group: "E" }, { name: "Ivory Coast", flag: "🇨🇮", group: "E" },
  { name: "Ecuador", flag: "🇪🇨", group: "E" }, { name: "Curaçao", flag: "🇨🇼", group: "E" },
  { name: "Netherlands", flag: "🇳🇱", group: "F" }, { name: "Japan", flag: "🇯🇵", group: "F" },
  { name: "Sweden", flag: "🇸🇪", group: "F" }, { name: "Tunisia", flag: "🇹🇳", group: "F" },
  { name: "Belgium", flag: "🇧🇪", group: "G" }, { name: "Egypt", flag: "🇪🇬", group: "G" },
  { name: "Iran", flag: "🇮🇷", group: "G" }, { name: "New Zealand", flag: "🇳🇿", group: "G" },
  { name: "Spain", flag: "🇪🇸", group: "H" }, { name: "Uruguay", flag: "🇺🇾", group: "H" },
  { name: "Saudi Arabia", flag: "🇸🇦", group: "H" }, { name: "Cape Verde", flag: "🇨🇻", group: "H" },
  { name: "France", flag: "🇫🇷", group: "I" }, { name: "Senegal", flag: "🇸🇳", group: "I" },
  { name: "Norway", flag: "🇳🇴", group: "I" }, { name: "Iraq", flag: "🇮🇶", group: "I" },
  { name: "Argentina", flag: "🇦🇷", group: "J" }, { name: "Algeria", flag: "🇩🇿", group: "J" },
  { name: "Austria", flag: "🇦🇹", group: "J" }, { name: "Jordan", flag: "🇯🇴", group: "J" },
  { name: "Portugal", flag: "🇵🇹", group: "K" }, { name: "Colombia", flag: "🇨🇴", group: "K" },
  { name: "Congo DR", flag: "🇨🇩", group: "K" }, { name: "Uzbekistan", flag: "🇺🇿", group: "K" },
  { name: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", group: "L" }, { name: "Croatia", flag: "🇭🇷", group: "L" },
  { name: "Ghana", flag: "🇬🇭", group: "L" }, { name: "Panama", flag: "🇵🇦", group: "L" },
];

function R32Setup({ onSaved }: { onSaved: () => void }) {
  const [matchups, setMatchups] = useState<Record<string, { home: string; away: string }>>(
    Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`r32_${i + 1}`, { home: "", away: "" }]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(slot: string, side: "home" | "away", value: string) {
    setMatchups((prev) => ({ ...prev, [slot]: { ...prev[slot], [side]: value } }));
  }

  const allFilled = Object.values(matchups).every((m) => m.home && m.away);

  async function save() {
    if (!allFilled) return;
    setSaving(true); setError("");
    for (const [slot, { home, away }] of Object.entries(matchups)) {
      const { error: err } = await supabase.from("bracket_matches")
        .update({ home_team: home, away_team: away }).eq("slot", slot);
      if (err) { setError(`Failed on ${slot}: ${err.message}`); setSaving(false); return; }
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-yellow-400/10 border border-yellow-500/30 rounded-xl p-3 text-sm text-yellow-200">
        <p className="font-bold mb-1">👑 Enter the 16 R32 matchups in bracket order</p>
        <p className="text-xs text-yellow-300/80">Match 1 winner plays Match 2 winner in R16, Match 3 winner plays Match 4, etc.</p>
      </div>
      {Array.from({ length: 16 }, (_, i) => {
        const slot = `r32_${i + 1}`;
        const m = matchups[slot];
        return (
          <div key={slot} className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-3">
            <p className="text-xs font-bold text-slate-400 mb-2">Match {i + 1}</p>
            {(["home", "away"] as const).map((side) => (
              <select key={side} value={m[side]} onChange={(e) => set(slot, side, e.target.value)}
                className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white
                  focus:outline-none focus:border-yellow-400 w-full mb-2 last:mb-0">
                <option value="">— Select team —</option>
                {["A","B","C","D","E","F","G","H","I","J","K","L"].map((g) => (
                  <optgroup key={g} label={`Group ${g}`}>
                    {ALL_48.filter((t) => t.group === g).map((t) => (
                      <option key={t.name} value={t.name}>{t.flag} {t.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            ))}
          </div>
        );
      })}
      {error && <div className="bg-red-900/30 border border-red-500/40 rounded-xl p-3 text-xs text-red-300">{error}</div>}
      <button onClick={save} disabled={!allFilled || saving}
        className="bg-yellow-400 text-black font-black py-3 rounded-xl disabled:opacity-40 sticky bottom-24">
        {saving ? "Saving…" : allFilled ? "🚀 Open Bracket for Everyone" : "Fill all 16 matchups to continue"}
      </button>
    </div>
  );
}
