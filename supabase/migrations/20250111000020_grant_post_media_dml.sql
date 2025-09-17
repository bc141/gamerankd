-- Grant DML on post_media so authenticated clients can write (RLS still enforces ownership)
GRANT INSERT, UPDATE, DELETE ON public.post_media TO authenticated;
GRANT SELECT ON public.post_media TO anon, authenticated;

