export type KnockoutRound = "r16" | "qf" | "sf" | "final" | "champion";

export const ROUNDS: KnockoutRound[] = ["r16", "qf", "sf", "final", "champion"];

export const ROUND_LABELS: Record<KnockoutRound, string> = {
  r16:      "Round of 16",
  qf:       "Quarterfinals",
  sf:       "Semifinals",
  final:    "Final",
  champion: "Champion 🏆",
};

export const ROUND_PICK_COUNT: Record<KnockoutRound, number> = {
  r16:      16,
  qf:       8,
  sf:       4,
  final:    2,
  champion: 1,
};

export const ROUND_POINTS: Record<KnockoutRound, number> = {
  r16:      2,
  qf:       4,
  sf:       6,
  final:    8,
  champion: 15,
};

// Bracket picks lock before first R32 match
export const BRACKET_LOCK_UTC = "2026-06-28T17:00:00Z";

export function isBracketLocked(): boolean {
  return new Date() >= new Date(BRACKET_LOCK_UTC);
}

export interface QualifiedTeam {
  name: string;
  flag: string;
  group_letter: string | null;
}

export interface BracketPick {
  player_name: string;
  team_name: string;
  round: KnockoutRound;
}

export interface KnockoutResult {
  team_name: string;
  round_reached: KnockoutRound;
}

// Rounds at or beyond a given round (i.e. team "reached" r16 means they also get r16 pts)
const ROUND_ORDER: KnockoutRound[] = ["r16", "qf", "sf", "final", "champion"];

export function roundIndex(r: KnockoutRound): number {
  return ROUND_ORDER.indexOf(r);
}

export interface BracketPlayerScore {
  playerName: string;
  bracketTotal: number;
  byRound: Record<KnockoutRound, number>;
}

export function calcBracketScores(
  picks: BracketPick[],
  results: KnockoutResult[]
): BracketPlayerScore[] {
  const resultMap = new Map<string, KnockoutRound>();
  results.forEach((r) => resultMap.set(r.team_name, r.round_reached));

  // Group picks by player
  const byPlayer = new Map<string, BracketPick[]>();
  picks.forEach((p) => {
    const arr = byPlayer.get(p.player_name) ?? [];
    arr.push(p);
    byPlayer.set(p.player_name, arr);
  });

  const scores: BracketPlayerScore[] = [];

  byPlayer.forEach((playerPicks, playerName) => {
    const byRound: Record<KnockoutRound, number> = {
      r16: 0, qf: 0, sf: 0, final: 0, champion: 0,
    };

    playerPicks.forEach((pick) => {
      const teamResult = resultMap.get(pick.team_name);
      if (!teamResult) return;
      // Team earns points if it reached AT LEAST the round picked
      if (roundIndex(teamResult) >= roundIndex(pick.round)) {
        byRound[pick.round] += ROUND_POINTS[pick.round];
      }
    });

    const bracketTotal = Object.values(byRound).reduce((a, b) => a + b, 0);
    scores.push({ playerName, bracketTotal, byRound });
  });

  return scores.sort((a, b) => b.bracketTotal - a.bracketTotal);
}
