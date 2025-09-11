// src/lib/reviews.ts
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Return a map of game_id -> rating (1..100) for a given user.
 * Only queries the provided gameIds to keep it light.
 */
export async function fetchUserRatingsMap(
  supabase: SupabaseClient,
  userId: string,
  gameIds: number[]
): Promise<Record<number, number>> {
  if (!userId || gameIds.length === 0) return {};

  const { data, error } = await supabase
    .from('reviews')
    .select('game_id,rating')
    .eq('user_id', userId)
    .in('game_id', gameIds);

  if (error || !data) return {};

  const map: Record<number, number> = {};
  for (const r of data) {
    if (typeof r?.rating === 'number' && typeof r?.game_id === 'number') {
      map[r.game_id] = r.rating;
    }
  }
  return map;
}
