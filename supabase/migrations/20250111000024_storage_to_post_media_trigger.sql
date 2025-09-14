-- Sync storage object uploads to post_media automatically

-- Unique guard to avoid duplicates
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='post_media_post_url_uniq'
  ) THEN
    CREATE UNIQUE INDEX post_media_post_url_uniq ON public.post_media (post_id, url);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.fn_sync_storage_to_post_media()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  uid text;
  pid uuid;
  ext text;
  mtype text;
BEGIN
  IF NEW.bucket_id <> 'post-media' THEN
    RETURN NEW;
  END IF;

  -- Expect path like: <uid>/<post_id>/<filename>
  uid := split_part(NEW.name, '/', 1);
  pid := NULLIF(split_part(NEW.name, '/', 2), '')::uuid;
  ext := lower(split_part(NEW.name, '.', 2));
  mtype := CASE WHEN ext IN ('mp4','mov','webm','mkv') THEN 'video' ELSE 'image' END;

  IF pid IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only insert if post exists
  IF EXISTS (SELECT 1 FROM public.posts WHERE id = pid) THEN
    INSERT INTO public.post_media(post_id, url, media_type)
    VALUES (pid, NEW.name, mtype)
    ON CONFLICT (post_id, url) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_storage_to_post_media ON storage.objects;
CREATE TRIGGER trg_sync_storage_to_post_media
AFTER INSERT ON storage.objects
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_storage_to_post_media();

