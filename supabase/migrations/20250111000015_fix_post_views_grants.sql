-- Ensure post views are queryable by authenticated users to allow hydration after insert
DO $$ BEGIN
  EXECUTE 'GRANT SELECT ON public.post_feed_v2 TO authenticated';
EXCEPTION WHEN undefined_table THEN
  -- ignore if view doesn't exist; fallback handled below
END $$;

DO $$ BEGIN
  EXECUTE 'GRANT SELECT ON public.post_feed TO authenticated';
EXCEPTION WHEN undefined_table THEN
  -- ignore if legacy view is absent
END $$;

-- Also ensure base tables used by hydration have SELECT for authenticated
DO $$ BEGIN
  EXECUTE 'GRANT SELECT ON public.posts TO authenticated';
EXCEPTION WHEN undefined_table THEN END $$;

DO $$ BEGIN
  EXECUTE 'GRANT SELECT ON public.post_with_counts TO authenticated';
EXCEPTION WHEN undefined_table THEN END $$;

DO $$ BEGIN
  EXECUTE 'GRANT SELECT ON public.post_like_counts TO authenticated';
EXCEPTION WHEN undefined_table THEN END $$;

DO $$ BEGIN
  EXECUTE 'GRANT SELECT ON public.post_comment_counts TO authenticated';
EXCEPTION WHEN undefined_table THEN END $$;

-- Profiles join is needed by the views
DO $$ BEGIN
  EXECUTE 'GRANT SELECT ON public.profiles TO authenticated';
EXCEPTION WHEN undefined_table THEN END $$;

