-- Recreate post feed views to include display_name and game fields for hydration

-- Drop dependent views in order
DROP VIEW IF EXISTS public.post_feed_v2 CASCADE;
DROP VIEW IF EXISTS public.post_feed CASCADE;
DROP VIEW IF EXISTS public.post_with_counts CASCADE;
DROP VIEW IF EXISTS public.post_like_counts CASCADE;
DROP VIEW IF EXISTS public.post_comment_counts CASCADE;

-- Counts
CREATE OR REPLACE VIEW public.post_comment_counts AS
SELECT post_id, COUNT(*)::bigint AS comment_count
FROM public.post_comments
GROUP BY post_id;

CREATE OR REPLACE VIEW public.post_like_counts AS
SELECT post_id, COUNT(*)::bigint AS like_count
FROM public.post_likes
GROUP BY post_id;

-- Posts with counts
CREATE OR REPLACE VIEW public.post_with_counts AS
SELECT p.*, COALESCE(pcc.comment_count, 0) AS comment_count, COALESCE(plc.like_count, 0) AS like_count
FROM public.posts p
LEFT JOIN public.post_comment_counts pcc ON p.id = pcc.post_id
LEFT JOIN public.post_like_counts plc ON p.id = plc.post_id;

-- Enhanced feed view with profile and game fields
CREATE OR REPLACE VIEW public.post_feed_v2 AS
SELECT
  p.id,
  p.user_id,
  p.created_at,
  p.body,
  p.tags,
  COALESCE(pcc.comment_count, 0) AS comment_count,
  COALESCE(plc.like_count, 0) AS like_count,
  prof.username,
  prof.display_name,
  prof.avatar_url,
  p.game_id,
  g.name AS game_name,
  g.cover_url AS game_cover_url
FROM public.posts p
JOIN public.profiles prof ON prof.id = p.user_id
LEFT JOIN public.post_comment_counts pcc ON p.id = pcc.post_id
LEFT JOIN public.post_like_counts plc ON p.id = plc.post_id
LEFT JOIN public.games g ON g.id = p.game_id;

-- Basic feed view (same columns)
CREATE OR REPLACE VIEW public.post_feed AS
SELECT
  p.id,
  p.user_id,
  p.created_at,
  p.body,
  p.tags,
  COALESCE(pcc.comment_count, 0) AS comment_count,
  COALESCE(plc.like_count, 0) AS like_count,
  prof.username,
  prof.display_name,
  prof.avatar_url,
  p.game_id,
  g.name AS game_name,
  g.cover_url AS game_cover_url
FROM public.posts p
JOIN public.profiles prof ON prof.id = p.user_id
LEFT JOIN public.post_comment_counts pcc ON p.id = pcc.post_id
LEFT JOIN public.post_like_counts plc ON p.id = plc.post_id
LEFT JOIN public.games g ON g.id = p.game_id;

-- Grants
GRANT SELECT ON public.post_comment_counts TO authenticated;
GRANT SELECT ON public.post_like_counts TO authenticated;
GRANT SELECT ON public.post_with_counts TO authenticated;
GRANT SELECT ON public.post_feed_v2 TO authenticated;
GRANT SELECT ON public.post_feed TO authenticated;

