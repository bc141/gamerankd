"use client"

import './v0-sandbox.css'
import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useFeedPosts, useWhoToFollow, useTrendingTopics, useContinuePlaying, useCreatePost, useToggleReaction, useFollowUser } from '@/lib/data-service/hooks'
import { timeAgo } from '@/lib/timeAgo'

// Import v0 components
import { HeroCard } from '@/components/v0-ui/hero-card'
import { FeedTabs } from '@/components/v0-ui/feed-tabs'
import { Composer } from '@/components/v0-ui/composer'
import { PostCard } from '@/components/v0-ui/post-card'
import { Sidebar } from '@/components/v0-ui/sidebar'
import { SkeletonPostCard, SkeletonSidebar } from '@/components/v0-ui/skeletons'
import type { FeedPost, WhoToFollow, TrendingTopic, GameProgress } from '@/lib/data-service/types'

// Create a query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      gcTime: 300000,
    },
  },
})

function V0TestPageContent() {
  const [activeTab, setActiveTab] = useState<'following' | 'for-you'>('for-you')
  const [showScrollToTop, setShowScrollToTop] = useState(false)
  const [selectedGame, setSelectedGame] = useState<GameProgress | null>(null)
  const [showGameModal, setShowGameModal] = useState(false)

  // Data fetching hooks
  const { 
    data: feedData, 
    isLoading: feedLoading, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage 
  } = useFeedPosts()
  
  const { data: whoToFollowData, isLoading: whoToFollowLoading } = useWhoToFollow()
  const { data: trendingData, isLoading: trendingLoading } = useTrendingTopics()
  const { data: continuePlayingData, isLoading: continuePlayingLoading } = useContinuePlaying()

  // Mutation hooks
  const createPostMutation = useCreatePost()
  const toggleReactionMutation = useToggleReaction()
  const followUserMutation = useFollowUser()

  // Flatten feed posts from all pages
  const posts = feedData?.pages.flatMap(page => page.success ? page.data.data : []) || []
  const whoToFollow = whoToFollowData?.success ? whoToFollowData.data : []
  const trendingTopics = trendingData?.success ? trendingData.data : []
  const continuePlaying = continuePlayingData?.success ? continuePlayingData.data : []

  const isLoading = feedLoading || whoToFollowLoading || trendingLoading || continuePlayingLoading

  // Scroll to top functionality
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollToTop(window.scrollY > 300)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleLike = (postId: string) => {
    const post = posts.find(p => p.id === postId)
    if (!post) return

    const isLiked = post.user_reactions.liked
    toggleReactionMutation.mutate({
      post_id: postId,
      reaction_type: 'like',
      action: isLiked ? 'remove' : 'add'
    })
  }

  const handlePost = (content: string) => {
    createPostMutation.mutate({
      content,
      game_id: selectedGame?.id
    }, {
      onSuccess: () => {
        setSelectedGame(null)
        setShowGameModal(false)
      }
    })
  }

  const handleAddImage = () => {
    console.log('Add image')
    // TODO: Implement image upload
  }

  const handleAddGame = () => {
    setShowGameModal(true)
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
    const user = whoToFollow.find(u => u.id === userId)
    if (!user) return

    followUserMutation.mutate({
      user_id: userId,
      follow: !user.is_following
    })
  }

  const handlePlayGame = (gameId: string) => {
    console.log('Play game:', gameId)
    // TODO: Implement game play functionality
  }

  return (
    <div className="v0-sandbox">
      <div className="main-container">
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
                    post={{
                      id: post.id,
                      user: {
                        avatar: post.user.avatar_url || '/avatar-placeholder.svg',
                        displayName: post.user.display_name,
                        handle: `@${post.user.username}`
                      },
                      timestamp: timeAgo(new Date(post.created_at)),
                      content: post.content,
                      gameImage: post.game?.cover_url,
                      likes: post.reaction_counts.likes,
                      comments: post.reaction_counts.comments,
                      shares: post.reaction_counts.shares,
                      isLiked: post.user_reactions.liked
                    }}
                    onLike={() => handleLike(post.id)}
                    onComment={() => handleComment(post.id)}
                    onShare={() => handleShare(post.id)}
                    onMore={() => handleMore(post.id)}
                  />
                ))
              )}
              
              {/* Load more button */}
              {hasNextPage && (
                <div className="flex justify-center py-4">
                  <button
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="px-6 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
                  >
                    {isFetchingNextPage ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {isLoading ? (
              <SkeletonSidebar />
            ) : (
              <Sidebar
                games={continuePlaying.map(game => ({
                  id: game.id,
                  name: game.name,
                  cover_url: game.cover_url
                }))}
                users={whoToFollow.map(user => ({
                  id: user.id,
                  username: user.username,
                  display_name: user.display_name,
                  avatar_url: user.avatar_url
                }))}
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
  )
}

export default function V0TestPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <V0TestPageContent />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
