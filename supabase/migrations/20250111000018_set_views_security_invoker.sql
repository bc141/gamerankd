-- Ensure views run with invoker privileges (Postgres 15+)
-- This avoids SECURITY DEFINER semantics on views

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
  EXECUTE 'ALTER VIEW public.post_feed SET (security_invoker = true)';
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'ALTER VIEW public.post_feed_v2 SET (security_invoker = true)';
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- Re-apply grants for safety
GRANT SELECT ON public.post_comment_counts TO authenticated;
GRANT SELECT ON public.post_like_counts TO authenticated;
GRANT SELECT ON public.post_with_counts TO authenticated;
GRANT SELECT ON public.post_feed TO authenticated;
GRANT SELECT ON public.post_feed_v2 TO authenticated;

