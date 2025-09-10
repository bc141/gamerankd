-- Fix Remaining Security Errors - Critical Security Fix
-- This migration fixes the remaining SECURITY DEFINER views and RLS issues

-- First, let's ensure all problematic views are completely dropped
-- Some might have been recreated after our previous migration
drop view if exists public.post_comment_counts cascade;
drop view if exists public.post_with_counts cascade;
drop view if exists public.user_game_library cascade;
drop view if exists public.post_feed_v2 cascade;
drop view if exists public.post_like_counts cascade;
drop view if exists public.post_feed cascade;
drop view if exists public.game_agg cascade;
drop view if exists public.game_rating_stats cascade;
drop view if exists public.notifications_visible cascade;

-- Enable RLS on all remaining tables that need it
-- These tables were missed in previous migrations

-- Enable RLS for public.games
alter table public.games enable row level security;

-- Enable RLS for public.post_media
alter table public.post_media enable row level security;

-- Enable RLS for public.post_tags
alter table public.post_tags enable row level security;

-- Enable RLS for public.reactions
alter table public.reactions enable row level security;

-- Enable RLS for public.comments
alter table public.comments enable row level security;

-- Enable RLS for public.review_entities
alter table public.review_entities enable row level security;

-- Enable RLS for public.rating_agg
alter table public.rating_agg enable row level security;

-- Create basic RLS policies for these tables
-- These provide read access to all users and write access to authenticated users

-- RLS policies for public.games
create policy "games: read for all" on public.games for select using (true);
create policy "games: insert for authenticated" on public.games for insert with check (auth.role() = 'authenticated');
create policy "games: update for authenticated" on public.games for update with check (auth.role() = 'authenticated');
create policy "games: delete for authenticated" on public.games for delete with check (auth.role() = 'authenticated');

-- RLS policies for public.post_media
create policy "post_media: read for all" on public.post_media for select using (true);
create policy "post_media: insert for authenticated" on public.post_media for insert with check (auth.role() = 'authenticated');
create policy "post_media: update for authenticated" on public.post_media for update with check (auth.role() = 'authenticated');
create policy "post_media: delete for authenticated" on public.post_media for delete with check (auth.role() = 'authenticated');

-- RLS policies for public.post_tags
create policy "post_tags: read for all" on public.post_tags for select using (true);
create policy "post_tags: insert for authenticated" on public.post_tags for insert with check (auth.role() = 'authenticated');
create policy "post_tags: update for authenticated" on public.post_tags for update with check (auth.role() = 'authenticated');
create policy "post_tags: delete for authenticated" on public.post_tags for delete with check (auth.role() = 'authenticated');

-- RLS policies for public.reactions
create policy "reactions: read for all" on public.reactions for select using (true);
create policy "reactions: insert for authenticated" on public.reactions for insert with check (auth.role() = 'authenticated');
create policy "reactions: update for authenticated" on public.reactions for update with check (auth.role() = 'authenticated');
create policy "reactions: delete for authenticated" on public.reactions for delete with check (auth.role() = 'authenticated');

-- RLS policies for public.comments
create policy "comments: read for all" on public.comments for select using (true);
create policy "comments: insert for authenticated" on public.comments for insert with check (auth.role() = 'authenticated');
create policy "comments: update for authenticated" on public.comments for update with check (auth.role() = 'authenticated');
create policy "comments: delete for authenticated" on public.comments for delete with check (auth.role() = 'authenticated');

-- RLS policies for public.review_entities
create policy "review_entities: read for all" on public.review_entities for select using (true);
create policy "review_entities: insert for authenticated" on public.review_entities for insert with check (auth.role() = 'authenticated');
create policy "review_entities: update for authenticated" on public.review_entities for update with check (auth.role() = 'authenticated');
create policy "review_entities: delete for authenticated" on public.review_entities for delete with check (auth.role() = 'authenticated');

