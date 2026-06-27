import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { KnockoutRound } from "@/lib/bracket";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const API_KEY = process.env.FOOTBALL_DATA_API_KEY!;

const NAME_MAP: Record<string, string> = {
  "Korea Republic": "South Korea", "Czech Republic": "Czechia",
  "Bosnia and Herzegovina": "Bosnia & Herzegovina", "United States": "USA",
  "Turkey": "Türkiye", "Côte d'Ivoire": "Ivory Coast",
  "Cabo Verde": "Cape Verde", "DR Congo": "Congo DR",
  "Democratic Republic of Congo": "Congo DR", "Curacao": "Curaçao",
};
function normalize(name: string): string { return NAME_MAP[name] ?? name; }

const STAGE_TO_ROUND: Record<string, KnockoutRound> = {
  "ROUND_OF_16":    "r16",
  "QUARTER_FINALS": "qf",
  "SEMI_FINALS":    "sf",
  "FINAL":          "final",
};

const ROUND_ORDER: KnockoutRound[] = ["r16", "qf", "sf", "final", "champion"];

export async function GET() {
  try {
    const res = await fetch(
      "https://api.football-data.org/v4/competitions/WC/matches?season=2026",
      { headers: { "X-Auth-Token": API_KEY }, cache: "no-store" }
    );
    if (!res.ok) return NextResponse.json({ error: "API error" }, { status: 502 });

    const data = await res.json();
    const matches: ApiMatch[] = data.matches ?? [];

    // Track the furthest round each team has reached
    const teamProgress = new Map<string, KnockoutRound>();

    for (const m of matches) {
      const round = STAGE_TO_ROUND[m.stage];
      if (!round || m.status !== "FINISHED") continue;

      const winner = getWinner(m);
      const loser = getLoser(m);
      if (!winner || !loser) continue;

      const winnerName = normalize(winner);
      const loserName = normalize(loser);

      // Winner advances — update if this round is further than recorded
      const winnerCurrent = teamProgress.get(winnerName);
      if (!winnerCurrent || ROUND_ORDER.indexOf(round) > ROUND_ORDER.indexOf(winnerCurrent)) {
        // Winner reached at least this round; if it's the final, they're champion
        const nextRound = round === "final" ? "champion" : round;
        teamProgress.set(winnerName, nextRound);
      }

      // Loser's furthest round is this round
      const loserCurrent = teamProgress.get(loserName);
      if (!loserCurrent || ROUND_ORDER.indexOf(round) > ROUND_ORDER.indexOf(loserCurrent)) {
        teamProgress.set(loserName, round);
      }
    }

    const rows = Array.from(teamProgress.entries()).map(([team_name, round_reached]) => ({
      team_name,
      round_reached,
    }));

    if (rows.length > 0) {
      await supabase
        .from("knockout_results")
        .upsert(rows, { onConflict: "team_name" });
    }

    return NextResponse.json({ updated: rows.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

function getWinner(m: ApiMatch): string | null {
  if (!m.score?.fullTime) return null;
  const { home, away } = m.score.fullTime;
  if (home === null || away === null) return null;
  if (home > away) return m.homeTeam?.name ?? null;
  if (away > home) return m.awayTeam?.name ?? null;
  // Penalty shootout winner
  if (m.score.penalties) {
    const { home: ph, away: pa } = m.score.penalties;
    if (ph !== null && pa !== null) return ph > pa ? (m.homeTeam?.name ?? null) : (m.awayTeam?.name ?? null);
  }
  return null;
}

function getLoser(m: ApiMatch): string | null {
  const winner = getWinner(m);
  if (!winner) return null;
  return winner === m.homeTeam?.name ? (m.awayTeam?.name ?? null) : (m.homeTeam?.name ?? null);
}

interface ApiMatch {
  stage: string;
  status: string;
  homeTeam?: { name: string };
  awayTeam?: { name: string };
  score?: {
    fullTime?: { home: number | null; away: number | null };
    penalties?: { home: number | null; away: number | null };
  };
}
