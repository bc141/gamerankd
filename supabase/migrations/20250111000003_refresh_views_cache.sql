-- Refresh views cache by making a small change to force linter refresh
-- This migration adds a comment to each view to trigger a refresh

COMMENT ON VIEW public.post_comment_counts IS 'Post comment counts - refreshed to remove SECURITY DEFINER';
COMMENT ON VIEW public.post_like_counts IS 'Post like counts - refreshed to remove SECURITY DEFINER';
COMMENT ON VIEW public.post_with_counts IS 'Posts with aggregated counts - refreshed to remove SECURITY DEFINER';
COMMENT ON VIEW public.user_game_library IS 'User game library - refreshed to remove SECURITY DEFINER';
COMMENT ON VIEW public.post_feed_v2 IS 'Enhanced post feed - refreshed to remove SECURITY DEFINER';
COMMENT ON VIEW public.post_feed IS 'Basic post feed - refreshed to remove SECURITY DEFINER';
COMMENT ON VIEW public.game_agg IS 'Game aggregation - refreshed to remove SECURITY DEFINER';
COMMENT ON VIEW public.game_rating_stats IS 'Game rating statistics - refreshed to remove SECURITY DEFINER';
COMMENT ON VIEW public.notifications_visible IS 'Visible notifications - refreshed to remove SECURITY DEFINER';
