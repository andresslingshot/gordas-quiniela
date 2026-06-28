-- Run this in Supabase → SQL Editor → New query
-- This replaces the old bracket tables

drop table if exists bracket_picks cascade;
drop table if exists knockout_results cascade;

-- The 31 bracket match slots (r32_1..r32_16, r16_1..r16_8, qf_1..qf_4, sf_1..sf_2, final)
create table if not exists bracket_matches (
  slot text primary key,
  round text not null,         -- 'r32','r16','qf','sf','final'
  position integer not null,   -- 1-based within round
  home_team text,              -- null until admin sets matchup
  away_team text,
  actual_winner text           -- null until match is played
);

-- Player bracket picks: one row per match slot per player
create table if not exists bracket_picks (
  player_name text not null references players(name) on delete cascade,
  slot text not null references bracket_matches(slot) on delete cascade,
  picked_winner text not null,
  primary key (player_name, slot)
);

alter table bracket_matches enable row level security;
alter table bracket_picks enable row level security;

create policy "Public read bracket_matches"  on bracket_matches for select using (true);
create policy "Public insert bracket_matches" on bracket_matches for insert with check (true);
create policy "Public update bracket_matches" on bracket_matches for update using (true);

create policy "Public read bracket_picks"   on bracket_picks for select using (true);
create policy "Public insert bracket_picks" on bracket_picks for insert with check (true);
create policy "Public update bracket_picks" on bracket_picks for update using (true);
create policy "Public delete bracket_picks" on bracket_picks for delete using (true);

-- Pre-populate all 31 slots so they exist before teams are set
insert into bracket_matches (slot, round, position) values
  ('r32_1','r32',1),('r32_2','r32',2),('r32_3','r32',3),('r32_4','r32',4),
  ('r32_5','r32',5),('r32_6','r32',6),('r32_7','r32',7),('r32_8','r32',8),
  ('r32_9','r32',9),('r32_10','r32',10),('r32_11','r32',11),('r32_12','r32',12),
  ('r32_13','r32',13),('r32_14','r32',14),('r32_15','r32',15),('r32_16','r32',16),
  ('r16_1','r16',1),('r16_2','r16',2),('r16_3','r16',3),('r16_4','r16',4),
  ('r16_5','r16',5),('r16_6','r16',6),('r16_7','r16',7),('r16_8','r16',8),
  ('qf_1','qf',1),('qf_2','qf',2),('qf_3','qf',3),('qf_4','qf',4),
  ('sf_1','sf',1),('sf_2','sf',2),
  ('final','final',1)
on conflict (slot) do nothing;
