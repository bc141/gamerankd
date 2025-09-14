-- Bring post_media to expected shape used by app
-- Add missing columns safely and constraints if they don't exist

-- post_id uuid → references posts(id)
ALTER TABLE public.post_media
  ADD COLUMN IF NOT EXISTS post_id uuid;

DO $$ BEGIN
  -- add FK if not present
  PERFORM 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid AND t.relname = 'post_media'
    WHERE c.conname = 'post_media_post_id_fkey';
  IF NOT FOUND THEN
    ALTER TABLE public.post_media
      ADD CONSTRAINT post_media_post_id_fkey FOREIGN KEY (post_id)
      REFERENCES public.posts(id) ON DELETE CASCADE;
  END IF;
END $$;

-- url text NOT NULL
ALTER TABLE public.post_media
  ADD COLUMN IF NOT EXISTS url text;
UPDATE public.post_media SET url = url WHERE url IS NULL; -- no-op but ensures column exists
ALTER TABLE public.post_media ALTER COLUMN url SET NOT NULL;

-- media_type text CHECK in ('image','video') with default 'image'
ALTER TABLE public.post_media
  ADD COLUMN IF NOT EXISTS media_type text;
UPDATE public.post_media SET media_type = 'image' WHERE media_type IS NULL;
DO $$ BEGIN
  PERFORM 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid AND t.relname = 'post_media'
   WHERE c.conname = 'post_media_type_chk';
  IF NOT FOUND THEN
    ALTER TABLE public.post_media
      ADD CONSTRAINT post_media_type_chk CHECK (media_type IN ('image','video'));
  END IF;
END $$;

-- created_at timestamptz default now()
ALTER TABLE public.post_media
  ADD COLUMN IF NOT EXISTS created_at timestamptz;
UPDATE public.post_media SET created_at = now() WHERE created_at IS NULL;
ALTER TABLE public.post_media ALTER COLUMN created_at SET DEFAULT now();

-- RLS policies (idempotent)
ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='post_media' AND policyname='Anyone can view post media'
  ) THEN
    CREATE POLICY "Anyone can view post media" ON public.post_media
      FOR SELECT TO anon, authenticated
      USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='post_media' AND policyname='Users manage media of own posts'
  ) THEN
    CREATE POLICY "Users manage media of own posts" ON public.post_media
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid()));
  END IF;
END $$;

GRANT SELECT ON public.post_media TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.post_media TO authenticated;

