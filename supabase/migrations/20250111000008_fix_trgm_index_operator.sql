-- Ensure pg_trgm extension and create the GIN trgm index in a schema-agnostic way
-- This pre-creates the index so older migrations that reference gin_trgm_ops skip safely

CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$
BEGIN
  -- Try creating with fully qualified operator class if extension was moved to `extensions` schema
  BEGIN
    EXECUTE 'CREATE INDEX IF NOT EXISTS games_name_trgm_idx ON public.games USING gin (name extensions.gin_trgm_ops)';
  EXCEPTION WHEN undefined_object THEN
    -- Fallback to unqualified operator class (default schema)
    EXECUTE 'CREATE INDEX IF NOT EXISTS games_name_trgm_idx ON public.games USING gin (name gin_trgm_ops)';
  END;
END
$$;


