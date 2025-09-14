-- Force posts.media_urls to be text[] (array of text)
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

