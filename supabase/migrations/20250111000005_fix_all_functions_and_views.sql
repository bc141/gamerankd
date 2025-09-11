-- Fix all function conflicts and apply security view fixes

-- Drop all conflicting functions first
DROP FUNCTION IF EXISTS public.game_search(text, integer);
DROP FUNCTION IF EXISTS public.game_search_v2(text, integer);

-- Recreate game_search function
CREATE OR REPLACE FUNCTION public.game_search(q text, lim integer default 10)
RETURNS TABLE (
  id bigint,
  igdb_id integer,
  name text,
  cover_url text,
  release_year integer,
  summary text,
  aliases text[]
)
LANGUAGE sql stable
AS $$
  SELECT
    g.id,
    g.igdb_id,
    g.name,
    g.cover_url,
    g.release_year,
    g.summary,
    g.aliases
  FROM public.games g
  WHERE
    g.parent_igdb_id is null
    AND (
      g.name ilike '%' || q || '%'
      OR EXISTS (
        SELECT 1 FROM unnest(g.aliases) as alias
        WHERE alias ilike '%' || q || '%'
      )
    )
  ORDER BY
    CASE WHEN g.name ilike q THEN 1
         WHEN g.name ilike q || '%' THEN 2
         WHEN g.name ilike '%' || q THEN 3
         ELSE 4 END,
    g.name
  LIMIT lim;
$$;

-- Recreate game_search_v2 function
CREATE OR REPLACE FUNCTION public.game_search_v2(q text, lim integer default 10)
RETURNS TABLE (
  id bigint,
  igdb_id integer,
  name text,
  cover_url text,
  release_year integer,
  summary text,
  aliases text[],
  parent_igdb_id integer
)
LANGUAGE sql stable
AS $$
  SELECT
    g.id,
    g.igdb_id,
    g.name,
    g.cover_url,
    g.release_year,
    g.summary,
    g.aliases,
    g.parent_igdb_id
  FROM public.games g
  WHERE
    g.parent_igdb_id is null
    AND (
      g.name ilike '%' || q || '%'
      OR EXISTS (
        SELECT 1 FROM unnest(g.aliases) as alias
        WHERE alias ilike '%' || q || '%'
      )
    )
  ORDER BY
    CASE WHEN g.name ilike q THEN 1
         WHEN g.name ilike q || '%' THEN 2
         WHEN g.name ilike '%' || q THEN 3
         ELSE 4 END,
    g.name
  LIMIT lim;
$$;

-- Now fix the Security Definer Views by recreating them without SECURITY DEFINER
-- Drop views with CASCADE to ensure complete removal
DROP VIEW IF EXISTS public.post_feed_v2 CASCADE;
DROP VIEW IF EXISTS public.post_feed CASCADE;
DROP VIEW IF EXISTS public.post_with_counts CASCADE;
DROP VIEW IF EXISTS public.post_like_counts CASCADE;
DROP VIEW IF EXISTS public.post_comment_counts CASCADE;
DROP VIEW IF EXISTS public.user_game_library CASCADE;
DROP VIEW IF EXISTS public.game_agg CASCADE;
DROP VIEW IF EXISTS public.game_rating_stats CASCADE;
DROP VIEW IF EXISTS public.notifications_visible CASCADE;

-- Recreate views without SECURITY DEFINER property

-- 1. post_comment_counts - Count comments per post
CREATE OR REPLACE VIEW public.post_comment_counts AS
SELECT
    post_id,
    COUNT(*) as comment_count
FROM public.post_comments
GROUP BY post_id;

-- 2. post_like_counts - Count likes per post
CREATE OR REPLACE VIEW public.post_like_counts AS
SELECT
    post_id,
    COUNT(*) as like_count
FROM public.post_likes
GROUP BY post_id;

-- 3. post_with_counts - Posts with aggregated counts
CREATE OR REPLACE VIEW public.post_with_counts AS
SELECT
    p.*,
    COALESCE(pcc.comment_count, 0) as comment_count,
    COALESCE(plc.like_count, 0) as like_count
FROM public.posts p
LEFT JOIN public.post_comment_counts pcc ON p.id = pcc.post_id
LEFT JOIN public.post_like_counts plc ON p.id = plc.post_id;

-- 4. user_game_library - User game library with game details
CREATE OR REPLACE VIEW public.user_game_library AS
SELECT
    ul.user_id,
    ul.game_id,
    ul.status,
    ul.updated_at,
    g.name as game_name,
    g.cover_url,
    g.release_year
FROM public.library ul
JOIN public.games g ON ul.game_id = g.id;

-- 5. post_feed_v2 - Enhanced post feed with user and count data
CREATE OR REPLACE VIEW public.post_feed_v2 AS
SELECT
    p.*,
    u.username,
    u.avatar_url,
    COALESCE(pcc.comment_count, 0) as comment_count,
    COALESCE(plc.like_count, 0) as like_count
FROM public.posts p
JOIN public.profiles u ON p.user_id = u.id
LEFT JOIN public.post_comment_counts pcc ON p.id = pcc.post_id
LEFT JOIN public.post_like_counts plc ON p.id = plc.post_id;

-- 6. post_feed - Basic post feed with user and count data
CREATE OR REPLACE VIEW public.post_feed AS
SELECT
    p.*,
    u.username,
    u.avatar_url,
    COALESCE(pcc.comment_count, 0) as comment_count,
    COALESCE(plc.like_count, 0) as like_count
FROM public.posts p
JOIN public.profiles u ON p.user_id = u.id
LEFT JOIN public.post_comment_counts pcc ON p.id = pcc.post_id
LEFT JOIN public.post_like_counts plc ON p.id = plc.post_id;

-- 7. game_agg - Game aggregation with library and review counts
CREATE OR REPLACE VIEW public.game_agg AS
SELECT
    g.id,
    g.name,
    g.cover_url,
    COUNT(DISTINCT l.user_id) AS library_count,
    COUNT(DISTINCT r.id) AS review_count,
    AVG(r.rating) AS avg_rating,
    MAX(r.created_at) AS last_review_at
FROM public.games g
LEFT JOIN public.library l ON g.id = l.game_id
LEFT JOIN public.reviews r ON g.id = r.game_id
GROUP BY g.id, g.name, g.cover_url;

-- 8. game_rating_stats - Game rating statistics
CREATE OR REPLACE VIEW public.game_rating_stats AS
SELECT
    game_id,
    COUNT(*) AS ratings_count,
    AVG(rating) AS avg_stars,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS ratings_7d
FROM public.reviews
GROUP BY game_id;

-- 9. notifications_visible - Visible notifications with user details
CREATE OR REPLACE VIEW public.notifications_visible AS
SELECT
    n.id,
    n.type,
    n.user_id,
    n.actor_id,
    n.game_id,
    n.comment_id,
    n.meta,
    n.created_at,
    n.read_at,
    p.username AS actor_username,
    p.avatar_url AS actor_avatar_url
FROM public.notifications n
LEFT JOIN public.profiles p ON n.actor_id = p.id
WHERE n.user_id = auth.uid();
