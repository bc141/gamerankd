"use client"

import { useState } from "react"
import "../v0-sandbox.css"
import { Search, Bell, MessageCircle, User, Heart, MessageCircle as MessageCircleIcon, Share, MoreHorizontal, ImageIcon, Gamepad2, Play, UserPlus, TrendingUp } from "lucide-react"
import { useV0Data } from "@/components/v0-sandbox/V0DataAdapter"

// V0 Sandbox - Exact replica of v0 components with real data
export default function V0SandboxPage() {
  const [activeTab, setActiveTab] = useState<"following" | "for-you">("following")
  const [composerContent, setComposerContent] = useState("")
  
  // Use data adapter to get real data
  const { posts, continuePlayingGames, whoToFollow, userAvatar, isLoading } = useV0Data()

  // Fallback for any rendering issues
  if (typeof window === 'undefined') {
    return <div>Loading...</div>
  }

  return (
    <div className="v0-sandbox min-h-screen bg-background">
      {/* V0 Header - Exact replica */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border">
        <div className="max-w-[1240px] mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-foreground">Gamdit</h1>
            </div>

            {/* Search */}
            <div className="flex-1 max-w-md mx-8">
              <div className="relative" role="search">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <input
                  type="search"
                  placeholder="Search games, players, posts..."
                  className="w-full pl-10 pr-4 py-2 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-200"
                />
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex items-center gap-2">
              <button className="v0-button v0-button-ghost v0-button-icon" aria-label="Notifications">
                <Bell className="w-5 h-5" />
              </button>
              <button className="v0-button v0-button-ghost v0-button-icon" aria-label="Messages">
                <MessageCircle className="w-5 h-5" />
              </button>
              <button className="v0-button v0-button-ghost v0-button-icon" aria-label="Profile">
                <User className="w-5 h-5" />
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-[1240px] mx-auto px-6 py-8">
        <div className="flex gap-8 lg:gap-12">
          {/* Main Feed - Ensure first feed item is visible on laptop */}
          <div className="flex-1 min-w-0 lg:min-w-[720px]">
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
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 min-h-[44px] ${
                    activeTab === "following"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  Following
                </button>
                <button
                  role="tab"
                  aria-selected={activeTab === "for-you"}
                  data-testid="for-you-tab"
                  onClick={() => setActiveTab("for-you")}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 min-h-[44px] ${
                    activeTab === "for-you"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  For You
                </button>
              </div>

              <div className="mt-4">
                {/* V0 Composer - Midnight Nova spacing rhythm */}
                <div className="bg-card border border-border rounded-xl p-4">
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
                          <button className="v0-button v0-button-ghost v0-button-icon" aria-label="Add image">
                            <ImageIcon className="w-5 h-5" />
                          </button>
                          <button className="v0-button v0-button-ghost v0-button-icon" aria-label="Add game">
                            <Gamepad2 className="w-5 h-5" />
                          </button>
                        </div>

                        <button
                          className="v0-button v0-button-default transition-all duration-200"
                          disabled={!composerContent.trim()}
                          data-testid="composer-submit"
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
                      <article key={post.id} className="bg-card border border-border rounded-xl p-6 transition-all duration-200 hover:border-border/80">
                        <div className="flex gap-4">
                          <img
                            src={post.user.avatar || "/placeholder.svg"}
                            alt={`${post.user.displayName} avatar`}
                            className="w-10 h-10 rounded-full flex-shrink-0"
                          />

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-foreground">{post.user.displayName}</h3>
                              <span className="text-muted-foreground text-sm">{post.user.handle}</span>
                              <span className="text-muted-foreground text-sm">·</span>
                              <time className="text-muted-foreground text-sm">{post.timestamp}</time>

                              <button className="v0-button v0-button-ghost v0-button-icon ml-auto" aria-label="More options">
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
                                  post.isLiked ? "text-red-500 hover:text-red-600" : "text-muted-foreground hover:text-foreground"
                                }`}
                                aria-label={`${post.isLiked ? "Unlike" : "Like"} post`}
                                data-testid="like-button"
                              >
                                <Heart className={`w-4 h-4 ${post.isLiked ? "fill-current" : ""}`} />
                                <span className="text-sm">{post.likes}</span>
                              </button>

                              <button
                                className="v0-button v0-button-ghost v0-button-sm gap-2 text-muted-foreground hover:text-foreground min-h-[44px] transition-colors duration-200"
                                aria-label="Comment on post"
                                data-testid="comment-button"
                              >
                                <MessageCircleIcon className="w-4 h-4" />
                                <span className="text-sm">{post.comments}</span>
                              </button>

                              <button
                                className="v0-button v0-button-ghost v0-button-sm gap-2 text-muted-foreground hover:text-foreground min-h-[44px] transition-colors duration-200"
                                aria-label="Share post"
                                data-testid="share-button"
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
          </div>

          {/* V0 Sidebar - Exact replica */}
          <aside className="hidden lg:block w-[360px] flex-shrink-0">
            <div className="space-y-6">
              {/* Continue Playing */}
              <div className="bg-sidebar border border-sidebar-border rounded-xl p-6">
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
              <div className="bg-sidebar border border-sidebar-border rounded-xl p-6">
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
