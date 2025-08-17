// src/lib/blocks.ts
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Fetch block sets for the viewer.
 * Mute is currently disabled: we return an empty iMuted and do not query the DB.
 */
export async function getBlockSets(supabase: SupabaseClient, viewerId: string | null) {
  const iBlocked = new Set<string>();   // I blocked them
  const blockedMe = new Set<string>();  // They blocked me
  const iMuted   = new Set<string>();   // (disabled) always empty

  if (!viewerId) return { iBlocked, blockedMe, iMuted };

  const [{ data: b1 }, { data: b2 }] = await Promise.all([
    supabase.from('blocks').select('blocked_id').eq('blocker_id', viewerId),
    supabase.from('blocks').select('blocker_id').eq('blocked_id', viewerId),
  ]);

  (b1 ?? []).forEach((r: any) => iBlocked.add(String(r.blocked_id)));
  (b2 ?? []).forEach((r: any) => blockedMe.add(String(r.blocker_id)));

  return { iBlocked, blockedMe, iMuted };
}

export async function blockUser(supabase: SupabaseClient, targetId: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user) return { error: new Error('Not signed in') };
  const { error } = await supabase
    .from('blocks')
    .upsert([{ blocker_id: u.user.id, blocked_id: targetId }], {
      onConflict: 'blocker_id,blocked_id',
    });
  return { error };
}

export async function unblockUser(supabase: SupabaseClient, targetId: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user) return { error: new Error('Not signed in') };
  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', u.user.id)
    .eq('blocked_id', targetId);
  return { error };
}

/**
 * Mute is disabled for v1: keep no-op functions so existing imports compile.
 * Re-enable later by wiring these back to a `mutes` table and updating getBlockSets.
 */
export async function muteUser(_supabase: SupabaseClient, _targetId: string) {
  // console.warn('muteUser is disabled'); // uncomment if you want a console hint in dev
  return { error: null as any };
}
export async function unmuteUser(_supabase: SupabaseClient, _targetId: string) {
  // console.warn('unmuteUser is disabled');
  return { error: null as any };
}

/** cross-tab refresh */
export function broadcastBlockSync() {
  try {
    localStorage.setItem('gb-block-sync', String(Date.now()));
  } catch {}
}