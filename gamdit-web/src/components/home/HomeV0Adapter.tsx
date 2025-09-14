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
    <main className="max-w-[1240px] mx-auto px-6 py-8">
      <div className="flex gap-8 lg:gap-12">
        {/* Main Feed */}
        <div className="flex-1 min-w-0 lg:min-w-[720px]">
          <HeroCard
            title="Welcome to the Gaming Universe"
            buttonText="Discover Games"
            onButtonClick={onDiscoverGames}
          />

          <div className="mt-8">
            <FeedTabs activeTab={activeTab} onTabChange={handleTabChange} />

            <div className="mt-6">
              <Composer
                onPost={handlePost}
                onAddImage={onAddImage}
                onAddGame={onAddGame}
              />

              <div className="mt-8 space-y-6">
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
          </div>
        </div>

        {/* Sidebar */}
        <aside className="hidden lg:block w-[360px] flex-shrink-0">
          <Sidebar
            games={games}
            users={users}
            onPlayGame={onGameClick}
            onFollow={onFollowUser}
          />
        </aside>
      </div>
    </main>
  )
}
