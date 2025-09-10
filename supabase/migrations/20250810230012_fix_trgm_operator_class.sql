-- Fix pg_trgm Operator Class Issues
-- This migration fixes the gin_trgm_ops operator class issue after moving pg_trgm to extensions schema

-- Ensure pg_trgm extension is available in both schemas
-- First in extensions schema for our secure functions
create extension if not exists pg_trgm with schema extensions;

-- Also ensure it's available in the default schema for operator classes
create extension if not exists pg_trgm;

-- Create text search indexes using the default gin_trgm_ops
create index if not exists games_name_trgm_idx 
  on public.games using gin (name gin_trgm_ops);

create index if not exists games_name_similarity_idx 
  on public.games using gin (name gin_trgm_ops);

-- Grant usage on the operator class
grant usage on operator class gin_trgm_ops to authenticated, anon;
