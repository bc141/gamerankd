-- Fix linter WARN 0003_auth_rls_initplan by SELECT-wrapping auth.*() in RLS policies
-- This updates a focused set of frequently-hit tables first: profiles, games, reviews, follows, likes, library.

-- PROFILES
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles: insert own'
  ) THEN
    DROP POLICY "profiles: insert own" ON public.profiles;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles: user can insert own'
  ) THEN
    DROP POLICY "profiles: user can insert own" ON public.profiles;
  END IF;
  CREATE POLICY "profiles: user can insert own" ON public.profiles
    FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = id);

  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles: update own'
  ) THEN
    DROP POLICY "profiles: update own" ON public.profiles;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles: user can update own'
  ) THEN
    DROP POLICY "profiles: user can update own" ON public.profiles;
  END IF;
  CREATE POLICY "profiles: user can update own" ON public.profiles
    FOR UPDATE
    USING ((SELECT auth.uid()) = id)
    WITH CHECK ((SELECT auth.uid()) = id);
END $$;

-- GAMES
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname='games: insert for authenticated' AND tablename='games') THEN
    DROP POLICY "games: insert for authenticated" ON public.games;
  END IF;
  CREATE POLICY "games: insert for authenticated" ON public.games
    FOR INSERT
    WITH CHECK ((SELECT auth.role()) = 'authenticated');

  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname='games: update for authenticated' AND tablename='games') THEN
    DROP POLICY "games: update for authenticated" ON public.games;
  END IF;
  CREATE POLICY "games: update for authenticated" ON public.games
    FOR UPDATE
    USING ((SELECT auth.role()) = 'authenticated')
    WITH CHECK ((SELECT auth.role()) = 'authenticated');

  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname='games: delete for authenticated' AND tablename='games') THEN
    DROP POLICY "games: delete for authenticated" ON public.games;
  END IF;
  CREATE POLICY "games: delete for authenticated" ON public.games
    FOR DELETE
    USING ((SELECT auth.role()) = 'authenticated');
END $$;

-- REVIEWS (generic own-row CRUD policy names)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reviews' AND policyname='users can CRUD their own reviews') THEN
    DROP POLICY "users can CRUD their own reviews" ON public.reviews;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reviews' AND policyname='reviews: insert own') THEN
    DROP POLICY "reviews: insert own" ON public.reviews;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reviews' AND policyname='reviews: update own') THEN
    DROP POLICY "reviews: update own" ON public.reviews;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reviews' AND policyname='reviews: delete own') THEN
    DROP POLICY "reviews: delete own" ON public.reviews;
  END IF;

  CREATE POLICY "reviews: insert own" ON public.reviews
    FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = user_id);

  CREATE POLICY "reviews: update own" ON public.reviews
    FOR UPDATE
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

  CREATE POLICY "reviews: delete own" ON public.reviews
    FOR DELETE
    USING ((SELECT auth.uid()) = user_id);
END $$;

-- LIBRARY (common policy names from warnings)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='library' AND policyname='lib_ins') THEN
    DROP POLICY lib_ins ON public.library;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='library' AND policyname='library_insert') THEN
    DROP POLICY library_insert ON public.library;
  END IF;
  CREATE POLICY library_insert ON public.library
    FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = user_id);

  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='library' AND policyname='lib_upd') THEN
    DROP POLICY lib_upd ON public.library;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='library' AND policyname='library_update') THEN
    DROP POLICY library_update ON public.library;
  END IF;
  CREATE POLICY library_update ON public.library
    FOR UPDATE
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='library' AND policyname='lib_del') THEN
    DROP POLICY lib_del ON public.library;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='library' AND policyname='library_delete') THEN
    DROP POLICY library_delete ON public.library;
  END IF;
  CREATE POLICY library_delete ON public.library
    FOR DELETE
    USING ((SELECT auth.uid()) = user_id);
END $$;

-- LIKES (review_likes / likes tables often use uid ownership)
DO $$
BEGIN
  -- review_likes insert/delete own
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='review_likes' AND policyname='review_likes: insert own') THEN
    DROP POLICY "review_likes: insert own" ON public.review_likes;
  END IF;
  CREATE POLICY "review_likes: insert own" ON public.review_likes
    FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = user_id);

  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='review_likes' AND policyname='review_likes: delete own') THEN
    DROP POLICY "review_likes: delete own" ON public.review_likes;
  END IF;
  CREATE POLICY "review_likes: delete own" ON public.review_likes
    FOR DELETE
    USING ((SELECT auth.uid()) = user_id);
END $$;


