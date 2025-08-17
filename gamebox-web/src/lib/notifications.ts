// src/lib/notifications.ts
import type { SupabaseClient } from '@supabase/supabase-js';

type Col = 'user_id' | 'recipient_id';

const TABLES_IN_ORDER = [
  { table: 'notifications_visible', col: 'user_id' as Col },
  { table: 'notifications_visible', col: 'recipient_id' as Col },
  { table: 'notifications',         col: 'user_id' as Col },
  { table: 'notifications',         col: 'recipient_id' as Col },
];

function nowIso() {
  return new Date().toISOString();
}

function okResult<T>(data: T) {
  return { data, error: null as any };
}
function errResult(error: any) {
  return { data: null as any, error };
}

/**
 * Count unread notifications for the signed-in user.
 * Tries (view, user_id) → (view, recipient_id) → (table, user_id) → (table, recipient_id).
 */
export async function getUnreadCount(supabase: SupabaseClient): Promise<number> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return 0;

  for (const { table, col } of TABLES_IN_ORDER) {
    const { count, error } = await supabase
      .from(table)
      .select('id', { head: true, count: 'exact' })
      .eq(col, uid)
      .is('read_at', null);

    if (!error && typeof count === 'number') return count;
  }
  // If all attempts fail (e.g., during migrations), safest fallback.
  return 0;
}

/**
 * Fetch a page of notifications, resilient to schema differences.
 * Returns the first successful result from view/table and column combination.
 */
export async function fetchNotifications(
  supabase: SupabaseClient,
  opts: { limit?: number; before?: string } = {}
) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return okResult<any[]>([]);

  const { limit = 20, before } = opts;

  for (const { table, col } of TABLES_IN_ORDER) {
    let q = supabase
      .from(table)
      .select('*')
      .eq(col, uid)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) q = q.lt('created_at', before);

    const { data, error } = await q;
    if (!error && Array.isArray(data)) return okResult(data);
  }
  return okResult<any[]>([]);
}

/**
 * Mark ONE notification as read (id must belong to the signed-in user).
 * Tries user_id then recipient_id to avoid column-name fragility.
 */
export async function markAsRead(
  supabase: SupabaseClient,
  id: string
) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return errResult(new Error('Not signed in'));

  // Attempt with user_id
  let res = await supabase
    .from('notifications')
    .update({ read_at: nowIso() })
    .eq('id', id)
    .eq('user_id', uid)
    .is('read_at', null);

  if (!res.error) {
    tryBroadcast();
    return okResult(true);
  }

  // Attempt with recipient_id
  res = await supabase
    .from('notifications')
    .update({ read_at: nowIso() })
    .eq('id', id)
    .eq('recipient_id', uid)
    .is('read_at', null);

  if (!res.error) {
    tryBroadcast();
    return okResult(true);
  }

  return errResult(res.error);
}

/**
 * Mark ALL my unread notifications as read.
 * Attempts update using user_id then recipient_id.
 */
export async function markAllAsRead(supabase: SupabaseClient) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return errResult(new Error('Not signed in'));

  // Try with user_id
  let res = await supabase
    .from('notifications')
    .update({ read_at: nowIso() })
    .eq('user_id', uid)
    .is('read_at', null);

  if (!res.error) {
    tryBroadcast();
    return okResult(res.count ?? null);
  }

  // Try with recipient_id
  res = await supabase
    .from('notifications')
    .update({ read_at: nowIso() })
    .eq('recipient_id', uid)
    .is('read_at', null);

  if (!res.error) {
    tryBroadcast();
    return okResult(res.count ?? null);
  }

  return errResult(res.error);
}

/**
 * Optional utility to purge or mark-read any unread notifs that are no longer relevant
 * after privacy actions. Kept conservative: just marks read (does not delete).
 * Call this after actions like "block" if you want to auto-clear.
 */
export async function markAllAsReadSafely(supabase: SupabaseClient) {
  // Just proxy to markAllAsRead; kept for semantic clarity at call sites.
  return markAllAsRead(supabase);
}

/** Cross-tab notification sync signal (consumed by NotificationsBell & list page). */
export function broadcastNotifSync() {
  try {
    localStorage.setItem('gb-notif-sync', String(Date.now()));
  } catch {}
}

/** Internal helper to avoid try/catch noise. */
function tryBroadcast() {
  try { broadcastNotifSync(); } catch {}
}