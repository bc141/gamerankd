// src/lib/likes.ts
import type { SupabaseClient } from '@supabase/supabase-js';

export type LikeEntry = { liked: boolean; count: number };

export function likeKey(reviewUserId: string, gameId: number) {
  return `${reviewUserId}:${gameId}`;
}

type Pair = { reviewUserId: string; gameId: number };

/**
 * Bulk prefetch counts + viewer-like state for a small set of (reviewUserId, gameId) pairs.
 * We fetch all matching rows, then count client-side. For 10–50 items this is fast and simple.
 */
export async function fetchLikesBulk(
  supabase: SupabaseClient,
  viewerId: string | null,
  pairs: Pair[]
): Promise<Record<string, LikeEntry>> {
  const uniqGameIds = Array.from(new Set(pairs.map(p => p.gameId)));
  const uniqUserIds = Array.from(new Set(pairs.map(p => p.reviewUserId)));

  if (uniqGameIds.length === 0 || uniqUserIds.length === 0) return {};

  // All likes that match our visible set
  const { data: allLikes, error: allErr } = await supabase
    .from('likes')
    .select('review_user_id, game_id')
    .in('game_id', uniqGameIds)
    .in('review_user_id', uniqUserIds);

  if (allErr || !Array.isArray(allLikes)) return {};

  // Viewer’s likes within the same visible set
  let mineRows: { review_user_id: string; game_id: number }[] = [];
  if (viewerId) {
    const { data: mine, error: mineErr } = await supabase
      .from('likes')
      .select('review_user_id, game_id')
      .eq('liker_id', viewerId)            // ← FIX: use liker_id, not user_id
      .in('game_id', uniqGameIds)
      .in('review_user_id', uniqUserIds);

    if (!mineErr && Array.isArray(mine)) mineRows = mine as any[];
  }

  // Count totals per pair
  const counts = new Map<string, number>();
  for (const row of allLikes) {
    const k = likeKey(String(row.review_user_id), Number(row.game_id));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const mineSet = new Set(
    mineRows.map(r => likeKey(String(r.review_user_id), Number(r.game_id)))
  );

  const out: Record<string, LikeEntry> = {};
  for (const p of pairs) {
    const k = likeKey(p.reviewUserId, p.gameId);
    out[k] = { liked: mineSet.has(k), count: counts.get(k) ?? 0 };
  }
  return out;
}

/**
 * Toggle like for one review (by (reviewUserId, gameId)).
 * Uses RPC so the DB sets liker_id = auth.uid(), which satisfies RLS.
 * Returns the authoritative { liked, count } from Postgres.
 */
export async function toggleLike(
  supabase: SupabaseClient,
  reviewUserId: string,
  gameId: number
): Promise<{ liked: boolean; count: number; error: any | null }> {
  const { data, error } = await supabase.rpc('toggle_like', {
    p_review_user_id: reviewUserId,
    p_game_id: gameId,
  });

  if (error) return { liked: false, count: 0, error };
  const row = Array.isArray(data) ? data[0] : data; // set-returning funcs come back as arrays
  return {
    liked: !!row?.liked,
    count: Number(row?.count ?? 0),
    error: null,
  };
}

/** Cross-tab + same-page broadcast so likes stay in sync everywhere. */
const LS_KEY = 'gb-like-sync';

export function broadcastLike(
  reviewUserId: string,
  gameId: number,
  liked: boolean,
  delta: number
) {
  const payload = { t: Date.now(), reviewUserId, gameId, liked, delta };
  try {
    // same-tab
    window.dispatchEvent(new CustomEvent(LS_KEY, { detail: payload }));
    // other tabs
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
  } catch {}
}

export function addLikeListener(
  handler: (d: { reviewUserId: string; gameId: number; liked: boolean; delta: number }) => void
) {
  const onLocal = (e: Event) => {
    const d = (e as CustomEvent).detail;
    if (d && typeof d === 'object') handler(d);
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key !== LS_KEY || !e.newValue) return;
    try {
      const d = JSON.parse(e.newValue);
      handler(d);
    } catch {}
  };
  window.addEventListener(LS_KEY as any, onLocal);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(LS_KEY as any, onLocal);
    window.removeEventListener('storage', onStorage);
  };
}