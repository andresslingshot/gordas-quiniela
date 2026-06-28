"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ROUNDS, ROUND_LABELS, ROUND_MATCH_COUNT, ROUND_POINTS,
  isBracketLocked, BRACKET_LOCK_UTC,
  FEEDER, BracketMatch, BracketPick, KnockoutRound, resolveTeam,
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

export default function BracketPage() {
  const router = useRouter();
  const [player, setPlayer] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [matches, setMatches] = useState<Map<string, BracketMatch>>(new Map());
  const [picks, setPicks] = useState<Map<string, string>>(new Map()); // slot → picked winner
  const [activeRound, setActiveRound] = useState<KnockoutRound>("r32");
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

  const roundMatches = ROUNDS.reduce((acc, r) => {
    const count = ROUND_MATCH_COUNT[r];
    acc[r] = Array.from({ length: count }, (_, i) => {
      const slot = r === "final" ? "final" : `${r}_${i + 1}`;
      return matches.get(slot) ?? { slot, round: r, position: i + 1, home_team: null, away_team: null, actual_winner: null };
    });
    return acc;
  }, {} as Record<KnockoutRound, BracketMatch[]>);

  const r32Ready = roundMatches.r32.some((m) => m.home_team !== null);

  const picksThisRound = roundMatches[activeRound].filter((m) => picks.has(m.slot)).length;
  const totalThisRound = ROUND_MATCH_COUNT[activeRound];

  if (!player) return null;

  // ── Setup needed ──────────────────────────────────────────────────────────
  if (!loading && !r32Ready) {
    return (
      <div className="flex flex-col gap-6 py-4">
        <div className="text-center">
          <div className="text-5xl mb-3">🗂️</div>
          <h2 className="text-2xl font-black gold-text mb-1">Bracket Setup</h2>
          <p className="text-slate-400 text-sm">
            Picks lock {formatKickoff(BRACKET_LOCK_UTC, "ET")} ET
          </p>
        </div>
        {canEdit ? (
          <R32Setup
            qualifiedTeams={Object.values(Object.fromEntries(
              Array.from(matches.values())
                .filter((m) => m.round === "r32" && m.home_team)
                .flatMap((m) => [[m.home_team!, m.home_team!], [m.away_team!, m.away_team!]])
            ))}
            onSaved={async () => {
              const { data } = await supabase.from("bracket_matches").select("*").order("position");
              const mMap = new Map<string, BracketMatch>();
              (data ?? []).forEach((m: BracketMatch) => mMap.set(m.slot, m));
              setMatches(mMap);
            }}
          />
        ) : (
          <p className="text-center text-slate-400 text-sm">
            The organizer is setting up the bracket — check back soon!
          </p>
        )}
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
            {locked ? "🔒 Picks locked" : `Picks lock ${formatKickoff(BRACKET_LOCK_UTC, "ET")} ET`}
          </p>
        </div>
        {saving && <span className="text-xs text-yellow-400 animate-pulse">Saving…</span>}
      </div>

      {/* Round tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {ROUNDS.map((r) => {
          const picked = roundMatches[r].filter((m) => picks.has(m.slot)).length;
          const total = ROUND_MATCH_COUNT[r];
          const complete = picked === total;
          return (
            <button
              key={r}
              onClick={() => setActiveRound(r)}
              className={`shrink-0 flex flex-col items-center px-3 py-2 rounded-xl text-xs font-bold transition-all
                ${activeRound === r
                  ? "bg-yellow-400 text-black"
                  : complete
                    ? "bg-green-800/60 text-green-300"
                    : "bg-slate-700 text-slate-300"}`}
            >
              <span>{r === "final" ? "🏆" : ROUND_LABELS[r].split(" ").pop()}</span>
              <span className="opacity-75">{picked}/{total}</span>
            </button>
          );
        })}
      </div>

      {/* Round header */}
      <div className="flex items-center justify-between bg-slate-800/60 border border-yellow-500/20 rounded-xl px-4 py-3">
        <div>
          <p className="font-bold text-white">{ROUND_LABELS[activeRound]}</p>
          <p className="text-xs text-slate-400">
            {picksThisRound}/{totalThisRound} picked ·{" "}
            <span className="text-yellow-400">{ROUND_POINTS[activeRound]} pts</span> per correct pick
          </p>
        </div>
      </div>

      {/* Match cards */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-slate-800/50 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {roundMatches[activeRound].map((match) => (
            <MatchCard
              key={match.slot}
              match={match}
              matches={matches}
              playerPick={picks.get(match.slot) ?? null}
              isSaved={savedSlots.has(match.slot)}
              locked={locked || !canEdit}
              onPick={savePick}
            />
          ))}
        </div>
      )}

      {/* Round navigation */}
      <div className="flex justify-between mt-1">
        <button
          onClick={() => setActiveRound(ROUNDS[ROUNDS.indexOf(activeRound) - 1])}
          disabled={activeRound === "r32"}
          className="text-sm text-slate-400 hover:text-white disabled:opacity-30 px-3 py-1.5 rounded-lg"
        >
          ← Previous
        </button>
        <button
          onClick={() => setActiveRound(ROUNDS[ROUNDS.indexOf(activeRound) + 1])}
          disabled={activeRound === "final"}
          className="text-sm text-yellow-400 hover:text-yellow-300 disabled:opacity-30 px-3 py-1.5 rounded-lg font-semibold"
        >
          Next →
        </button>
      </div>

      {!canEdit && !locked && (
        <p className="text-center text-xs text-orange-400">
          👁 View only — enter the PIN on the home page to submit picks
        </p>
      )}
    </div>
  );
}

// ── Match Card ────────────────────────────────────────────────────────────────

