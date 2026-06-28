export type KnockoutRound = "r32" | "r16" | "qf" | "sf" | "final";

export const ROUNDS: KnockoutRound[] = ["r32", "r16", "qf", "sf", "final"];

export const ROUND_LABELS: Record<KnockoutRound, string> = {
  r32:   "Round of 32",
  r16:   "Round of 16",
  qf:    "Quarterfinals",
  sf:    "Semifinals",
  final: "Final",
};

export const ROUND_MATCH_COUNT: Record<KnockoutRound, number> = {
  r32: 16, r16: 8, qf: 4, sf: 2, final: 1,
};

export const ROUND_POINTS: Record<KnockoutRound, number> = {
  r32: 2, r16: 4, qf: 6, sf: 8, final: 15,
};

export const BRACKET_LOCK_UTC = "2026-06-28T17:00:00Z";

export function isBracketLocked(): boolean {
  return new Date() >= new Date(BRACKET_LOCK_UTC);
}

// Which two slots feed into each later-round slot
export const FEEDER: Record<string, { home: string; away: string }> = {
  r16_1:  { home: "r32_1",  away: "r32_2"  },
  r16_2:  { home: "r32_3",  away: "r32_4"  },
  r16_3:  { home: "r32_5",  away: "r32_6"  },
  r16_4:  { home: "r32_7",  away: "r32_8"  },
  r16_5:  { home: "r32_9",  away: "r32_10" },
  r16_6:  { home: "r32_11", away: "r32_12" },
  r16_7:  { home: "r32_13", away: "r32_14" },
  r16_8:  { home: "r32_15", away: "r32_16" },
  qf_1:   { home: "r16_1",  away: "r16_2"  },
  qf_2:   { home: "r16_3",  away: "r16_4"  },
  qf_3:   { home: "r16_5",  away: "r16_6"  },
  qf_4:   { home: "r16_7",  away: "r16_8"  },
  sf_1:   { home: "qf_1",   away: "qf_2"   },
  sf_2:   { home: "qf_3",   away: "qf_4"   },
  final:  { home: "sf_1",   away: "sf_2"   },
};

export interface BracketMatch {
  slot: string;
  round: KnockoutRound;
  position: number;
  home_team: string | null;
  away_team: string | null;
  actual_winner: string | null;
}

export interface BracketPick {
  player_name: string;
  slot: string;
  picked_winner: string;
}

// Resolve which team appears as home/away for a slot given picks + actual results
export function resolveTeam(
  slot: string,
  side: "home" | "away",
  matches: Map<string, BracketMatch>,
  picks: Map<string, string> // slot → picked_winner
): string | null {
  const match = matches.get(slot);
  if (!match) return null;

  // For R32 matches, teams are set directly by admin
  if (match.round === "r32") {
    return side === "home" ? match.home_team : match.away_team;
  }

  // For later rounds, look at the feeder slot
  const feeders = FEEDER[slot];
  if (!feeders) return null;
  const feederSlot = side === "home" ? feeders.home : feeders.away;
  const feederMatch = matches.get(feederSlot);
  if (!feederMatch) return null;

  // Actual winner takes priority
  if (feederMatch.actual_winner) return feederMatch.actual_winner;
  // Player's pick is next
  return picks.get(feederSlot) ?? null;
}

// ── Scoring ──────────────────────────────────────────────────────────────────

export interface BracketPlayerScore {
  playerName: string;
  bracketTotal: number;
  correct: number;
}

export function calcBracketScores(
  picks: BracketPick[],
  matches: BracketMatch[]
): BracketPlayerScore[] {
  const matchMap = new Map(matches.map((m) => [m.slot, m]));

  const byPlayer = new Map<string, BracketPick[]>();
  picks.forEach((p) => {
    const arr = byPlayer.get(p.player_name) ?? [];
    arr.push(p);
    byPlayer.set(p.player_name, arr);
  });

  const scores: BracketPlayerScore[] = [];
  byPlayer.forEach((playerPicks, playerName) => {
    let total = 0;
    let correct = 0;
    playerPicks.forEach((pick) => {
      const match = matchMap.get(pick.slot);
      if (!match?.actual_winner) return;
      if (pick.picked_winner === match.actual_winner) {
        total += ROUND_POINTS[match.round];
        correct++;
      }
    });
    scores.push({ playerName, bracketTotal: total, correct });
  });

  return scores.sort((a, b) => b.bracketTotal - a.bracketTotal);
}