-- RLS policies for public.rating_agg
create policy "rating_agg: read for all" on public.rating_agg for select using (true);
create policy "rating_agg: insert for authenticated" on public.rating_agg for insert with check (auth.role() = 'authenticated');
create policy "rating_agg: update for authenticated" on public.rating_agg for update with check (auth.role() = 'authenticated');
create policy "rating_agg: delete for authenticated" on public.rating_agg for delete with check (auth.role() = 'authenticated');

-- Create secure views without SECURITY DEFINER
-- These replace the problematic views with proper security

-- Create post_comment_counts view
create view public.post_comment_counts as
select
  p.id as post_id,
  count(pc.id) as comment_count
from public.posts p
left join public.post_comments pc on p.id = pc.post_id
group by p.id;

-- Create post_with_counts view
create view public.post_with_counts as
select
  p.id,
  p.user_id,
  p.game_id,
  p.rating,
  p.review,
  p.created_at,
  coalesce(pcc.comment_count, 0) as comment_count,
  coalesce(plc.like_count, 0) as like_count
from public.posts p
left join public.post_comment_counts pcc on p.id = pcc.post_id
left join public.post_like_counts plc on p.id = plc.post_id;

-- Create user_game_library view
create view public.user_game_library as
select
  r.user_id,
  r.game_id,
  r.rating,
  r.review,
  r.created_at
from public.reviews r;

-- Create post_feed_v2 view
create view public.post_feed_v2 as
select
  p.id,
  p.user_id,
  p.game_id,
  p.rating,
  p.review,
  p.created_at,
  pcc.comment_count,
  plc.like_count
from public.posts p
left join public.post_comment_counts pcc on p.id = pcc.post_id
left join public.post_like_counts plc on p.id = plc.post_id
order by p.created_at desc;

-- Create post_like_counts view
create view public.post_like_counts as
select
  p.id as post_id,
  count(r.id) as like_count
from public.posts p
left join public.reactions r on p.id = r.post_id and r.reaction_type = 'like'
group by p.id;

-- Create post_feed view
create view public.post_feed as
select
  p.id,
  p.user_id,
  p.game_id,
  p.rating,
  p.review,
  p.created_at,
  pcc.comment_count,
  plc.like_count
from public.posts p
left join public.post_comment_counts pcc on p.id = pcc.post_id
left join public.post_like_counts plc on p.id = plc.post_id
order by p.created_at desc;

-- Create game_agg view
create view public.game_agg as
select
  g.id as game_id,
  g.name,
  g.igdb_id,
  count(r.id) as review_count,
  round(avg(r.rating), 2) as average_rating
from public.games g
left join public.reviews r on g.id = r.game_id
group by g.id, g.name, g.igdb_id;

-- Create game_rating_stats view
create view public.game_rating_stats as
select
  g.id as game_id,
  g.name,
  count(r.id) as total_reviews,
  round(avg(r.rating), 2) as average_rating,
  jsonb_object_agg(
    r.rating::text,
    rating_count
  ) as rating_distribution
from public.games g
left join public.reviews r on g.id = r.game_id
left join (
  select rating, count(*) as rating_count
  from public.reviews
  group by rating
) rc on r.rating = rc.rating
group by g.id, g.name;

-- Create notifications_visible view
create view public.notifications_visible as
select
  n.id,
  n.user_id,
  n.type,
  n.data,
  n.created_at,
  n.read_at
from public.notifications n
order by n.created_at desc;

-- Grant permissions on the new views
grant select on public.post_comment_counts to authenticated, anon;
grant select on public.post_with_counts to authenticated, anon;
grant select on public.user_game_library to authenticated, anon;
grant select on public.post_feed_v2 to authenticated, anon;
grant select on public.post_like_counts to authenticated, anon;
grant select on public.post_feed to authenticated, anon;
grant select on public.game_agg to authenticated, anon;
grant select on public.game_rating_stats to authenticated, anon;
grant select on public.notifications_visible to authenticated, anon;
