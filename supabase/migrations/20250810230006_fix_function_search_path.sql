-- Fix Function Search Path Security Warnings
-- This migration adds security definer and search_path to all functions

-- Fix all functions to have proper search_path security
-- This prevents SQL injection attacks through search_path manipulation

-- Update touch_updated_at function
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Update library_set_updated_at function
create or replace function public.library_set_updated_at()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Update prevent_blocked_notification function
create or replace function public.prevent_blocked_notification()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Check if the user is blocked
  if exists (
    select 1 from public.blocks 
    where (blocker_id = new.user_id and blocked_id = new.target_user_id)
       or (blocker_id = new.target_user_id and blocked_id = new.user_id)
  ) then
    return null;
  end if;
  return new;
end;
$$;

-- Update delete_like_notifs function
create or replace function public.delete_like_notifs()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.notifications
  where type = 'like' and data->>'post_id' = old.post_id::text;
  return old;
end;
$$;

-- Update set_updated_at function
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Update rating_agg_apply function
create or replace function public.rating_agg_apply()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Update rating aggregation
  if TG_OP = 'INSERT' or TG_OP = 'UPDATE' then
    insert into public.rating_agg (game_id, total_ratings, average_rating)
    values (new.game_id, 1, new.rating)
    on conflict (game_id) do update set
      total_ratings = rating_agg.total_ratings + 1,
      average_rating = (rating_agg.average_rating * rating_agg.total_ratings + new.rating) / (rating_agg.total_ratings + 1);
  elsif TG_OP = 'DELETE' then
    update public.rating_agg
    set total_ratings = total_ratings - 1,
        average_rating = case 
          when total_ratings > 1 then (average_rating * total_ratings - old.rating) / (total_ratings - 1)
          else 0
        end
    where game_id = old.game_id;
  end if;
  return coalesce(new, old);
end;
$$;

-- Update trigger functions for reviews rating
create or replace function public.trg_reviews_rating_ins()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.rating_agg_apply();
  return new;
end;
$$;

create or replace function public.trg_reviews_rating_upd()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.rating_agg_apply();
  return new;
end;
$$;

create or replace function public.trg_reviews_rating_del()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.rating_agg_apply();
  return old;
end;
$$;

-- Update notification functions
create or replace function public.app_notify_follow()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, data)
  values (new.followed_id, 'follow', jsonb_build_object('follower_id', new.follower_id));
  return new;
end;
$$;

create or replace function public.app_notify_like()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, data)
  values (new.user_id, 'like', jsonb_build_object('post_id', new.post_id, 'liker_id', new.liker_id));
  return new;
end;
$$;

create or replace function public.app_clear_like()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.notifications
  where type = 'like' and data->>'post_id' = old.post_id::text and data->>'liker_id' = old.liker_id::text;
  return old;
end;
$$;

create or replace function public.app_notify_comment()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, data)
  values (new.user_id, 'comment', jsonb_build_object('post_id', new.post_id, 'commenter_id', new.commenter_id));
  return new;
end;
$$;

-- Update notification management functions (if notifications table exists)
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'notifications' and table_schema = 'public') then
    create or replace function public.get_notifications(user_id_param uuid)
    returns table (
      id bigint,
      type text,
      data jsonb,
      created_at timestamptz,
      read_at timestamptz
    )
    language sql
    security definer set search_path = public
    as $$
      select n.id, n.type, n.data, n.created_at, n.read_at
      from public.notifications n
      where n.user_id = user_id_param
      order by n.created_at desc;
    $$;
  end if;
end $$;

-- Update other notification functions (if notifications table exists)
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'notifications' and table_schema = 'public') then
    create or replace function public.mark_notifications_read(user_id_param uuid, notification_ids bigint[])
    returns void
    language plpgsql
    security definer set search_path = public
    as $$
    begin
      update public.notifications
      set read_at = now()
      where user_id = user_id_param and id = any(notification_ids);
    end;
    $$;

    create or replace function public.mark_all_notifications_read(user_id_param uuid)
    returns void
    language plpgsql
    security definer set search_path = public
    as $$
    begin
      update public.notifications
      set read_at = now()
      where user_id = user_id_param and read_at is null;
    end;
    $$;
  end if;
end $$;

-- Update game-related functions
create or replace function public.browse_games(limit_count integer default 20, offset_count integer default 0)
returns table (
  id bigint,
  igdb_id integer,
  name text,
  cover_url text,
  release_year integer,
  summary text
)
language sql
security definer set search_path = public
as $$
  select g.id, g.igdb_id, g.name, g.cover_url, g.release_year, g.summary
  from public.games g
  order by g.created_at desc
  limit limit_count offset offset_count;
$$;

-- Update block/mute functions
create or replace function public.toggle_block(blocker_id_param uuid, blocked_id_param uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  block_exists boolean;
begin
  select exists(
    select 1 from public.blocks 
    where blocker_id = blocker_id_param and blocked_id = blocked_id_param
  ) into block_exists;
  
  if block_exists then
    delete from public.blocks 
    where blocker_id = blocker_id_param and blocked_id = blocked_id_param;
    return false;
  else
    insert into public.blocks (blocker_id, blocked_id) 
    values (blocker_id_param, blocked_id_param);
    return true;
  end if;
end;
$$;

create or replace function public.toggle_mute(muter_id_param uuid, muted_id_param uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  mute_exists boolean;
begin
  select exists(
    select 1 from public.mutes 
    where muter_id = muter_id_param and muted_id = muted_id_param
  ) into mute_exists;
  
  if mute_exists then
    delete from public.mutes 
    where muter_id = muter_id_param and muted_id = muted_id_param;
    return false;
  else
    insert into public.mutes (muter_id, muted_id) 
    values (muter_id_param, muted_id_param);
    return true;
  end if;
end;
$$;

-- Update trigger function
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Update game search functions (already have search_path, but ensure they're secure)
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
language sql
security definer set search_path = public
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
    g.parent_igdb_id is null
    and (
      g.name ilike '%' || q || '%'
      or exists (
        select 1 from unnest(g.aliases) as alias
        where alias ilike '%' || q || '%'
      )
    )
  order by 
    case when g.name ilike q then 1
         when g.name ilike q || '%' then 2
         when g.name ilike '%' || q then 3
         else 4 end,
    g.name
  limit lim;
$$;

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
language sql
security definer set search_path = public
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
    g.parent_igdb_id is null
    and (
      g.name ilike '%' || q || '%'
      or exists (
        select 1 from unnest(g.aliases) as alias
        where alias ilike '%' || q || '%'
      )
    )
  order by 
    case when g.name ilike q then 1
         when g.name ilike q || '%' then 2
         when g.name ilike '%' || q then 3
         else 4 end,
    g.name
  limit lim;
$$;

-- Update other functions
create or replace function public.get_game_rating_stats(game_id_param bigint)
returns table (
  game_id bigint,
  total_reviews bigint,
  average_rating numeric,
  rating_distribution jsonb
)
language sql
security definer set search_path = public
as $$
  select 
    game_id_param as game_id,
    count(*) as total_reviews,
    round(avg(rating), 2) as average_rating,
    jsonb_object_agg(
      rating::text, 
      rating_count
    ) as rating_distribution
  from (
    select rating, count(*) as rating_count
    from public.reviews
    where game_id = game_id_param
    group by rating
  ) rating_counts;
$$;

-- Update _set_path function
create or replace function public._set_path()
returns text
language plpgsql
security definer set search_path = public
as $$
begin
  return 'public';
end;
$$;
