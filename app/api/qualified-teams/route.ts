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
  "Korea Republic": "South Korea", "Czech Republic": "Czechia",
  "Bosnia and Herzegovina": "Bosnia & Herzegovina", "United States": "USA",
  "Turkey": "Türkiye", "Côte d'Ivoire": "Ivory Coast",
  "Cabo Verde": "Cape Verde", "DR Congo": "Congo DR",
  "Democratic Republic of Congo": "Congo DR", "Curacao": "Curaçao",
};
function normalize(name: string): string { return NAME_MAP[name] ?? name; }

export async function GET() {
  const log: string[] = [];

  try {
    // Strategy 1: fetch R32 matches — teams are listed once bracket is set
    log.push("Trying R32 matches endpoint...");
    const r32Res = await fetch(
      "https://api.football-data.org/v4/competitions/WC/matches?season=2026&stage=ROUND_OF_32",
      { headers: { "X-Auth-Token": API_KEY }, cache: "no-store" }
    );

    if (r32Res.ok) {
      const r32Data = await r32Res.json();
      const r32Matches: ApiMatch[] = r32Data.matches ?? [];
      log.push(`R32 matches found: ${r32Matches.length}`);

      const teamSet = new Set<string>();
      r32Matches.forEach((m) => {
        if (m.homeTeam?.name) teamSet.add(m.homeTeam.name);
        if (m.awayTeam?.name) teamSet.add(m.awayTeam.name);
      });

      if (teamSet.size >= 28) {
        const rows = Array.from(teamSet).map((rawName) => {
          const name = normalize(rawName);
          return { name, flag: FLAGS[rawName] ?? FLAGS[name] ?? "🏳️", group_letter: null };
        });

        await supabase.from("qualified_teams").upsert(rows, { onConflict: "name" });
        return NextResponse.json({ method: "r32_matches", qualified: rows.length, log });
      }
      log.push(`Not enough teams in R32 yet (${teamSet.size}), trying standings...`);
    } else {
      log.push(`R32 endpoint failed: ${r32Res.status}`);
    }

    // Strategy 2: standings
    log.push("Trying standings endpoint...");
    const standRes = await fetch(
      "https://api.football-data.org/v4/competitions/WC/standings?season=2026",
      { headers: { "X-Auth-Token": API_KEY }, cache: "no-store" }
    );

    if (!standRes.ok) {
      const body = await standRes.text();
      log.push(`Standings failed: ${standRes.status} ${body}`);
      return NextResponse.json({ error: "Both endpoints failed", log }, { status: 502 });
    }

    const standData = await standRes.json();
    const standings: StandingGroup[] = standData.standings ?? [];
    log.push(`Standing groups found: ${standings.length}`);

    const rows: { name: string; flag: string; group_letter: string }[] = [];
    const thirdPlace: { name: string; flag: string; group_letter: string; pts: number; gd: number; gf: number }[] = [];

    standings.forEach((group) => {
      const letter = group.group?.replace("GROUP_", "") ?? "";
      const sorted = [...group.table].sort((a, b) => a.position - b.position);

      sorted.slice(0, 2).forEach((entry) => {
        const name = normalize(entry.team.name);
        rows.push({ name, flag: FLAGS[entry.team.name] ?? "🏳️", group_letter: letter });
      });

      if (sorted[2]) {
        const e = sorted[2];
        thirdPlace.push({
          name: normalize(e.team.name),
          flag: FLAGS[e.team.name] ?? "🏳️",
          group_letter: letter,
          pts: e.points,
          gd: e.goalDifference,
          gf: e.goalsFor,
        });
      }
    });

    const best8 = thirdPlace
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
      .slice(0, 8)
      .map(({ name, flag, group_letter }) => ({ name, flag, group_letter }));

    const allTeams = [...rows, ...best8];
    if (allTeams.length > 0) {
      await supabase.from("qualified_teams").upsert(allTeams, { onConflict: "name" });
    }

    return NextResponse.json({ method: "standings", qualified: allTeams.length, log });
  } catch (err) {
    log.push(`Exception: ${String(err)}`);
    return NextResponse.json({ error: String(err), log }, { status: 500 });
  }
}

interface ApiMatch {
  homeTeam?: { name: string };
  awayTeam?: { name: string };
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
