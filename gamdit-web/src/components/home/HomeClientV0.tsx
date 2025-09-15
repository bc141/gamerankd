'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { waitForSession } from '@/lib/waitForSession';
import { timeAgo } from '@/lib/timeAgo';
// Header is rendered globally in layout; keep v0 header unused here
import { HeroCard } from '@/components/v0-ui/hero-card';
import { FeedTabs } from '@/components/v0-ui/feed-tabs';
import { Composer } from '@/components/v0-ui/composer';
import { PostCard } from '@/components/v0-ui/post-card';
import { Sidebar } from '@/components/v0-ui/sidebar';
import { SkeletonPostCard, SkeletonSidebar } from '@/components/v0-ui/skeletons';
import './v0-sandbox.css';

type InitialCursor = { id: string; created_at: string } | undefined;

// ---------- constants ----------
const POSTS_VIEW = 'post_feed_v2';
const POST_COLS = 'id,user_id,created_at,body,tags,media_urls,like_count,comment_count,username,display_name,avatar_url,game_id,game_name,game_cover_url';

// ---------- types ----------
interface V0Post {
  id: string;
  user: {
    avatar: string;
    displayName: string;
    handle: string;
  };
  timestamp: string;
  content: string;
  gameImage?: string;
  likes: number;
  comments: number;
  shares: number;
  isLiked: boolean;
}

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

