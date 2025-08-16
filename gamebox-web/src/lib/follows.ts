// src/lib/follows.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { notifyFollow } from './notifications';

function isUniqueViolation(e: any) {
  // Postgres unique_violation (and common duplicate wording)
  return e?.code === '23505' || /duplicate key|unique/i.test(String(e?.message ?? ''));
}

/** Return follower/following counts for a user. */
export async function getFollowCounts(
  supabase: SupabaseClient,
  userId: string
): Promise<{ followers: number; following: number }> {
  const [{ count: followers }, { count: following }] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followee_id', userId),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
  ]);

  return { followers: followers ?? 0, following: following ?? 0 };
}

/** Check if the signed-in user follows `targetUserId`. */
export async function checkIsFollowing(
  supabase: SupabaseClient,
  targetUserId: string
): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me || me === targetUserId) return false;

  const { count, error } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', me)
    .eq('followee_id', targetUserId);

  if (error) return false;
  return (count ?? 0) > 0;
}

/**
 * Toggle follow state for the signed-in user and `targetUserId`.
 * - On FOLLOW: insert row + fire-and-forget notifyFollow (DB unique index will dedupe; 23505 is OK).
 * - On UNFOLLOW: delete row. We DO NOT clear the prior follow notification (so re-follow won't ping again).
 * If `isFollowing` is omitted, we'll fetch the current state first.
 */
export async function toggleFollow(
  supabase: SupabaseClient,
  targetUserId: string,
  isFollowing?: boolean
): Promise<{ error: any | null }> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) return { error: new Error('Not signed in') };
  if (me === targetUserId) return { error: new Error('You cannot follow yourself') };

  if (typeof isFollowing === 'undefined') {
    isFollowing = await checkIsFollowing(supabase, targetUserId);
  }

  if (isFollowing) {
    // UNFOLLOW: remove the row, keep any historical notification
    const { error } = await supabase
      .from('follows')
      .delete()
      .match({ follower_id: me, followee_id: targetUserId });
    return { error };
  } else {
    // FOLLOW: insert row; ignore duplicate races; notify once
    const { error } = await supabase
      .from('follows')
      .insert({ follower_id: me, followee_id: targetUserId });

    if (error && !isUniqueViolation(error)) {
      return { error };
    }

    // Fire-and-forget: the notifications table unique index will swallow duplicates (23505)
    try {
      notifyFollow(supabase, targetUserId).catch(() => {});
    } catch {}
    return { error: null };
  }
}