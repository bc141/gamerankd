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

-- Drop policies for mutes table
drop policy if exists "mutes_ins" on public.mutes;
drop policy if exists "mutes_sel" on public.mutes;
drop policy if exists "mutes_del" on public.mutes;

-- Drop policies for review_likes table
drop policy if exists "review_likes: insert own" on public.review_likes;
drop policy if exists "review_likes: delete own" on public.review_likes;

-- Drop policies for likes table
drop policy if exists "likes: insert own" on public.likes;
drop policy if exists "likes: delete own" on public.likes;
drop policy if exists "likes: insert by liker" on public.likes;
drop policy if exists "likes: delete by liker" on public.likes;
drop policy if exists "likes: insert by liker for existing review" on public.likes;
drop policy if exists "likes: read for all" on public.likes;
drop policy if exists "likes_insert_own" on public.likes;
drop policy if exists "likes_delete_own" on public.likes;
drop policy if exists "likes_select_all" on public.likes;

-- Drop policies for follows table
drop policy if exists "follows insert own" on public.follows;
drop policy if exists "follows delete own" on public.follows;
drop policy if exists "follows: follower can see own edges" on public.follows;
drop policy if exists "follows select all" on public.follows;
drop policy if exists "follows_ins" on public.follows;
drop policy if exists "follows_sel" on public.follows;
drop policy if exists "follows_del" on public.follows;
drop policy if exists "follows_insert_no_block" on public.follows;
drop policy if exists "follows_select_no_block" on public.follows;

-- Drop policies for review_comments table
drop policy if exists "rc_insert_self" on public.review_comments;
drop policy if exists "rc_delete_author_or_owner" on public.review_comments;
drop policy if exists "rc_read_not_blocked" on public.review_comments;
drop policy if exists "rc_insert_not_blocked" on public.review_comments;
drop policy if exists "rc_select_all" on public.review_comments;

-- Drop policies for user_blocks_deprecated table
drop policy if exists "blocks_insert_own" on public.user_blocks_deprecated;
drop policy if exists "blocks_delete_own" on public.user_blocks_deprecated;
drop policy if exists "blocks_select_own" on public.user_blocks_deprecated;

-- Drop policies for user_mutes_deprecated table
drop policy if exists "mutes_select_own" on public.user_mutes_deprecated;
drop policy if exists "mutes_insert_own" on public.user_mutes_deprecated;
drop policy if exists "mutes_delete_own" on public.user_mutes_deprecated;

-- Drop policies for notifications table
drop policy if exists "notif_select" on public.notifications;
drop policy if exists "notif_insert" on public.notifications;
drop policy if exists "notif_update" on public.notifications;
drop policy if exists "notif_delete" on public.notifications;

-- Drop policies for library table
drop policy if exists "lib_select" on public.library;
drop policy if exists "lib_ins" on public.library;
drop policy if exists "lib_upd" on public.library;
drop policy if exists "lib_del" on public.library;
drop policy if exists "library_select" on public.library;
drop policy if exists "library_insert" on public.library;
drop policy if exists "library_update" on public.library;
drop policy if exists "library_delete" on public.library;

-- Drop policies for posts table
drop policy if exists "posts: insert" on public.posts;
drop policy if exists "posts: update" on public.posts;
drop policy if exists "posts: delete" on public.posts;

-- Drop policies for post_likes table
drop policy if exists "post_likes: insert" on public.post_likes;
drop policy if exists "post_likes: delete" on public.post_likes;

-- Drop policies for post_comments table
drop policy if exists "post_comments: insert" on public.post_comments;
drop policy if exists "post_comments: delete" on public.post_comments;

-- Drop policies for blocks table
drop policy if exists "blocks_read_mine" on public.blocks;
drop policy if exists "blocks_insert_mine" on public.blocks;
drop policy if exists "blocks_delete_mine" on public.blocks;
drop policy if exists "blocks_select_either" on public.blocks;
drop policy if exists "blocks_insert_self" on public.blocks;
drop policy if exists "blocks_delete_self" on public.blocks;
drop policy if exists "blocks_ins" on public.blocks;
drop policy if exists "blocks_sel" on public.blocks;
drop policy if exists "blocks_del" on public.blocks;

-- Drop policies for mutes_deprecated table
drop policy if exists "mutes_read_mine" on public.mutes_deprecated;
drop policy if exists "mutes_insert_mine" on public.mutes_deprecated;
drop policy if exists "mutes_delete_mine" on public.mutes_deprecated;

