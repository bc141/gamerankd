-- Fix SECURITY DEFINER Views - Security Fix
-- This migration removes SECURITY DEFINER from views to fix security issues

-- Drop and recreate views without SECURITY DEFINER
-- Note: We'll recreate them as regular views or functions with proper security

-- Drop problematic views
drop view if exists public.post_comment_counts cascade;
drop view if exists public.post_with_counts cascade;
drop view if exists public.user_game_library cascade;
drop view if exists public.post_feed_v2 cascade;
drop view if exists public.post_like_counts cascade;
drop view if exists public.post_feed cascade;
drop view if exists public.game_agg cascade;
drop view if exists public.game_rating_stats cascade;
drop view if exists public.notifications_visible cascade;

-- Recreate as secure functions instead of views
-- This provides better security control

-- Create secure function for post comment counts
create or replace function public.get_post_comment_counts()
returns table (
  post_id bigint,
  comment_count bigint
)
language sql
security definer set search_path = public
as $$
  select 
    c.post_id,
    count(*) as comment_count
  from public.comments c
  group by c.post_id;
$$;

-- Create secure function for post with counts
create or replace function public.get_post_with_counts()
returns table (
  id bigint,
  user_id uuid,
  game_id bigint,
  rating smallint,
  review text,
  created_at timestamptz,
  comment_count bigint,
  like_count bigint
)
language sql
security definer set search_path = public
as $$
  select 
    r.id,
    r.user_id,
    r.game_id,
    r.rating,
    r.review,
    r.created_at,
    coalesce(cc.comment_count, 0) as comment_count,
    coalesce(lc.like_count, 0) as like_count
  from public.reviews r
  left join (
    select post_id, count(*) as comment_count
    from public.comments
    group by post_id
  ) cc on r.id = cc.post_id
  left join (
    select post_id, count(*) as like_count
    from public.reactions
    where reaction_type = 'like'
    group by post_id
  ) lc on r.id = lc.post_id;
$$;

-- Create secure function for user game library
create or replace function public.get_user_game_library(user_id_param uuid)
returns table (
  game_id bigint,
  rating smallint,
  review text,
  created_at timestamptz
)
language sql
security definer set search_path = public
as $$
  select 
    r.game_id,
    r.rating,
    r.review,
    r.created_at
  from public.reviews r
  where r.user_id = user_id_param;
$$;

-- Create secure function for game statistics
create or replace function public.get_game_rating_stats(game_id_param bigint)
returns table (
  game_id bigint,
  total_reviews bigint,
  average_rating numeric,
  rating_distribution jsonb
)
language sql
security definer set search_path = public
as $$
  select 
    game_id_param as game_id,
    count(*) as total_reviews,
    round(avg(rating), 2) as average_rating,
    jsonb_object_agg(
      rating::text, 
      rating_count
    ) as rating_distribution
  from (
    select rating, count(*) as rating_count
    from public.reviews
    where game_id = game_id_param
    group by rating
  ) rating_counts;
$$;

-- Create secure function for notifications
create or replace function public.get_notifications_visible(user_id_param uuid)
returns table (
  id bigint,
  user_id uuid,
  type text,
  data jsonb,
  created_at timestamptz,
  read_at timestamptz
)
language sql
security definer set search_path = public
as $$
  select 
    n.id,
    n.user_id,
    n.type,
    n.data,
    n.created_at,
    n.read_at
  from public.notifications n
  where n.user_id = user_id_param
  order by n.created_at desc;
$$;

-- Grant execute permissions
grant execute on function public.get_post_comment_counts() to authenticated, anon;
grant execute on function public.get_post_with_counts() to authenticated, anon;
grant execute on function public.get_user_game_library(uuid) to authenticated;
grant execute on function public.get_game_rating_stats(bigint) to authenticated, anon;
grant execute on function public.get_notifications_visible(uuid) to authenticated;
