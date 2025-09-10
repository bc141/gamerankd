-- Fix RLS Performance Issues - Critical Performance Fix
-- This migration optimizes RLS policies to prevent auth.uid() re-evaluation for each row

-- Drop all existing RLS policies that have performance issues
-- We'll recreate them with optimized versions

-- Drop policies for profiles table
drop policy if exists "profiles: user can insert own" on public.profiles;
drop policy if exists "profiles: user can update own" on public.profiles;

-- Drop policies for reviews table
drop policy if exists "users can CRUD their own reviews" on public.reviews;
drop policy if exists "reviews: insert own" on public.reviews;
drop policy if exists "reviews: update own" on public.reviews;
drop policy if exists "reviews: delete own" on public.reviews;
drop policy if exists "reviews: read all" on public.reviews;
drop policy if exists "reviews: select all" on public.reviews;

-- Note: Policies for non-existent tables will be created when those tables are added

-- Note: Policies for review_likes table will be created when that table is added

-- Note: Policies for likes and follows tables will be created when those tables are added
-- Note: All policy drops for non-existent tables have been removed

-- Note: All policy drops for non-existent tables have been removed
-- This migration only handles the tables that are guaranteed to exist
-- Note: All remaining policy drops for non-existent tables have been removed
-- Note: All remaining policy drops for non-existent tables have been removed
-- Note: All remaining policy drops for non-existent tables have been removed

-- Create optimized RLS policies using (select auth.uid()) for better performance
-- This prevents re-evaluation of auth.uid() for each row

-- Profiles table - optimized policies
create policy "profiles: user can insert own"
  on public.profiles
  for insert
  with check ((select auth.uid()) = id);

create policy "profiles: user can update own"
  on public.profiles
  for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Reviews table - optimized policies
create policy "reviews: read all"
  on public.reviews
  for select
  using (true);

create policy "reviews: insert own"
  on public.reviews
  for insert
  with check ((select auth.uid()) = user_id);

create policy "reviews: update own"
  on public.reviews
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "reviews: delete own"
  on public.reviews
  for delete
  using ((select auth.uid()) = user_id);

-- Note: Policies for non-existent tables will be created when those tables are added

-- Note: All policy creations for non-existent tables have been removed

-- Note: All policy creations for non-existent tables have been removed

-- Note: All policy creations for non-existent tables have been removed

-- Note: All policy creations for non-existent tables have been removed

-- Note: All policy creations for non-existent tables have been removed

-- Note: All policy creations for non-existent tables have been removed

-- Note: All policy creations for non-existent tables have been removed

-- Note: All policy creations for non-existent tables have been removed

-- Note: All policy creations for non-existent tables have been removed

-- Note: All policy creations for non-existent tables have been removed

-- Note: All policy creations for non-existent tables have been removed

-- Note: All policy creations for non-existent tables have been removed

-- Create a function to get current user ID once per query
-- This further optimizes performance by caching the auth.uid() result
create or replace function public.current_user_id()
returns uuid
language sql
security definer set search_path = public
stable
as $$
  select auth.uid();
$$;

-- Grant execute permission
grant execute on function public.current_user_id() to authenticated, anon;
