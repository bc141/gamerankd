// src/lib/blocks.ts
import type { SupabaseClient } from '@supabase/supabase-js';

export async function getBlockSets(supabase: SupabaseClient, viewerId: string) {
  const [mine, others] = await Promise.all([
    supabase.from('user_blocks').select('blocked_id').eq('blocker_id', viewerId),
    supabase.from('user_blocks').select('blocker_id').eq('blocked_id', viewerId),
  ]);

  return {
    iBlocked: new Set((mine.data ?? []).map(r => String(r.blocked_id))),
    blockedMe: new Set((others.data ?? []).map(r => String(r.blocker_id))),
  };
}

export async function getMuteSet(supabase: SupabaseClient, viewerId: string) {
  const { data } = await supabase.from('user_mutes').select('muted_id').eq('muter_id', viewerId);
  return new Set((data ?? []).map(r => String(r.muted_id)));
}

export async function toggleBlock(supabase: SupabaseClient, targetUserId: string) {
  const { data, error } = await supabase.rpc('toggle_block', { target: targetUserId });
  return { blocked: Boolean(data?.[0]?.blocked), error };
}

export async function toggleMute(supabase: SupabaseClient, targetUserId: string) {
  const { data, error } = await supabase.rpc('toggle_mute', { target: targetUserId });
  return { muted: Boolean(data?.[0]?.muted), error };
}