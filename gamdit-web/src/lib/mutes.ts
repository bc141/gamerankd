// src/lib/mutes.ts
import type { SupabaseClient } from '@supabase/supabase-js';

/** One-way mute: user_id (me) hides muted_id (them) */
export type MuteSet = Set<string>;

const CACHE_TTL_MS = 10_000;
const HAS_WINDOW = typeof window !== 'undefined';
const SYNC_KEY = 'gb-mute-sync';

type CacheEntry = { t: number; set: MuteSet };
const cache = new Map<string, CacheEntry>(); // key: viewerId

const now = () => Date.now();
const norm = (v: unknown) => String(v ?? '');

export async function getMuteSet(
  supabase: SupabaseClient,
  viewerId: string | null,
  opts?: { force?: boolean }
): Promise<MuteSet> {
  if (!viewerId) return new Set();
  const key = norm(viewerId);
  const hit = cache.get(key);
  if (!opts?.force && hit && now() - hit.t < CACHE_TTL_MS) return hit.set;

  const set = new Set<string>();
  const { data } = await supabase
    .from('mutes')
    .select('muted_id')
    .eq('user_id', viewerId);

  for (const r of data ?? []) set.add(norm((r as any).muted_id));
  cache.set(key, { t: now(), set });
  return set;
}

export function invalidateMuteCache(viewerId: string | null) {
  if (!viewerId) return;
  cache.delete(norm(viewerId));
}

export function broadcastMuteSync() {
  try {
    if (HAS_WINDOW && 'localStorage' in window) {
      window.localStorage.setItem(SYNC_KEY, String(Date.now()));
    }
  } catch {}
}

/** Optional listener; returns an unsubscribe */
export function addMuteSyncListener(handler: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === SYNC_KEY) handler();
  };
  try {
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  } catch {
    return () => {};
  }
}

export async function muteUser(
  supabase: SupabaseClient,
  targetId: string
): Promise<{ error: any | null }> {
  const { data: u } = await supabase.auth.getUser();
  const me = u?.user?.id;
  if (!me) return { error: new Error('Not signed in') };
  if (me === targetId) return { error: new Error("You can't mute yourself") };

  const { error } = await supabase
    .from('mutes')
    .upsert([{ user_id: me, muted_id: targetId }], {
      onConflict: 'user_id,muted_id',
    });

  invalidateMuteCache(me);
  broadcastMuteSync();
  return { error };
}

export async function unmuteUser(
  supabase: SupabaseClient,
  targetId: string
): Promise<{ error: any | null }> {
  const { data: u } = await supabase.auth.getUser();
  const me = u?.user?.id;
  if (!me) return { error: new Error('Not signed in') };

  const { error } = await supabase
    .from('mutes')
    .delete()
    .eq('user_id', me)
    .eq('muted_id', targetId);

  invalidateMuteCache(me);
  broadcastMuteSync();
  return { error };
}