'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { waitForSession } from '@/lib/waitForSession';
import { timeAgo } from '@/lib/timeAgo';
import { Header } from '@/components/v0-ui';
import { HeroCard } from '@/components/v0-ui/hero-card';
import { FeedTabs } from '@/components/v0-ui/feed-tabs';
import { Composer } from '@/components/v0-ui/composer';
import { PostCard } from '@/components/v0-ui/post-card';
import { Sidebar } from '@/components/v0-ui/sidebar';
import { SkeletonPostCard, SkeletonSidebar } from '@/components/v0-ui/skeletons';
import './v0-sandbox.css';

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
export default function HomeClientV0() {
  const router = useRouter();
  const [posts, setPosts] = useState<V0Post[]>([]);
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
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Load data
  useEffect(() => {
    async function loadData() {
      try {
        const sb = supabaseBrowser();
        const session = await waitForSession(sb);
        
        if (session?.user) {
          setCurrentUser(session.user);
          
          // Load user's following data
          const { data: followingData } = await sb
            .from('follows')
            .select('following_id')
            .eq('follower_id', session.user.id);
          
          if (followingData) {
            setFollowedUsers(new Set(followingData.map(f => f.following_id)));
          }
        }

        // Load posts based on active tab
        let postsData, postsError;
        
        if (activeTab === 'following' && currentUser) {
          // Get posts from users I follow
          const { data: followingIds } = await sb
            .from('follows')
            .select('following_id')
            .eq('follower_id', currentUser.id);
          
          if (followingIds && followingIds.length > 0) {
            const followingUserIds = followingIds.map(f => f.following_id);
            const { data, error } = await sb
              .from('post_feed_v2')
              .select('id,user_id,created_at,body,tags,media_urls,like_count,comment_count,username,display_name,avatar_url,game_id,game_name,game_cover_url')
              .in('user_id', followingUserIds)
              .order('created_at', { ascending: false })
              .limit(20);
            postsData = data;
            postsError = error;
          } else {
            // No following, show empty
            setPosts([]);
            setIsLoading(false);
            return;
          }
        } else {
          // Load all posts for "For You" tab
          const { data, error } = await sb
            .from('post_feed_v2')
            .select('id,user_id,created_at,body,tags,media_urls,like_count,comment_count,username,display_name,avatar_url,game_id,game_name,game_cover_url')
            .order('created_at', { ascending: false })
            .limit(20);
          postsData = data;
          postsError = error;
        }

        if (postsError) {
          console.error('Error loading posts:', postsError);
        }

        // Load games
        const { data: gamesData, error: gamesError } = await sb
          .from('games')
          .select('id, name, cover_url')
          .order('created_at', { ascending: false })
          .limit(5);

        if (gamesError) {
          console.error('Error loading games:', gamesError);
        }

        // Load users for sidebar
        const { data: usersData, error: usersError } = await sb
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .limit(3);

        if (usersError) {
          console.error('Error loading users:', usersError);
        }

        // Transform posts
        const transformedPosts: V0Post[] = (postsData || []).map((post: any) => ({
          id: post.id,
          user: {
            avatar: post.avatar_url || '/avatar-placeholder.svg',
            displayName: post.display_name || post.username,
            handle: `@${post.username}`,
          },
          timestamp: timeAgo(new Date(post.created_at)),
          content: post.body,
          gameImage: post.game_cover_url || undefined,
          likes: post.like_count || 0,
          comments: post.comment_count || 0,
          shares: 0,
          isLiked: false,
        }));

        setPosts(transformedPosts);
        setGames(gamesData || []);
        setUsers(usersData || []);

      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [activeTab, currentUser]);

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
    if (!currentUser) return;
    
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
        await sb.from('likes').delete().eq('post_id', postId).eq('user_id', currentUser.id);
      } else {
        await sb.from('likes').insert({ post_id: postId, user_id: currentUser.id });
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
    if (!currentUser || !content.trim()) return;
    
    try {
      const sb = supabaseBrowser();
      const { error } = await sb.from('posts').insert({
        body: content,
        user_id: currentUser.id,
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
    if (!currentUser) return;
    
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
        await sb.from('follows').delete().eq('follower_id', currentUser.id).eq('following_id', userId);
      } else {
        await sb.from('follows').insert({ follower_id: currentUser.id, following_id: userId });
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
    if (currentUser) {
      router.push(`/u/${currentUser.user_metadata?.username || currentUser.id}`);
    } else {
      router.push('/login');
    }
  };

  const handleTabChange = (tab: 'following' | 'for-you') => {
    setActiveTab(tab);
    // Scroll to top when switching tabs
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFilterChange = (filter: 'all' | 'clips' | 'reviews' | 'screens') => {
    setActiveFilter(filter);
    // Scroll to top when changing filter
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="v0-sandbox">
      <Header
        onSearch={handleSearch}
        onNotifications={handleNotifications}
        onMessages={handleMessages}
        onProfile={handleProfile}
      />
      
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
              ) : (
                posts.map((post) => (
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
