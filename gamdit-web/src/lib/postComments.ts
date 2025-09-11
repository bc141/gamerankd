import type { SupabaseClient } from '@supabase/supabase-js';
export const postCommentKey = (postId: string) => `post:${postId}`;

export async function fetchPostCommentCountsBulk(
  sb: SupabaseClient, postIds: string[]
): Promise<Record<string, number>> {
  if (!postIds.length) return {};
  const { data } = await sb
    .from('post_comment_counts')
    .select('post_id, comment_count')
    .in('post_id', postIds);
  const out: Record<string, number> = {};
  (data ?? []).forEach((r:any) => { out[postCommentKey(String(r.post_id))] = Number(r.comment_count) || 0; });
  return out;
}