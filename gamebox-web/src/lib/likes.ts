// src/lib/likes.ts
import type { SupabaseClient } from '@supabase/supabase-js';

export async function getLikeCounts(
  supabase: SupabaseClient,
  pairs: Array<{ review_user_id: string; game_id: number }>
): Promise<Record<string, number>> {
  if (pairs.length === 0) return {};
  // de-dup and query
  const ids = Array.from(new Set(pairs.map(p => `${p.review_user_id}:${p.game_id}`)));
  const { data, error } = await supabase
    .from('review_likes')
    .select('review_user_id, game_id');
  if (error) return {};
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const k = `${row.review_user_id}:${row.game_id}`;
    if (!ids.includes(k)) continue;
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

export async function didILike(
  supabase: SupabaseClient,
  meId: string,
  review_user_id: string,
  game_id: number
): Promise<boolean> {
  const { data } = await supabase
    .from('review_likes')
    .select('user_id')
    .eq('user_id', meId)
    .eq('review_user_id', review_user_id)
    .eq('game_id', game_id)
    .limit(1);
  return !!(data && data.length > 0);
}

export async function toggleLike(
  supabase: SupabaseClient,
  meId: string,
  review_user_id: string,
  game_id: number,
  currentlyLiked: boolean
): Promise<{ error: null | { message: string } }> {
  if (currentlyLiked) {
    const { error } = await supabase
      .from('review_likes')
      .delete()
      .eq('user_id', meId)
      .eq('review_user_id', review_user_id)
      .eq('game_id', game_id);
    return { error: error ?? null };
  } else {
    const { error } = await supabase
      .from('review_likes')
      .insert({ user_id: meId, review_user_id, game_id });
    return { error: error ?? null };
  }
}