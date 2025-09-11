-- Optimize rating_agg RLS policies to avoid per-row auth initplan cost

ALTER TABLE public.rating_agg ENABLE ROW LEVEL SECURITY;

-- Replace INSERT policy with SELECT-wrapped auth call
DROP POLICY IF EXISTS "Rating agg insert by authenticated" ON public.rating_agg;
CREATE POLICY "Rating agg insert by authenticated" ON public.rating_agg
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- Replace UPDATE policy with SELECT-wrapped auth call
DROP POLICY IF EXISTS "Rating agg update by authenticated" ON public.rating_agg;
CREATE POLICY "Rating agg update by authenticated" ON public.rating_agg
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);


