-- Allow public read of post_media rows while keeping writes restricted to owners
DO $$ BEGIN
  -- Create a SELECT policy if missing
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='post_media' AND policyname='Anyone can view post media'
  ) THEN
    CREATE POLICY "Anyone can view post media" ON public.post_media
      FOR SELECT TO anon, authenticated
      USING (true);
  END IF;
END $$;

-- Keep write operations restricted to post owners (already created earlier), but ensure it exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='post_media' AND policyname='Users manage media of own posts'
  ) THEN
    CREATE POLICY "Users manage media of own posts" ON public.post_media
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid()));
  END IF;
END $$;

GRANT SELECT ON public.post_media TO anon, authenticated;

