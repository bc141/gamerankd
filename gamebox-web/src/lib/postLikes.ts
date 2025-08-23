import type { SupabaseClient } from '@supabase/supabase-js';

export type LikeEntry = { liked: boolean; count: number };
export const postLikeKey = (postId: string) => `post:${postId}`;

export function addPostLikeListener(cb: (x:{postId:string;liked:boolean;delta:number}) => void) {
  const h = (e: StorageEvent) => {
    if (e.key !== 'gb-post-like-sync') return;
    try { const p = JSON.parse(e.newValue || '{}'); if (p?.postId) cb(p); } catch {}
  };
  try { window.addEventListener('storage', h); } catch {}
  return () => { try { window.removeEventListener('storage', h); } catch {} };
}

export function broadcastPostLike(postId: string, liked: boolean, delta: number) {
  try { localStorage.setItem('gb-post-like-sync', JSON.stringify({ postId, liked, delta, t: Date.now() })); } catch {}
}

export async function fetchPostLikesBulk(
  sb: SupabaseClient, userId: string | null, postIds: string[]
): Promise<Record<string, LikeEntry>> {
  if (!postIds.length) return {};
  const { data: counts } = await sb
    .from('post_like_counts')
    .select('post_id, like_count')
    .in('post_id', postIds);

  const countMap = Object.fromEntries((counts ?? []).map((r:any) => [String(r.post_id), Number(r.like_count)||0]));
  let likedSet = new Set<string>();
  if (userId) {
    const { data: mine } = await sb
      .from('post_likes')
      .select('post_id')
      .eq('user_id', userId)
      .in('post_id', postIds);
    likedSet = new Set((mine ?? []).map((r:any) => String(r.post_id)));
  }
  const out: Record<string, LikeEntry> = {};
  postIds.forEach(id => { out[postLikeKey(id)] = { liked: likedSet.has(id), count: countMap[id] ?? 0 }; });
  return out;
}

export async function togglePostLike(
  sb: SupabaseClient, userId: string, postId: string
): Promise<{ liked: boolean; count: number; error?: string }> {
  const { data: existing } = await sb
    .from('post_likes')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    const { error } = await sb.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId);
    if (error) return { liked: true, count: 0, error: error.message };
  } else {
    const { error } = await sb.from('post_likes').insert({ post_id: postId, user_id: userId });
    if (error) return { liked: false, count: 0, error: error.message };
  }

  const { data: row } = await sb
    .from('post_like_counts')
    .select('like_count')
    .eq('post_id', postId)
    .maybeSingle();

  return { liked: !existing, count: Number(row?.like_count ?? 0) };
}