import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const API_KEY = process.env.FOOTBALL_DATA_API_KEY!;

const FLAGS: Record<string, string> = {
  "Mexico": "🇲🇽", "South Africa": "🇿🇦", "Korea Republic": "🇰🇷",
  "Czechia": "🇨🇿", "Czech Republic": "🇨🇿", "Canada": "🇨🇦",
  "Bosnia and Herzegovina": "🇧🇦", "Qatar": "🇶🇦", "Switzerland": "🇨🇭",
  "Brazil": "🇧🇷", "Morocco": "🇲🇦", "Haiti": "🇭🇹", "Scotland": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  "United States": "🇺🇸", "Paraguay": "🇵🇾", "Australia": "🇦🇺",
  "Turkey": "🇹🇷", "Türkiye": "🇹🇷", "Germany": "🇩🇪", "Curaçao": "🇨🇼",
  "Curacao": "🇨🇼", "Netherlands": "🇳🇱", "Japan": "🇯🇵",
  "Côte d'Ivoire": "🇨🇮", "Ivory Coast": "🇨🇮", "Ecuador": "🇪🇨",
  "Tunisia": "🇹🇳", "Sweden": "🇸🇪", "Spain": "🇪🇸", "Cape Verde": "🇨🇻",
  "Cabo Verde": "🇨🇻", "Belgium": "🇧🇪", "Egypt": "🇪🇬",
  "Saudi Arabia": "🇸🇦", "Uruguay": "🇺🇾", "Iran": "🇮🇷",
  "New Zealand": "🇳🇿", "France": "🇫🇷", "Senegal": "🇸🇳", "Iraq": "🇮🇶",
  "Norway": "🇳🇴", "Argentina": "🇦🇷", "Algeria": "🇩🇿", "Austria": "🇦🇹",
  "Jordan": "🇯🇴", "Portugal": "🇵🇹", "DR Congo": "🇨🇩",
  "Democratic Republic of Congo": "🇨🇩", "England": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "Croatia": "🇭🇷", "Ghana": "🇬🇭", "Panama": "🇵🇦",
  "Colombia": "🇨🇴", "Uzbekistan": "🇺🇿",
};

const NAME_MAP: Record<string, string> = {
  "Korea Republic": "South Korea",
  "Czech Republic": "Czechia",
  "Bosnia and Herzegovina": "Bosnia & Herzegovina",
  "United States": "USA",
  "Turkey": "Türkiye",
  "Côte d'Ivoire": "Ivory Coast",
  "Cabo Verde": "Cape Verde",
  "DR Congo": "Congo DR",
  "Democratic Republic of Congo": "Congo DR",
  "Curacao": "Curaçao",
};

function normalize(name: string): string {
  return NAME_MAP[name] ?? name;
}

export async function GET() {
  try {
    // Fetch standings to determine group stage qualifiers
    const res = await fetch(
      "https://api.football-data.org/v4/competitions/WC/standings?season=2026",
      { headers: { "X-Auth-Token": API_KEY }, cache: "no-store" }
    );

    if (!res.ok) {
      return NextResponse.json({ error: "API error", status: res.status }, { status: 502 });
    }

    const data = await res.json();
    const standings: StandingGroup[] = data.standings ?? [];

    const rows: { name: string; flag: string; group_letter: string }[] = [];
    const thirdPlaceTeams: { name: string; flag: string; group_letter: string; points: number; goalDiff: number; goalsFor: number }[] = [];

    standings.forEach((group) => {
      const letter = group.group?.replace("GROUP_", "") ?? "";
      const sorted = [...group.table].sort((a, b) => a.position - b.position);

      // Top 2 qualify automatically
      sorted.slice(0, 2).forEach((entry) => {
        const name = normalize(entry.team.name);
        rows.push({ name, flag: FLAGS[entry.team.name] ?? "🏳️", group_letter: letter });
      });

      // Collect 3rd place teams for best-of-8 selection
      if (sorted[2]) {
        const entry = sorted[2];
        const name = normalize(entry.team.name);
        thirdPlaceTeams.push({
          name,
          flag: FLAGS[entry.team.name] ?? "🏳️",
          group_letter: letter,
          points: entry.points,
          goalDiff: entry.goalDifference,
          goalsFor: entry.goalsFor,
        });
      }
    });

    // Best 8 third-place teams (by points, then GD, then GF)
    const best8 = thirdPlaceTeams
      .sort((a, b) =>
        b.points - a.points ||
        b.goalDiff - a.goalDiff ||
        b.goalsFor - a.goalsFor
      )
      .slice(0, 8)
      .map(({ name, flag, group_letter }) => ({ name, flag, group_letter }));

    const allTeams = [...rows, ...best8];

    if (allTeams.length > 0) {
      await supabase
        .from("qualified_teams")
        .upsert(allTeams, { onConflict: "name" });
    }

    return NextResponse.json({ qualified: allTeams.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

interface StandingGroup {
  group: string;
  table: {
    position: number;
    points: number;
    goalDifference: number;
    goalsFor: number;
    team: { name: string };
  }[];
}
