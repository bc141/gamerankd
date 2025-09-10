-- Fix RLS Security Errors - Critical Security Fix
-- This migration enables RLS on all tables that were missing it

-- Enable RLS on tables that exist
alter table public.games enable row level security;

-- Enable RLS on tables that might exist (conditional)
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'post_media' and table_schema = 'public') then
    alter table public.post_media enable row level security;
  end if;
  
  if exists (select 1 from information_schema.tables where table_name = 'post_tags' and table_schema = 'public') then
    alter table public.post_tags enable row level security;
  end if;
  
  if exists (select 1 from information_schema.tables where table_name = 'reactions' and table_schema = 'public') then
    alter table public.reactions enable row level security;
  end if;
  
  if exists (select 1 from information_schema.tables where table_name = 'comments' and table_schema = 'public') then
    alter table public.comments enable row level security;
  end if;
  
  if exists (select 1 from information_schema.tables where table_name = 'review_entities' and table_schema = 'public') then
    alter table public.review_entities enable row level security;
  end if;
  
  if exists (select 1 from information_schema.tables where table_name = 'rating_agg' and table_schema = 'public') then
    alter table public.rating_agg enable row level security;
  end if;
end $$;

-- Create RLS policies for games table (already done in previous migration, but ensure they exist)
drop policy if exists "games: read for all" on public.games;
create policy "games: read for all"
  on public.games
  for select
  using (true);

drop policy if exists "games: insert for authenticated" on public.games;
create policy "games: insert for authenticated"
  on public.games
  for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "games: update for authenticated" on public.games;
create policy "games: update for authenticated"
  on public.games
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "games: delete for authenticated" on public.games;
create policy "games: delete for authenticated"
  on public.games
  for delete
  using (auth.role() = 'authenticated');

-- Note: RLS policies for other tables will be created when those tables are added
-- This migration only handles the games table which is guaranteed to exist
