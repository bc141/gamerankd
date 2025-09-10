-- Fix SECURITY DEFINER Views - Security Fix
-- This migration removes SECURITY DEFINER from views to fix security issues

-- Drop and recreate views without SECURITY DEFINER
-- Note: We'll recreate them as regular views or functions with proper security

-- Drop problematic views
drop view if exists public.post_comment_counts cascade;
drop view if exists public.post_with_counts cascade;
drop view if exists public.user_game_library cascade;
drop view if exists public.post_feed_v2 cascade;
drop view if exists public.post_like_counts cascade;
drop view if exists public.post_feed cascade;
drop view if exists public.game_agg cascade;
drop view if exists public.game_rating_stats cascade;
drop view if exists public.notifications_visible cascade;

-- Note: Functions for non-existent tables will be created when those tables are added
-- This migration only handles dropping the problematic views
