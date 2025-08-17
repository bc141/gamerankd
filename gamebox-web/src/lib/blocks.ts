// src/lib/blocks.ts
import type { SupabaseClient } from '@supabase/supabase-js';

/** What we return from getBlockSets */
export type BlockSets = {
  /** Users I have blocked */
  iBlocked: Set<string>;
  /** Users who have blocked me */
  blockedMe: Set<string>;
  /** Reserved for future use; always empty for now (mute is disabled) */
  iMuted: Set<string>;
};

/** 10s cache to avoid spamming the DB as users navigate around */
const CACHE_TTL_MS = 10_000;
type CacheEntry = { t: number; sets: BlockSets };
const cache = new Map<string, CacheEntry>(); // key: viewerId

function now() {
  return Date.now();
}
function normalizeId(id: unknown) {
  return String(id ?? '');
}
function emptySets(): BlockSets {
  return { iBlocked: new Set(), blockedMe: new Set(), iMuted: new Set() };
}

/**
 * Fetch block sets for the viewer (with a small in-memory cache).
 * Mute is currently disabled: iMuted is always empty.
 */
export async function getBlockSets(
  supabase: SupabaseClient,
  viewerId: string | null,
  opts?: { force?: boolean }
): Promise<BlockSets> {
  if (!viewerId) return emptySets();

  const key = normalizeId(viewerId);
  const entry = cache.get(key);
  if (!opts?.force && entry && now() - entry.t < CACHE_TTL_MS) {
    return entry.sets;
  }

  const iBlocked = new Set<string>();
  const blockedMe = new Set<string>();
  const iMuted = new Set<string>(); // reserved, stays empty

  const [{ data: b1 }, { data: b2 }] = await Promise.all([
    supabase.from('blocks').select('blocked_id').eq('blocker_id', viewerId),
    supabase.from('blocks').select('blocker_id').eq('blocked_id', viewerId),
  ]);

  (b1 ?? []).forEach((r: any) => iBlocked.add(normalizeId(r.blocked_id)));
  (b2 ?? []).forEach((r: any) => blockedMe.add(normalizeId(r.blocker_id)));

  const sets: BlockSets = { iBlocked, blockedMe, iMuted };
  cache.set(key, { t: now(), sets });
  return sets;
}

/** Invalidate the cached block sets for a viewer */
export function invalidateBlockCache(viewerId: string | null) {
  if (!viewerId) return;
  cache.delete(normalizeId(viewerId));
}

/** Convenience predicate for UI / interaction guards */
export function isInteractionBlocked(sets: BlockSets, otherUserId: string): boolean {
  const id = normalizeId(otherUserId);
  return sets.iBlocked.has(id) || sets.blockedMe.has(id);
}

/**
 * Block a user:
 * 1) Upsert into `blocks`
 * 2) Remove follow rows in BOTH directions
 * 3) Invalidate cache + broadcast cross-tab sync
 */
export async function blockUser(
  supabase: SupabaseClient,
  targetId: string
): Promise<{ error: any | null }> {
  const { data: u } = await supabase.auth.getUser();
  const me = u?.user?.id;
  if (!me) return { error: new Error('Not signed in') };
  if (normalizeId(me) === normalizeId(targetId)) {
    return { error: new Error("You can’t block yourself") };
  }

  // 1) Upsert the block
  const { error: upsertError } = await supabase
    .from('blocks')
    .upsert([{ blocker_id: me, blocked_id: targetId }], {
      onConflict: 'blocker_id,blocked_id',
    });

  // 2) Remove follows in BOTH directions (best-effort)
  let delError: any = null;
  if (!upsertError) {
    // Try single OR delete first (Supabase v2+)
    const { error } = await supabase
      .from('follows')
      .delete()
      .or(
        `and(follower_id.eq.${me},followee_id.eq.${targetId}),` +
          `and(follower_id.eq.${targetId},followee_id.eq.${me})`
      );

    if (error) {
      // Fallback: two separate deletes (works everywhere)
      const [a, b] = await Promise.all([
        supabase.from('follows').delete().match({ follower_id: me, followee_id: targetId }),
        supabase.from('follows').delete().match({ follower_id: targetId, followee_id: me }),
      ]);
      delError = a.error ?? b.error ?? null;
    } else {
      delError = null;
    }
  }

  // 3) Cache bust + cross-tab notify
  invalidateBlockCache(me);
  broadcastBlockSync();

  return { error: upsertError ?? delError };
}

/**
 * Unblock a user:
 * 1) Delete from `blocks`
 * 2) Invalidate cache + broadcast cross-tab sync
 */
export async function unblockUser(
  supabase: SupabaseClient,
  targetId: string
): Promise<{ error: any | null }> {
  const { data: u } = await supabase.auth.getUser();
  const me = u?.user?.id;
  if (!me) return { error: new Error('Not signed in') };

  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', me)
    .eq('blocked_id', targetId);

  invalidateBlockCache(me);
  broadcastBlockSync();

  return { error };
}

/**
 * Mute is disabled for v1: keep no-op functions so existing imports compile.
 * Re-enable later by wiring these back to a `mutes` table and updating getBlockSets.
 */
export async function muteUser(_supabase: SupabaseClient, _targetId: string): Promise<{ error: any | null }> {
  return { error: null };
}
export async function unmuteUser(_supabase: SupabaseClient, _targetId: string): Promise<{ error: any | null }> {
  return { error: null };
}

/** Cross-tab refresh signal */
const LS_KEY = 'gb-block-sync';

export function broadcastBlockSync() {
  try {
    if (typeof window !== 'undefined' && 'localStorage' in window) {
      window.localStorage.setItem(LS_KEY, String(Date.now()));
    }
  } catch {}
}

/** Optional: listen for cross-tab block changes (returns an unsubscribe) */
export function addBlockSyncListener(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === LS_KEY) handler();
  };
  try {
    window.addEventListener('storage', onStorage);
  } catch {}
  return () => {
    try {
      window.removeEventListener('storage', onStorage);
    } catch {}
  };
}