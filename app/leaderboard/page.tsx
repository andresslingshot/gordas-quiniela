"use client";
import { useEffect, useState } from "react";
import { supabase, Pick, Result } from "@/lib/supabase";
import { calcLeaderboard, PlayerScore } from "@/lib/scoring";
import { calcBracketScores, BracketPlayerScore, BracketPick, KnockoutResult } from "@/lib/bracket";

const MEDALS = ["🥇", "🥈", "🥉"];

interface CombinedScore {
  playerName: string;
  groupTotal: number;
  bracketTotal: number;
  total: number;
  exact: number;
  outcome: number;
  played: number;
}

export default function LeaderboardPage() {
  const [board, setBoard] = useState<CombinedScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [currentPlayer, setCurrentPlayer] = useState<string | null>(null);
  const [view, setView] = useState<"combined" | "group" | "bracket">("combined");

  useEffect(() => {
    setCurrentPlayer(localStorage.getItem("gq_player"));
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      await Promise.all([
        fetch("/api/results").catch(() => {}),
        fetch("/api/knockout-results").catch(() => {}),
      ]);

      const [picksRes, resultsRes, bPicksRes, bResultsRes, playersRes] = await Promise.all([
        supabase.from("picks").select("player_name, match_id, home_score, away_score"),
        supabase.from("results").select("match_id, home_score, away_score, status"),
        supabase.from("bracket_picks").select("player_name, team_name, round"),
        supabase.from("knockout_results").select("team_name, round_reached"),
        supabase.from("players").select("name").order("created_at", { ascending: true }),
      ]);

      const picks = (picksRes.data ?? []) as Pick[];
      const results = (resultsRes.data ?? []) as Result[];
      const bPicks = (bPicksRes.data ?? []) as BracketPick[];
      const bResults = (bResultsRes.data ?? []) as KnockoutResult[];
      const allPlayers = (playersRes.data ?? []) as { name: string }[];

      const groupScores = calcLeaderboard(picks, results);
      const bracketScores = calcBracketScores(bPicks, bResults);

      const groupMap = new Map<string, PlayerScore>(groupScores.map((s) => [s.playerName, s]));
      const bracketMap = new Map<string, BracketPlayerScore>(bracketScores.map((s) => [s.playerName, s]));

      const combined: CombinedScore[] = allPlayers.map((p) => {
        const g = groupMap.get(p.name);
        const b = bracketMap.get(p.name);
        return {
          playerName: p.name,
          groupTotal: g?.total ?? 0,
          bracketTotal: b?.bracketTotal ?? 0,
          total: (g?.total ?? 0) + (b?.bracketTotal ?? 0),
          exact: g?.exact ?? 0,
          outcome: g?.outcome ?? 0,
          played: g?.played ?? 0,
        };
      });

      combined.sort((a, b) => b.total - a.total);
      setBoard(combined);
      setLastUpdated(new Date().toLocaleTimeString());
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black gold-text">Leaderboard</h2>
          {board.length > 0 && (
            <p className="text-xs text-slate-500">{board.length} player{board.length !== 1 ? "s" : ""} joined</p>
          )}
        </div>
        {lastUpdated && <span className="text-xs text-slate-500">Updated {lastUpdated}</span>}
      </div>

      {/* View toggle */}
      <div className="flex gap-1 bg-slate-800 rounded-full p-1">
        {(["combined", "group", "bracket"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 py-1.5 rounded-full text-xs font-bold transition-all capitalize
              ${view === v ? "bg-yellow-400 text-black" : "text-slate-400"}`}
          >
            {v === "combined" ? "Total" : v === "group" ? "⚽ Group" : "🗂️ Bracket"}
          </button>
        ))}
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
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {board.map((entry, idx) => {
            const pts = view === "combined" ? entry.total
              : view === "group" ? entry.groupTotal
              : entry.bracketTotal;
            return (
              <div
                key={entry.playerName}
                className={`rounded-xl border px-4 py-3 flex items-center gap-3
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
                  {view === "combined" && (
                    <p className="text-xs text-slate-500">
                      ⚽ {entry.groupTotal} + 🗂️ {entry.bracketTotal}
                    </p>
                  )}
                  {view === "group" && (
                    <p className="text-xs text-slate-500">
                      {entry.exact} exact · {entry.outcome} outcome · {entry.played} played
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-black text-yellow-400">{pts}</p>
                  <p className="text-xs text-slate-500">pts</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
        <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Scoring</p>
        <div className="flex flex-col gap-1 text-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mt-1">Group Stage</p>
          <div className="flex justify-between"><span className="text-white">Exact score</span><span className="text-yellow-400 font-bold">3 pts</span></div>
          <div className="flex justify-between"><span className="text-white">Correct outcome</span><span className="text-yellow-400 font-bold">1 pt</span></div>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mt-2">Bracket</p>
          <div className="flex justify-between"><span className="text-white">Makes Round of 16</span><span className="text-yellow-400 font-bold">2 pts</span></div>
          <div className="flex justify-between"><span className="text-white">Makes Quarterfinals</span><span className="text-yellow-400 font-bold">4 pts</span></div>
          <div className="flex justify-between"><span className="text-white">Makes Semifinals</span><span className="text-yellow-400 font-bold">6 pts</span></div>
          <div className="flex justify-between"><span className="text-white">Makes the Final</span><span className="text-yellow-400 font-bold">8 pts</span></div>
          <div className="flex justify-between"><span className="text-white">Wins the tournament 🏆</span><span className="text-yellow-400 font-bold">15 pts</span></div>
        </div>
      </div>
    </div>
  );
}
