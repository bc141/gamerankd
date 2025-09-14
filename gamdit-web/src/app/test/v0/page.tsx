"use client"

import './v0-sandbox.css'
import { useState, useEffect } from 'react'
import { supabaseBrowser } from '@/lib/supabaseBrowser'
import { waitForSession } from '@/lib/waitForSession'
import { timeAgo } from '@/lib/timeAgo'

// Import v0 components
import { HeroCard } from '@/components/v0-ui/hero-card'
import { FeedTabs } from '@/components/v0-ui/feed-tabs'
import { Composer } from '@/components/v0-ui/composer'
import { PostCard } from '@/components/v0-ui/post-card'
import { Sidebar } from '@/components/v0-ui/sidebar'
import { SkeletonPostCard, SkeletonSidebar } from '@/components/v0-ui/skeletons'

interface V0Post {
  id: string
  user: {
    avatar: string
    displayName: string
    handle: string
  }
  timestamp: string
  content: string
  gameImage?: string
  likes: number
  comments: number
  shares: number
  isLiked: boolean
}

interface V0Game {
  id: string
  name: string
  cover_url: string
}

interface V0User {
  id: string
  username: string
  display_name: string
  avatar_url: string
}

export default function V0TestPage() {
  const [posts, setPosts] = useState<V0Post[]>([])
  const [games, setGames] = useState<V0Game[]>([])
  const [users, setUsers] = useState<V0User[]>([])
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'following' | 'for-you'>('for-you')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const sb = supabaseBrowser()
        const session = await waitForSession(sb)

        // Load posts
        const { data: postsData, error: postsError } = await sb
          .from('post_feed_v2')
          .select('id,user_id,created_at,body,tags,media_urls,like_count,comment_count,username,display_name,avatar_url,game_id,game_name,game_cover_url')
          .order('created_at', { ascending: false })
          .limit(10)

        if (postsError) {
          console.error('Error loading posts:', postsError)
        }

        // Load games
        const { data: gamesData, error: gamesError } = await sb
          .from('games')
          .select('id, name, cover_url')
          .order('created_at', { ascending: false })
          .limit(5)

        if (gamesError) {
          console.error('Error loading games:', gamesError)
        }

        // Load users
        const { data: usersData, error: usersError } = await sb
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .neq('id', session?.user?.id)
          .limit(3)

        if (usersError) {
          console.error('Error loading users:', usersError)
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
        }))

        setPosts(transformedPosts)
        setGames(gamesData || [])
        setUsers(usersData || [])
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  const handleLike = (postId: string) => {
    setLikedPosts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(postId)) {
        newSet.delete(postId)
      } else {
        newSet.add(postId)
      }
      return newSet
    })
  }

  const handlePost = (content: string, gameId?: string) => {
    console.log('Post created:', { content, gameId })
    // TODO: Implement post creation
  }

  const handleAddImage = () => {
    console.log('Add image')
    // TODO: Implement image upload
  }

  const handleAddGame = () => {
    console.log('Add game')
    // TODO: Implement game selection
  }

  const handleComment = (postId: string) => {
    console.log('Comment on post:', postId)
    // TODO: Implement comment functionality
  }

  const handleShare = (postId: string) => {
    console.log('Share post:', postId)
    // TODO: Implement share functionality
  }

  const handleMore = (postId: string) => {
    console.log('More actions for post:', postId)
    // TODO: Implement more actions
  }

  const handleFollow = (userId: string) => {
    console.log('Follow user:', userId)
    // TODO: Implement follow functionality
  }

  const handlePlayGame = (gameId: string) => {
    console.log('Play game:', gameId)
    // TODO: Implement game play functionality
  }

  return (
    <div className="v0-sandbox min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">V0 UI Test</h1>
          <p className="text-muted-foreground">Testing v0 components with real backend data</p>
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="text-sm text-foreground">
              <strong>Posts loaded:</strong> {posts.length}
            </p>
            <p className="text-sm text-foreground">
              <strong>Games loaded:</strong> {games.length}
            </p>
            <p className="text-sm text-foreground">
              <strong>Users loaded:</strong> {users.length}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Feed */}
          <div className="lg:col-span-2 space-y-6">
            {/* Hero Section */}
            <HeroCard
              title="Welcome to Gamdit"
              description="Connect with fellow gamers and share your experiences."
              buttonText="Get Started"
              onButtonClick={() => console.log('Get Started clicked')}
            />

            {/* Feed Tabs */}
            <FeedTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />

            {/* Composer */}
            <Composer
              onPost={handlePost}
              onAddImage={handleAddImage}
              onAddGame={handleAddGame}
              placeholder="What's happening in your game?"
            />

            {/* Posts */}
            <div className="space-y-4">
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
          <div className="space-y-6">
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
    </div>
  )
}
