-- Force posts.media_urls to be text[] (array of text)
-- Drop dependent views first to allow column type changes
DROP VIEW IF EXISTS public.feed_unified_v1 CASCADE;
DROP VIEW IF EXISTS public.post_feed_v2 CASCADE;
DROP VIEW IF EXISTS public.post_feed CASCADE;
DROP VIEW IF EXISTS public.post_with_counts CASCADE;

ALTER TABLE public.posts
  ALTER COLUMN media_urls TYPE text[]
  USING (
    CASE
      WHEN media_urls IS NULL THEN NULL
      WHEN pg_typeof(media_urls)::text = 'text[]' THEN media_urls
      WHEN left(media_urls::text,1) = '{' THEN string_to_array(replace(replace(trim(both '{}' from media_urls::text),'"',''),' ',''), ',')
      ELSE ARRAY[media_urls::text]::text[]
    END
  );

