-- Add missing fields to games table
alter table public.games 
add column if not exists release_year integer,
add column if not exists aliases text[];

-- Add index on release_year for potential sorting/filtering
create index if not exists games_release_year_idx on public.games(release_year);
