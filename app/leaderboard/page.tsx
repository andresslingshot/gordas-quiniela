"use client";
import { useEffect, useState } from "react";
import { supabase, Pick, Result } from "@/lib/supabase";
import { calcLeaderboard, PlayerScore } from "@/lib/scoring";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const [board, setBoard] = useState<PlayerScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [currentPlayer, setCurrentPlayer] = useState<string | null>(null);

  useEffect(() => {
    setCurrentPlayer(localStorage.getItem("gq_player"));
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      // Refresh results from football-data.org via our API route
      await fetch("/api/results").catch(() => {});

      const [picksRes, resultsRes] = await Promise.all([
        supabase.from("picks").select("player_name, match_id, home_score, away_score"),
        supabase.from("results").select("match_id, home_score, away_score, status"),
      ]);

      const picks = (picksRes.data ?? []) as Pick[];
      const results = (resultsRes.data ?? []) as Result[];

      setBoard(calcLeaderboard(picks, results));
      setLastUpdated(new Date().toLocaleTimeString());
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black gold-text">Leaderboard</h2>
        {lastUpdated && (
          <span className="text-xs text-slate-500">Updated {lastUpdated}</span>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-800/50 animate-pulse" />
          ))}
        </div>
      ) : board.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-slate-400">No results yet — check back after the first match!</p>
          <p className="text-slate-600 text-sm mt-1">Kick-off is June 11 🚀</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {board.map((entry, idx) => (
            <div
              key={entry.playerName}
              className={`rounded-xl border px-4 py-3 flex items-center gap-3 transition-all
                ${entry.playerName === currentPlayer
                  ? "bg-yellow-400/10 border-yellow-500/50"
                  : "bg-slate-800/60 border-slate-700/50"}`}
            >
              <span className="text-2xl w-8 text-center shrink-0">
                {MEDALS[idx] ?? <span className="text-slate-500 text-base font-bold">{idx + 1}</span>}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`font-black truncate ${entry.playerName === currentPlayer ? "text-yellow-300" : "text-white"}`}>
                  {entry.playerName}
                  {entry.playerName === currentPlayer && <span className="ml-1 text-xs font-normal text-yellow-500">(you)</span>}
                </p>
                <p className="text-xs text-slate-500">
                  {entry.exact} exact · {entry.outcome} outcome · {entry.played} played
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-black text-yellow-400">{entry.total}</p>
                <p className="text-xs text-slate-500">pts</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
        <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Scoring</p>
        <div className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between"><span className="text-white">Exact score</span><span className="text-yellow-400 font-bold">3 pts</span></div>
          <div className="flex justify-between"><span className="text-white">Correct outcome</span><span className="text-yellow-400 font-bold">1 pt</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Wrong</span><span className="text-slate-500 font-bold">0 pts</span></div>
        </div>
      </div>
    </div>
  );
}
