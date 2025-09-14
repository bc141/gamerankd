-- Drop dependent views, cast column, recreate views
DROP VIEW IF EXISTS public.post_feed_v2 CASCADE;
DROP VIEW IF EXISTS public.post_feed CASCADE;

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

-- Recreate views (same as 20250111000025)
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

ALTER VIEW public.post_feed_v2 SET (security_invoker = true);
ALTER VIEW public.post_feed SET (security_invoker = true);
GRANT SELECT ON public.post_feed_v2 TO authenticated;
GRANT SELECT ON public.post_feed TO authenticated;

