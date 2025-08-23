# Materialized View Setup for High Traffic Optimization

## Overview

This setup provides a scalable solution for game rating statistics using a materialized view with automatic refresh triggers. It's designed for high-traffic scenarios where live aggregates might become expensive.

## What It Provides

- **Materialized View**: `game_rating_stats` - pre-computed rating statistics for each game
- **Automatic Refresh**: Triggers that update the view whenever reviews change
- **Fallback Support**: Code gracefully falls back to live aggregates if the view doesn't exist

## Database Migration

When Docker is available, run the migration to create the materialized view:

```bash
cd supabase
npx supabase db reset
```

Or apply just the new migration:

```bash
npx supabase migration up
```

## Migration Details

The migration creates:

1. **Materialized View**: `game_rating_stats`
   - `game_id`: Game identifier
   - `review_count`: Total number of ratings
   - `avg_rating_100`: Average rating (1-100 scale)

2. **Unique Index**: For efficient lookups by game_id

3. **Refresh Function**: `refresh_game_rating_stats()`

4. **Trigger Function**: `trigger_refresh_game_rating_stats()`

5. **Triggers**: Automatically refresh the view after INSERT/UPDATE/DELETE on reviews

## How It Works

1. **Initial Load**: The materialized view is populated with existing data
2. **Real-time Updates**: Triggers automatically refresh the view when reviews change
3. **Efficient Queries**: Single row lookup instead of scanning all reviews
4. **Fallback**: If the view doesn't exist, code uses live aggregates

## Performance Benefits

- **Before**: O(n) scan of all reviews for each game page load
- **After**: O(1) lookup from pre-computed statistics
- **Scalability**: Performance remains constant regardless of review count

## Manual Refresh (if needed)

```sql
SELECT refresh_game_rating_stats();
```

## Monitoring

Check if the materialized view is working:

```sql
SELECT * FROM game_rating_stats LIMIT 5;
SELECT COUNT(*) FROM game_rating_stats;
```

## Fallback Behavior

The code automatically detects if the materialized view exists:
- ✅ **View exists**: Uses efficient single-row lookup
- ❌ **View missing**: Falls back to live aggregate calculation
- 🔄 **Best of both**: Immediate performance + graceful degradation

## When to Use

- **Current**: Live aggregates work fine for moderate traffic
- **High Traffic**: Materialized view provides consistent performance
- **Future**: Easy to switch between approaches based on needs
