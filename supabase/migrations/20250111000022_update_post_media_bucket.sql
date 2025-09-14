-- Ensure storage bucket 'post-media' exists and is public
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'post-media') THEN
    UPDATE storage.buckets SET public = true WHERE id = 'post-media';
  ELSE
    INSERT INTO storage.buckets (id, name, public) VALUES ('post-media', 'post-media', true);
  END IF;
END $$;

-- Ensure public read policy exists (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Public can read post-media'
  ) THEN
    CREATE POLICY "Public can read post-media" ON storage.objects
      FOR SELECT TO anon, authenticated
      USING (bucket_id = 'post-media');
  END IF;
END $$;