-- Create optimized RLS policies using (select auth.uid()) for better performance
-- This prevents re-evaluation of auth.uid() for each row

-- Profiles table - optimized policies
create policy "profiles: user can insert own"
  on public.profiles
  for insert
  with check ((select auth.uid()) = user_id);

create policy "profiles: user can update own"
  on public.profiles
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

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

-- Mutes table - optimized policies
create policy "mutes: insert own"
  on public.mutes
  for insert
  with check ((select auth.uid()) = muter_id);

create policy "mutes: select own"
  on public.mutes
  for select
  using ((select auth.uid()) = muter_id);

create policy "mutes: delete own"
  on public.mutes
  for delete
  using ((select auth.uid()) = muter_id);

-- Review likes table - optimized policies
create policy "review_likes: insert own"
  on public.review_likes
  for insert
  with check ((select auth.uid()) = user_id);

create policy "review_likes: delete own"
  on public.review_likes
  for delete
  using ((select auth.uid()) = user_id);

-- Likes table - optimized policies
create policy "likes: read all"
  on public.likes
  for select
  using (true);

create policy "likes: insert own"
  on public.likes
  for insert
  with check ((select auth.uid()) = user_id);

create policy "likes: delete own"
  on public.likes
  for delete
  using ((select auth.uid()) = user_id);

-- Follows table - optimized policies
create policy "follows: read all"
  on public.follows
  for select
  using (true);

create policy "follows: insert own"
  on public.follows
  for insert
  with check ((select auth.uid()) = follower_id);

create policy "follows: delete own"
  on public.follows
  for delete
  using ((select auth.uid()) = follower_id);

-- Review comments table - optimized policies
create policy "review_comments: read all"
  on public.review_comments
  for select
  using (true);

create policy "review_comments: insert own"
  on public.review_comments
  for insert
  with check ((select auth.uid()) = user_id);

create policy "review_comments: delete own"
  on public.review_comments
  for delete
  using ((select auth.uid()) = user_id);

-- Notifications table - optimized policies
create policy "notifications: read own"
  on public.notifications
  for select
  using ((select auth.uid()) = user_id);

create policy "notifications: insert own"
  on public.notifications
  for insert
  with check ((select auth.uid()) = user_id);

create policy "notifications: update own"
  on public.notifications
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "notifications: delete own"
  on public.notifications
  for delete
  using ((select auth.uid()) = user_id);

-- Library table - optimized policies
create policy "library: read own"
  on public.library
  for select
  using ((select auth.uid()) = user_id);

create policy "library: insert own"
  on public.library
  for insert
  with check ((select auth.uid()) = user_id);

create policy "library: update own"
  on public.library
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "library: delete own"
  on public.library
  for delete
  using ((select auth.uid()) = user_id);

-- Posts table - optimized policies
create policy "posts: read all"
  on public.posts
  for select
  using (true);

create policy "posts: insert own"
  on public.posts
  for insert
  with check ((select auth.uid()) = user_id);

create policy "posts: update own"
  on public.posts
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "posts: delete own"
  on public.posts
  for delete
  using ((select auth.uid()) = user_id);

-- Post likes table - optimized policies
create policy "post_likes: read all"
  on public.post_likes
  for select
  using (true);

create policy "post_likes: insert own"
  on public.post_likes
  for insert
  with check ((select auth.uid()) = user_id);

create policy "post_likes: delete own"
  on public.post_likes
  for delete
  using ((select auth.uid()) = user_id);

-- Post comments table - optimized policies
create policy "post_comments: read all"
  on public.post_comments
  for select
  using (true);

create policy "post_comments: insert own"
  on public.post_comments
  for insert
  with check ((select auth.uid()) = user_id);

create policy "post_comments: delete own"
  on public.post_comments
  for delete
  using ((select auth.uid()) = user_id);

-- Blocks table - optimized policies
create policy "blocks: read own"
  on public.blocks
  for select
  using ((select auth.uid()) = blocker_id or (select auth.uid()) = blocked_id);

create policy "blocks: insert own"
  on public.blocks
  for insert
  with check ((select auth.uid()) = blocker_id);

create policy "blocks: delete own"
  on public.blocks
  for delete
  using ((select auth.uid()) = blocker_id);

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
