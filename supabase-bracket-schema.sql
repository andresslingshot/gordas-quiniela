-- Run this in Supabase → SQL Editor → New query

-- Teams that qualified for the knockout stage (populated via /api/qualified-teams)
create table if not exists qualified_teams (
  name text primary key,
  flag text not null default '🏳️',
  group_letter text
);

-- Bracket picks: one row per player per team per round
-- round values: 'r16', 'qf', 'sf', 'final', 'champion'
create table if not exists bracket_picks (
  id uuid primary key default gen_random_uuid(),
  player_name text not null references players(name) on delete cascade,
  team_name text not null,
  round text not null,
  submitted_at timestamptz default now(),
  unique(player_name, team_name, round)
);

-- How far each team actually got in the knockout stage
-- round_reached values: 'r16', 'qf', 'sf', 'final', 'champion'
create table if not exists knockout_results (
  team_name text primary key,
  round_reached text not null
);

-- Row Level Security
alter table qualified_teams enable row level security;
alter table bracket_picks enable row level security;
alter table knockout_results enable row level security;

create policy "Public read qualified_teams" on qualified_teams for select using (true);
create policy "Public insert qualified_teams" on qualified_teams for insert with check (true);
create policy "Public update qualified_teams" on qualified_teams for update using (true);

create policy "Public read bracket_picks" on bracket_picks for select using (true);
create policy "Public insert bracket_picks" on bracket_picks for insert with check (true);
create policy "Public update bracket_picks" on bracket_picks for update using (true);
create policy "Public delete bracket_picks" on bracket_picks for delete using (true);

create policy "Public read knockout_results" on knockout_results for select using (true);
create policy "Public insert knockout_results" on knockout_results for insert with check (true);
create policy "Public update knockout_results" on knockout_results for update using (true);
