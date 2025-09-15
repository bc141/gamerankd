-- Fix feed_unified_v1 view to work with actual database schema
-- This view provides a common shape for all feed content types

DROP VIEW IF EXISTS public.feed_unified_v1 CASCADE;

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

-- Set security invoker to false (no RLS filters needed)
ALTER VIEW public.feed_unified_v1 SET (security_invoker = false);

-- Grant access to authenticated users
GRANT SELECT ON public.feed_unified_v1 TO authenticated;

-- Add comment for documentation
COMMENT ON VIEW public.feed_unified_v1 IS 'Unified feed view merging posts, reviews, and ratings with common shape for feed display';
