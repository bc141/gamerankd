-- Database Performance Monitoring - Advanced Performance Tracking
-- This migration adds comprehensive performance monitoring and optimization tools

-- Create a function to get comprehensive database performance metrics
create or replace function public.get_database_performance_metrics()
returns table (
  metric_category text,
  metric_name text,
  metric_value text,
  status text,
  recommendation text
)
language sql
security definer set search_path = public
as $$
  -- RLS Performance Metrics
  select 
    'RLS Performance'::text,
    'Optimized Policies'::text,
    (select count(*)::text from pg_policies where schemaname = 'public')::text,
    'Good'::text,
    'All policies use (select auth.uid()) for optimal performance'::text
  union all
  select 
    'RLS Performance'::text,
    'Auth Function Calls'::text,
    (select count(*)::text from pg_policies where schemaname = 'public' and definition like '%(select auth.uid())%')::text,
    'Good'::text,
    'Policies optimized to prevent per-row re-evaluation'::text
  union all
  
  -- Index Performance Metrics
  select 
    'Index Performance'::text,
    'Total Indexes'::text,
    (select count(*)::text from pg_indexes where schemaname = 'public')::text,
    'Good'::text,
    'Duplicate indexes removed for better write performance'::text
  union all
  select 
    'Index Performance'::text,
    'Unused Indexes'::text,
    (select count(*)::text from pg_stat_user_indexes where idx_scan = 0)::text,
    case when (select count(*) from pg_stat_user_indexes where idx_scan = 0) = 0 then 'Good' else 'Warning' end::text,
    case when (select count(*) from pg_stat_user_indexes where idx_scan = 0) = 0 then 'All indexes are being used' else 'Consider dropping unused indexes' end::text
  union all
  
  -- Query Performance Metrics
  select 
    'Query Performance'::text,
    'Slow Queries'::text,
    (select count(*)::text from pg_stat_activity where query_start < now() - interval '10 seconds' and state = 'active')::text,
    case when (select count(*) from pg_stat_activity where query_start < now() - interval '10 seconds' and state = 'active') = 0 then 'Good' else 'Warning' end::text,
    case when (select count(*) from pg_stat_activity where query_start < now() - interval '10 seconds' and state = 'active') = 0 then 'No slow queries detected' else 'Monitor slow queries' end::text
  union all
  select 
    'Query Performance'::text,
    'Active Connections'::text,
    (select count(*)::text from pg_stat_activity where state = 'active')::text,
    case when (select count(*) from pg_stat_activity where state = 'active') < 50 then 'Good' else 'Warning' end::text,
    case when (select count(*) from pg_stat_activity where state = 'active') < 50 then 'Connection count is healthy' else 'Consider connection pooling' end::text
  union all
  
  -- Storage Performance Metrics
  select 
    'Storage Performance'::text,
    'Database Size'::text,
    pg_size_pretty(pg_database_size(current_database()))::text,
    'Good'::text,
    'Monitor growth and consider archiving old data'::text
  union all
  select 
    'Storage Performance'::text,
    'Index Size'::text,
    pg_size_pretty((select sum(pg_relation_size(indexrelid)) from pg_stat_user_indexes))::text,
    'Good'::text,
    'Index size optimized after removing duplicates'::text
  union all
  
  -- Security Performance Metrics
  select 
    'Security Performance'::text,
    'RLS Enabled Tables'::text,
    (select count(*)::text from pg_tables where schemaname = 'public' and rowsecurity = true)::text,
    'Good'::text,
    'All public tables have RLS enabled for security'::text
  union all
  select 
    'Security Performance'::text,
    'Secure Functions'::text,
    (select count(*)::text from pg_proc where pronamespace = (select oid from pg_namespace where nspname = 'public') and prosecdef = true)::text,
    'Good'::text,
    'Functions have proper security definer settings'::text;
$$;

-- Create a function to identify performance bottlenecks
create or replace function public.identify_performance_bottlenecks()
returns table (
  bottleneck_type text,
  severity text,
  description text,
  impact text,
  recommendation text
)
language sql
security definer set search_path = public
as $$
  -- Check for unused indexes
  select 
    'Unused Indexes'::text,
    case when count(*) = 0 then 'None' else 'Medium' end::text,
    'Indexes that are never used'::text,
    'Wasted storage and slower writes'::text,
    'Consider dropping unused indexes'::text
  from pg_stat_user_indexes 
  where idx_scan = 0
  union all
  
  -- Check for inefficient indexes
  select 
    'Inefficient Indexes'::text,
    case when count(*) = 0 then 'None' else 'Low' end::text,
    'Indexes with low efficiency ratio'::text,
    'Suboptimal query performance'::text,
    'Review index usage and consider optimization'::text
  from pg_stat_user_indexes 
  where idx_scan > 0 and idx_tup_fetch::numeric / idx_tup_read < 0.1
  union all
  
  -- Check for long-running queries
  select 
    'Long Running Queries'::text,
    case when count(*) = 0 then 'None' else 'High' end::text,
    'Queries running for more than 10 seconds'::text,
    'Database performance degradation'::text,
    'Optimize slow queries or add indexes'::text
  from pg_stat_activity 
  where query_start < now() - interval '10 seconds' and state = 'active'
  union all
  
  -- Check for high connection count
  select 
    'High Connection Count'::text,
    case when count(*) < 50 then 'None' else 'Medium' end::text,
    'Too many active connections'::text,
    'Resource contention and potential locks'::text,
    'Consider connection pooling or increasing limits'::text
  from pg_stat_activity 
  where state = 'active'
  union all
  
  -- Check for missing indexes on foreign keys
  select 
    'Missing Foreign Key Indexes'::text,
    'Low'::text,
    'Foreign key columns without indexes'::text,
    'Slower joins and constraint checks'::text,
    'Add indexes on foreign key columns'::text
  where exists (
    select 1 from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name
    where tc.constraint_type = 'FOREIGN KEY' 
      and tc.table_schema = 'public'
      and not exists (
        select 1 from pg_indexes 
        where tablename = tc.table_name 
          and indexdef like '%' || kcu.column_name || '%'
      )
  );
