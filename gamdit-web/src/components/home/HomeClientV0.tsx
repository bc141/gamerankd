'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { waitForSession } from '@/lib/waitForSession';
import { timeAgo } from '@/lib/timeAgo';
import { HomeV0Adapter } from './HomeV0Adapter';
import type { PostData, Game, User } from '@/components/v0-ui';

// ---------- constants ----------
const POSTS_VIEW = 'post_feed_v2';
const POST_COLS = 'id,user_id,created_at,body,tags,media_urls,like_count,comment_count,username,display_name,avatar_url,game_id,game_name,game_cover_url';

// ---------- types ----------
interface PostRow {
  id: string;
  user_id: string;
  created_at: string;
  body: string;
  tags: string[];
  media_urls: string[];
  like_count: number;
  comment_count: number;
  username: string;
  display_name: string;
  avatar_url: string;
  game_id: string;
  game_name: string;
  game_cover_url: string;
}

interface LocalUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
}

// ---------- helpers ----------
async function selectPostsWithFallback(
  sb: ReturnType<typeof supabaseBrowser>,
  build: (q: any) => any,
  limit = 40
): Promise<PostRow[]> {
  let q = build(sb.from(POSTS_VIEW).select(POST_COLS))
    .order('created_at', { ascending: false })
    .limit(limit);
  let { data, error } = await q;
  if (!error) return (data ?? []) as PostRow[];

  // fallback to v1
  q = build(sb.from('post_feed').select(POST_COLS))
    .order('created_at', { ascending: false })
    .limit(limit);
  ({ data, error } = await q);
  if (error) throw error;
  return (data ?? []) as PostRow[];
}

function transformPostToV0(post: PostRow): PostData {
  return {
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
    shares: 0, // Not implemented yet
    isLiked: false, // Will be updated by like handlers
  };
}

// ---------- main component ----------
export default function HomeClientV0() {
  const [me, setMe] = useState<LocalUser | null>(null);
  const [posts, setPosts] = useState<PostData[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scope, setScope] = useState<'following' | 'for-you'>('following');
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  // Scroll to top functionality
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Scroll listener for scroll-to-top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollToTop(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Initialize session and data
  useEffect(() => {
    async function init() {
      try {
        const sb = supabaseBrowser();
        const session = await waitForSession(sb);
        
        if (session?.user) {
          setMe({
            id: session.user.id,
            username: session.user.user_metadata?.username || 'user',
            display_name: session.user.user_metadata?.display_name || session.user.user_metadata?.full_name || 'User',
            avatar_url: session.user.user_metadata?.avatar_url || '/avatar-placeholder.svg',
          });
        }

        // Load posts
        const postsData = await selectPostsWithFallback(sb, (q) => q);
        setPosts(postsData.map(transformPostToV0));

        // Mock data for sidebar (replace with real data later)
        setGames([
          {
            id: '1',
            name: 'Cyberpunk 2077',
            cover_url: '/placeholder.jpg',
          },
          {
            id: '2',
            name: 'Elden Ring',
            cover_url: '/placeholder.jpg',
          },
        ]);

        setUsers([
          {
            id: '1',
            username: 'mikeplays',
            display_name: 'ProGamer_Mike',
            avatar_url: '/avatar-placeholder.svg',
          },
          {
            id: '2',
            username: 'queenstreams',
            display_name: 'StreamQueen',
            avatar_url: '/avatar-placeholder.svg',
          },
        ]);

      } catch (error) {
        console.error('Error initializing HomeClientV0:', error);
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, []);

  // Event handlers
  const handleTabChange = (tab: 'following' | 'for-you') => {
    setScope(tab);
    // TODO: Implement different feed logic based on scope
  };

  const handlePost = async (content: string) => {
    try {
      const sb = supabaseBrowser();
      const { error } = await sb.from('posts').insert({
        body: content,
        user_id: me?.id,
      });

      if (error) throw error;

      // Refresh posts
      const postsData = await selectPostsWithFallback(sb, (q) => q);
      setPosts(postsData.map(transformPostToV0));
    } catch (error) {
      console.error('Error creating post:', error);
    }
  };

  const handleLike = async (postId: string) => {
    // TODO: Implement like functionality
    console.log('Like post:', postId);
  };

  const handleComment = (postId: string) => {
    // TODO: Implement comment functionality
    console.log('Comment on post:', postId);
  };

  const handleShare = (postId: string) => {
    // TODO: Implement share functionality
    console.log('Share post:', postId);
  };

  const handleMore = (postId: string) => {
    // TODO: Implement more actions
    console.log('More actions for post:', postId);
  };

  const handleAddImage = () => {
    // TODO: Implement image upload
    console.log('Add image');
  };

  const handleAddGame = () => {
    // TODO: Implement game selection
    console.log('Add game');
  };

  const handleGameClick = (gameId: string) => {
    // TODO: Navigate to game page
    console.log('Click game:', gameId);
  };

  const handleFollowUser = (userId: string) => {
    // TODO: Implement follow functionality
    console.log('Follow user:', userId);
  };

  const handleSeeAllGames = () => {
    // TODO: Navigate to games page
    console.log('See all games');
  };

  const handleSeeAllUsers = () => {
    // TODO: Navigate to users page
    console.log('See all users');
  };

  const handleDiscoverGames = () => {
    // TODO: Navigate to discover page
    console.log('Discover games');
  };

  const handleSearch = (query: string) => {
    // TODO: Implement search
    console.log('Search:', query);
  };

  const handleNotifications = () => {
    // TODO: Navigate to notifications
    console.log('Notifications');
  };

  const handleMessages = () => {
    // TODO: Navigate to messages
    console.log('Messages');
  };

  const handleProfile = () => {
    // TODO: Navigate to profile
    console.log('Profile');
  };

  return (
    <>
      <HomeV0Adapter
        posts={posts}
        games={games}
        users={users}
        userAvatar={me?.avatar_url}
        isLoading={isLoading}
        onTabChange={handleTabChange}
        onPost={handlePost}
        onLike={handleLike}
        onComment={handleComment}
        onShare={handleShare}
        onMore={handleMore}
        onAddImage={handleAddImage}
        onAddGame={handleAddGame}
        onGameClick={handleGameClick}
        onFollowUser={handleFollowUser}
        onSeeAllGames={handleSeeAllGames}
        onSeeAllUsers={handleSeeAllUsers}
        onDiscoverGames={handleDiscoverGames}
      />

      {/* Scroll to Top Button */}
      <button
        className={`scroll-to-top ${showScrollToTop ? 'visible' : ''}`}
        onClick={scrollToTop}
        aria-label="Scroll to top"
        type="button"
      >
        ↑
      </button>
    </>
  );
}
