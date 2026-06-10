import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key);

export interface Pick {
  player_name: string;
  match_id: number;
  home_score: number;
  away_score: number;
}

export interface Result {
  match_id: number;
  home_score: number | null;
  away_score: number | null;
  status: "SCHEDULED" | "IN_PLAY" | "FINISHED";
}

export interface Player {
  name: string;
}
