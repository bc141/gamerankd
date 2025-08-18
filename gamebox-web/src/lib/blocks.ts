// src/lib/blocks.ts
import type { SupabaseClient } from '@supabase/supabase-js';

/** What we return from getBlockSets */
export type BlockSets = {
  iBlocked: Set<string>;
  blockedMe: Set<string>;
  iMuted: Set<string>; // NEW (mute)
};

const CACHE_TTL_MS = 10_000;
type CacheEntry = { t: number; sets: BlockSets };
const cache = new Map<string, CacheEntry>();

const HAS_WINDOW = typeof window !== 'undefined';
const SYNC_KEY = 'gb-block-sync';

const now = () => Date.now();
const normalizeId = (id: unknown) => String(id ?? '');
const emptySets = (): BlockSets => ({ iBlocked: new Set(), blockedMe: new Set(), iMuted: new Set() });

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
  const iMuted = new Set<string>(); // NEW (mute)

  const [{ data: b1 }, { data: b2 }, { data: m1 }] = await Promise.all([
    supabase.from('blocks').select('blocked_id').eq('blocker_id', viewerId),
    supabase.from('blocks').select('blocker_id').eq('blocked_id', viewerId),
    supabase.from('mutes').select('muted_id').eq('user_id', viewerId), // NEW (mute)
  ]);

  (b1 ?? []).forEach((r: any) => iBlocked.add(normalizeId(r.blocked_id)));
  (b2 ?? []).forEach((r: any) => blockedMe.add(normalizeId(r.blocker_id)));
  (m1 ?? []).forEach((r: any) => iMuted.add(normalizeId(r.muted_id)));   // NEW (mute)

  const sets: BlockSets = { iBlocked, blockedMe, iMuted };
  cache.set(key, { t: now(), sets });
  return sets;
}

export function invalidateBlockCache(viewerId: string | null) {
  if (!viewerId) return;
  cache.delete(normalizeId(viewerId));
}

export function isInteractionBlocked(sets: BlockSets, otherUserId: string): boolean {
  const id = normalizeId(otherUserId);
  return sets.iBlocked.has(id) || sets.blockedMe.has(id);
}

/** Optional helper: should viewer hide this user's content (mute OR hard block)? */
export function isHiddenFromViewer(sets: BlockSets, otherUserId: string): boolean {
  const id = normalizeId(otherUserId);
  return sets.iMuted.has(id) || sets.iBlocked.has(id) || sets.blockedMe.has(id);
}

export async function blockUser(supabase: SupabaseClient, targetId: string): Promise<{ error: any | null }> {
  const { data: u } = await supabase.auth.getUser();
  const me = u?.user?.id;
  if (!me) return { error: new Error('Not signed in') };
  if (normalizeId(me) === normalizeId(targetId)) return { error: new Error("You can’t block yourself") };

  const { error } = await supabase
    .from('blocks')
    .upsert([{ blocker_id: me, blocked_id: targetId }], { onConflict: 'blocker_id,blocked_id' });

  invalidateBlockCache(me);
  broadcastBlockSync();
  return { error };
}

export async function unblockUser(supabase: SupabaseClient, targetId: string): Promise<{ error: any | null }> {
  const { data: u } = await supabase.auth.getUser();
  const me = u?.user?.id;
  if (!me) return { error: new Error('Not signed in') };

  const { error } = await supabase.from('blocks').delete().eq('blocker_id', me).eq('blocked_id', targetId);

  invalidateBlockCache(me);
  broadcastBlockSync();
  return { error };
}

/** NEW (mute): lightweight hide control */
export async function muteUser(supabase: SupabaseClient, targetId: string): Promise<{ error: any | null }> {
  const { data: u } = await supabase.auth.getUser();
  const me = u?.user?.id;
  if (!me) return { error: new Error('Not signed in') };
  if (normalizeId(me) === normalizeId(targetId)) return { error: new Error("You can’t mute yourself") };

  const { error } = await supabase
    .from('mutes')
    .upsert([{ user_id: me, muted_id: targetId }], { onConflict: 'user_id,muted_id' });

  invalidateBlockCache(me);
  broadcastBlockSync();
  return { error };
}

export async function unmuteUser(supabase: SupabaseClient, targetId: string): Promise<{ error: any | null }> {
  const { data: u } = await supabase.auth.getUser();
  const me = u?.user?.id;
  if (!me) return { error: new Error('Not signed in') };

  const { error } = await supabase.from('mutes').delete().eq('user_id', me).eq('muted_id', targetId);

  invalidateBlockCache(me);
  broadcastBlockSync();
  return { error };
}

/** Cross-tab refresh signal */
export function broadcastBlockSync() {
  try { if (HAS_WINDOW) window.localStorage.setItem(SYNC_KEY, String(Date.now())); } catch {}
}

export function addBlockSyncListener(handler: () => void): () => void {
  if (!HAS_WINDOW) return () => {};
  const onStorage = (e: StorageEvent) => { if (e.key === SYNC_KEY) handler(); };
  try { window.addEventListener('storage', onStorage); } catch {}
  return () => { try { window.removeEventListener('storage', onStorage); } catch {} };
}