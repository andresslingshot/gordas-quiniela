-- Run this in Supabase → SQL Editor → New query

-- Players table
create table if not exists players (
  name text primary key,
  created_at timestamptz default now()
);

-- Picks table
create table if not exists picks (
  id uuid primary key default gen_random_uuid(),
  player_name text not null references players(name) on delete cascade,
  match_id integer not null,
  home_score integer not null,
  away_score integer not null,
  submitted_at timestamptz default now(),
  unique(player_name, match_id)
);

-- Results table (populated automatically by /api/results)
create table if not exists results (
  match_id integer primary key,
  home_score integer,
  away_score integer,
  status text default 'SCHEDULED',
  updated_at timestamptz default now()
);

-- Allow the app to read and write (Row Level Security)
alter table players enable row level security;
alter table picks enable row level security;
alter table results enable row level security;

create policy "Public read players" on players for select using (true);
create policy "Public insert players" on players for insert with check (true);

create policy "Public read picks" on picks for select using (true);
create policy "Public insert picks" on picks for insert with check (true);
create policy "Public update picks" on picks for update using (true);

create policy "Public read results" on results for select using (true);
create policy "Public insert results" on results for insert with check (true);
create policy "Public update results" on results for update using (true);