// ---------- main component ----------
export default function HomeClientV0({ initialItems = [], initialNextCursor, initialHasMore = false }: { initialItems?: any[]; initialNextCursor?: InitialCursor; initialHasMore?: boolean }) {
  const router = useRouter();
  const [posts, setPosts] = useState<V0Post[]>([]);
  const [nextCursor, setNextCursor] = useState<{ id: string; created_at: string } | undefined>(initialNextCursor);
  const [hasMore, setHasMore] = useState<boolean>(initialHasMore);
  const [games, setGames] = useState<V0Game[]>([]);
  const [users, setUsers] = useState<V0User[]>([]);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'following' | 'for-you'>('for-you');
  const [activeFilter, setActiveFilter] = useState<'all' | 'clips' | 'reviews' | 'screens'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [selectedGame, setSelectedGame] = useState<V0Game | null>(null);
  const [showGameModal, setShowGameModal] = useState(false);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Load session once on mount and seed initial server data
  useEffect(() => {
    let isMounted = true;
    
    async function loadSession() {
      try {
        const sb = supabaseBrowser();
        const session = await waitForSession(sb);
        
        if (isMounted && session?.user) {
          setSessionUserId(session.user.id);
          
          // Load user's following data
          const { data: followingData } = await sb
            .from('follows')
            .select('following_id')
            .eq('follower_id', session.user.id);
          
          if (followingData) {
            setFollowedUsers(new Set(followingData.map(f => f.following_id)));
          }
        }
      } catch (error) {
        console.error('Error loading session:', error);
      } finally {
        if (isMounted) {
          setIsMounted(true);
        }
      }
    }

    // seed initial posts from server (transform contract to V0Post)
    const transform = (post: any): V0Post => ({
      id: post.id,
      user: {
        avatar: post.user?.avatar_url || '/avatar-placeholder.svg',
        displayName: post.user?.display_name || post.user?.username || 'User',
        handle: `@${post.user?.username || 'user'}`,
      },
      timestamp: timeAgo(new Date(post.created_at)),
      content: post.content,
      gameImage: post.game?.cover_url || undefined,
      likes: post.reaction_counts?.likes || 0,
      comments: post.reaction_counts?.comments || 0,
      shares: post.reaction_counts?.shares || 0,
      isLiked: post.user_reactions?.liked || false,
    })
    setPosts((initialItems || []).map(transform));
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
      isMounted = false;
    };
  }, []);

  // Reset feed cache when tab or filter changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setIsLoading(true)
    setPosts([])
    setNextCursor(undefined)
    setHasMore(false)
  }, [activeTab, activeFilter])

  // Helper to call server feed API
  async function fetchFeed(params: { viewerId: string | null; tab: 'following' | 'for-you'; filter: 'all' | 'clips' | 'reviews' | 'screens'; cursor?: { id: string; created_at: string } | null }) {
    const res = await fetch('/api/feed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        viewerId: params.viewerId,
        tab: params.tab,
        filter: params.filter,
        cursor: params.cursor ?? null,
        limit: 20
      })
    })
    if (!res.ok) throw new Error('Failed to load feed')
    return res.json() as Promise<{ items: any[]; nextCursor?: { id: string; created_at: string }; hasMore: boolean }>
  }

  // Load data based on activeTab and sessionUserId
  useEffect(() => {
    if (!isMounted) return;
    // For Following, wait until we know the viewer id to avoid fetching wrong feed
    if (activeTab === 'following' && !sessionUserId) return;
    
    let abortController = new AbortController();
    
    async function loadData() {
      try {
        const { items, nextCursor: nc, hasMore: hm } = await fetchFeed({
          viewerId: sessionUserId,
          tab: activeTab,
          filter: activeFilter,
          cursor: null
        })

        // Transform posts
        const transformedPosts: V0Post[] = (items || []).map((post: any) => ({
          id: post.id,
          user: {
            avatar: post.user?.avatar_url || '/avatar-placeholder.svg',
            displayName: post.user?.display_name || post.user?.username,
            handle: `@${post.user?.username || 'user'}`,
          },
          timestamp: timeAgo(new Date(post.created_at)),
          content: post.content,
          gameImage: post.game?.cover_url || undefined,
          likes: post.reaction_counts?.likes || 0,
          comments: post.reaction_counts?.comments || 0,
          shares: post.reaction_counts?.shares || 0,
          isLiked: post.user_reactions?.liked || false,
        }));

        if (!abortController.signal.aborted) {
          setPosts(transformedPosts);
          setNextCursor(nc);
          setHasMore(hm);
          setIsLoading(false);
        }

      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error('Error loading data:', error);
          setIsLoading(false);
        }
      }
    }

    loadData();
    
    return () => {
      abortController.abort();
    };
  }, [activeTab, sessionUserId, isMounted]);

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
      const transformed: V0Post[] = (items || []).map((post: any) => ({
        id: post.id,
        user: {
          avatar: post.user?.avatar_url || '/avatar-placeholder.svg',
          displayName: post.user?.display_name || post.user?.username,
          handle: `@${post.user?.username || 'user'}`,
        },
        timestamp: timeAgo(new Date(post.created_at)),
        content: post.content,
        gameImage: post.game?.cover_url || undefined,
        likes: post.reaction_counts?.likes || 0,
        comments: post.reaction_counts?.comments || 0,
        shares: post.reaction_counts?.shares || 0,
        isLiked: post.user_reactions?.liked || false,
      }))
      setPosts(prev => [...prev, ...transformed])
      setNextCursor(nc)
      setHasMore(hm)
    } catch (e) {
      console.error('Failed to load more:', e)
      // TODO: toast error, keep last good page
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
    if (activeFilter === 'all') return true;
    if (activeFilter === 'clips') return post.content.toLowerCase().includes('clip') || post.content.toLowerCase().includes('video');
    if (activeFilter === 'reviews') return post.content.toLowerCase().includes('review') || post.content.toLowerCase().includes('rating');
    if (activeFilter === 'screens') return post.content.toLowerCase().includes('screenshot') || post.content.toLowerCase().includes('screen');
    return true;
  });

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
                        filteredPosts.map((post) => (
                          <PostCard
                            key={post.id}
                            post={post}
                            onLike={() => handleLike(post.id)}
                            onComment={() => handleComment(post.id)}
                            onShare={() => handleShare(post.id)}
                            onMore={() => handleMore(post.id)}
                          />
                        ))
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
