// src/lib/comments.ts
import type { SupabaseClient } from '@supabase/supabase-js';

export type CommentUser = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  commenter: CommentUser | null;
};

export function commentKey(reviewUserId: string, gameId: number) {
  return `${reviewUserId}:${gameId}`;
}

type Pair = { reviewUserId: string; gameId: number };

/** Bulk comment counts for visible review pairs (client-side aggregate). */
export async function fetchCommentCountsBulk(
  supabase: SupabaseClient,
  pairs: Pair[]
): Promise<Record<string, number>> {
  const uniqGameIds = Array.from(new Set(pairs.map(p => p.gameId)));
  const uniqUserIds = Array.from(new Set(pairs.map(p => p.reviewUserId)));
  if (!uniqGameIds.length || !uniqUserIds.length) return {};

  const { data, error } = await supabase
    .from('review_comments')
    .select('review_user_id, game_id')
    .in('game_id', uniqGameIds)
    .in('review_user_id', uniqUserIds);

  if (error) return {};

  const out: Record<string, number> = {};
  for (const row of (data ?? [])) {
    const k = commentKey(String((row as any).review_user_id), Number((row as any).game_id));
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

// Adjust if your FK alias differs
const COMMENTER_JOIN = 'profiles!review_comments_commenter_id_fkey';

/** Paginated list (newest first). */
export async function listComments(
  supabase: SupabaseClient,
  reviewUserId: string,
  gameId: number,
  limit = 20,
  before?: string
): Promise<{ rows: CommentRow[]; error: any | null }> {
  let q = supabase
    .from('review_comments')
    .select(
      `
      id, body, created_at,
      commenter:${COMMENTER_JOIN} ( id, username, display_name, avatar_url )
    `
    )
    .eq('review_user_id', reviewUserId)
    .eq('game_id', gameId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) q = q.lt('created_at', before);

  const { data, error } = await q;
  if (error) return { rows: [], error };

  const rows: CommentRow[] = (data as any[] ?? []).map((r: any) => {
    const c = r?.commenter ?? null;
    return {
      id: String(r.id),
      body: String(r.body ?? ''),
      created_at: r.created_at ?? new Date(0).toISOString(),
      commenter: c
        ? {
            id: String(c.id),
            username: c.username ?? null,
            display_name: c.display_name ?? null,
            avatar_url: c.avatar_url ?? null,
          }
        : null,
    };
  });

  return { rows, error: null };
}

/** Insert one comment and return the joined commenter. */
export async function addComment(
  supabase: SupabaseClient,
  viewerId: string,
  reviewUserId: string,
  gameId: number,
  body: string
): Promise<{ row: CommentRow | null; error: any | null }> {
  const trimmed = (body ?? '').trim();
  if (!trimmed) return { row: null, error: new Error('Empty comment') };

  const { data, error } = await supabase
    .from('review_comments')
    .insert({
      review_user_id: reviewUserId,
      game_id: gameId,
      commenter_id: viewerId,
      body: trimmed,
    })
    .select(
      `
      id, body, created_at,
      commenter:${COMMENTER_JOIN} ( id, username, display_name, avatar_url )
    `
    )
    .single();

  if (error || !data) return { row: null, error };

  const d: any = data;
  const c: any = d?.commenter ?? null;

  const row: CommentRow = {
    id: String(d.id),
    body: String(d.body ?? ''),
    created_at: d.created_at ?? new Date().toISOString(),
    commenter: c
      ? {
          id: String(c.id),
          username: c.username ?? null,
          display_name: c.display_name ?? null,
          avatar_url: c.avatar_url ?? null,
        }
      : null,
  };

  return { row, error: null };
}

// --- cross-tab comment count sync (broadcast + listen) ---
const HAS_WINDOW = typeof window !== 'undefined';
const COMMENT_LS_KEY = 'gb-comment-sync';
const TAB_SS_KEY = 'gb-comment-tab';

function safeLSSet(key: string, val: string) {
  try {
    if (!HAS_WINDOW || !('localStorage' in window)) return;
    window.localStorage.setItem(key, val);
  } catch {}
}
function safeSSGet(key: string): string | null {
  try {
    if (!HAS_WINDOW || !('sessionStorage' in window)) return null;
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSSSet(key: string, val: string) {
  try {
    if (!HAS_WINDOW || !('sessionStorage' in window)) return;
    window.sessionStorage.setItem(key, val);
  } catch {}
}
function getTabId(): string {
  if (!HAS_WINDOW) return 'static-tab';
  let id = safeSSGet(TAB_SS_KEY);
  if (!id) {
    const canUUID = typeof crypto !== 'undefined' && 'randomUUID' in crypto;
    id = canUUID ? crypto.randomUUID() : String(Math.random());
    safeSSSet(TAB_SS_KEY, id);
  }
  return id!;
}

export function broadcastCommentDelta(
  reviewUserId: string,
  gameId: number,
  delta: number
) {
  const payload = {
    t: Date.now(),
    origin: getTabId(),
    reviewUserId,
    gameId,
    delta,
  };
  // same-tab custom event
  try {
    if (HAS_WINDOW) {
      window.dispatchEvent(new CustomEvent(COMMENT_LS_KEY, { detail: payload }));
    }
  } catch {}
  // other tabs
  safeLSSet(COMMENT_LS_KEY, JSON.stringify(payload));
}

export function addCommentListener(
  handler: (d: { reviewUserId: string; gameId: number; delta: number }) => void
) {
  const localId = getTabId();

  const onLocal = (e: Event) => {
    const d = (e as CustomEvent).detail;
    if (!d || typeof d !== 'object') return;
    if ((d as any).origin === localId) return;
    handler(d as any);
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key !== COMMENT_LS_KEY || !e.newValue) return;
    try {
      const d = JSON.parse(e.newValue);
      if (!d || typeof d !== 'object') return;
      if (d.origin === localId) return;
      handler(d);
    } catch {}
  };

  try { window.addEventListener(COMMENT_LS_KEY as any, onLocal); } catch {}
  try { window.addEventListener('storage', onStorage); } catch {}

  return () => {
    try { window.removeEventListener(COMMENT_LS_KEY as any, onLocal); } catch {}
    try { window.removeEventListener('storage', onStorage); } catch {}
  };
}

/** Alias for CommentButton.tsx compatibility */
export const addCommentCountListener = addCommentListener;