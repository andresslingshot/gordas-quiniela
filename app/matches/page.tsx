"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FIXTURES, GROUPS, isLocked, Match } from "@/lib/fixtures";
import { supabase, Pick } from "@/lib/supabase";
import TimezoneToggle from "@/components/TimezoneToggle";
import { TZ, formatKickoff } from "@/lib/timezones";

type ScoreMap = Record<number, { home: string; away: string }>;

export default function MatchesPage() {
  const router = useRouter();
  const [player, setPlayer] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [tz, setTz] = useState<TZ>("ET");
  const [scores, setScores] = useState<ScoreMap>({});
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState<Set<number>>(new Set());
  const [activeGroup, setActiveGroup] = useState("A");

  useEffect(() => {
    const stored = localStorage.getItem("gq_player");
    if (!stored) { router.replace("/"); return; }
    setPlayer(stored);
    setCanEdit(localStorage.getItem("gq_can_edit") === "true");
    const tzStored = localStorage.getItem("gq_tz") as TZ | null;
    if (tzStored) setTz(tzStored);
  }, [router]);

  // load existing picks
  useEffect(() => {
    if (!player) return;
    supabase
      .from("picks")
      .select("match_id, home_score, away_score")
      .eq("player_name", player)
      .then(({ data }) => {
        if (!data) return;
        const map: ScoreMap = {};
        data.forEach((p: { match_id: number; home_score: number; away_score: number }) => {
          map[p.match_id] = {
            home: String(p.home_score),
            away: String(p.away_score),
          };
        });
        setScores(map);
        setSaved(new Set(data.map((p: { match_id: number }) => p.match_id)));
      });
  }, [player]);

  const handleTzChange = useCallback((newTz: TZ) => {
    setTz(newTz);
    localStorage.setItem("gq_tz", newTz);
  }, []);

  async function savePick(match: Match) {
    if (!player || !canEdit) return;
    const entry = scores[match.id];
    if (!entry) return;
    const h = parseInt(entry.home);
    const a = parseInt(entry.away);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) return;

    setSaving((s) => new Set(s).add(match.id));
    await supabase.from("picks").upsert(
      { player_name: player, match_id: match.id, home_score: h, away_score: a },
      { onConflict: "player_name,match_id" }
    );
    setSaving((s) => { const n = new Set(s); n.delete(match.id); return n; });
    setSaved((s) => new Set(s).add(match.id));
  }

  function setScore(matchId: number, side: "home" | "away", val: string) {
    const clean = val.replace(/[^0-9]/g, "").slice(0, 2);
    setScores((prev) => ({
      ...prev,
      [matchId]: { ...prev[matchId], [side]: clean },
    }));
    setSaved((s) => { const n = new Set(s); n.delete(matchId); return n; });
  }

  const groupMatches = FIXTURES.filter((m) => m.group === activeGroup);

  if (!player) return null;

  return (
    <div className="flex flex-col gap-4">
      {/* controls */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-xs text-slate-400">Playing as</p>
          <p className="font-bold text-white">{player}
            {canEdit
              ? <span className="ml-2 text-xs text-green-400 font-normal">✓ can submit</span>
              : <span className="ml-2 text-xs text-orange-400 font-normal">👁 view only</span>
            }
          </p>
        </div>
        <TimezoneToggle value={tz} onChange={handleTzChange} />
      </div>

      {/* group tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {GROUPS.map((g) => (
          <button
            key={g}
            onClick={() => setActiveGroup(g)}
            className={`shrink-0 w-9 h-9 rounded-full text-sm font-black transition-all
              ${activeGroup === g
                ? "bg-yellow-400 text-black"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* match cards */}
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((md) => {
          const mdMatches = groupMatches.filter((m) => m.matchday === md);
          if (!mdMatches.length) return null;
          return (
            <div key={md}>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Matchday {md}</p>
              <div className="flex flex-col gap-2">
                {mdMatches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    tz={tz}
                    scores={scores}
                    saved={saved}
                    saving={saving}
                    canEdit={canEdit}
                    onScoreChange={setScore}
                    onSave={savePick}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => {
          localStorage.removeItem("gq_player");
          localStorage.removeItem("gq_can_edit");
          router.push("/");
        }}
        className="text-xs text-slate-600 hover:text-slate-400 text-center mt-2"
      >
        Switch player
      </button>
    </div>
  );
}

// ── Match Card ────────────────────────────────────────────────────────────────

interface CardProps {
  match: Match;
  tz: TZ;
  scores: ScoreMap;
  saved: Set<number>;
  saving: Set<number>;
  canEdit: boolean;
  onScoreChange: (id: number, side: "home" | "away", val: string) => void;
  onSave: (match: Match) => void;
}

function MatchCard({ match, tz, scores, saved, saving, canEdit, onScoreChange, onSave }: CardProps) {
  const locked = isLocked(match);
  const entry = scores[match.id];
  const isSaved = saved.has(match.id);
  const isSaving = saving.has(match.id);
  const hasValues = entry && entry.home !== "" && entry.away !== "";

  return (
    <div className={`rounded-xl border p-4 transition-all
      ${locked
        ? "bg-slate-800/40 border-slate-700/50"
        : "bg-slate-800/80 border-yellow-500/20 hover:border-yellow-500/40"}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold
          ${locked ? "bg-red-900/60 text-red-300" : "bg-green-900/60 text-green-300"}`}>
          {locked ? "🔒 Locked" : "🟢 Open"}
        </span>
        <span className="text-xs text-slate-500">{formatKickoff(match.kickoffUTC, tz)}</span>
      </div>

      <div className="flex items-center gap-2">
        {/* Home */}
        <div className="flex-1 flex flex-col items-center gap-1">
          <span className="text-2xl">{match.homeFlag}</span>
          <span className="text-xs font-bold text-center leading-tight">{match.homeTeam}</span>
        </div>

        {/* Scores */}
        <div className="flex items-center gap-2">
          <ScoreInput
            value={entry?.home ?? ""}
            disabled={locked || !canEdit}
            onChange={(v) => onScoreChange(match.id, "home", v)}
          />
          <span className="text-slate-500 font-bold">–</span>
          <ScoreInput
            value={entry?.away ?? ""}
            disabled={locked || !canEdit}
            onChange={(v) => onScoreChange(match.id, "away", v)}
          />
        </div>

        {/* Away */}
        <div className="flex-1 flex flex-col items-center gap-1">
          <span className="text-2xl">{match.awayFlag}</span>
          <span className="text-xs font-bold text-center leading-tight">{match.awayTeam}</span>
        </div>
      </div>

      {/* Save button */}
      {canEdit && !locked && (
        <div className="mt-3 flex justify-center">
          <button
            onClick={() => onSave(match)}
            disabled={!hasValues || isSaving || isSaved}
            className={`text-xs px-4 py-1.5 rounded-full font-bold transition-all
              ${isSaved
                ? "bg-green-800/50 text-green-300 cursor-default"
                : hasValues
                  ? "bg-yellow-400 text-black hover:bg-yellow-300"
                  : "bg-slate-700 text-slate-500 cursor-not-allowed"}`}
          >
            {isSaving ? "Saving…" : isSaved ? "✓ Saved" : "Save Pick"}
          </button>
        </div>
      )}
    </div>
  );
}

function ScoreInput({
  value, disabled, onChange,
}: {
  value: string; disabled: boolean; onChange: (v: string) => void;
}) {
  return (
    <input
      type="number"
      min={0}
      max={99}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      placeholder="–"
      className={`w-12 h-12 text-center text-xl font-black rounded-xl border transition-all
        ${disabled
          ? "bg-slate-700/40 border-slate-700 text-slate-500 cursor-not-allowed"
          : "bg-slate-700 border-slate-500 text-white focus:border-yellow-400 focus:outline-none"}`}
    />
  );
}
