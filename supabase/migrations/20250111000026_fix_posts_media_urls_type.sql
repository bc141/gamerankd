-- Ensure posts.media_urls is an array of text
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='posts' AND column_name='media_urls' AND data_type <> 'ARRAY'
  ) THEN
    ALTER TABLE public.posts
      ALTER COLUMN media_urls TYPE text[]
      USING (
        CASE
          WHEN media_urls IS NULL THEN NULL
          WHEN left(media_urls,1) = '{' THEN string_to_array(replace(replace(trim(both '{}' from media_urls),'"',''),' ',''), ',')
          ELSE ARRAY[media_urls]::text[]
        END
      );
  END IF;
END $$;

