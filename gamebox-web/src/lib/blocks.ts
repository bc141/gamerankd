// src/lib/blocks.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { purgeAllBetween } from './notifications';

/** What we return from getBlockSets */
export type BlockSets = {
  iBlocked: Set<string>;   // users I have blocked
  blockedMe: Set<string>;  // users who blocked me
  iMuted: Set<string>;     // reserved for future use (empty)
};

const CACHE_TTL_MS = 10_000;
type CacheEntry = { t: number; sets: BlockSets };
const cache = new Map<string, CacheEntry>(); // key: viewerId

const HAS_WINDOW = typeof window !== 'undefined';
const SYNC_KEY = 'gb-block-sync';

const now = () => Date.now();
const normalizeId = (id: unknown) => String(id ?? '');
const emptySets = (): BlockSets => ({ iBlocked: new Set(), blockedMe: new Set(), iMuted: new Set() });

/** Fetch block sets for the viewer (with a small in-memory cache). */
export async function getBlockSets(
  supabase: SupabaseClient,
  viewerId: string | null,
  opts?: { force?: boolean }
): Promise<BlockSets> {
  if (!viewerId) return emptySets();

  const key = normalizeId(viewerId);
  const entry = cache.get(key);
  if (!opts?.force && entry && now() - entry.t < CACHE_TTL_MS) return entry.sets;

  const iBlocked = new Set<string>();
  const blockedMe = new Set<string>();
  const iMuted = new Set<string>(); // reserved

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

/** Convenience predicate for UI gates */
export function isInteractionBlocked(sets: BlockSets, otherUserId: string): boolean {
  const id = normalizeId(otherUserId);
  return sets.iBlocked.has(id) || sets.blockedMe.has(id);
}

/**
 * Block a user (idempotent):
 * 1) Upsert into `blocks`
 * 2) Best-effort: remove follows both ways (client)
 * 3) Best-effort: purge mutual notifications (client)
 * 4) Invalidate cache + broadcast
 * DB trigger also runs to enforce (2)+(3) server-side.
 */
export async function blockUser(
  supabase: SupabaseClient,
  targetId: string
): Promise<{ error: any | null }> {
  const { data: u } = await supabase.auth.getUser();
  const me = u?.user?.id;
  if (!me) return { error: new Error('Not signed in') };
  if (normalizeId(me) === normalizeId(targetId)) {
    return { error: new Error("You can't block yourself") };
  }

  // 1) Upsert
  const { error: upsertError } = await supabase
    .from('blocks')
    .upsert([{ blocker_id: me, blocked_id: targetId }], { onConflict: 'blocker_id,blocked_id' });

  // 2) Best-effort unfollow both ways
  if (!upsertError) {
    const { error: delErr } = await supabase
      .from('follows')
      .delete()
      .or(
        `and(follower_id.eq.${me},followee_id.eq.${targetId}),` +
        `and(follower_id.eq.${targetId},followee_id.eq.${me})`
      );
    // ignore delErr (server trigger also handles it)
  }

  // 3) Best-effort purge mutual notifications
  try { await purgeAllBetween(supabase, me, targetId); } catch {}

  // 4) Cache bust + cross-tab
  invalidateBlockCache(me);
  broadcastBlockSync();

  return { error: upsertError ?? null };
}

/** Unblock a user (delete row where I’m the blocker) */
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

/** Cross-tab refresh signal */
export function broadcastBlockSync() {
  try {
    if (HAS_WINDOW && 'localStorage' in window) {
      window.localStorage.setItem(SYNC_KEY, String(Date.now()));
    }
  } catch {}
}

/** Optional: listen for cross-tab block changes (returns an unsubscribe) */
export function addBlockSyncListener(handler: () => void): () => void {
  if (!HAS_WINDOW) return () => {};
  const onStorage = (e: StorageEvent) => { if (e.key === SYNC_KEY) handler(); };
  try { window.addEventListener('storage', onStorage); } catch {}
  return () => { try { window.removeEventListener('storage', onStorage); } catch {} };
}