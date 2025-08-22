-- Add game search RPC functions that filter out editions
create or replace function public.game_search(q text, lim integer default 10)
returns table (
  id bigint,
  igdb_id integer,
  name text,
  cover_url text,
  release_year integer,
  summary text,
  aliases text[]
)
language sql stable
as $$
  select 
    g.id,
    g.igdb_id,
    g.name,
    g.cover_url,
    g.release_year,
    g.summary,
    g.aliases
  from public.games g
  where 
    -- Only show base titles (not editions)
    g.parent_igdb_id is null
    -- Text search on name and aliases
    and (
      g.name ilike '%' || q || '%'
      or exists (
        select 1 from unnest(g.aliases) as alias
        where alias ilike '%' || q || '%'
      )
    )
  order by 
    -- Prioritize exact matches, then name similarity
    case when g.name ilike q then 1
         when g.name ilike q || '%' then 2
         when g.name ilike '%' || q then 3
         else 4 end,
    g.name
  limit lim;
$$;

-- Enhanced version for the search API
create or replace function public.game_search_v2(q text, lim integer default 10)
returns table (
  id bigint,
  igdb_id integer,
  name text,
  cover_url text,
  release_year integer,
  summary text,
  aliases text[],
  parent_igdb_id integer
)
language sql stable
as $$
  select 
    g.id,
    g.igdb_id,
    g.name,
    g.cover_url,
    g.release_year,
    g.summary,
    g.aliases,
    g.parent_igdb_id
  from public.games g
  where 
    -- Only show base titles (not editions)
    g.parent_igdb_id is null
    -- Text search on name and aliases
    and (
      g.name ilike '%' || q || '%'
      or exists (
        select 1 from unnest(g.aliases) as alias
        where alias ilike '%' || q || '%'
      )
    )
  order by 
    -- Prioritize exact matches, then name similarity
    case when g.name ilike q then 1
         when g.name ilike q || '%' then 2
         when g.name ilike '%' || q then 3
         else 4 end,
    g.name
  limit lim;
$$;

-- Grant execute permission
grant execute on function public.game_search(text, integer) to authenticated, anon;
grant execute on function public.game_search_v2(text, integer) to authenticated, anon;
