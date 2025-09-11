'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { timeAgo } from '@/lib/timeAgo';
import PostCommentThread from '@/components/comments/PostCommentThread';
import ReviewContextModal from '@/components/ReviewContext/ReviewContextModal';
import type { SupabaseClient } from '@supabase/supabase-js';

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

type ContextType = 'review' | 'post';

type ContextData = 
  | { type: 'review'; reviewUserId: string; gameId: number }
  | { type: 'post'; postId: string; focusInput?: boolean };

const POSTS_VIEW = 'post_feed_v2';

export function useUnifiedContextModal(
  supabase: SupabaseClient,
  viewerId: string | null,
  onClose?: () => void
) {
  const [context, setContext] = useState<ContextData | null>(null);
  const [post, setPost] = useState<PostRow | null>(null);

  const openReview = useCallback((reviewUserId: string, gameId: number) => {
    setContext({ type: 'review', reviewUserId, gameId });
  }, []);

  const openPost = useCallback((postId: string, opts?: { focusInput?: boolean }) => {
    setContext({ type: 'post', postId, focusInput: !!opts?.focusInput });
  }, []);

  const close = useCallback(() => {
    setContext(null);
    setPost(null);
    onClose?.();
  }, [onClose]);

  // Hydrate post data when opening post context
  useEffect(() => {
    if (!context || context.type !== 'post') return;
    
    let cancelled = false;
    (async () => {
      const cols =
        'id,user_id,created_at,body,tags,like_count,comment_count,username,display_name,avatar_url,game_id,game_name,game_cover_url';

      let res = await supabase.from(POSTS_VIEW).select(cols).eq('id', context.postId).maybeSingle();
      if (res.error || !res.data) {
        res = await supabase.from('post_feed').select(cols).eq('id', context.postId).maybeSingle();
      }
      if (!cancelled) setPost((res.data ?? null) as PostRow | null);
    })();
    return () => { cancelled = true; };
  }, [context, supabase]);

  const modal = useMemo(() => {
    if (!context) return null;

    if (context.type === 'review') {
      return (
        <ReviewContextModal
          supabase={supabase}
          viewerId={viewerId}
          reviewUserId={context.reviewUserId}
          gameId={context.gameId}
          onClose={close}
        />
      );
    }

    if (context.type === 'post') {
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
                postId={context.postId}
                viewerId={viewerId}
                onClose={close}
                embed={true}
                autoFocusInput={!!context.focusInput}
              />
            </div>
          </div>
        </div>
      );
    }

    return null;
  }, [context, post, viewerId, close, supabase]);

  return { 
    openReview, 
    openPost, 
    close, 
    modal,
    // Legacy compatibility
    open: openReview,
    openPostContext: openPost
  };
}
