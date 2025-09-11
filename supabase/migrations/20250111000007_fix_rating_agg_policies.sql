-- Fix RLS blocking writes to rating_agg
-- Context: Users cannot rate/edit due to RLS on rating_agg allowing only SELECT.
-- Approach: Allow authenticated users to INSERT/UPDATE aggregated rows.

-- Ensure RLS is enabled (should already be from earlier migration)
ALTER TABLE public.rating_agg ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert rows into rating_agg
DROP POLICY IF EXISTS "Rating agg insert by authenticated" ON public.rating_agg;
CREATE POLICY "Rating agg insert by authenticated" ON public.rating_agg
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow authenticated users to update rows in rating_agg
DROP POLICY IF EXISTS "Rating agg update by authenticated" ON public.rating_agg;
CREATE POLICY "Rating agg update by authenticated" ON public.rating_agg
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Keep public read access (policy should already exist from prior migration)
-- CREATE POLICY "Rating agg is viewable by everyone" ... (left intact)

-- (Optional) Ensure privileges are present
GRANT INSERT, UPDATE ON public.rating_agg TO authenticated;

