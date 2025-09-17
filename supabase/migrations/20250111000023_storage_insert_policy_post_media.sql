-- Ensure authenticated users can upload to post-media under their uid prefix
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can upload to post-media under their uid prefix'
  ) THEN
    CREATE POLICY "Users can upload to post-media under their uid prefix" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'post-media' AND position(auth.uid()::text || '/' in name) = 1);
  END IF;
END $$;

-- Ensure authenticated users can update/delete their own post-media files
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='storage' AND tablename='objects' AND policyname='Users manage own post-media files'
  ) THEN
    CREATE POLICY "Users manage own post-media files" ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = 'post-media' AND position(auth.uid()::text || '/' in name) = 1)
      WITH CHECK (bucket_id = 'post-media' AND position(auth.uid()::text || '/' in name) = 1);
  END IF;
END $$;

