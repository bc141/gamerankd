-- Fix function conflict by dropping and recreating game_search function

-- Drop the existing function first
DROP FUNCTION IF EXISTS public.game_search(text, integer);

-- Recreate the function with the correct signature
CREATE OR REPLACE FUNCTION public.game_search(q text, lim integer default 10)
RETURNS TABLE (
  id bigint,
  igdb_id integer,
  name text,
  cover_url text,
  release_year integer,
  summary text,
  aliases text[]
)
LANGUAGE sql stable
AS $$
  SELECT
    g.id,
    g.igdb_id,
    g.name,
    g.cover_url,
    g.release_year,
    g.summary,
    g.aliases
  FROM public.games g
  WHERE
    -- Only show base titles (not editions)
    g.parent_igdb_id is null
    -- Text search on name and aliases
    AND (
      g.name ilike '%' || q || '%'
      OR EXISTS (
        SELECT 1 FROM unnest(g.aliases) as alias
        WHERE alias ilike '%' || q || '%'
      )
    )
  ORDER BY
    -- Prioritize exact matches, then name similarity
    CASE WHEN g.name ilike q THEN 1
         WHEN g.name ilike q || '%' THEN 2
         WHEN g.name ilike '%' || q THEN 3
         ELSE 4 END,
    g.name
  LIMIT lim;
$$;
