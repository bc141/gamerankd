'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { timeAgo } from '@/lib/timeAgo';
import PostCommentThread from '@/components/comments/PostCommentThread';
import ReviewContextModal from '@/components/ReviewContext/ReviewContextModal';
import InteractionButton from '@/components/InteractionButton';
import { postLikeKey, fetchPostLikesBulk, togglePostLike as togglePostLikeApi, type LikeEntry as PostLikeEntry } from '@/lib/postLikes';
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
  
  // Like state for posts
  const [postLikes, setPostLikes] = useState<Record<string, PostLikeEntry>>({});
  const [postLikeBusy, setPostLikeBusy] = useState<Record<string, boolean>>({});

  const openReview = useCallback((reviewUserId: string, gameId: number) => {
    setContext({ type: 'review', reviewUserId, gameId });
  }, []);

  const openPost = useCallback((postId: string, opts?: { focusInput?: boolean }) => {
    setContext({ type: 'post', postId, focusInput: !!opts?.focusInput });
  }, []);

  const close = useCallback(() => {
    setContext(null);
    setPost(null);
    setPostLikes({});
    setPostLikeBusy({});
    onClose?.();
  }, [onClose]);

  // Toggle like for a post
  const onTogglePostLike = useCallback(async (postId: string) => {
    if (!viewerId) return;
    
    const likeK = postLikeKey(postId);
    if (postLikeBusy[likeK]) return;
    
    const before = postLikes[likeK] ?? { liked: false, count: (post?.like_count || 0) };

    // Optimistic update
    setPostLikes(prev => ({ 
      ...prev, 
      [likeK]: { liked: !before.liked, count: before.count + (before.liked ? -1 : 1) } 
    }));
    setPostLikeBusy(prev => ({ ...prev, [likeK]: true }));

    try {
      const { liked, count, error } = await togglePostLikeApi(supabase, viewerId, postId);
      if (error) {
        setPostLikes(prev => ({ ...prev, [likeK]: before }));
        return;
      }
      setPostLikes(prev => ({ ...prev, [likeK]: { liked, count } }));
    } finally {
      setPostLikeBusy(prev => ({ ...prev, [likeK]: false }));
    }
  }, [viewerId, postLikes, postLikeBusy, post?.like_count, supabase]);

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
      if (!cancelled) {
        setPost((res.data ?? null) as PostRow | null);
        
        // Load like data for the post
        if (res.data && viewerId) {
          const likeData = await fetchPostLikesBulk(supabase, viewerId, [context.postId]);
          if (!cancelled) {
            setPostLikes(likeData ?? {});
          }
        }
      }
    })();
    return () => { cancelled = true; };
  }, [context, supabase, viewerId]);

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
      const likeK = postLikeKey(context.postId);
      const entry = postLikes[likeK] ?? { liked: false, count: (post?.like_count || 0) };
      
      return (
        <div className="fixed inset-0 z-[70]">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
          <div className="absolute inset-x-0 top-[10vh] mx-auto max-w-3xl rounded-2xl bg-[rgb(var(--bg-card))] border border-[rgb(var(--border))] shadow-[var(--shadow-lg)] overflow-hidden">
            {/* Header */}
            <div className="flex items-start gap-4 p-6 border-b border-[rgb(var(--border))]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post?.game_cover_url || post?.avatar_url || '/avatar-placeholder.svg'}
                alt=""
                className={post?.game_cover_url
                  ? 'h-16 w-12 object-cover rounded-lg border border-[rgb(var(--border))]'
                  : 'h-12 w-12 object-cover rounded-full border border-[rgb(var(--border))]'}
              />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-[rgb(var(--txt))] text-lg truncate">
                  {post?.game_name ?? 'Post'}
                </div>
                <div className="text-sm text-[rgb(var(--txt-muted))] truncate">
                  by {post?.display_name || post?.username || 'Player'} · {post ? timeAgo(post.created_at) : ''}
                </div>
                {post?.body?.trim() && (
                  <p className="mt-3 text-[rgb(var(--txt))] whitespace-pre-wrap break-words leading-relaxed">{post.body.trim()}</p>
                )}
                
                {/* Actions in header */}
                <div className="flex items-center gap-3 mt-4">
                  <InteractionButton
                    type="like"
                    count={entry.count}
                    active={entry.liked}
                    busy={postLikeBusy[likeK]}
                    onClick={() => onTogglePostLike(context.postId)}
                  />
                </div>
              </div>
              <button
                onClick={close}
                className="ml-2 rounded-lg p-2 text-[rgb(var(--txt-muted))] hover:text-[rgb(var(--txt))] hover:bg-[rgb(var(--hover))] transition-colors"
                aria-label="Close"
                type="button"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Thread */}
            <div className="p-6 pt-4 max-h-[65vh] overflow-y-auto">
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
