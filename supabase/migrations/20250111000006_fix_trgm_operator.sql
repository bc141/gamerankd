-- Fix trigram operator class issue

-- First ensure pg_trgm extension is properly installed
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Drop the problematic index if it exists
DROP INDEX IF EXISTS public.games_name_trgm_idx;

-- Recreate the index with the correct operator class
CREATE INDEX IF NOT EXISTS games_name_trgm_idx ON public.games USING gin (name gin_trgm_ops);
