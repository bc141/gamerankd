// src/lib/follows.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { notifyFollow } from './notifications';
import { getBlockSets } from '@/lib/blocks';

function isUniqueViolation(e: any) {
  // Postgres unique_violation (and common duplicate wording)
  return e?.code === '23505' || /duplicate key|unique/i.test(String(e?.message ?? ''));
}

/** Quick guard so UI or actions can tell if following is allowed. */
export async function canFollow(
  supabase: SupabaseClient,
  targetUserId: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) return { ok: false, reason: 'Not signed in' };
  if (me === targetUserId) return { ok: false, reason: 'You cannot follow yourself' };

  // If either party has blocked the other, disallow following
  const { iBlocked, blockedMe } = await getBlockSets(supabase, me);
  if (iBlocked.has(targetUserId)) return { ok: false, reason: 'You have blocked this user' };
  if (blockedMe.has(targetUserId)) return { ok: false, reason: 'You are blocked by this user' };

  return { ok: true };
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
 * - FOLLOW: disallowed if either party has blocked the other.
 * - UNFOLLOW: always allowed.
 * - Notifies on successful new follow (duplicates ignored).
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
    // UNFOLLOW
    const { error } = await supabase
      .from('follows')
      .delete()
      .match({ follower_id: me, followee_id: targetUserId });
    return { error };
  } else {
    // FOLLOW — guard against blocks
    const allow = await canFollow(supabase, targetUserId);
    if (!allow.ok) {
      return { error: new Error('Following is disabled due to a block') };
    }

    const { error } = await supabase
      .from('follows')
      .insert({ follower_id: me, followee_id: targetUserId });

    if (error && !isUniqueViolation(error)) {
      return { error };
    }

    // Fire-and-forget; unique index on notifications prevents dupes
    try {
      notifyFollow(supabase, targetUserId).catch(() => {});
    } catch {}
    return { error: null };
  }
}