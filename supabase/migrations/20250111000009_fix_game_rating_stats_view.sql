-- Normalize game_rating_stats view to match frontend expectations
-- Frontend expects: review_count, avg_rating_100 columns

DROP VIEW IF EXISTS public.game_rating_stats CASCADE;

CREATE VIEW public.game_rating_stats AS
SELECT
  r.game_id,
  COUNT(*)::integer AS review_count,
  AVG(r.rating)::numeric(10,2) AS avg_rating_100
FROM public.reviews r
GROUP BY r.game_id;

GRANT SELECT ON public.game_rating_stats TO anon, authenticated;

