// src/lib/follows.ts
import type { SupabaseClient } from '@supabase/supabase-js';

export async function getFollowCounts(sb: SupabaseClient, userId: string) {
  const [{ count: followers }, { count: following }] = await Promise.all([
    sb.from('follows').select('*', { count: 'exact', head: true }).eq('followee_id', userId),
    sb.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
  ]);
  return {
    followers: followers ?? 0,
    following: following ?? 0,
  };
}

export async function checkIsFollowing(sb: SupabaseClient, targetUserId: string) {
  const { data: me } = await sb.auth.getUser();
  const uid = me.user?.id;
  if (!uid) return false;
  const { count } = await sb
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', uid)
    .eq('followee_id', targetUserId);
  return (count ?? 0) > 0;
}

export async function toggleFollow(sb: SupabaseClient, targetUserId: string, currentlyFollowing: boolean) {
  const { data: me } = await sb.auth.getUser();
  const uid = me.user?.id;
  if (!uid) throw new Error('Not signed in');

  if (currentlyFollowing) {
    return sb.from('follows')
      .delete()
      .eq('follower_id', uid)
      .eq('followee_id', targetUserId);
  }
  return sb.from('follows')
    .insert({ follower_id: uid, followee_id: targetUserId });
}