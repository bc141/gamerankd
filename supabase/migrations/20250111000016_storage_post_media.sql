-- Create a storage bucket for post media (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'post-media'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('post-media', 'post-media', true);
  END IF;
END $$;

-- Public read policy for files in post-media
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Public can read post-media'
  ) THEN
    CREATE POLICY "Public can read post-media" ON storage.objects
      FOR SELECT TO anon, authenticated
      USING (bucket_id = 'post-media');
  END IF;
END $$;

-- Authenticated users can insert their own files under their user folder
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can upload to post-media under their uid prefix'
  ) THEN
    CREATE POLICY "Users can upload to post-media under their uid prefix" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'post-media'
        AND (position(auth.uid()::text || '/' in name) = 1)
      );
  END IF;
END $$;

-- Authenticated users can update/delete their own files
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users manage own post-media files'
  ) THEN
    CREATE POLICY "Users manage own post-media files" ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = 'post-media' AND (position(auth.uid()::text || '/' in name) = 1))
      WITH CHECK (bucket_id = 'post-media' AND (position(auth.uid()::text || '/' in name) = 1));
  END IF;
END $$;

-- Ensure post_media table exists (idempotent minimal)
-- This creates if missing; if it exists already, block will error, so guard
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='post_media'
  ) THEN
    CREATE TABLE public.post_media (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
      url text NOT NULL,
      media_type text NOT NULL CHECK (media_type IN ('image','video')),
      created_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Users manage media of own posts" ON public.post_media
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid()));
    GRANT SELECT ON public.post_media TO anon, authenticated;
  END IF;
END $$;

