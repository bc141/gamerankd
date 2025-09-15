'use client';

import { useEffect, useState } from 'react';
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
  const [posts, setPosts] = useState<V0Post[]>([]);
  const [games, setGames] = useState<V0Game[]>([]);
  const [users, setUsers] = useState<V0User[]>([]);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'following' | 'for-you'>('for-you');
  const [isLoading, setIsLoading] = useState(true);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [selectedGame, setSelectedGame] = useState<V0Game | null>(null);
  const [showGameModal, setShowGameModal] = useState(false);

  // Load data
  useEffect(() => {
    async function loadData() {
      try {
        const sb = supabaseBrowser();

        // Load posts
        const { data: postsData, error: postsError } = await sb
          .from('post_feed_v2')
          .select('id,user_id,created_at,body,tags,media_urls,like_count,comment_count,username,display_name,avatar_url,game_id,game_name,game_cover_url')
          .order('created_at', { ascending: false })
          .limit(10);

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

        // Load users
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
  }, []);

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

  const handleLike = (postId: string) => {
    setLikedPosts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
    console.log('Like post:', postId);
  };

  const handlePost = (content: string) => {
    console.log('Post created:', { content, gameId: selectedGame?.id });
    // TODO: Implement post creation
  };

  const handleAddImage = () => {
    console.log('Add image');
    // TODO: Implement image upload
  };

  const handleAddGame = () => {
    setShowGameModal(true);
  };

  const handleComment = (postId: string) => {
    console.log('Comment on post:', postId);
    // TODO: Implement comment functionality
  };

  const handleShare = (postId: string) => {
    console.log('Share post:', postId);
    // TODO: Implement share functionality
  };

  const handleMore = (postId: string) => {
    console.log('More actions for post:', postId);
    // TODO: Implement more actions
  };

  const handleFollow = (userId: string) => {
    console.log('Follow user:', userId);
    // TODO: Implement follow functionality
  };

  const handlePlayGame = (gameId: string) => {
    console.log('Play game:', gameId);
    // TODO: Implement game play functionality
  };

  const handleSearch = (query: string) => {
    console.log('Search:', query);
  };

  const handleNotifications = () => {
    console.log('Notifications');
  };

  const handleMessages = () => {
    console.log('Messages');
  };

  const handleProfile = () => {
    console.log('Profile');
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
                onTabChange={setActiveTab}
              />
            </div>

            {/* Quick Filter Chips */}
            <div className="filter-chips">
              <button className="filter-chip active" type="button">
                All
              </button>
              <button className="filter-chip" type="button">
                Clips
              </button>
              <button className="filter-chip" type="button">
                Reviews
              </button>
              <button className="filter-chip" type="button">
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
