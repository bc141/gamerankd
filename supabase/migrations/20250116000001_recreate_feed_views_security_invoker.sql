-- Drop dependent feed/count views so we can recreate them with security_invoker semantics
DROP VIEW IF EXISTS public.post_feed_v2 CASCADE;
DROP VIEW IF EXISTS public.post_feed CASCADE;
DROP VIEW IF EXISTS public.post_with_counts CASCADE;
DROP VIEW IF EXISTS public.post_like_counts CASCADE;
DROP VIEW IF EXISTS public.post_comment_counts CASCADE;
DROP VIEW IF EXISTS public.feed_unified_v1 CASCADE;

-- Recreate helper count views with SECURITY INVOKER behaviour
CREATE VIEW public.post_comment_counts
WITH (security_invoker = true) AS
SELECT
  post_id,
  COUNT(*) AS comment_count
FROM public.post_comments
GROUP BY post_id;

CREATE VIEW public.post_like_counts
WITH (security_invoker = true) AS
SELECT
  post_id,
  COUNT(*) AS like_count
FROM public.post_likes
GROUP BY post_id;

CREATE VIEW public.post_with_counts
WITH (security_invoker = true) AS
SELECT
  p.*,
  COALESCE(pcc.comment_count, 0) AS comment_count,
  COALESCE(plc.like_count, 0) AS like_count
FROM public.posts p
LEFT JOIN public.post_comment_counts pcc ON p.id = pcc.post_id
LEFT JOIN public.post_like_counts plc ON p.id = plc.post_id;

-- Recreate main feed view
CREATE VIEW public.feed_unified_v1
WITH (security_invoker = true) AS
-- Posts from posts table with joins
SELECT 
  p.id::text as id,
  p.user_id,
  p.created_at,
  'post'::text as kind,
  p.body,
  NULL::integer as rating_score,
  COALESCE(p.media_urls, ARRAY[]::text[]) as media_urls,
  p.game_id,
  g.name as game_name,
  g.cover_url as game_cover_url,
  COALESCE(plc.like_count, 0) as like_count,
  COALESCE(pcc.comment_count, 0) as comment_count,
  prof.username,
  prof.display_name,
  prof.avatar_url
FROM public.posts p
LEFT JOIN public.profiles prof ON prof.id = p.user_id
LEFT JOIN public.games g ON g.id = p.game_id
LEFT JOIN public.post_like_counts plc ON p.id = plc.post_id
LEFT JOIN public.post_comment_counts pcc ON p.id = pcc.post_id

UNION ALL

-- Reviews (with text content)
SELECT 
  ('review_' || r.id)::text as id,
  r.user_id,
  r.created_at,
  'review'::text as kind,
  COALESCE(r.review, '') as body,
  r.rating as rating_score,
  ARRAY[]::text[] as media_urls,
  r.game_id,
  g.name as game_name,
  g.cover_url as game_cover_url,
  0 as like_count,
  0 as comment_count,
  prof.username,
  prof.display_name,
  prof.avatar_url
FROM public.reviews r
LEFT JOIN public.games g ON g.id = r.game_id
LEFT JOIN public.profiles prof ON prof.id = r.user_id
WHERE r.review IS NOT NULL AND TRIM(r.review) != ''

UNION ALL

-- Ratings (without text content, just score)
SELECT 
  ('rating_' || r.id)::text as id,
  r.user_id,
  r.created_at,
  'rating'::text as kind,
  CONCAT('Rated ', r.rating, '/100') as body,
  r.rating as rating_score,
  ARRAY[]::text[] as media_urls,
  r.game_id,
  g.name as game_name,
  g.cover_url as game_cover_url,
  0 as like_count,
  0 as comment_count,
  prof.username,
  prof.display_name,
  prof.avatar_url
FROM public.reviews r
LEFT JOIN public.games g ON g.id = r.game_id
LEFT JOIN public.profiles prof ON prof.id = r.user_id
WHERE r.review IS NULL OR TRIM(r.review) = '';

-- Recreate feed views dependant on helper views
CREATE VIEW public.post_feed_v2
WITH (security_invoker = true) AS
SELECT
  p.id,
  p.user_id,
  p.created_at,
  p.body,
  p.tags,
  p.media_urls,
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

CREATE VIEW public.post_feed
WITH (security_invoker = true) AS
SELECT
  p.id,
  p.user_id,
  p.created_at,
  p.body,
  p.tags,
  p.media_urls,
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

-- Restore grants for application roles
GRANT SELECT ON public.post_comment_counts TO authenticated, service_role;
GRANT SELECT ON public.post_like_counts TO authenticated, service_role;
GRANT SELECT ON public.post_with_counts TO authenticated, service_role;
GRANT SELECT ON public.feed_unified_v1 TO authenticated, service_role;
GRANT SELECT ON public.post_feed_v2 TO authenticated, service_role;
GRANT SELECT ON public.post_feed TO authenticated, service_role;