interface CardProps {
  match: BracketMatch;
  matches: Map<string, BracketMatch>;
  playerPick: string | null;
  isSaved: boolean;
  locked: boolean;
  onPick: (slot: string, winner: string) => void;
}

function MatchCard({ match, matches, playerPick, isSaved, locked, onPick }: CardProps) {
  const home = resolveTeam(match.slot, "home", matches, new Map());
  const away = resolveTeam(match.slot, "away", matches, new Map());

  const actual = match.actual_winner;
  const hasResult = !!actual;

  function scoreClass(team: string | null) {
    if (!hasResult || !team) return "";
    if (team === actual) return "text-green-400";
    return "text-slate-500";
  }

  return (
    <div className={`rounded-xl border p-4 transition-all
      ${hasResult
        ? playerPick === actual
          ? "bg-green-900/20 border-green-500/40"
          : playerPick
            ? "bg-slate-800/40 border-slate-700/30"
            : "bg-slate-800/40 border-slate-700/30"
        : "bg-slate-800/70 border-yellow-500/20"}`}
    >
      {/* Match label */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-bold text-slate-500 uppercase">
          Match {match.position}
        </span>
        {hasResult && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
            ✓ Result in
          </span>
        )}
        {playerPick && isSaved && !hasResult && (
          <span className="text-xs text-green-400">✓ Saved</span>
        )}
      </div>

      {/* Teams */}
      <div className="flex flex-col gap-2">
        {[
          { team: home, side: "home" as const },
          { team: away, side: "away" as const },
        ].map(({ team, side }) => {
          const isPick = playerPick === team;
          const isWinner = actual === team;
          const isLoser = hasResult && team && team !== actual;
          const tbd = !team;

          return (
            <button
              key={side}
              disabled={locked || tbd || hasResult}
              onClick={() => team && onPick(match.slot, team)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left w-full
                ${isWinner
                  ? "bg-green-800/40 border-green-500/60 text-white"
                  : isPick && !hasResult
                    ? "bg-yellow-400/20 border-yellow-400 text-white"
                    : isLoser
                      ? "bg-slate-800/30 border-slate-700/20 text-slate-500"
                      : tbd
                        ? "bg-slate-800/20 border-slate-700/20 text-slate-600 cursor-default"
                        : locked || hasResult
                          ? "bg-slate-800/40 border-slate-700/30 text-slate-300 cursor-default"
                          : "bg-slate-700/50 border-slate-600/50 text-slate-200 hover:border-yellow-500/50 hover:bg-slate-700/80"}`}
            >
              <span className="text-2xl shrink-0">{team ? (FLAGS[team] ?? "🏳️") : "❓"}</span>
              <span className={`font-bold text-sm ${scoreClass(team)}`}>
                {team ?? "TBD"}
              </span>
              {isWinner && <span className="ml-auto text-green-400 font-bold">🏆</span>}
              {isPick && !hasResult && <span className="ml-auto text-yellow-400">✓</span>}
            </button>
          );
        })}
      </div>

      {/* Score feedback */}
      {hasResult && playerPick && (
        <p className={`text-xs mt-2 text-center font-semibold
          ${playerPick === actual ? "text-green-400" : "text-slate-500"}`}>
          {playerPick === actual
            ? `⭐ Correct! +${ROUND_POINTS[match.round]} pts`
            : `You picked ${FLAGS[playerPick] ?? ""} ${playerPick}`}
        </p>
      )}
    </div>
  );
}

// ── R32 Setup (admin only) ────────────────────────────────────────────────────

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

function R32Setup({ onSaved }: { qualifiedTeams: string[]; onSaved: () => void }) {
  const [matchups, setMatchups] = useState<Record<string, { home: string; away: string }>>(
    Object.fromEntries(
      Array.from({ length: 16 }, (_, i) => [`r32_${i + 1}`, { home: "", away: "" }])
    )
  );
  const [saving, setSaving] = useState(false);

  function set(slot: string, side: "home" | "away", value: string) {
    setMatchups((prev) => ({ ...prev, [slot]: { ...prev[slot], [side]: value } }));
  }

  const allFilled = Object.values(matchups).every((m) => m.home && m.away);

  async function save() {
    if (!allFilled) return;
    setSaving(true);
    const rows = Object.entries(matchups).map(([slot, { home, away }]) => ({
      slot,
      home_team: home,
      away_team: away,
    }));
    await supabase.from("bracket_matches").upsert(rows, { onConflict: "slot" });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-yellow-400/10 border border-yellow-500/30 rounded-xl p-3 text-sm text-yellow-200">
        <p className="font-bold mb-1">👑 Admin: Set up the R32 bracket</p>
        <p className="text-xs text-yellow-300/80">
          Enter the 16 Round of 32 matchups. Use the official FIFA bracket order.
          Players will then pick winners round by round.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {Array.from({ length: 16 }, (_, i) => {
          const slot = `r32_${i + 1}`;
          const m = matchups[slot];
          return (
            <div key={slot} className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-3">
              <p className="text-xs font-bold text-slate-400 mb-2">Match {i + 1}</p>
              <div className="flex flex-col gap-2">
                {(["home", "away"] as const).map((side) => (
                  <select
                    key={side}
                    value={m[side]}
                    onChange={(e) => set(slot, side, e.target.value)}
                    className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white
                      focus:outline-none focus:border-yellow-400 w-full"
                  >
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
            </div>
          );
        })}
      </div>

      <button
        onClick={save}
        disabled={!allFilled || saving}
        className="bg-yellow-400 text-black font-black py-3 rounded-xl disabled:opacity-40 sticky bottom-24"
      >
        {saving ? "Saving…" : allFilled ? "🚀 Open Bracket for Everyone" : `Fill all 16 matchups to continue`}
      </button>
    </div>
  );
}
