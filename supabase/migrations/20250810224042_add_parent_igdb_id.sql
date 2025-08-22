-- Add parent_igdb_id field to track edition relationships
alter table public.games 
add column if not exists parent_igdb_id integer;

-- Add index on parent_igdb_id for efficient lookups
create index if not exists games_parent_igdb_id_idx on public.games(parent_igdb_id);

-- Add foreign key constraint to self-reference (optional, for data integrity)
-- alter table public.games add constraint games_parent_fk 
--   foreign key (parent_igdb_id) references public.games(igdb_id);
