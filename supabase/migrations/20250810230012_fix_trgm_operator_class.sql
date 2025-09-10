-- Fix pg_trgm Operator Class Issues
-- This migration fixes the gin_trgm_ops operator class issue after moving pg_trgm to extensions schema

-- First, ensure pg_trgm extension is properly installed in extensions schema
create extension if not exists pg_trgm with schema extensions;

-- Create a simple text search index using the extensions schema operator class
-- We'll use the operator class from the extensions schema directly
create index if not exists games_name_trgm_idx 
  on public.games using gin (name extensions.gin_trgm_ops);

create index if not exists games_name_similarity_idx 
  on public.games using gin (name extensions.gin_trgm_ops);

-- Grant usage on the operator class from extensions schema
grant usage on operator class extensions.gin_trgm_ops to authenticated, anon;
