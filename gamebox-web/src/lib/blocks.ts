// src/lib/blocks.ts
import type { SupabaseClient } from '@supabase/supabase-js';

export async function getBlockSets(supabase: SupabaseClient, viewerId: string | null) {
  const iBlocked = new Set<string>();   // I blocked them
  const blockedMe = new Set<string>();  // they blocked me
  const iMuted = new Set<string>();     // I muted them

  if (!viewerId) return { iBlocked, blockedMe, iMuted };

  const [{ data: b1 }, { data: b2 }, { data: m }] = await Promise.all([
    supabase.from('blocks').select('blocked_id').eq('blocker_id', viewerId),
    supabase.from('blocks').select('blocker_id').eq('blocked_id', viewerId),
    supabase.from('mutes').select('muted_id').eq('muter_id', viewerId),
  ]);

  (b1 ?? []).forEach((r: any) => iBlocked.add(String(r.blocked_id)));
  (b2 ?? []).forEach((r: any) => blockedMe.add(String(r.blocker_id)));
  (m  ?? []).forEach((r: any) => iMuted.add(String(r.muted_id)));

  return { iBlocked, blockedMe, iMuted };
}

export async function blockUser(supabase: SupabaseClient, targetId: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user) return { error: new Error('Not signed in') };
  const { error } = await supabase
    .from('blocks')
    .upsert([{ blocker_id: u.user.id, blocked_id: targetId }], { onConflict: 'blocker_id,blocked_id' });
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

export async function muteUser(supabase: SupabaseClient, targetId: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user) return { error: new Error('Not signed in') };
  const { error } = await supabase
    .from('mutes')
    .upsert([{ muter_id: u.user.id, muted_id: targetId }], { onConflict: 'muter_id,muted_id' });
  return { error };
}

export async function unmuteUser(supabase: SupabaseClient, targetId: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user) return { error: new Error('Not signed in') };
  const { error } = await supabase
    .from('mutes')
    .delete()
    .eq('muter_id', u.user.id)
    .eq('muted_id', targetId);
  return { error };
}

/** cross-tab refresh */
export function broadcastBlockSync() {
  try { localStorage.setItem('gb-block-sync', String(Date.now())); } catch {}
}