"use client"

import { useState, useEffect } from 'react'
import { supabaseBrowser } from '@/lib/supabaseBrowser'
import { waitForSession } from '@/lib/waitForSession'
import { timeAgo } from '@/lib/timeAgo'
import { Heart, MessageCircle, Share, MoreHorizontal } from 'lucide-react'

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

export default function FeedTestPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadPosts() {
      try {
        const sb = supabaseBrowser()
        const session = await waitForSession(sb)

        // Load posts from existing API
        const { data: postsData, error: postsError } = await sb
          .from('post_feed_v2')
          .select('id,user_id,created_at,body,tags,media_urls,like_count,comment_count,username,display_name,avatar_url,game_id,game_name,game_cover_url')
          .order('created_at', { ascending: false })
          .limit(20)

        if (postsError) {
          console.error('Error loading posts:', postsError)
        }

        // Transform posts to our format
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
      } catch (error) {
        console.error('Error loading posts:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadPosts()
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

  const handleComment = (postId: string) => {
    console.log('Comment on post:', postId)
  }

  const handleShare = (postId: string) => {
    console.log('Share post:', postId)
  }

  const handleMore = (postId: string) => {
    console.log('More actions for post:', postId)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-foreground mb-8">Feed Test - Loading...</h1>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-6 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-muted rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-1/6"></div>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="h-4 bg-muted rounded w-full"></div>
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">Feed Test</h1>
          <p className="text-muted-foreground">Testing feed component with real backend data</p>
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="text-sm text-foreground">
              <strong>Posts loaded:</strong> {posts.length}
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Liked posts:</strong> {likedPosts.size}
            </p>
          </div>
        </div>

        <div className="space-y-6">
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
                      onClick={() => handleMore(post.id)}
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
                      onClick={() => handleComment(post.id)}
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>{post.comments}</span>
                    </button>

                    <button
                      className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm transition-colors duration-200"
                      onClick={() => handleShare(post.id)}
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

        {posts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No posts found</p>
          </div>
        )}
      </div>
    </div>
  )
}
