// src/lib/likes.ts
import type { SupabaseClient } from '@supabase/supabase-js';

export type LikeEntry = { liked: boolean; count: number };
export function likeKey(reviewUserId: string, gameId: number) {
  return `${reviewUserId}:${gameId}`;
}

type Pair = { reviewUserId: string; gameId: number };

// ----- safe browser storage helpers (SSR-proof) -----
const HAS_WINDOW = typeof window !== 'undefined';

function ssGet(key: string): string | null {
  try { return HAS_WINDOW ? window.sessionStorage.getItem(key) : null; } catch { return null; }
}
function ssSet(key: string, val: string) {
  try { if (HAS_WINDOW) window.sessionStorage.setItem(key, val); } catch {}
}
function lsSet(key: string, val: string) {
  try { if (HAS_WINDOW) window.localStorage.setItem(key, val); } catch {}
}

// per-tab id so we ignore our own broadcasts
const TAB_KEY = 'gb-like-tab';
function getTabId(): string {
  if (!HAS_WINDOW) return 'static-tab';
  let id = ssGet(TAB_KEY);
  if (!id) {
    try {
      id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
        ? crypto.randomUUID()
        : String(Math.random());
    } catch { id = String(Math.random()); }
    ssSet(TAB_KEY, id);
  }
  return id!;
}

// ----- bulk preload for visible set -----
export async function fetchLikesBulk(
  supabase: SupabaseClient,
  viewerId: string | null,
  pairs: Pair[]
): Promise<Record<string, LikeEntry>> {
  const uniqGameIds = Array.from(new Set(pairs.map(p => p.gameId)));
  const uniqUserIds = Array.from(new Set(pairs.map(p => p.reviewUserId)));
  if (uniqGameIds.length === 0 || uniqUserIds.length === 0) return {};

  const { data: allLikes, error: allErr } = await supabase
    .from('likes')
    .select('review_user_id, game_id')
    .in('game_id', uniqGameIds)
    .in('review_user_id', uniqUserIds);
  if (allErr) return {};

  let mine: { review_user_id: string; game_id: number }[] = [];
  if (viewerId) {
    const { data: myLikes } = await supabase
      .from('likes')
      .select('review_user_id, game_id')
      .eq('liker_id', viewerId) // IMPORTANT: liker_id column
      .in('game_id', uniqGameIds)
      .in('review_user_id', uniqUserIds);
    if (Array.isArray(myLikes)) mine = myLikes as any[];
  }

  const counts = new Map<string, number>();
  for (const row of (allLikes ?? [])) {
    const k = likeKey(String(row.review_user_id), Number(row.game_id));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const mineSet = new Set(
    mine.map(r => likeKey(String(r.review_user_id), Number(r.game_id)))
  );

  const out: Record<string, LikeEntry> = {};
  for (const p of pairs) {
    const k = likeKey(p.reviewUserId, p.gameId);
    out[k] = { liked: mineSet.has(k), count: counts.get(k) ?? 0 };
  }
  return out;
}

// ----- RPC toggle (returns authoritative { liked, count }) -----
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
  const row = Array.isArray(data) ? data[0] : data;
  return { liked: !!row?.liked, count: Number(row?.count ?? 0), error: null };
}

// ----- cross-tab broadcast (optional, harmless) -----
const LS_KEY = 'gb-like-sync';

export function broadcastLike(
  reviewUserId: string,
  gameId: number,
  liked: boolean,
  delta: number
) {
  const payload = {
    t: Date.now(),
    origin: getTabId(),
    reviewUserId,
    gameId,
    liked,
    delta,
  };
  try {
    if (HAS_WINDOW) {
      window.dispatchEvent(new CustomEvent(LS_KEY, { detail: payload }));
    }
  } catch {}
  lsSet(LS_KEY, JSON.stringify(payload));
}

export function addLikeListener(
  handler: (d: { reviewUserId: string; gameId: number; liked: boolean; delta: number }) => void
) {
  const localId = getTabId();
  const onLocal = (e: Event) => {
    const d = (e as CustomEvent).detail;
    if (!d || typeof d !== 'object') return;
    if ((d as any).origin === localId) return;
    handler(d);
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key !== LS_KEY || !e.newValue) return;
    try {
      const d = JSON.parse(e.newValue);
      if (!d || typeof d !== 'object') return;
      if (d.origin === localId) return;
      handler(d);
    } catch {}
  };
  if (HAS_WINDOW) {
    window.addEventListener(LS_KEY as any, onLocal as any);
    window.addEventListener('storage', onStorage);
  }
  return () => {
    if (HAS_WINDOW) {
      window.removeEventListener(LS_KEY as any, onLocal as any);
      window.removeEventListener('storage', onStorage);
    }
  };
}