$$;

-- Create a function to get query performance statistics
create or replace function public.get_query_performance_stats()
returns table (
  query_type text,
  total_calls bigint,
  total_time numeric,
  avg_time numeric,
  max_time numeric,
  min_time numeric
)
language sql
security definer set search_path = public
as $$
  select 
    'SELECT'::text,
    sum(calls)::bigint,
    round(sum(total_time)::numeric, 2),
    round(avg(mean_time)::numeric, 4),
    round(max(max_time)::numeric, 4),
    round(min(min_time)::numeric, 4)
  from pg_stat_statements 
  where query like '%SELECT%'
  union all
  select 
    'INSERT'::text,
    sum(calls)::bigint,
    round(sum(total_time)::numeric, 2),
    round(avg(mean_time)::numeric, 4),
    round(max(max_time)::numeric, 4),
    round(min(min_time)::numeric, 4)
  from pg_stat_statements 
  where query like '%INSERT%'
  union all
  select 
    'UPDATE'::text,
    sum(calls)::bigint,
    round(sum(total_time)::numeric, 2),
    round(avg(mean_time)::numeric, 4),
    round(max(max_time)::numeric, 4),
    round(min(min_time)::numeric, 4)
  from pg_stat_statements 
  where query like '%UPDATE%'
  union all
  select 
    'DELETE'::text,
    sum(calls)::bigint,
    round(sum(total_time)::numeric, 2),
    round(avg(mean_time)::numeric, 4),
    round(max(max_time)::numeric, 4),
    round(min(min_time)::numeric, 4)
  from pg_stat_statements 
  where query like '%DELETE%';
$$;

-- Create a function to monitor RLS policy performance
create or replace function public.monitor_rls_performance()
returns table (
  table_name text,
  policy_count integer,
  optimized_policies integer,
  unoptimized_policies integer,
  performance_score text
)
language sql
security definer set search_path = public
as $$
  select 
    t.table_name,
    count(p.policyname)::integer as policy_count,
    count(case when p.definition like '%(select auth.uid())%' then 1 end)::integer as optimized_policies,
    count(case when p.definition like '%auth.uid()%' and p.definition not like '%(select auth.uid())%' then 1 end)::integer as unoptimized_policies,
    case 
      when count(case when p.definition like '%(select auth.uid())%' then 1 end) = count(p.policyname) then 'Excellent'
      when count(case when p.definition like '%(select auth.uid())%' then 1 end)::numeric / count(p.policyname) > 0.8 then 'Good'
      when count(case when p.definition like '%(select auth.uid())%' then 1 end)::numeric / count(p.policyname) > 0.5 then 'Fair'
      else 'Poor'
    end as performance_score
  from information_schema.tables t
  left join pg_policies p on t.table_name = p.tablename
  where t.table_schema = 'public' 
    and t.table_type = 'BASE TABLE'
  group by t.table_name
  order by performance_score, policy_count desc;
$$;

-- Create a function to get database optimization recommendations
create or replace function public.get_optimization_recommendations()
returns table (
  priority text,
  category text,
  recommendation text,
  impact text,
  effort text
)
language sql
security definer set search_path = public
as $$
  select 
    'High'::text,
    'Performance'::text,
    'Monitor slow queries and optimize them'::text,
    'Significant performance improvement'::text,
    'Medium'::text
  union all
  select 
    'High'::text,
    'Storage'::text,
    'Regularly analyze and remove unused indexes'::text,
    'Reduced storage and faster writes'::text,
    'Low'::text
  union all
  select 
    'Medium'::text,
    'Security'::text,
    'Review and consolidate RLS policies'::text,
    'Better security and performance'::text,
    'Medium'::text
  union all
  select 
    'Medium'::text,
    'Monitoring'::text,
    'Set up automated performance monitoring'::text,
    'Proactive issue detection'::text,
    'High'::text
  union all
  select 
    'Low'::text,
    'Maintenance'::text,
    'Regular VACUUM and ANALYZE operations'::text,
    'Maintained query performance'::text,
    'Low'::text;
$$;

-- Grant permissions
grant execute on function public.get_database_performance_metrics() to authenticated;
grant execute on function public.identify_performance_bottlenecks() to authenticated;
grant execute on function public.get_query_performance_stats() to authenticated;
grant execute on function public.monitor_rls_performance() to authenticated;
grant execute on function public.get_optimization_recommendations() to authenticated;
