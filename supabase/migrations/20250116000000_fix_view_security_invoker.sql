-- Ensure critical feed views use invoker security semantics
-- This addresses Supabase security advisor warnings about SECURITY DEFINER views.

DO $$ BEGIN
  EXECUTE 'ALTER VIEW public.post_comment_counts SET (security_invoker = true)';
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'ALTER VIEW public.post_like_counts SET (security_invoker = true)';
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'ALTER VIEW public.post_with_counts SET (security_invoker = true)';
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'ALTER VIEW public.feed_unified_v1 SET (security_invoker = true)';
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'ALTER VIEW public.post_feed SET (security_invoker = true)';
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'ALTER VIEW public.post_feed_v2 SET (security_invoker = true)';
EXCEPTION WHEN undefined_object THEN NULL; END $$;

GRANT SELECT ON public.post_comment_counts TO authenticated;
GRANT SELECT ON public.post_comment_counts TO service_role;
GRANT SELECT ON public.post_like_counts TO authenticated;
GRANT SELECT ON public.post_like_counts TO service_role;
GRANT SELECT ON public.post_with_counts TO authenticated;
GRANT SELECT ON public.post_with_counts TO service_role;
GRANT SELECT ON public.feed_unified_v1 TO authenticated;
GRANT SELECT ON public.feed_unified_v1 TO service_role;
GRANT SELECT ON public.post_feed TO authenticated;
GRANT SELECT ON public.post_feed TO service_role;
GRANT SELECT ON public.post_feed_v2 TO authenticated;
GRANT SELECT ON public.post_feed_v2 TO service_role;
