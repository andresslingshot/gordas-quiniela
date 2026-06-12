import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { FIXTURES } from "@/lib/fixtures";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const API_KEY = process.env.FOOTBALL_DATA_API_KEY!;

// football-data.org team names → our names
const NAME_MAP: Record<string, string> = {
  "Mexico":                       "Mexico",
  "South Africa":                 "South Africa",
  "Korea Republic":               "South Korea",
  "Czechia":                      "Czechia",
  "Czech Republic":               "Czechia",
  "Canada":                       "Canada",
  "Bosnia and Herzegovina":       "Bosnia & Herzegovina",
  "Qatar":                        "Qatar",
  "Switzerland":                  "Switzerland",
  "Brazil":                       "Brazil",
  "Morocco":                      "Morocco",
  "Haiti":                        "Haiti",
  "Scotland":                     "Scotland",
  "United States":                "USA",
  "USA":                          "USA",
  "Paraguay":                     "Paraguay",
  "Australia":                    "Australia",
  "Turkey":                       "Türkiye",
  "Türkiye":                      "Türkiye",
  "Germany":                      "Germany",
  "Curaçao":                      "Curaçao",
  "Curacao":                      "Curaçao",
  "Netherlands":                  "Netherlands",
  "Japan":                        "Japan",
  "Côte d'Ivoire":                "Ivory Coast",
  "Ivory Coast":                  "Ivory Coast",
  "Ecuador":                      "Ecuador",
  "Tunisia":                      "Tunisia",
  "Sweden":                       "Sweden",
  "Spain":                        "Spain",
  "Cape Verde":                   "Cape Verde",
  "Cabo Verde":                   "Cape Verde",
  "Belgium":                      "Belgium",
  "Egypt":                        "Egypt",
  "Saudi Arabia":                 "Saudi Arabia",
  "Uruguay":                      "Uruguay",
  "Iran":                         "Iran",
  "New Zealand":                  "New Zealand",
  "France":                       "France",
  "Senegal":                      "Senegal",
  "Iraq":                         "Iraq",
  "Norway":                       "Norway",
  "Argentina":                    "Argentina",
  "Algeria":                      "Algeria",
  "Austria":                      "Austria",
  "Jordan":                       "Jordan",
  "Portugal":                     "Portugal",
  "DR Congo":                     "Congo DR",
  "Democratic Republic of Congo": "Congo DR",
  "Congo DR":                     "Congo DR",
  "England":                      "England",
  "Croatia":                      "Croatia",
  "Ghana":                        "Ghana",
  "Panama":                       "Panama",
  "Colombia":                     "Colombia",
  "Uzbekistan":                   "Uzbekistan",
};

function normalize(name: string): string {
  return NAME_MAP[name] ?? name;
}

// Build lookup: "HomeTeam|AwayTeam" → our match id
const FIXTURE_LOOKUP = new Map<string, number>();
FIXTURES.forEach((m) => {
  FIXTURE_LOOKUP.set(`${m.homeTeam}|${m.awayTeam}`, m.id);
});

export async function GET() {
  try {
    const res = await fetch(
      "https://api.football-data.org/v4/competitions/WC/matches?season=2026",
      { headers: { "X-Auth-Token": API_KEY }, cache: "no-store" }
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: "API error", status: res.status, body: text }, { status: 502 });
    }

    const data = await res.json();
    const matches: ApiMatch[] = data.matches ?? [];

    const rows: { match_id: number; home_score: number | null; away_score: number | null; status: string }[] = [];

    for (const m of matches) {
      if (m.status !== "FINISHED" && m.status !== "IN_PLAY") continue;

      const home = normalize(m.homeTeam?.name ?? "");
      const away = normalize(m.awayTeam?.name ?? "");
      const ourId = FIXTURE_LOOKUP.get(`${home}|${away}`);

      if (!ourId) continue; // couldn't match — skip

      rows.push({
        match_id: ourId,
        home_score: m.score?.fullTime?.home ?? null,
        away_score: m.score?.fullTime?.away ?? null,
        status: m.status,
      });
    }

    if (rows.length > 0) {
      await supabase
        .from("results")
        .upsert(rows, { onConflict: "match_id" });
    }

    return NextResponse.json({ updated: rows.length, total: matches.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

interface ApiMatch {
  id: number;
  status: string;
  homeTeam?: { name: string };
  awayTeam?: { name: string };
  score?: {
    fullTime?: { home: number | null; away: number | null };
  };
}
