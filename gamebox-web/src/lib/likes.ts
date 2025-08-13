// gamebox-web/src/lib/likes.ts
import type { SupabaseClient } from '@supabase/supabase-js';

export const likeKey = (reviewUserId: string, gameId: number) =>
  `${reviewUserId}:${gameId}`;

export async function toggleLike(
  supabase: SupabaseClient,
  meId: string,
  reviewUserId: string,
  gameId: number,
  currentlyLiked: boolean
) {
  if (currentlyLiked) {
    const { error } = await supabase
      .from('likes')
      .delete()
      .eq('liker_id', meId)
      .eq('review_user_id', reviewUserId)
      .eq('game_id', gameId);
    return { error };
  } else {
    const { error } = await supabase
      .from('likes')
      .upsert(
        { liker_id: meId, review_user_id: reviewUserId, game_id: gameId },
        { onConflict: 'liker_id,review_user_id,game_id' }
      );
    return { error };
  }
}

type Pair = { reviewUserId: string; gameId: number };

export async function getLikeStateForPairs(
  supabase: SupabaseClient,
  meId: string,
  pairs: Pair[]
): Promise<{ likedKeys: Set<string>; counts: Record<string, number> }> {
  if (!pairs.length) return { likedKeys: new Set(), counts: {} };

  // dedupe pairs
  const uniq = Array.from(new Map(pairs.map(p => [likeKey(p.reviewUserId, p.gameId), p])).values());
  const userIds = Array.from(new Set(uniq.map(p => p.reviewUserId)));
  const gameIds = Array.from(new Set(uniq.map(p => p.gameId)));

  // 1) counts for all pairs (filter exact in JS)
  const { data: allRows, error: cErr } = await supabase
    .from('likes')
    .select('review_user_id, game_id')
    .in('review_user_id', userIds)
    .in('game_id', gameIds);

  if (cErr) return { likedKeys: new Set(), counts: {} };

  const counts: Record<string, number> = {};
  for (const r of allRows ?? []) {
    const k = likeKey(String(r.review_user_id), Number(r.game_id));
    counts[k] = (counts[k] ?? 0) + 1;
  }

  // 2) which of those are liked by me?
  const { data: mine } = await supabase
    .from('likes')
    .select('review_user_id, game_id')
    .eq('liker_id', meId)
    .in('review_user_id', userIds)
    .in('game_id', gameIds);

  const likedKeys = new Set<string>(
    (mine ?? []).map(r => likeKey(String(r.review_user_id), Number(r.game_id)))
  );

  return { likedKeys, counts };
}