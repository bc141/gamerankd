-- Fix media_urls column type and create feed_unified_v1 view
-- This migration handles the dependency issues by dropping views first

-- Drop all dependent views first to allow column type changes
DROP VIEW IF EXISTS public.feed_unified_v1 CASCADE;
DROP VIEW IF EXISTS public.post_feed_v2 CASCADE;
DROP VIEW IF EXISTS public.post_feed CASCADE;
DROP VIEW IF EXISTS public.post_with_counts CASCADE;

-- Now we can safely alter the media_urls column
ALTER TABLE public.posts
  ALTER COLUMN media_urls TYPE text[]
  USING (
    CASE
      WHEN media_urls IS NULL THEN NULL
      WHEN pg_typeof(media_urls)::text = 'text[]' THEN media_urls
      WHEN left(media_urls::text,1) = '{' THEN string_to_array(replace(replace(trim(both '{}' from media_urls::text),'"',''),' ',''), ',')
      ELSE ARRAY[media_urls::text]::text[]
    END
  );

-- Recreate the post_comment_counts view
CREATE OR REPLACE VIEW public.post_comment_counts AS
SELECT
    post_id,
    COUNT(*) as comment_count
FROM public.post_comments
GROUP BY post_id;

-- Recreate the post_like_counts view
CREATE OR REPLACE VIEW public.post_like_counts AS
SELECT
    post_id,
    COUNT(*) as like_count
FROM public.post_likes
GROUP BY post_id;

-- Recreate the post_with_counts view
CREATE OR REPLACE VIEW public.post_with_counts AS
SELECT
    p.*,
    COALESCE(pcc.comment_count, 0) as comment_count,
    COALESCE(plc.like_count, 0) as like_count
FROM public.posts p
LEFT JOIN public.post_comment_counts pcc ON p.id = pcc.post_id
LEFT JOIN public.post_like_counts plc ON p.id = plc.post_id;

-- Recreate the post_feed_v2 view
CREATE OR REPLACE VIEW public.post_feed_v2 AS
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

-- Recreate the post_feed view
CREATE OR REPLACE VIEW public.post_feed AS
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

-- Now create the unified feed view
CREATE OR REPLACE VIEW public.feed_unified_v1 AS
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

-- Set security invoker settings
ALTER VIEW public.feed_unified_v1 SET (security_invoker = false);
ALTER VIEW public.post_feed_v2 SET (security_invoker = true);
ALTER VIEW public.post_feed SET (security_invoker = true);
ALTER VIEW public.post_with_counts SET (security_invoker = true);

-- Grant access to authenticated users
GRANT SELECT ON public.feed_unified_v1 TO authenticated;
GRANT SELECT ON public.post_feed_v2 TO authenticated;
GRANT SELECT ON public.post_feed TO authenticated;
GRANT SELECT ON public.post_with_counts TO authenticated;

-- Add comment for documentation
COMMENT ON VIEW public.feed_unified_v1 IS 'Unified feed view merging posts, reviews, and ratings with common shape for feed display';
