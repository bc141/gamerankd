"use client"

import { useState } from "react"
import "./v0-sandbox.css"
import { Heart, MessageCircle as MessageCircleIcon, Share, MoreHorizontal, ImageIcon, Gamepad2, Play, UserPlus, TrendingUp } from "lucide-react"
import { useV0Data } from "@/components/v0-sandbox/V0DataAdapter"

// V0 Test - Completely isolated from main app with real data
export default function V0TestPage() {
  const [activeTab, setActiveTab] = useState<"following" | "for-you">("following")
  const [composerContent, setComposerContent] = useState("")
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set())
  
  // Use real data from backend
  const { posts, continuePlayingGames, whoToFollow, userAvatar, isLoading } = useV0Data()

  // Event handlers
  const handlePost = () => {
    if (composerContent.trim()) {
      console.log('Posting:', composerContent)
      // TODO: Implement actual post creation
      setComposerContent("")
    }
  }

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
    console.log('Like toggled for post:', postId)
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

  const handleAddImage = () => {
    console.log('Add image')
    // TODO: Implement image upload
  }

  const handleAddGame = () => {
    console.log('Add game')
    // TODO: Implement game selection
  }

  return (
    <div className="v0-sandbox min-h-screen bg-background">
      {/* No header - use main app's header */}

      <main className="main-layout py-8">
        {/* Main Feed - Ensure first feed item is visible on laptop */}
        <div className="space-y-6">
            {/* V0 Hero Card - Compact for laptop viewport */}
            <div
              className="relative overflow-hidden rounded-xl p-4 text-center"
              style={{
                background: `linear-gradient(135deg, var(--brand-gradient-start) 0%, var(--brand-gradient-end) 100%)`,
              }}
            >
              <div className="relative z-10">
                <h2 className="text-xl font-bold text-white mb-2">Welcome to the Gaming Universe</h2>
                <button
                  className="v0-button v0-button-default v0-button-sm bg-black/80 hover:bg-black/90 text-white border-black/50 backdrop-blur-sm transition-all duration-200"
                >
                  Discover Games
                </button>
              </div>
              <div className="absolute inset-0 bg-black/10" />
            </div>

            <div className="mt-6">
              {/* V0 Feed Tabs - Midnight Nova spacing rhythm */}
              <div role="tablist" className="flex bg-card rounded-lg p-1 border border-border">
                <button
                  role="tab"
                  aria-selected={activeTab === "following"}
                  data-testid="following-tab"
                  onClick={() => setActiveTab("following")}
                  className={`tab-button flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 min-h-[44px] ${
                    activeTab === "following" ? "active" : ""
                  }`}
                >
                  Following
                </button>
                <button
                  role="tab"
                  aria-selected={activeTab === "for-you"}
                  data-testid="for-you-tab"
                  onClick={() => setActiveTab("for-you")}
                  className={`tab-button flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 min-h-[44px] ${
                    activeTab === "for-you" ? "active" : ""
                  }`}
                >
                  For You
                </button>
              </div>

              <div className="mt-4">
                {/* V0 Composer - Midnight Nova spacing rhythm */}
                <div className="composer-card">
                  <div className="flex gap-4">
                    <img src={userAvatar || "/avatar-placeholder.svg"} alt="Your avatar" className="w-10 h-10 rounded-full flex-shrink-0" />

                    <div className="flex-1">
                      <textarea
                        value={composerContent}
                        onChange={(e) => setComposerContent(e.target.value)}
                        placeholder="What's happening in your game?"
                        className="w-full bg-transparent text-foreground placeholder:text-muted-foreground resize-none border-none outline-none text-lg min-h-[80px]"
                        rows={3}
                      />

                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                        <div className="flex items-center gap-2">
                          <button 
                            className="v0-button v0-button-ghost v0-button-icon" 
                            aria-label="Add image"
                            onClick={handleAddImage}
                          >
                            <ImageIcon className="w-5 h-5" />
                          </button>
                          <button 
                            className="v0-button v0-button-ghost v0-button-icon" 
                            aria-label="Add game"
                            onClick={handleAddGame}
                          >
                            <Gamepad2 className="w-5 h-5" />
                          </button>
                        </div>

                        <button
                          className="v0-button v0-button-default transition-all duration-200"
                          disabled={!composerContent.trim()}
                          data-testid="composer-submit"
                          onClick={handlePost}
                        >
                          Post
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {isLoading ? (
                    <>
                      <div className="bg-card border border-border rounded-xl p-6 animate-pulse">
                        <div className="flex gap-4">
                          <div className="w-10 h-10 bg-muted rounded-full flex-shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="h-4 bg-muted rounded w-24" />
                              <div className="h-4 bg-muted rounded w-16" />
                              <div className="h-4 bg-muted rounded w-8" />
                            </div>
                            <div className="space-y-2 mb-4">
                              <div className="h-4 bg-muted rounded w-full" />
                              <div className="h-4 bg-muted rounded w-3/4" />
                            </div>
                            <div className="flex items-center gap-6">
                              <div className="h-8 bg-muted rounded w-16" />
                              <div className="h-8 bg-muted rounded w-16" />
                              <div className="h-8 bg-muted rounded w-16" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    posts.map((post) => (
                    <article key={post.id} className="post-card transition-all duration-200 hover:border-border/80">
                      <div className="flex gap-4">
                        <img
                          src={post.user.avatar || "/avatar-placeholder.svg"}
                          alt={`${post.user.displayName} avatar`}
                          className="w-10 h-10 rounded-full flex-shrink-0"
                        />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-foreground">{post.user.displayName}</h3>
                            <span className="text-muted-foreground text-sm">{post.user.handle}</span>
                            <span className="text-muted-foreground text-sm">·</span>
                            <time className="text-muted-foreground text-sm">{post.timestamp}</time>

                            <button 
                              className="v0-button v0-button-ghost v0-button-icon ml-auto" 
                              aria-label="More options"
                              onClick={() => handleMore(post.id)}
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </div>

                          <p className="text-foreground mb-4 leading-relaxed">{post.content}</p>

                          {post.gameImage && (
                            <div className="mb-4">
                              <img
                                src={post.gameImage || "/placeholder.svg"}
                                alt="Game screenshot"
                                className="rounded-lg max-w-full h-auto border border-border"
                              />
                            </div>
                          )}

                          <div className="flex items-center gap-6">
                            <button
                              className={`v0-button v0-button-ghost v0-button-sm gap-2 min-h-[44px] transition-colors duration-200 ${
                                likedPosts.has(post.id) ? "text-red-500 hover:text-red-600" : "text-muted-foreground hover:text-foreground"
                              }`}
                              aria-label={`${likedPosts.has(post.id) ? "Unlike" : "Like"} post`}
                              data-testid="like-button"
                              onClick={() => handleLike(post.id)}
                            >
                              <Heart className={`w-4 h-4 ${likedPosts.has(post.id) ? "fill-current" : ""}`} />
                              <span className="text-sm">{post.likes + (likedPosts.has(post.id) ? 1 : 0)}</span>
                            </button>

                            <button
                              className="v0-button v0-button-ghost v0-button-sm gap-2 text-muted-foreground hover:text-foreground min-h-[44px] transition-colors duration-200"
                              aria-label="Comment on post"
                              data-testid="comment-button"
                              onClick={() => handleComment(post.id)}
                            >
                              <MessageCircleIcon className="w-4 h-4" />
                              <span className="text-sm">{post.comments}</span>
                            </button>

                            <button
                              className="v0-button v0-button-ghost v0-button-sm gap-2 text-muted-foreground hover:text-foreground min-h-[44px] transition-colors duration-200"
                              aria-label="Share post"
                              data-testid="share-button"
                              onClick={() => handleShare(post.id)}
                            >
                              <Share className="w-4 h-4" />
                              <span className="text-sm">{post.shares}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* V0 Sidebar - Exact replica */}
            <aside className="hidden lg:block w-[360px] flex-shrink-0">
            <div className="space-y-6">
              {/* Continue Playing */}
              <div className="sidebar-card">
                <div className="flex items-center gap-2 mb-4">
                  <Play className="w-5 h-5 text-sidebar-accent" />
                  <h2 className="font-semibold text-sidebar-foreground">Continue Playing</h2>
                </div>

                <div className="space-y-4">
                  {continuePlayingGames.map((game) => (
                    <div key={game.id} className="flex items-center gap-3">
                      <img
                        src={game.cover || "/placeholder.svg"}
                        alt={`${game.title} cover`}
                        className="w-12 h-12 rounded-lg object-cover border border-sidebar-border"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sidebar-foreground text-sm truncate">{game.title}</h3>
                        <p className="text-xs text-muted-foreground">{game.progress}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Who to Follow */}
              <div className="sidebar-card">
                <div className="flex items-center gap-2 mb-4">
                  <UserPlus className="w-5 h-5 text-sidebar-accent" />
                  <h2 className="font-semibold text-sidebar-foreground">Who to Follow</h2>
                </div>

                <div className="space-y-4">
                  {whoToFollow.map((user) => (
                    <div key={user.id} className="flex items-center gap-3">
                      <img
                        src={user.avatar || "/placeholder.svg"}
                        alt={`${user.displayName} avatar`}
                        className="w-8 h-8 rounded-full"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sidebar-foreground text-sm truncate">{user.displayName}</h3>
                        <p className="text-xs text-muted-foreground">{user.handle}</p>
                      </div>
                      <button className="v0-button v0-button-outline v0-button-sm text-xs bg-transparent">
                        Follow
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trending */}
              <div className="bg-sidebar border border-sidebar-border rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-sidebar-accent" />
                  <h2 className="font-semibold text-sidebar-foreground">Trending</h2>
                </div>

                <div className="text-center py-8">
                  <p className="text-muted-foreground text-sm">No trending topics yet</p>
                  <p className="text-muted-foreground text-xs mt-1">Check back later!</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}
