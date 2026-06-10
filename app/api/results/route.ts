import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const API_KEY = process.env.FOOTBALL_DATA_API_KEY!;
const CACHE_MINUTES = 5;

let lastFetch = 0;

export async function GET() {
  // Simple in-process cache — don't hit the API more than once per 5 min
  if (Date.now() - lastFetch < CACHE_MINUTES * 60 * 1000) {
    return NextResponse.json({ cached: true });
  }

  try {
    const res = await fetch(
      "https://api.football-data.org/v4/competitions/WC/matches?season=2026&stage=GROUP_STAGE",
      { headers: { "X-Auth-Token": API_KEY }, next: { revalidate: 300 } }
    );

    if (!res.ok) {
      return NextResponse.json({ error: "API error", status: res.status }, { status: 502 });
    }

    const data = await res.json();
    const matches: ApiMatch[] = data.matches ?? [];

    const rows = matches
      .filter((m) => m.status === "FINISHED" || m.status === "IN_PLAY")
      .map((m) => ({
        match_id: m.id,
        home_score: m.score?.fullTime?.home ?? null,
        away_score: m.score?.fullTime?.away ?? null,
        status: m.status,
      }));

    if (rows.length > 0) {
      await supabase
        .from("results")
        .upsert(rows, { onConflict: "match_id" });
    }

    lastFetch = Date.now();
    return NextResponse.json({ updated: rows.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

interface ApiMatch {
  id: number;
  status: string;
  score?: {
    fullTime?: { home: number | null; away: number | null };
  };
}
