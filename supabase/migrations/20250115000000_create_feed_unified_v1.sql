-- Create unified feed view that merges posts, reviews, and ratings
-- This view provides a common shape for all feed content types

CREATE OR REPLACE VIEW public.feed_unified_v1 AS
-- Posts from post_feed_v2 (already has all the joins we need)
SELECT 
  p.id::text as id,
  p.user_id,
  p.created_at,
  'post'::text as kind,
  p.body,
  NULL::integer as rating_score,
  p.media_urls,
  p.game_id,
  p.game_name,
  p.game_cover_url,
  p.like_count,
  p.comment_count,
  p.username,
  p.display_name,
  p.avatar_url
FROM public.post_feed_v2 p

UNION ALL

-- Reviews (with text content)
SELECT 
  r.id::text as id,
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
  r.id::text as id,
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
