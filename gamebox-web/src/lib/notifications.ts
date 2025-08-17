// src/lib/notifications.ts
import type { SupabaseClient } from '@supabase/supabase-js';

type NotifType = 'like' | 'comment' | 'follow';

const isUniqueViolation = (e: any) => e?.code === '23505'; // duplicate
const isNil = (v: unknown) => v === null || v === undefined;

// --- coercers ---------------------------------------------------------------
function toIntOrNull(v: unknown): number | null {
  if (isNil(v)) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return Number.isFinite(i) ? i : null;
}

export async function markReadById(supabase: SupabaseClient, id: number) {
  await supabase.from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null);
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

/** Insert a notification (DB unique index handles dedupe). */
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
  if (error && !isUniqueViolation(error)) {
    // 23503 = FK fail, 42501 = RLS denied, etc.
    // eslint-disable-next-line no-console
    console.warn('insertNotif error', { code: (error as any)?.code, error });
  }
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
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('deleteNotif error', { code: (error as any)?.code, error });
  }
}

/* ------------------------------------------------------------------ */
/* Likes                                                               */
/* ------------------------------------------------------------------ */

export async function notifyLike(
  supabase: SupabaseClient,
  reviewUserId: string,
  gameId: number
) {
  const me = await getMeId(supabase);
  if (!me || me === reviewUserId) return; // no self-notifs
  await insertNotif(supabase, {
    type: 'like',
    user_id: reviewUserId,
    actor_id: me,
    game_id: gameId,        // <-- map camelCase -> snake_case
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
    game_id: gameId,        // <-- map camelCase -> snake_case
    comment_id: null,
  });
}

/* ------------------------------------------------------------------ */
/* Comments                                                            */
/* ------------------------------------------------------------------ */

export async function notifyComment(
  supabase: SupabaseClient,
  reviewUserId: string,
  gameId: number,
  commentId: string,          // uuid string
  preview?: string
) {
  const me = await getMeId(supabase);
  if (!me || me === reviewUserId) return; // no self-notifs
  const trimmed = preview?.slice(0, 160); // light safety trim
  await insertNotif(supabase, {
    type: 'comment',
    user_id: reviewUserId,
    actor_id: me,
    game_id: gameId,         // <-- map camelCase -> snake_case
    comment_id: commentId,
    meta: trimmed ? { preview: trimmed } : null,
  });
}

export async function clearComment(
  supabase: SupabaseClient,
  reviewUserId: string,
  gameId: number,
  commentId: string          // uuid string
) {
  const me = await getMeId(supabase);
  if (!me) return;
  await deleteNotif(supabase, {
    type: 'comment',
    user_id: reviewUserId,
    actor_id: me,
    game_id: gameId,         // <-- map camelCase -> snake_case
    comment_id: commentId,
  });
}

/* ------------------------------------------------------------------ */
/* Follows                                                             */
/* ------------------------------------------------------------------ */

export async function notifyFollow(
  supabase: SupabaseClient,
  targetUserId: string
) {
  const me = await getMeId(supabase);
  if (!me || me === targetUserId) return;
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

/* ------------------------------------------------------------------ */
/* Optional helpers (for badge later)                                  */
/* ------------------------------------------------------------------ */

export async function getUnreadCount(supabase: SupabaseClient) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return 0;

  // If your recipient column is 'user_id', keep that; if you use 'recipient_id', swap it.
  const recipientCol = 'user_id'; // or 'recipient_id'

  const { count } = await supabase
    .from('notifications_visible')               // ← the view
    .select('id', { head: true, count: 'exact' })
    .eq(recipientCol, uid)
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
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('markAllRead error', { code: (error as any)?.code, error });
  }
}