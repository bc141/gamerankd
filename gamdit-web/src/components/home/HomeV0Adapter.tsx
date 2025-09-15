"use client"

import { useState } from "react"
import { 
  HeroCard, 
  FeedTabs, 
  Composer, 
  PostCard, 
  Sidebar, 
  SkeletonPostCard,
  type PostData,
  type Game,
  type User
} from "@/components/v0-ui"

interface HomeV0AdapterProps {
  // Data props
  posts: PostData[]
  games: Game[]
  users: User[]
  userAvatar?: string
  isLoading?: boolean
  
  // Event handlers
  onTabChange: (tab: "following" | "for-you") => void
  onPost: (content: string) => void
  onLike: (postId: string) => void
  onComment: (postId: string) => void
  onShare: (postId: string) => void
  onMore: (postId: string) => void
  onAddImage: () => void
  onAddGame: () => void
  onGameClick: (gameId: string) => void
  onFollowUser: (userId: string) => void
  onSeeAllGames: () => void
  onSeeAllUsers: () => void
  onDiscoverGames: () => void
}

export function HomeV0Adapter({
  posts,
  games,
  users,
  userAvatar,
  isLoading = false,
  onTabChange,
  onPost,
  onLike,
  onComment,
  onShare,
  onMore,
  onAddImage,
  onAddGame,
  onGameClick,
  onFollowUser,
  onSeeAllGames,
  onSeeAllUsers,
  onDiscoverGames
}: HomeV0AdapterProps) {
  const [activeTab, setActiveTab] = useState<"following" | "for-you">("following")
  const handleTabChange = (tab: "following" | "for-you") => {
    setActiveTab(tab)
    onTabChange(tab)
  }

  const handlePost = (content: string) => {
    onPost(content)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Main Feed */}
      <div className="lg:col-span-3 space-y-3">
        {/* Hero Section */}
        <HeroCard
          title="Welcome to Gamdit"
          description="Connect with fellow gamers and share your experiences."
          buttonText="Get Started"
          onButtonClick={onDiscoverGames}
        />

        {/* Sticky Feed Tabs */}
        <div className="sticky-tabs">
          <FeedTabs activeTab={activeTab} onTabChange={handleTabChange} />
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
          onAddImage={onAddImage}
          onAddGame={onAddGame}
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
                onLike={onLike}
                onComment={onComment}
                onShare={onShare}
                onMore={onMore}
              />
            ))
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        <Sidebar
          games={games}
          users={users}
          onPlayGame={onGameClick}
          onFollow={onFollowUser}
        />
      </div>
    </div>
  )
}
