-- Clean Database Setup - Ground Up Approach
-- This migration consolidates all essential fixes into a single, clean migration
-- It preserves what works and fixes what's broken without complexity

-- ============================================================================
-- 1. EXTENSIONS & SCHEMA SETUP
-- ============================================================================

-- Ensure pg_trgm extension is available for text search
create extension if not exists pg_trgm;

-- Create extensions schema for better security
create schema if not exists extensions;

-- Move pg_trgm to extensions schema (if possible)
-- Note: This may require superuser privileges in production
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_trgm') then
    -- Try to move to extensions schema
    begin
      alter extension pg_trgm set schema extensions;
    exception when others then
      -- If we can't move it, that's okay - we'll work with it in public
      raise notice 'Could not move pg_trgm to extensions schema: %', SQLERRM;
    end;
  end if;
end $$;

-- ============================================================================
-- 2. SECURE WRAPPER FUNCTIONS
-- ============================================================================

-- Create secure wrapper functions for pg_trgm (avoiding conflicts)
create or replace function public.secure_similarity(text, text)
returns real
language sql
security definer set search_path = public, extensions
as $$
  select similarity($1, $2);
$$;

create or replace function public.secure_word_similarity(text, text)
returns real
language sql
security definer set search_path = public, extensions
as $$
  select word_similarity($1, $2);
$$;

create or replace function public.secure_strict_word_similarity(text, text)
returns real
language sql
security definer set search_path = public, extensions
as $$
  select strict_word_similarity($1, $2);
$$;

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS) SETUP
-- ============================================================================

-- Enable RLS on all existing tables
alter table public.games enable row level security;
alter table public.reviews enable row level security;
alter table public.profiles enable row level security;

-- Create comprehensive RLS policies for games table
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

-- Create comprehensive RLS policies for reviews table
drop policy if exists "reviews: read all" on public.reviews;
create policy "reviews: read all"
  on public.reviews
  for select
  using (true);

drop policy if exists "reviews: insert own" on public.reviews;
create policy "reviews: insert own"
  on public.reviews
  for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "reviews: update own" on public.reviews;
create policy "reviews: update own"
  on public.reviews
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "reviews: delete own" on public.reviews;
create policy "reviews: delete own"
  on public.reviews
  for delete
  using ((select auth.uid()) = user_id);

-- Create comprehensive RLS policies for profiles table
drop policy if exists "profiles: read all" on public.profiles;
create policy "profiles: read all"
  on public.profiles
  for select
  using (true);

drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own"
  on public.profiles
  for insert
  with check ((select auth.uid()) = id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own"
  on public.profiles
  for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ============================================================================
-- 4. PERFORMANCE OPTIMIZATIONS
-- ============================================================================

-- Create essential indexes for performance
create index if not exists games_name_idx on public.games using gin (to_tsvector('english', name));
create index if not exists games_igdb_id_idx on public.games(igdb_id);
create index if not exists games_created_at_idx on public.games(created_at desc);
-- Create trigram index robustly across environments
do $$
begin
  begin
    execute 'create index if not exists games_name_trgm_idx on public.games using gin (name extensions.gin_trgm_ops)';
  exception when undefined_object then
    begin
      execute 'create index if not exists games_name_trgm_idx on public.games using gin (name gin_trgm_ops)';
    exception when undefined_object then
      -- Operator class not available; skip (pg_trgm may be unavailable on this instance)
      raise notice 'Skipping games_name_trgm_idx creation: gin_trgm_ops not found';
    end;
  end;
end $$;

create index if not exists reviews_user_id_idx on public.reviews(user_id);
create index if not exists reviews_game_id_idx on public.reviews(game_id);
create index if not exists reviews_created_at_idx on public.reviews(created_at desc);
create index if not exists reviews_rating_idx on public.reviews(rating);

create index if not exists profiles_username_idx on public.profiles(username);
create index if not exists profiles_created_at_idx on public.profiles(created_at desc);

-- ============================================================================
-- 5. DATA VALIDATION & CONSTRAINTS
-- ============================================================================

-- Add essential constraints for data integrity (if they don't exist)
do $$
begin
  -- Games table constraints
  if not exists (select 1 from pg_constraint where conname = 'games_name_length') then
    alter table public.games add constraint games_name_length check (length(name) >= 1 and length(name) <= 255);
  end if;
  
  if not exists (select 1 from pg_constraint where conname = 'games_cover_url_format') then
    alter table public.games add constraint games_cover_url_format check (cover_url is null or cover_url ~ '^https?://');
  end if;
  
  -- Reviews table constraints
  if not exists (select 1 from pg_constraint where conname = 'reviews_rating_range') then
    alter table public.reviews add constraint reviews_rating_range check (rating >= 1 and rating <= 100);
  end if;
  
  if not exists (select 1 from pg_constraint where conname = 'reviews_review_length') then
    alter table public.reviews add constraint reviews_review_length check (review is null or length(review) <= 5000);
  end if;
  
  -- Profiles table constraints
  if not exists (select 1 from pg_constraint where conname = 'profiles_username_format') then
    alter table public.profiles add constraint profiles_username_format check (username is null or username ~ '^[a-z0-9_]{3,20}$');
  end if;
  
  if not exists (select 1 from pg_constraint where conname = 'profiles_display_name_length') then
    alter table public.profiles add constraint profiles_display_name_length check (display_name is null or length(display_name) <= 100);
  end if;
end $$;

-- ============================================================================
-- 6. UTILITY FUNCTIONS
-- ============================================================================

-- Create a function to get current user ID (optimized)
create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

-- Create a function to check if user is authenticated
create or replace function public.is_authenticated()
returns boolean
language sql
stable
as $$
  select auth.role() = 'authenticated';
$$;

-- ============================================================================
-- 7. GRANTS & PERMISSIONS
-- ============================================================================

-- Grant necessary permissions
grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on public.games to authenticated, anon;
grant select, insert, update, delete on public.reviews to authenticated, anon;
grant select, insert, update, delete on public.profiles to authenticated, anon;

grant execute on function public.secure_similarity(text, text) to authenticated, anon;
grant execute on function public.secure_word_similarity(text, text) to authenticated, anon;
grant execute on function public.secure_strict_word_similarity(text, text) to authenticated, anon;
grant execute on function public.current_user_id() to authenticated, anon;
grant execute on function public.is_authenticated() to authenticated, anon;

-- ============================================================================
-- 8. CLEANUP
-- ============================================================================

-- Remove any problematic views that might exist
drop view if exists public.post_comment_counts cascade;
drop view if exists public.post_with_counts cascade;
drop view if exists public.user_game_library cascade;
drop view if exists public.post_feed_v2 cascade;
drop view if exists public.post_like_counts cascade;
drop view if exists public.post_feed cascade;
drop view if exists public.game_agg cascade;
drop view if exists public.game_rating_stats cascade;
drop view if exists public.notifications_visible cascade;

-- ============================================================================
-- 9. VERIFICATION
-- ============================================================================

-- Create a function to verify database health
create or replace function public.verify_database_health()
returns table (
  check_name text,
  status text,
  details text
)
language plpgsql
as $$
begin
  -- Check RLS is enabled
  return query
  select 'RLS Enabled'::text, 
         case when relrowsecurity then 'PASS' else 'FAIL' end::text,
         'Games table RLS status'::text
  from pg_class where relname = 'games';
  
  -- Check indexes exist
  return query
  select 'Indexes Created'::text,
         case when count(*) > 0 then 'PASS' else 'FAIL' end::text,
         'Essential indexes count: ' || count(*)::text
  from pg_indexes where schemaname = 'public' and tablename in ('games', 'reviews', 'profiles');
  
  -- Check functions exist
  return query
  select 'Functions Created'::text,
         case when count(*) >= 5 then 'PASS' else 'FAIL' end::text,
         'Secure functions count: ' || count(*)::text
  from pg_proc where pronamespace = (select oid from pg_namespace where nspname = 'public')
  and proname like 'secure_%';
end;
$$;

-- Grant execute permission on verification function
grant execute on function public.verify_database_health() to authenticated, anon;
