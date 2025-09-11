-- Fix Security Definer Views
-- This migration recreates all 9 views without the SECURITY DEFINER property

-- Drop all views in dependency order (dependent views first)
DROP VIEW IF EXISTS public.post_feed_v2 CASCADE;
DROP VIEW IF EXISTS public.post_feed CASCADE;
DROP VIEW IF EXISTS public.post_with_counts CASCADE;
DROP VIEW IF EXISTS public.user_game_library CASCADE;
DROP VIEW IF EXISTS public.game_agg CASCADE;
DROP VIEW IF EXISTS public.post_like_counts CASCADE;
DROP VIEW IF EXISTS public.post_comment_counts CASCADE;
DROP VIEW IF EXISTS public.game_rating_stats CASCADE;
DROP VIEW IF EXISTS public.notifications_visible CASCADE;

-- Recreate views without SECURITY DEFINER property

-- 1. post_comment_counts - Count comments per post
CREATE VIEW public.post_comment_counts AS
SELECT 
    post_id,
    COUNT(*) as comment_count
FROM public.post_comments
GROUP BY post_id;

-- 2. post_like_counts - Count likes per post
CREATE VIEW public.post_like_counts AS
SELECT 
    post_id,
    COUNT(*) as like_count
FROM public.post_likes
GROUP BY post_id;

-- 3. post_with_counts - Posts with aggregated counts
CREATE VIEW public.post_with_counts AS
SELECT 
    p.*,
    COALESCE(pcc.comment_count, 0) as comment_count,
    COALESCE(plc.like_count, 0) as like_count
FROM public.posts p
LEFT JOIN public.post_comment_counts pcc ON p.id = pcc.post_id
LEFT JOIN public.post_like_counts plc ON p.id = plc.post_id;

-- 4. user_game_library - User game library with game details
-- Note: Using 'library' table (not 'user_library')
CREATE VIEW public.user_game_library AS
SELECT 
    l.user_id,
    l.game_id,
    l.status,
    l.updated_at,
    g.name as game_name,
    g.cover_url,
    g.release_year
FROM public.library l
JOIN public.games g ON l.game_id = g.id;

-- 5. post_feed_v2 - Enhanced post feed with user and count data
CREATE VIEW public.post_feed_v2 AS
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
CREATE VIEW public.post_feed AS
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
-- Note: Using 'library' table (not 'user_library')
CREATE VIEW public.game_agg AS
SELECT 
    g.id,
    g.name,
    g.cover_url,
    g.release_year,
    COUNT(DISTINCT l.user_id) as library_count,
    AVG(r.rating) as avg_rating,
    COUNT(r.id) as review_count
FROM public.games g
LEFT JOIN public.library l ON g.id = l.game_id
LEFT JOIN public.reviews r ON g.id = r.game_id
GROUP BY g.id, g.name, g.cover_url, g.release_year;

-- 8. game_rating_stats - Game rating statistics
CREATE VIEW public.game_rating_stats AS
SELECT 
    game_id,
    COUNT(*) as total_ratings,
    AVG(rating) as average_rating,
    MIN(rating) as min_rating,
    MAX(rating) as max_rating
FROM public.reviews
GROUP BY game_id;

-- 9. notifications_visible - Visible notifications with user details
CREATE VIEW public.notifications_visible AS
SELECT 
    n.*,
    u.username as from_username,
    u.avatar_url as from_avatar_url
FROM public.notifications n
JOIN public.profiles u ON n.actor_id = u.id
WHERE n.read_at IS NULL;

-- Grant necessary permissions to authenticated users
GRANT SELECT ON public.post_comment_counts TO authenticated;
GRANT SELECT ON public.post_like_counts TO authenticated;
GRANT SELECT ON public.post_with_counts TO authenticated;
GRANT SELECT ON public.user_game_library TO authenticated;
GRANT SELECT ON public.post_feed_v2 TO authenticated;
GRANT SELECT ON public.post_feed TO authenticated;
GRANT SELECT ON public.game_agg TO authenticated;
GRANT SELECT ON public.game_rating_stats TO authenticated;
GRANT SELECT ON public.notifications_visible TO authenticated;
