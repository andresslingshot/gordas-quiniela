"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FIXTURES } from "@/lib/fixtures";
import { supabase, Pick, Result } from "@/lib/supabase";
import { scorePickAgainstResult } from "@/lib/scoring";
import TimezoneToggle from "@/components/TimezoneToggle";
import { TZ, formatKickoff } from "@/lib/timezones";

interface EnrichedPick {
  match_id: number;
  home_score: number;
  away_score: number;
  result: Result | null;
  points: number;
}

export default function MyPicksPage() {
  const router = useRouter();
  const [player, setPlayer] = useState<string | null>(null);
  const [tz, setTz] = useState<TZ>("ET");
  const [picks, setPicks] = useState<EnrichedPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem("gq_player");
    if (!stored) { router.replace("/"); return; }
    setPlayer(stored);
    const tzStored = localStorage.getItem("gq_tz") as TZ | null;
    if (tzStored) setTz(tzStored);

    async function load() {
      const [picksRes, resultsRes] = await Promise.all([
        supabase.from("picks").select("match_id, home_score, away_score").eq("player_name", stored!),
        supabase.from("results").select("match_id, home_score, away_score, status"),
      ]);

      const rawPicks = (picksRes.data ?? []) as Pick[];
      const results = (resultsRes.data ?? []) as Result[];
      const resultMap = new Map(results.map((r) => [r.match_id, r]));

      let pts = 0;
      const enriched: EnrichedPick[] = rawPicks.map((p) => {
        const r = resultMap.get(p.match_id) ?? null;
        const points = r ? scorePickAgainstResult(p, r) : 0;
        pts += points;
        return { ...p, result: r, points };
      });

      enriched.sort((a, b) => a.match_id - b.match_id);
      setPicks(enriched);
      setTotal(pts);
      setLoading(false);
    }
    load();
  }, [router]);

  function handleTzChange(newTz: TZ) {
    setTz(newTz);
    localStorage.setItem("gq_tz", newTz);
  }

  if (!player) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-black gold-text">My Picks</h2>
          <p className="text-slate-400 text-sm">{player}</p>
        </div>
        <TimezoneToggle value={tz} onChange={handleTzChange} />
      </div>

      {/* Score summary */}
      <div className="bg-yellow-400/10 border border-yellow-500/30 rounded-xl p-4 flex items-center gap-4">
        <div className="text-5xl">🏅</div>
        <div>
          <p className="text-3xl font-black text-yellow-400">{total} pts</p>
          <p className="text-slate-400 text-sm">{picks.length} picks submitted</p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-800/50 animate-pulse" />
          ))}
        </div>
      ) : picks.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-5xl mb-3">📝</div>
          <p className="text-slate-400">No picks yet — head to ⚽ Picks to start!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {picks.map((pick) => {
            const match = FIXTURES.find((m) => m.id === pick.match_id);
            if (!match) return null;
            const hasResult = pick.result?.status === "FINISHED";
            return (
              <div
                key={pick.match_id}
                className={`rounded-xl border px-4 py-3
                  ${!hasResult ? "bg-slate-800/60 border-slate-700/40"
                    : pick.points === 3 ? "bg-green-900/30 border-green-500/40"
                    : pick.points === 1 ? "bg-blue-900/30 border-blue-500/40"
                    : "bg-slate-800/40 border-slate-700/30"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 mb-0.5">{formatKickoff(match.kickoffUTC, tz)} · Group {match.group}</p>
                    <p className="text-sm font-bold truncate">
                      {match.homeFlag} {match.homeTeam} vs {match.awayTeam} {match.awayFlag}
                    </p>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <p className="text-base font-black text-white">{pick.home_score}–{pick.away_score}</p>
                    {hasResult && pick.result && (
                      <>
                        <p className="text-xs text-slate-400">
                          Result: {pick.result.home_score}–{pick.result.away_score}
                        </p>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                          ${pick.points === 3 ? "bg-green-500/30 text-green-300"
                            : pick.points === 1 ? "bg-blue-500/30 text-blue-300"
                            : "bg-slate-600/50 text-slate-400"}`}>
                          {pick.points === 3 ? "⭐ +3" : pick.points === 1 ? "+1" : "0"}
                        </span>
                      </>
                    )}
                    {!hasResult && (
                      <span className="text-xs text-slate-500">Pending</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
