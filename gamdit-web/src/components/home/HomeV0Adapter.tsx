"use client"

import { useState } from "react"
import { 
  HeroCard, 
  FeedTabs, 
  Composer, 
  PostCard, 
  Sidebar, 
  PostSkeleton,
  type PostData,
  type ContinuePlayingGame,
  type WhoToFollowUser
} from "@/components/v0-ui"

interface HomeV0AdapterProps {
  // Data props
  posts: PostData[]
  continuePlayingGames: ContinuePlayingGame[]
  whoToFollow: WhoToFollowUser[]
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
  continuePlayingGames,
  whoToFollow,
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
  const [composerContent, setComposerContent] = useState("")

  const handleTabChange = (tab: "following" | "for-you") => {
    setActiveTab(tab)
    onTabChange(tab)
  }

  const handlePost = () => {
    if (composerContent.trim()) {
      onPost(composerContent)
      setComposerContent("")
    }
  }

  return (
    <main className="max-w-[1240px] mx-auto px-6 py-8">
      <div className="flex gap-8 lg:gap-12">
        {/* Main Feed */}
        <div className="flex-1 min-w-0 lg:min-w-[720px]">
          <HeroCard
            title="Welcome to the Gaming Universe"
            ctaText="Discover Games"
            onCtaClick={onDiscoverGames}
          />

          <div className="mt-8">
            <FeedTabs activeTab={activeTab} onTabChange={handleTabChange} />

            <div className="mt-6">
              <Composer
                content={composerContent}
                onContentChange={setComposerContent}
                onSubmit={handlePost}
                onAddImage={onAddImage}
                onAddGame={onAddGame}
                userAvatar={userAvatar}
              />

              <div className="mt-8 space-y-6">
                {isLoading ? (
                  <>
                    <PostSkeleton />
                    <PostSkeleton />
                    <PostSkeleton />
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
            continuePlayingGames={continuePlayingGames}
            whoToFollow={whoToFollow}
            onGameClick={onGameClick}
            onFollowUser={onFollowUser}
            onSeeAllGames={onSeeAllGames}
            onSeeAllUsers={onSeeAllUsers}
          />
        </aside>
      </div>
    </main>
  )
}
