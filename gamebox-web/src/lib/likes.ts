// src/lib/likes.ts
import type { SupabaseClient } from '@supabase/supabase-js';

export type LikeEntry = { liked: boolean; count: number };

export function likeKey(reviewUserId: string, gameId: number) {
  return `${reviewUserId}:${gameId}`;
}

type Pair = { reviewUserId: string; gameId: number };

// ---------------- safety helpers ----------------
const HAS_WINDOW = typeof window !== 'undefined';

function safeSSGet(key: string): string | null {
  try {
    if (!HAS_WINDOW || !('sessionStorage' in window)) return null;
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSSSet(key: string, val: string) {
  try {
    if (!HAS_WINDOW || !('sessionStorage' in window)) return;
    window.sessionStorage.setItem(key, val);
  } catch {}
}
function safeLSSet(key: string, val: string) {
  try {
    if (!HAS_WINDOW || !('localStorage' in window)) return;
    window.localStorage.setItem(key, val);
  } catch {}
}
function safeAddEventListener(
  type: string,
  handler: (e: any) => void
) {
  try {
    if (!HAS_WINDOW) return;
    window.addEventListener(type as any, handler as any);
  } catch {}
}
function safeRemoveEventListener(
  type: string,
  handler: (e: any) => void
) {
  try {
    if (!HAS_WINDOW) return;
    window.removeEventListener(type as any, handler as any);
  } catch {}
}

// ---- per-tab id so we can ignore our own broadcasts ----
const TAB_KEY = 'gb-like-tab';
function getTabId(): string {
  if (!HAS_WINDOW) return 'static-tab';
  try {
    let id = safeSSGet(TAB_KEY);
    if (!id) {
      const canUUID =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto;
      id = canUUID ? crypto.randomUUID() : String(Math.random());
      safeSSSet(TAB_KEY, id);
    }
    return id!;
  } catch {
    return 'static-tab';
  }
}

// ---- bulk fetch current counts + whether viewer liked ----
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

  // Viewer’s likes within the same visible set
let mine: { review_user_id: string; game_id: number }[] = [];
if (viewerId) {
  const { data: myLikes, error: myErr } = await supabase
    .from('likes')
    .select('review_user_id, game_id')
    .eq('liker_id', viewerId)        // 👈 FIX (was user_id)
    .in('game_id', uniqGameIds)
    .in('review_user_id', uniqUserIds);
  if (!myErr && Array.isArray(myLikes)) mine = myLikes as any[];
}

  const counts = new Map<string, number>();
  for (const row of allLikes ?? []) {
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

// ---- server-side toggle via RPC; returns authoritative {liked,count} ----
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
  return {
    liked: !!row?.liked,
    count: Number(row?.count ?? 0),
    error: null,
  };
}

// ---- cross-tab broadcast (now includes origin) ----
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
  // local (same tab)
  try {
    if (HAS_WINDOW) {
      const ev = new CustomEvent(LS_KEY, { detail: payload });
      window.dispatchEvent(ev);
    }
  } catch {}
  // other tabs
  safeLSSet(LS_KEY, JSON.stringify(payload));
}

// ---- listen for broadcasts (ignores events from same tab) ----
export function addLikeListener(
  handler: (d: { reviewUserId: string; gameId: number; liked: boolean; delta: number }) => void
) {
  const localId = getTabId();

  const onLocal = (e: Event) => {
    const d = (e as CustomEvent).detail;
    if (!d || typeof d !== 'object') return;
    if (d.origin === localId) return; // ignore our own tab
    handler(d);
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key !== LS_KEY || !e.newValue) return;
    try {
      const d = JSON.parse(e.newValue);
      if (!d || typeof d !== 'object') return;
      if (d.origin === localId) return; // ignore our own tab
      handler(d);
    } catch {}
  };

  safeAddEventListener(LS_KEY, onLocal);
  safeAddEventListener('storage', onStorage);

  return () => {
    safeRemoveEventListener(LS_KEY, onLocal);
    safeRemoveEventListener('storage', onStorage);
  };
}