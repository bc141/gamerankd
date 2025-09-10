-- Database Monitoring & Maintenance
-- This migration adds monitoring, maintenance, and health check functions

-- Create database health check function
create or replace function public.database_health_check()
returns table (
  check_name text,
  status text,
  message text,
  severity text
)
language plpgsql
security definer set search_path = public
as $$
begin
  -- Check 1: Database connectivity
  return query select 'connectivity'::text, 'ok'::text, 'Database is accessible'::text, 'info'::text;
  
  -- Check 2: RLS policies enabled
  return query
  select 
    'rls_policies'::text,
    case when count(*) = 3 then 'ok' else 'warning' end::text,
    'RLS enabled on ' || count(*) || ' tables'::text,
    case when count(*) = 3 then 'info' else 'warning' end::text
  from pg_tables 
  where schemaname = 'public' 
    and tablename in ('games', 'reviews', 'profiles')
    and rowsecurity = true;
  
  -- Check 3: Index usage
  return query
  select 
    'index_usage'::text,
    case when count(*) > 0 then 'ok' else 'warning' end::text,
    'Found ' || count(*) || ' indexes'::text,
    case when count(*) > 0 then 'info' else 'warning' end::text
  from pg_indexes 
  where schemaname = 'public';
  
  -- Check 4: Recent activity
  return query
  select 
    'recent_activity'::text,
    case when count(*) > 0 then 'ok' else 'info' end::text,
    'Found ' || count(*) || ' recent reviews'::text,
    'info'::text
  from public.reviews 
  where created_at > now() - interval '24 hours';
  
  -- Check 5: Data integrity
  return query
  select 
    'data_integrity'::text,
    case when count(*) = 0 then 'ok' else 'warning' end::text,
    'Found ' || count(*) || ' constraint violations'::text,
    case when count(*) = 0 then 'info' else 'warning' end::text
  from (
    select 1 from public.games where length(name) = 0 or length(name) > 255
    union all
    select 1 from public.reviews where rating < 1 or rating > 100
    union all
    select 1 from public.profiles where username is not null and length(username) < 3
  ) violations;
end;
$$;

-- Create function to get database statistics
create or replace function public.get_database_stats()
returns table (
  metric_name text,
  metric_value bigint,
  description text
)
language sql
security definer set search_path = public
as $$
  select 'total_games'::text, count(*)::bigint, 'Total number of games'::text from public.games
  union all
  select 'total_reviews'::text, count(*)::bigint, 'Total number of reviews'::text from public.reviews
  union all
  select 'total_profiles'::text, count(*)::bigint, 'Total number of user profiles'::text from public.profiles
  union all
  select 'reviews_last_24h'::text, count(*)::bigint, 'Reviews created in last 24 hours'::text from public.reviews where created_at > now() - interval '24 hours'
  union all
  select 'games_last_24h'::text, count(*)::bigint, 'Games added in last 24 hours'::text from public.games where created_at > now() - interval '24 hours';
$$;

-- Create function to clean up old audit logs
create or replace function public.cleanup_audit_logs(retention_days integer default 90)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  deleted_count integer;
  games_deleted integer;
  reviews_deleted integer;
begin
  -- Clean up old games audit logs
  delete from public.games_audit 
  where changed_at < now() - (retention_days || ' days')::interval;
  
  get diagnostics games_deleted = row_count;
  
  -- Clean up old reviews audit logs
  delete from public.reviews_audit 
  where changed_at < now() - (retention_days || ' days')::interval;
  
  get diagnostics reviews_deleted = row_count;
  
  -- Calculate total deleted count
  deleted_count := games_deleted + reviews_deleted;
  
  -- Clean up old rate limit records
  delete from public.rate_limits 
  where created_at < now() - interval '7 days';
  
  return deleted_count;
end;
$$;

-- Create function to analyze slow queries (if pg_stat_statements is available)
create or replace function public.analyze_slow_queries()
returns table (
  query text,
  calls bigint,
  total_time numeric,
  mean_time numeric,
  max_time numeric
)
language plpgsql
security definer set search_path = public
as $$
begin
  -- Check if pg_stat_statements extension is available
  if exists (select 1 from pg_extension where extname = 'pg_stat_statements') then
    return query
    select 
      left(query, 100) as query,
      calls,
      round(total_exec_time::numeric, 2) as total_time,
      round(mean_exec_time::numeric, 2) as mean_time,
      round(max_exec_time::numeric, 2) as max_time
    from pg_stat_statements 
    where mean_exec_time > 100 -- Queries taking more than 100ms on average
    order by mean_exec_time desc
    limit 10;
  else
    -- Return empty result if extension is not available
    return query
    select 
      'pg_stat_statements not available'::text as query,
      0::bigint as calls,
      0::numeric as total_time,
      0::numeric as mean_time,
      0::numeric as max_time
    where false;
  end if;
end;
$$;

-- Create maintenance function
create or replace function public.run_maintenance()
returns table (
  task_name text,
  status text,
  details text
)
language plpgsql
security definer set search_path = public
as $$
declare
  deleted_count integer;
begin
  -- Task 1: Refresh materialized views
  perform public.refresh_game_stats();
  return query select 'refresh_materialized_views'::text, 'completed'::text, 'Game stats view refreshed'::text;
  
  -- Task 2: Clean up audit logs
  select public.cleanup_audit_logs(90) into deleted_count;
  return query select 'cleanup_audit_logs'::text, 'completed'::text, 'Deleted ' || deleted_count || ' old audit records'::text;
  
  -- Task 3: Update table statistics
  analyze public.games;
  analyze public.reviews;
  analyze public.profiles;
  return query select 'update_statistics'::text, 'completed'::text, 'Table statistics updated'::text;
  
  -- Task 4: Check for orphaned records
  select count(*) into deleted_count
  from public.reviews r
  left join public.games g on r.game_id = g.id
  where g.id is null;
  
  if deleted_count > 0 then
    delete from public.reviews 
    where game_id not in (select id from public.games);
    return query select 'cleanup_orphaned_reviews'::text, 'completed'::text, 'Deleted ' || deleted_count || ' orphaned reviews'::text;
  else
    return query select 'cleanup_orphaned_reviews'::text, 'skipped'::text, 'No orphaned reviews found'::text;
  end if;
end;
$$;

-- Grant permissions
grant execute on function public.database_health_check() to authenticated;
grant execute on function public.get_database_stats() to authenticated;
grant execute on function public.cleanup_audit_logs(integer) to authenticated;
grant execute on function public.analyze_slow_queries() to authenticated;
grant execute on function public.run_maintenance() to authenticated;
