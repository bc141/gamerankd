/* eslint-disable @typescript-eslint/naming-convention */
// src/lib/notifications.ts
import type { SupabaseClient } from '@supabase/supabase-js';

type NotifType = 'like' | 'comment' | 'follow';

const isUniqueViolation = (e: any) => e?.code === '23505';
const isNil = (v: unknown) => v === null || v === undefined;

/** Cross-tab sync key for the bell / notifications page */
export const NOTIF_SYNC_KEY = 'gb-notif-sync';
export function broadcastNotifSync() {
  try { localStorage.setItem(NOTIF_SYNC_KEY, String(Date.now())); } catch {}
}

/* ----------------------------- coercers ----------------------------- */
function toIntOrNull(v: unknown): number | null {
  if (isNil(v)) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return Number.isFinite(i) ? i : null;
}

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function toUuidOrNull(v: unknown): string | null {
  if (isNil(v)) return null;
  const s = String(v).trim();
  return UUID_RE.test(s) ? s : null;
}

async function getMeId(supabase: SupabaseClient): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

/** Client-side guard to avoid creating notifs that RLS will later hide */
async function hasBlockEitherWay(
  supabase: SupabaseClient,
  a: string,
  b: string
): Promise<boolean> {
  if (a === b) return false;
  const { count, error } = await supabase
    .from('blocks')
    .select('blocker_id', { head: true, count: 'exact' })
    .or(
      `and(blocker_id.eq.${a},blocked_id.eq.${b}),` +
      `and(blocker_id.eq.${b},blocked_id.eq.${a})`
    );
  if (error) {
    // Be permissive; server-side RLS still protects us.
    return false;
  }
  return (count ?? 0) > 0;
}

/* ------------------------------ updates ------------------------------ */
export async function markReadById(supabase: SupabaseClient, id: number) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null);

  if (!error) broadcastNotifSync();
}

/* ----------------------------- primitives ---------------------------- */
async function insertNotif(
  supabase: SupabaseClient,
  payload: {
    type: NotifType;
    user_id: string;            // recipient
    actor_id: string;           // sender
    game_id?: number | null;    // int
    comment_id?: string | null; // uuid
    meta?: Record<string, any> | null;
  }
) {
  const record = {
    type: payload.type,
    user_id: payload.user_id,
    actor_id: payload.actor_id,
    game_id: toIntOrNull(payload.game_id),
    comment_id: toUuidOrNull(payload.comment_id),
    meta: payload.meta ?? null,
  };

  const { error } = await supabase.from('notifications').insert([record]);
  if (error && !isUniqueViolation(error)) return;
  if (!error) broadcastNotifSync();
}

async function deleteNotif(
  supabase: SupabaseClient,
  where: {
    type: NotifType;
    user_id: string;
    actor_id: string;
    game_id?: number | null;
    comment_id?: string | null;
  }
) {
  const gameId = toIntOrNull(where.game_id);
  const commentId = toUuidOrNull(where.comment_id);

  let q = supabase
    .from('notifications')
    .delete()
    .eq('type', where.type)
    .eq('user_id', where.user_id)
    .eq('actor_id', where.actor_id);

  q = isNil(gameId) ? q.is('game_id', null) : q.eq('game_id', gameId);
  q = isNil(commentId) ? q.is('comment_id', null) : q.eq('comment_id', commentId);

  const { error } = await q;
  if (!error) broadcastNotifSync();
}

/** Remove all notifications between A and B (both directions). Safe to call after block. */
export async function purgeAllBetween(
  supabase: SupabaseClient,
  a: string,
  b: string
) {
  if (!a || !b || a === b) return;
  const { error } = await supabase
    .from('notifications')
    .delete()
    .or(
      `and(user_id.eq.${a},actor_id.eq.${b}),` +
      `and(user_id.eq.${b},actor_id.eq.${a})`
    );
  if (!error) broadcastNotifSync();
}

/* -------------------------------- likes ------------------------------ */
export async function notifyLike(
  supabase: SupabaseClient,
  reviewUserId: string,
  gameId: number
) {
  const me = await getMeId(supabase);
  if (!me || me === reviewUserId) return; // no self-notifs
  if (await hasBlockEitherWay(supabase, me, reviewUserId)) return;

  await insertNotif(supabase, {
    type: 'like',
    user_id: reviewUserId,
    actor_id: me,
    game_id:gameId,
    comment_id: null,
  });
}

export async function clearLike(
  supabase: SupabaseClient,
  reviewUserId: string,
  gameId: number
) {
  const me = await getMeId(supabase);
  if (!me) return;
  await deleteNotif(supabase, {
    type: 'like',
    user_id: reviewUserId,
    actor_id: me,
    game_id:gameId,
    comment_id: null,
  });
}

/* ------------------------------ comments ---------------------------- */
export async function notifyComment(
  supabase: SupabaseClient,
  reviewUserId: string,
  gameId: number,
  commentId: string,          // uuid string
  preview?: string
) {
  const me = await getMeId(supabase);
  if (!me || me === reviewUserId) return; // no self-notifs
  if (await hasBlockEitherWay(supabase, me, reviewUserId)) return;

  const trimmed = preview?.slice(0, 160);
  await insertNotif(supabase, {
    type: 'comment',
    user_id: reviewUserId,
    actor_id: me,
    game_id:gameId,
    comment_id: commentId,
    meta: trimmed ? { preview: trimmed } : null,
  });
}

export async function clearComment(
  supabase: SupabaseClient,
  reviewUserId: string,
  gameId: number,
  commentId: string
) {
  const me = await getMeId(supabase);
  if (!me) return;
  await deleteNotif(supabase, {
    type: 'comment',
    user_id: reviewUserId,
    actor_id: me,
    game_id:gameId,
    comment_id: commentId,
  });
}

/* ------------------------------- follows ----------------------------- */
export async function notifyFollow(
  supabase: SupabaseClient,
  targetUserId: string
) {
  const me = await getMeId(supabase);
  if (!me || me === targetUserId) return;
  if (await hasBlockEitherWay(supabase, me, targetUserId)) return;

  await insertNotif(supabase, {
    type: 'follow',
    user_id: targetUserId,
    actor_id: me,
    game_id: null,
    comment_id: null,
  });
}

export async function clearFollow(
  supabase: SupabaseClient,
  targetUserId: string
) {
  const me = await getMeId(supabase);
  if (!me) return;
  await deleteNotif(supabase, {
    type: 'follow',
    user_id: targetUserId,
    actor_id: me,
    game_id: null,
    comment_id: null,
  });
}

/* ----------------------------- unread badge -------------------------- */
export async function getUnreadCount(supabase: SupabaseClient) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return 0;

  // If you keep a filtered view, swap 'notifications' -> 'notifications_visible'.
  const { count } = await supabase
    .from('notifications')
    .select('id', { head: true, count: 'exact' })
    .eq('user_id', uid)
    .is('read_at', null);

  return count ?? 0;
}

export async function markAllRead(supabase: SupabaseClient) {
  const me = await getMeId(supabase);
  if (!me) return;

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', me)
    .is('read_at', null);

  if (!error) broadcastNotifSync();
}