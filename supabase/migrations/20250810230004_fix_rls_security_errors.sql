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

-- Create RLS policies for post_media table
create policy "post_media: read for all"
  on public.post_media
  for select
  using (true);

create policy "post_media: insert for authenticated"
  on public.post_media
  for insert
  with check (auth.role() = 'authenticated');

create policy "post_media: update for authenticated"
  on public.post_media
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "post_media: delete for authenticated"
  on public.post_media
  for delete
  using (auth.role() = 'authenticated');

-- Create RLS policies for post_tags table
create policy "post_tags: read for all"
  on public.post_tags
  for select
  using (true);

create policy "post_tags: insert for authenticated"
  on public.post_tags
  for insert
  with check (auth.role() = 'authenticated');

create policy "post_tags: update for authenticated"
  on public.post_tags
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "post_tags: delete for authenticated"
  on public.post_tags
  for delete
  using (auth.role() = 'authenticated');

-- Create RLS policies for reactions table
create policy "reactions: read for all"
  on public.reactions
  for select
  using (true);

create policy "reactions: insert for authenticated"
  on public.reactions
  for insert
  with check (auth.role() = 'authenticated');

create policy "reactions: update for authenticated"
  on public.reactions
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "reactions: delete for authenticated"
  on public.reactions
  for delete
  using (auth.role() = 'authenticated');

-- Create RLS policies for comments table
create policy "comments: read for all"
  on public.comments
  for select
  using (true);

create policy "comments: insert for authenticated"
  on public.comments
  for insert
  with check (auth.role() = 'authenticated');

create policy "comments: update for authenticated"
  on public.comments
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "comments: delete for authenticated"
  on public.comments
  for delete
  using (auth.role() = 'authenticated');

-- Create RLS policies for review_entities table
create policy "review_entities: read for all"
  on public.review_entities
  for select
  using (true);

create policy "review_entities: insert for authenticated"
  on public.review_entities
  for insert
  with check (auth.role() = 'authenticated');

create policy "review_entities: update for authenticated"
  on public.review_entities
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "review_entities: delete for authenticated"
  on public.review_entities
  for delete
  using (auth.role() = 'authenticated');

-- Create RLS policies for rating_agg table
create policy "rating_agg: read for all"
  on public.rating_agg
  for select
  using (true);

create policy "rating_agg: insert for authenticated"
  on public.rating_agg
  for insert
  with check (auth.role() = 'authenticated');

create policy "rating_agg: update for authenticated"
  on public.rating_agg
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "rating_agg: delete for authenticated"
  on public.rating_agg
  for delete
  using (auth.role() = 'authenticated');
