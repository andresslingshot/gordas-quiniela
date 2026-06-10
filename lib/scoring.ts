import { Pick, Result } from "./supabase";

function outcome(home: number, away: number): "H" | "D" | "A" {
  if (home > away) return "H";
  if (home < away) return "A";
  return "D";
}

export function scorePickAgainstResult(pick: Pick, result: Result): number {
  if (result.home_score === null || result.away_score === null) return 0;
  if (result.status !== "FINISHED") return 0;

  const exactMatch =
    pick.home_score === result.home_score &&
    pick.away_score === result.away_score;
  if (exactMatch) return 3;

  const correctOutcome =
    outcome(pick.home_score, pick.away_score) ===
    outcome(result.home_score, result.away_score);
  if (correctOutcome) return 1;

  return 0;
}

export interface PlayerScore {
  playerName: string;
  total: number;
  exact: number;
  outcome: number;
  played: number;
}

export function calcLeaderboard(
  picks: Pick[],
  results: Result[]
): PlayerScore[] {
  const resultMap = new Map<number, Result>();
  results.forEach((r) => resultMap.set(r.match_id, r));

  const scoreMap = new Map<string, PlayerScore>();

  picks.forEach((pick) => {
    const result = resultMap.get(pick.match_id);
    if (!result || result.status !== "FINISHED") return;

    const pts = scorePickAgainstResult(pick, result);
    const prev = scoreMap.get(pick.player_name) ?? {
      playerName: pick.player_name,
      total: 0,
      exact: 0,
      outcome: 0,
      played: 0,
    };

    scoreMap.set(pick.player_name, {
      playerName: pick.player_name,
      total: prev.total + pts,
      exact: prev.exact + (pts === 3 ? 1 : 0),
      outcome: prev.outcome + (pts === 1 ? 1 : 0),
      played: prev.played + 1,
    });
  });

  return [...scoreMap.values()].sort((a, b) => b.total - a.total);
}
