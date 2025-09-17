'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import PostCommentThread from '@/components/comments/PostCommentThread';
import { timeAgo } from '@/lib/timeAgo';

type PostRow = {
  id: string;
  user_id: string;
  created_at: string;
  body: string | null;
  tags: string[] | null;
  like_count: number;
  comment_count: number;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  game_id: number | null;
  game_name: string | null;
  game_cover_url: string | null;
};

const POSTS_VIEW = 'post_feed_v2';

export function usePostContextModal(viewerId: string | null, onClose?: () => void) {
  const sb = supabaseBrowser();
  const [state, setState] = useState<{ postId: string; focus?: boolean } | null>(null);
  const [post, setPost] = useState<PostRow | null>(null);

  const open  = useCallback((postId: string, opts?: { focusInput?: boolean }) => {
    setState({ postId, focus: !!opts?.focusInput });
  }, []);
  const close = useCallback(() => {
    setState(null);
    onClose?.();
  }, [onClose]);

  // hydrate the single post from view (fallback-safe)
  useEffect(() => {
    if (!state) return;
    let cancelled = false;
    (async () => {
      const cols =
        'id,user_id,created_at,body,tags,like_count,comment_count,username,display_name,avatar_url,game_id,game_name,game_cover_url';

      let res = await sb.from(POSTS_VIEW).select(cols).eq('id', state.postId).maybeSingle();
      if (res.error || !res.data) {
        res = await sb.from('post_feed').select(cols).eq('id', state.postId).maybeSingle();
      }
      if (!cancelled) setPost((res.data ?? null) as PostRow | null);
    })();
    return () => { cancelled = true; };
  }, [state, sb]);

  const modal = useMemo(() => {
    if (!state) return null;
    return (
      <div className="fixed inset-0 z-[70]">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
        <div className="absolute inset-x-0 top-[10vh] mx-auto max-w-2xl rounded-2xl bg-neutral-900/95 border border-white/10 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-start gap-3 p-4 border-b border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post?.game_cover_url || post?.avatar_url || '/avatar-placeholder.svg'}
              alt=""
              className={post?.game_cover_url
                ? 'h-16 w-12 object-cover rounded border border-white/10'
                : 'h-10 w-10 object-cover rounded-full border border-white/10'}
            />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-white truncate">
                {post?.game_name ?? 'Post'}
              </div>
              <div className="text-sm text-white/70 truncate">
                by {post?.display_name || post?.username || 'Player'} · {post ? timeAgo(post.created_at) : ''}
              </div>
              {post?.body?.trim() && (
                <p className="mt-2 text-white/85 whitespace-pre-wrap break-words">{post.body.trim()}</p>
              )}
            </div>
            <button
              onClick={close}
              className="ml-2 rounded p-1 text-white/70 hover:text-white"
              aria-label="Close"
              type="button"
            >
              ×
            </button>
          </div>

          {/* Thread */}
          <div className="p-4 pt-3 max-h-[65vh] overflow-y-auto">
            <PostCommentThread
              postId={state.postId}
              viewerId={viewerId}
              onClose={close}
              embed={true}
              autoFocusInput={!!state.focus}
            />
          </div>
        </div>
      </div>
    );
  }, [state, post, viewerId, close, sb]);

  return { open, close, modal };
}
