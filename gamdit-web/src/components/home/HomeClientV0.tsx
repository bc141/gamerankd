'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { waitForSession } from '@/lib/waitForSession';
import { timeAgo } from '@/lib/timeAgo';
// Header is rendered globally in layout; keep v0 header unused here
import { HeroCard } from '@/components/v0-ui/hero-card';
import { FeedCardV2, type FeedKind } from '@/components/feed/FeedCardV2';
import { normalizeToFeedCard } from '@/components/feed/normalize';
import { FeedTabs } from '@/components/v0-ui/feed-tabs';
import { Composer } from '@/components/v0-ui/composer';
import { PostCard, type PostData } from '@/components/v0-ui/post-card';
import { Sidebar } from '@/components/v0-ui/sidebar';
import { SkeletonPostCard, SkeletonSidebar } from '@/components/v0-ui/skeletons';
import './v0-sandbox.css';
import type { FeedPost } from '@/lib/data-service/types';

type InitialCursor = { id: string; created_at: string } | undefined;

// ---------- types ----------
interface V0Game {
  id: string;
  name: string;
  cover_url: string;
}

interface V0User {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
}

// ---------- helpers ----------
type FeedItem = (FeedPost & { kind?: FeedKind; rating_score?: number | null })

const isVideoMedia = (url: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(String(url || ''))

const toNumber = (value: any, fallback = 0) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

const parseMediaArray = (value: any): string[] => {
  if (!value) return []
  if (Array.isArray(value)) return value.map((entry) => String(entry))
  if (typeof value === 'string' && value.trim().length > 0) return [value]
  return []
}

const mapUser = (item: any): FeedItem['user'] => {
  const source = item?.user || {}
  const username = source.username ?? item?.username ?? ''
  const displayName = source.display_name ?? source.displayName ?? item?.display_name ?? username

  return {
    id: String(source.id ?? item?.user_id ?? ''),
    username: String(username ?? ''),
    display_name: String(displayName ?? ''),
    avatar_url: source.avatar_url ?? source.avatarUrl ?? source.avatar ?? item?.avatar_url ?? undefined,
    bio: source.bio ?? item?.bio,
    followers_count: toNumber(source.followers_count ?? item?.followers_count, 0),
    following_count: toNumber(source.following_count ?? item?.following_count, 0),
    posts_count: toNumber(source.posts_count ?? item?.posts_count, 0),
    is_following: Boolean(source.is_following ?? item?.is_following ?? false),
    is_verified: Boolean(source.is_verified ?? item?.is_verified ?? false)
  }
}

const mapGame = (item: any): FeedItem['game'] => {
  const game = item?.game
  const createdAt = item?.created_at ?? item?.createdAt ?? new Date().toISOString()

  if (game) {
    const allowedStatuses: Set<'playing' | 'completed' | 'paused' | 'dropped'> = new Set(['playing', 'completed', 'paused', 'dropped'])
    const rawStatus = (game.status ?? 'playing') as string
    const safeStatus: 'playing' | 'completed' | 'paused' | 'dropped' = allowedStatuses.has(rawStatus as any)
      ? (rawStatus as 'playing' | 'completed' | 'paused' | 'dropped')
      : 'playing'

    return {
      id: String(game.id ?? item?.game_id ?? ''),
      name: game.name ?? item?.game_name ?? '',
      cover_url: game.cover_url ?? game.coverUrl ?? item?.game_cover_url ?? undefined,
      last_played_at: game.last_played_at ?? createdAt,
      playtime_minutes: toNumber(game.playtime_minutes, 0),
      progress_percentage: toNumber(game.progress_percentage, 0),
      status: safeStatus
    }
  }

  if (item?.game_id) {
    return {
      id: String(item.game_id),
      name: item?.game_name ?? '',
      cover_url: item?.game_cover_url ?? undefined,
      last_played_at: createdAt,
      playtime_minutes: 0,
      progress_percentage: 0,
      status: 'playing'
    }
  }

  return undefined
}

const normalizeReactionCounts = (raw: any): FeedItem['reaction_counts'] => {
  return {
    likes: toNumber(raw?.likes ?? raw?.like_count, 0),
    comments: toNumber(raw?.comments ?? raw?.comment_count, 0),
    shares: toNumber(raw?.shares ?? raw?.share_count, 0),
    views: toNumber(raw?.views ?? raw?.view_count, 0)
  }
}

const mapToFeedItem = (item: any): FeedItem => {
  const createdAt = String(item?.created_at ?? item?.createdAt ?? new Date().toISOString())
  const updatedAt = String(item?.updated_at ?? item?.updatedAt ?? createdAt)
  const user = mapUser(item)
  const rawKind = typeof item?.kind === 'string' ? item.kind.toLowerCase() : undefined
  const kind: FeedKind | undefined = rawKind === 'post' || rawKind === 'review' || rawKind === 'rating'
    ? (rawKind as FeedKind)
    : undefined
  const reactionCounts = normalizeReactionCounts(item?.reaction_counts ?? item)
  const userReactions = item?.user_reactions ?? item?.myReactions ?? {}

  return {
    id: String(item?.id ?? ''),
    content: String(item?.content ?? item?.body ?? item?.text ?? ''),
    created_at: createdAt,
    updated_at: updatedAt,
    user_id: String(item?.user_id ?? user.id ?? ''),
    user,
    game_id: item?.game_id ? String(item.game_id) : item?.game?.id ? String(item.game.id) : undefined,
    game: mapGame(item),
    media_urls: parseMediaArray(item?.media_urls ?? item?.media ?? item?.mediaUrls),
    reaction_counts: reactionCounts,
    user_reactions: {
      liked: Boolean(userReactions?.liked ?? false),
      commented: Boolean(userReactions?.commented ?? false),
      shared: Boolean(userReactions?.shared ?? false)
    },
    _cursor: item?._cursor
      ? {
          id: String(item._cursor.id ?? item?.id ?? ''),
          created_at: String(item._cursor.created_at ?? createdAt)
        }
      : {
          id: String(item?.id ?? ''),
          created_at: createdAt
        },
    kind,
    rating_score: typeof item?.rating_score === 'number'
      ? item.rating_score
      : typeof item?.rating === 'number'
      ? item.rating
      : null
  }
}

const toLegacyPostData = (item: FeedItem): PostData => ({
  id: item.id,
  user: {
    avatar: item.user.avatar_url || '/avatar-placeholder.svg',
    displayName: item.user.display_name || item.user.username || 'User',
    handle: `@${item.user.username || 'user'}`
  },
  timestamp: timeAgo(new Date(item.created_at)),
  content: item.content,
  gameImage: item.game?.cover_url ?? undefined,
  likes: item.reaction_counts?.likes ?? 0,
  comments: item.reaction_counts?.comments ?? 0,
  shares: item.reaction_counts?.shares ?? 0,
  isLiked: item.user_reactions?.liked ?? false
})

// ---------- main component ----------
export default function HomeClientV0({ initialItems = [], initialNextCursor, initialHasMore = false }: { initialItems?: any[]; initialNextCursor?: InitialCursor; initialHasMore?: boolean }) {
  const router = useRouter();
  const { addToast } = useToast();
  const [posts, setPosts] = useState<FeedItem[]>(() => (initialItems || []).map(mapToFeedItem));
  const [nextCursor, setNextCursor] = useState<{ id: string; created_at: string } | undefined>(initialNextCursor);
  const [hasMore, setHasMore] = useState<boolean>(initialHasMore);
  const [games, setGames] = useState<V0Game[]>([]);
  const [users, setUsers] = useState<V0User[]>([]);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(
    () =>
      new Set(
        (initialItems || [])
          .map(mapToFeedItem)
          .filter(item => item.user_reactions?.liked)
          .map(item => item.id)
      )
  );
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'following' | 'for-you'>('for-you');
  const [activeFilter, setActiveFilter] = useState<'all' | 'clips' | 'reviews' | 'screens'>('all');
  const [isLoading, setIsLoading] = useState(() => (initialItems?.length ?? 0) === 0);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [selectedGame, setSelectedGame] = useState<V0Game | null>(null);
  const [showGameModal, setShowGameModal] = useState(false);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Load session once on mount and seed initial server data
  useEffect(() => {
    let mounted = true;
    
    async function loadSession() {
      try {
        const sb = supabaseBrowser();
        const session = await waitForSession(sb);
        
        if (mounted && session?.user) {
          setSessionUserId(session.user.id);
          // Load following ids via server helper to avoid client PostgREST
          try {
            const res = await fetch('/api/sidebar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ viewerId: session.user.id })
            })
            const json = await res.json()
            const ids: string[] = Array.isArray(json?.ids) ? json.ids : []
            setFollowedUsers(new Set(ids))
          } catch (e) {
            // ignore; not critical for initial feed
          }
        }
      } catch (error) {
        console.error('Error loading session:', error);
      } finally {
        if (mounted) {
          setIsMounted(true);
        }
      }
    }

    if ((initialItems || []).length > 0) {
      setIsLoading(false)
    }
    loadSession();

    // load sidebar via API (server-backed) to avoid RLS
    ;(async () => {
      try {
        const res = await fetch('/api/sidebar')
        if (res.ok) {
          const data = await res.json()
          setGames(data.games || [])
          setUsers(data.users || [])
        }
      } catch (e) {
        console.error('Sidebar load failed', e)
      }
    })()
    
    return () => {
      mounted = false;
    };
  }, []);

  // Reset feed loading when tab or filter changes (preserve last good page until next load succeeds)
  useEffect(() => {
    if (!isMounted) return
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setIsLoading(true)
  }, [activeTab, activeFilter, isMounted])

  // Helper to call server feed API
  async function fetchFeed(
    params: { viewerId: string | null; tab: 'following' | 'for-you'; filter: 'all' | 'clips' | 'reviews' | 'screens'; cursor?: { id: string; created_at: string } | null },
    signal?: AbortSignal
  ) {
    const res = await fetch('/api/feed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        viewerId: params.viewerId,
        tab: params.tab,
        filter: params.filter,
        cursor: params.cursor ?? null,
        limit: 20
      }),
      signal
    })
    // API always returns 200 with a stable shape; network failures will throw
    return res.json() as Promise<{ items: any[]; nextCursor: { id: string; created_at: string } | null; hasMore: boolean }>
  }

  // Load data based on activeTab and sessionUserId
  useEffect(() => {
    if (!isMounted) return;
    if (activeTab === 'following' && !sessionUserId) return;

    const abortController = new AbortController();

    async function loadData() {
      try {
        const { items, nextCursor: nc, hasMore: hm } = await fetchFeed(
          {
            viewerId: sessionUserId,
            tab: activeTab,
            filter: activeFilter,
            cursor: null
          },
          abortController.signal
        )

        const mappedPosts = (items || []).map(mapToFeedItem)

        if (!abortController.signal.aborted) {
          setPosts(mappedPosts)
          setLikedPosts(new Set(mappedPosts.filter(item => item.user_reactions?.liked).map(item => item.id)))
          setNextCursor(nc || undefined)
          setHasMore(hm)
          setIsLoading(false)
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error('Error loading data:', error)
          addToast({ type: 'error', message: 'Failed to refresh feed. Showing last posts.' })
          setIsLoading(false)
        }
      }
    }

    loadData()

    return () => {
      abortController.abort()
    }
  }, [activeTab, activeFilter, sessionUserId, isMounted]);

  // Cursor pagination
  const loadMore = async () => {
    if (!hasMore || !nextCursor) return
    try {
      const { items, nextCursor: nc, hasMore: hm } = await fetchFeed({
        viewerId: sessionUserId,
        tab: activeTab,
        filter: activeFilter,
        cursor: nextCursor
      })
      const mapped = (items || []).map(mapToFeedItem)
      setPosts(prev => [...prev, ...mapped])
      setLikedPosts(prev => {
        const next = new Set(prev)
        mapped.forEach(item => {
          if (item.user_reactions?.liked) {
            next.add(item.id)
          }
        })
        return next
      })
      setNextCursor(nc || undefined)
      setHasMore(hm)
    } catch (e) {
      console.error('Failed to load more:', e)
      addToast({ type: 'error', message: 'Could not load more posts. Try again.' })
    }
  }

  // Scroll to top functionality
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollToTop(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLike = async (postId: string) => {
    if (!sessionUserId) return;
    
    const sb = supabaseBrowser();
    const isLiked = likedPosts.has(postId);
    
    // Optimistic update
    setLikedPosts(prev => {
      const newSet = new Set(prev);
      if (isLiked) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
    setPosts(prev => prev.map(item => {
      if (item.id !== postId) return item
      const likeCount = item.reaction_counts?.likes ?? 0
      const delta = isLiked ? -1 : 1
      return {
        ...item,
        reaction_counts: {
          ...item.reaction_counts,
          likes: Math.max(0, likeCount + delta)
        },
        user_reactions: {
          ...item.user_reactions,
          liked: !isLiked
        }
      }
    }))

    try {
      if (isLiked) {
        await sb.from('likes').delete().eq('post_id', postId).eq('user_id', sessionUserId);
      } else {
        await sb.from('likes').insert({ post_id: postId, user_id: sessionUserId });
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      // Revert optimistic update
      setLikedPosts(prev => {
        const newSet = new Set(prev);
        if (isLiked) {
          newSet.add(postId);
        } else {
          newSet.delete(postId);
        }
        return newSet;
      });
      setPosts(prev => prev.map(item => {
        if (item.id !== postId) return item
        const likeCount = item.reaction_counts?.likes ?? 0
        const delta = isLiked ? 1 : -1
        return {
          ...item,
          reaction_counts: {
            ...item.reaction_counts,
            likes: Math.max(0, likeCount + delta)
          },
          user_reactions: {
            ...item.user_reactions,
            liked: isLiked
          }
        }
      }))
    }
  };

  const handlePost = async (content: string) => {
    if (!sessionUserId || !content.trim()) return;
    
    try {
      const sb = supabaseBrowser();
      const { error } = await sb.from('posts').insert({
        body: content,
        user_id: sessionUserId,
        game_id: selectedGame?.id || null,
      });

      if (error) throw error;

      // Refresh posts
      window.location.reload();
    } catch (error) {
      console.error('Error creating post:', error);
    }
  };

  const handleAddImage = () => {
    // TODO: Implement image upload
    console.log('Add image');
  };

  const handleAddGame = () => {
    setShowGameModal(true);
  };

  const handleComment = (postId: string) => {
    // Navigate to post detail with comment focus
    router.push(`/post/${postId}?focus=comment`);
  };

  const handleShare = (postId: string) => {
    // Copy post URL to clipboard
    const postUrl = `${window.location.origin}/post/${postId}`;
    navigator.clipboard.writeText(postUrl);
    // TODO: Show toast notification
  };

  const handleMore = (postId: string) => {
    // TODO: Show post options modal
    console.log('More actions for post:', postId);
  };

  const handleFollow = async (userId: string) => {
    if (!sessionUserId) return;
    
    const sb = supabaseBrowser();
    const isFollowing = followedUsers.has(userId);
    
    // Optimistic update
    setFollowedUsers(prev => {
      const newSet = new Set(prev);
      if (isFollowing) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });

    try {
      if (isFollowing) {
        await sb.from('follows').delete().eq('follower_id', sessionUserId).eq('following_id', userId);
      } else {
        await sb.from('follows').insert({ follower_id: sessionUserId, following_id: userId });
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      // Revert optimistic update
      setFollowedUsers(prev => {
        const newSet = new Set(prev);
        if (isFollowing) {
          newSet.add(userId);
        } else {
          newSet.delete(userId);
        }
        return newSet;
      });
    }
  };

  const handlePlayGame = (gameId: string) => {
    router.push(`/game/${gameId}`);
  };

  const handleGameClick = (gameId: string) => {
    router.push(`/game/${gameId}`);
  };

  const handleUserClick = (userId: string) => {
    router.push(`/u/${userId}`);
  };

  const handleSearch = (query: string) => {
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
    }
  };

  const handleNotifications = () => {
    router.push('/notifications');
  };

  const handleMessages = () => {
    router.push('/messages');
  };

  const handleProfile = () => {
    if (sessionUserId) {
      router.push(`/u/${sessionUserId}`);
    } else {
      router.push('/login');
    }
  };

  const handleTabChange = (tab: 'following' | 'for-you') => {
    if (tab === activeTab) return
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFilterChange = (filter: 'all' | 'clips' | 'reviews' | 'screens') => {
    if (filter === activeFilter) return
    setActiveFilter(filter);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Filter posts based on active filter
  const filteredPosts = posts.filter(post => {
    if (activeFilter === 'all') return true

    const content = (post.content || '').toLowerCase()
    const media = Array.isArray(post.media_urls) ? post.media_urls : []

    if (activeFilter === 'clips') {
      return (post.kind === 'post' || !post.kind) && media.some(isVideoMedia)
    }

    if (activeFilter === 'reviews') {
      return post.kind === 'review' || post.kind === 'rating' || content.includes('review') || content.includes('rating')
    }

    if (activeFilter === 'screens') {
      return (post.kind === 'post' || !post.kind) && media.length > 0 && media.every(url => !isVideoMedia(url))
    }

    return true
  })

  const useFeedCardV2 = process.env.NEXT_PUBLIC_FEED_CARD_V2 !== 'false'

  return (
    <div className="v0-sandbox">
      <div className="main-container">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Feed */}
          <div className="lg:col-span-3 space-y-3">
            {/* Hero Section */}
            <HeroCard
              title="Welcome to Gamdit"
              description="Connect with fellow gamers and share your experiences."
              buttonText="Get Started"
              onButtonClick={() => console.log('Get Started clicked')}
            />

            {/* Sticky Feed Tabs */}
            <div className="sticky-tabs">
              <FeedTabs
                activeTab={activeTab}
                onTabChange={handleTabChange}
              />
            </div>

            {/* Quick Filter Chips */}
            <div className="filter-chips">
              <button 
                className={`filter-chip ${activeFilter === 'all' ? 'active' : ''}`} 
                type="button"
                onClick={() => handleFilterChange('all')}
                aria-label="Show all posts"
              >
                All
              </button>
              <button 
                className={`filter-chip ${activeFilter === 'clips' ? 'active' : ''}`} 
                type="button"
                onClick={() => handleFilterChange('clips')}
                aria-label="Show clip posts"
              >
                Clips
              </button>
              <button 
                className={`filter-chip ${activeFilter === 'reviews' ? 'active' : ''}`} 
                type="button"
                onClick={() => handleFilterChange('reviews')}
                aria-label="Show review posts"
              >
                Reviews
              </button>
              <button 
                className={`filter-chip ${activeFilter === 'screens' ? 'active' : ''}`} 
                type="button"
                onClick={() => handleFilterChange('screens')}
                aria-label="Show screenshot posts"
              >
                Screens
              </button>
            </div>

            {/* Composer */}
            <Composer
              onPost={handlePost}
              onAddImage={handleAddImage}
              onAddGame={handleAddGame}
              placeholder="What's happening in your game?"
            />

                    {/* Posts */}
                    <div className="space-y-3">
                      {isLoading ? (
                        <>
                          <SkeletonPostCard />
                          <SkeletonPostCard />
                          <SkeletonPostCard />
                        </>
                      ) : activeTab === 'following' && filteredPosts.length === 0 ? (
                        <div className="sidebar-card" role="region" aria-label="Following onboarding">
                          <div className="sidebar-header">
                            <h2 className="sidebar-title">Your Following feed is empty</h2>
                          </div>
                          <p className="text-sm" style={{ color: 'var(--v0-muted-foreground)' }}>
                            Follow players to see their posts here. Try the suggestions in "Who to Follow".
                          </p>
                        </div>
                      ) : (
                        filteredPosts.map((post) => {
                          const cardProps = normalizeToFeedCard(post as any)
                          return useFeedCardV2 ? (
                            <FeedCardV2
                              key={post.id}
                              {...cardProps}
                              actions={{
                                onLike: () => handleLike(post.id),
                                onComment: () => handleComment(post.id),
                                onShare: () => handleShare(post.id)
                              }}
                            />
                          ) : (
                            <PostCard
                              key={post.id}
                              post={toLegacyPostData(post)}
                              onLike={() => handleLike(post.id)}
                              onComment={() => handleComment(post.id)}
                              onShare={() => handleShare(post.id)}
                              onMore={() => handleMore(post.id)}
                            />
                          )
                        })
                      )}
                    </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {isLoading ? (
              <SkeletonSidebar />
            ) : (
              <Sidebar
                games={games}
                users={users}
                onFollow={handleFollow}
                onPlayGame={handlePlayGame}
                onGameClick={handleGameClick}
                onUserClick={handleUserClick}
                followedUsers={followedUsers}
              />
            )}
          </div>
        </div>
      </div>

      {/* Scroll to Top Button */}
      <button
        className={`scroll-to-top ${showScrollToTop ? 'visible' : ''}`}
        onClick={scrollToTop}
        aria-label="Scroll to top"
        type="button"
      >
        ↑
      </button>
    </div>
  );
}
