import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

const STAGE_MAP: Record<string, string> = {
  "ROUND_OF_32":    "r32",
  "ROUND_OF_16":    "r16",
  "QUARTER_FINALS": "qf",
  "SEMI_FINALS":    "sf",
  "FINAL":          "final",
};

export async function GET() {
  try {
    const res = await fetch(
      "https://api.football-data.org/v4/competitions/WC/matches?season=2026",
      { headers: { "X-Auth-Token": API_KEY }, cache: "no-store" }
    );
    if (!res.ok) return NextResponse.json({ error: "API error" }, { status: 502 });

    const data = await res.json();
    const apiMatches: ApiMatch[] = data.matches ?? [];

    // Fetch our bracket_matches to find which slot each match belongs to
    const { data: slots } = await supabase
      .from("bracket_matches")
      .select("slot, round, position, home_team, away_team");

    const slotList = (slots ?? []) as { slot: string; round: string; position: number; home_team: string | null; away_team: string | null }[];

    const updates: { slot: string; actual_winner: string }[] = [];

    for (const m of apiMatches) {
      const round = STAGE_MAP[m.stage];
      if (!round || m.status !== "FINISHED") continue;

      const winner = getWinner(m);
      if (!winner) continue;

      const home = normalize(m.homeTeam?.name ?? "");
      const away = normalize(m.awayTeam?.name ?? "");

      // Match by teams
      const slot = slotList.find(
        (s) => s.round === round && s.home_team === home && s.away_team === away
      );
      if (!slot) continue;

      updates.push({ slot: slot.slot, actual_winner: normalize(winner) });
    }

    for (const u of updates) {
      await supabase.from("bracket_matches").update({ actual_winner: u.actual_winner }).eq("slot", u.slot);
    }

    return NextResponse.json({ updated: updates.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

function getWinner(m: ApiMatch): string | null {
  const h = m.score?.fullTime?.home;
  const a = m.score?.fullTime?.away;
  if (h === null || h === undefined || a === null || a === undefined) return null;
  if (h > a) return m.homeTeam?.name ?? null;
  if (a > h) return m.awayTeam?.name ?? null;
  const ph = m.score?.penalties?.home;
  const pa = m.score?.penalties?.away;
  if (ph != null && pa != null) return ph > pa ? (m.homeTeam?.name ?? null) : (m.awayTeam?.name ?? null);
  return null;
}

interface ApiMatch {
  stage: string; status: string;
  homeTeam?: { name: string }; awayTeam?: { name: string };
  score?: {
    fullTime?: { home: number | null; away: number | null };
    penalties?: { home: number | null; away: number | null };
  };
}
