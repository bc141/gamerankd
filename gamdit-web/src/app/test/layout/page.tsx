"use client"

import { useState, useEffect } from 'react'
import { supabaseBrowser } from '@/lib/supabaseBrowser'
import { waitForSession } from '@/lib/waitForSession'
import { timeAgo } from '@/lib/timeAgo'
import { Heart, MessageCircle, Share, MoreHorizontal, ImageIcon, Gamepad2, Send, Play, UserPlus, TrendingUp, Plus } from 'lucide-react'

interface Post {
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

interface Game {
  id: string
  name: string
  cover_url: string
}

interface User {
  id: string
  username: string
  display_name: string
  avatar_url: string
}

export default function LayoutTestPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set())
  const [composerContent, setComposerContent] = useState('')
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [showGameSelector, setShowGameSelector] = useState(false)
  const [userAvatar, setUserAvatar] = useState('/avatar-placeholder.svg')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const sb = supabaseBrowser()
        const session = await waitForSession(sb)
        
        if (session?.user) {
          setUserAvatar(session.user.user_metadata?.avatar_url || '/avatar-placeholder.svg')
        }

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

        // Transform data
        const transformedPosts: Post[] = (postsData || []).map((post: any) => ({
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

  const handlePost = async () => {
    if (!composerContent.trim()) return

    try {
      const sb = supabaseBrowser()
      const session = await waitForSession(sb)
      
      if (!session?.user) {
        console.error('No user session')
        return
      }

      const { data, error } = await sb
        .from('posts')
        .insert({
          user_id: session.user.id,
          body: composerContent,
          game_id: selectedGame?.id || null,
        })
        .select()

      if (error) {
        console.error('Error creating post:', error)
        return
      }

      console.log('Post created:', data)
      setComposerContent('')
      setSelectedGame(null)
      alert('Post created successfully!')
    } catch (error) {
      console.error('Error creating post:', error)
      alert('Error creating post')
    }
  }

  const handleSelectGame = (game: Game) => {
    setSelectedGame(game)
    setShowGameSelector(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold text-foreground mb-8">Layout Test - Loading...</h1>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-6 animate-pulse">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 bg-muted rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
                      <div className="h-3 bg-muted rounded w-1/6"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-6">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-6 animate-pulse">
                  <div className="h-4 bg-muted rounded w-1/3 mb-4"></div>
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className="w-12 h-12 bg-muted rounded-lg"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-muted rounded w-1/2"></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">Layout Test</h1>
          <p className="text-muted-foreground">Testing complete layout with all components</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Feed */}
          <div className="lg:col-span-2 space-y-6">
            {/* Hero Section */}
            <div
              className="relative overflow-hidden rounded-xl p-6 text-center"
              style={{
                background: `linear-gradient(135deg, #7a00ff 0%, #2f3bff 100%)`,
              }}
            >
              <div className="relative z-10">
                <h2 className="text-xl font-bold text-white mb-2">
                  Welcome to Gamdit
                </h2>
                <p className="text-white/90 mb-4">
                  Connect with fellow gamers and share your experiences.
                </p>
                <button className="px-4 py-2 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-colors">
                  Get Started
                </button>
              </div>
              <div className="absolute inset-0 bg-black/10" />
            </div>

            {/* Composer */}
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex gap-4">
                <img 
                  src={userAvatar} 
                  alt="Your avatar" 
                  className="w-10 h-10 rounded-full flex-shrink-0" 
                />
                
                <div className="flex-1">
                  <textarea
                    value={composerContent}
                    onChange={(e) => setComposerContent(e.target.value)}
                    placeholder="What's happening in your game?"
                    className="w-full bg-transparent text-foreground placeholder:text-muted-foreground resize-none border-none outline-none text-lg min-h-[80px]"
                    rows={3}
                  />

                  {selectedGame && (
                    <div className="mt-3 p-3 bg-muted rounded-lg border border-border flex items-center gap-3">
                      <img
                        src={selectedGame.cover_url}
                        alt={selectedGame.name}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                      <div className="flex-1">
                        <h4 className="font-medium text-foreground text-sm">{selectedGame.name}</h4>
                        <p className="text-xs text-muted-foreground">Game</p>
                      </div>
                      <button
                        onClick={() => setSelectedGame(null)}
                        className="p-1 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
                      >
                        ×
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                    <div className="flex items-center gap-2">
                      <button 
                        className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
                        aria-label="Add image"
                      >
                        <ImageIcon className="w-5 h-5" />
                      </button>
                      
                      <button 
                        className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
                        onClick={() => setShowGameSelector(true)}
                        aria-label="Add game"
                      >
                        <Gamepad2 className="w-5 h-5" />
                      </button>
                    </div>

                    <button
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!composerContent.trim()}
                      onClick={handlePost}
                    >
                      <Send className="w-4 h-4 mr-2 inline" />
                      Post
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Posts */}
            <div className="space-y-4">
              {posts.map((post) => (
                <article key={post.id} className="bg-card border border-border rounded-xl p-6 hover:shadow-lg transition-all duration-200">
                  <div className="flex gap-4">
                    <img
                      src={post.user.avatar}
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
                          className="ml-auto p-1 hover:bg-muted rounded-full transition-colors"
                          onClick={() => console.log('More options')}
                          aria-label="More options"
                        >
                          <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>

                      <p className="text-foreground mb-4 leading-relaxed">{post.content}</p>

                      {post.gameImage && (
                        <div className="mb-4">
                          <img
                            src={post.gameImage}
                            alt="Game cover"
                            className="rounded-lg max-w-full h-auto border border-border"
                          />
                        </div>
                      )}

                      <div className="flex items-center gap-6">
                        <button
                          className={`flex items-center gap-2 text-sm transition-colors duration-200 ${
                            likedPosts.has(post.id) 
                              ? "text-red-500 hover:text-red-600" 
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                          onClick={() => handleLike(post.id)}
                        >
                          <Heart className={`w-4 h-4 ${likedPosts.has(post.id) ? "fill-current" : ""}`} />
                          <span>{post.likes + (likedPosts.has(post.id) ? 1 : 0)}</span>
                        </button>

                        <button
                          className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm transition-colors duration-200"
                          onClick={() => console.log('Comment')}
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>{post.comments}</span>
                        </button>

                        <button
                          className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm transition-colors duration-200"
                          onClick={() => console.log('Share')}
                        >
                          <Share className="w-4 h-4" />
                          <span>{post.shares}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Continue Playing */}
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Play className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-foreground">Continue Playing</h2>
              </div>

              <div className="space-y-4">
                {games.map((game) => (
                  <button
                    key={game.id}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <img
                      src={game.cover_url}
                      alt={`${game.name} cover`}
                      className="w-12 h-12 rounded-lg object-cover border border-border"
                    />
                    <div className="flex-1 min-w-0 text-left">
                      <h3 className="font-medium text-foreground text-sm truncate">{game.name}</h3>
                      <p className="text-xs text-muted-foreground">Recently played</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Who to Follow */}
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <UserPlus className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-foreground">Who to Follow</h2>
              </div>

              <div className="space-y-4">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center gap-3">
                    <img
                      src={user.avatar_url || '/avatar-placeholder.svg'}
                      alt={`${user.display_name} avatar`}
                      className="w-8 h-8 rounded-full"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground text-sm truncate">
                        {user.display_name || user.username}
                      </h3>
                      <p className="text-xs text-muted-foreground">@{user.username}</p>
                    </div>
                    <button
                      onClick={() => console.log('Follow', user.id)}
                      className="px-3 py-1 text-xs font-medium text-primary border border-primary rounded-full hover:bg-primary/10 transition-colors"
                    >
                      Follow
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Trending */}
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-foreground">Trending</h2>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground text-sm">#Gaming</p>
                    <p className="text-xs text-muted-foreground">1.2K posts</p>
                  </div>
                  <Plus className="w-4 h-4 text-muted-foreground" />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground text-sm">#NewGame</p>
                    <p className="text-xs text-muted-foreground">856 posts</p>
                  </div>
                  <Plus className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Game Selector Modal */}
        {showGameSelector && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">Select a Game</h3>
                <button
                  onClick={() => setShowGameSelector(false)}
                  className="p-1 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-2">
                {games.map((game) => (
                  <button
                    key={game.id}
                    onClick={() => handleSelectGame(game)}
                    className="w-full p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors flex items-center gap-3"
                  >
                    <img
                      src={game.cover_url}
                      alt={game.name}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                    <div className="flex-1 text-left">
                      <h4 className="font-medium text-foreground text-sm">{game.name}</h4>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
