"use client"

import './v0-sandbox.css'
import { useState, useEffect } from 'react'
import { supabaseBrowser } from '@/lib/supabaseBrowser'
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
  const [showScrollToTop, setShowScrollToTop] = useState(false)
  const [selectedGame, setSelectedGame] = useState<V0Game | null>(null)
  const [showGameModal, setShowGameModal] = useState(false)

  // Load data
  useEffect(() => {
    async function loadData() {
      try {
        const sb = supabaseBrowser()

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
    setLikedPosts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(postId)) {
        newSet.delete(postId)
      } else {
        newSet.add(postId)
      }
      return newSet
    })
    console.log('Like post:', postId)
  }

  const handlePost = (content: string) => {
    console.log('Post created:', { content, gameId: selectedGame?.id })
    // TODO: Implement post creation
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
    console.log('Follow user:', userId)
    // TODO: Implement follow functionality
  }

  const handlePlayGame = (gameId: string) => {
    console.log('Play game:', gameId)
    // TODO: Implement game play functionality
  }

  return (
    <div className="v0-sandbox" style={{ backgroundColor: '#0a0a0a', minHeight: '100vh', color: 'white' }}>
      <div className="main-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1.5rem' }}>
        <div className="mb-8">
          <h1 style={{ color: 'white', fontSize: '2rem', marginBottom: '1rem' }}>V0 UI Test</h1>
          <p style={{ color: '#9ca3af', marginBottom: '1rem' }}>Testing v0 components with real backend data</p>
          <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#1a1a1a', borderRadius: '0.5rem' }}>
            <p style={{ color: 'white', fontSize: '0.875rem' }}>
              <strong>Posts loaded:</strong> {posts.length}
            </p>
            <p style={{ color: 'white', fontSize: '0.875rem' }}>
              <strong>Games loaded:</strong> {games.length}
            </p>
            <p style={{ color: 'white', fontSize: '0.875rem' }}>
              <strong>Users loaded:</strong> {users.length}
            </p>
            <p style={{ color: 'white', fontSize: '0.875rem' }}>
              <strong>Loading:</strong> {isLoading ? 'Yes' : 'No'}
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
          {/* Main Feed */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Simple Test Content */}
            <div style={{ padding: '1rem', backgroundColor: '#111111', borderRadius: '0.5rem', border: '1px solid #333' }}>
              <h2 style={{ color: 'white', marginBottom: '0.5rem' }}>Hero Section</h2>
              <p style={{ color: '#9ca3af' }}>Welcome to Gamdit - Connect with fellow gamers</p>
              <button 
                style={{ 
                  marginTop: '0.5rem', 
                  padding: '0.5rem 1rem', 
                  backgroundColor: '#7a00ff', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '0.25rem',
                  cursor: 'pointer'
                }}
                onClick={() => console.log('Get Started clicked')}
              >
                Get Started
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <button 
                style={{ 
                  padding: '0.5rem 1rem', 
                  backgroundColor: activeTab === 'for-you' ? '#7a00ff' : '#1a1a1a', 
                  color: 'white', 
                  border: '1px solid #333', 
                  borderRadius: '0.25rem',
                  cursor: 'pointer'
                }}
                onClick={() => setActiveTab('for-you')}
              >
                For You
              </button>
              <button 
                style={{ 
                  padding: '0.5rem 1rem', 
                  backgroundColor: activeTab === 'following' ? '#7a00ff' : '#1a1a1a', 
                  color: 'white', 
                  border: '1px solid #333', 
                  borderRadius: '0.25rem',
                  cursor: 'pointer'
                }}
                onClick={() => setActiveTab('following')}
              >
                Following
              </button>
            </div>

            {/* Posts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {isLoading ? (
                <div style={{ padding: '1rem', backgroundColor: '#111111', borderRadius: '0.5rem', border: '1px solid #333' }}>
                  <p style={{ color: '#9ca3af' }}>Loading posts...</p>
                </div>
              ) : (
                posts.map((post) => (
                  <div key={post.id} style={{ padding: '1rem', backgroundColor: '#111111', borderRadius: '0.5rem', border: '1px solid #333' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <div style={{ width: '32px', height: '32px', backgroundColor: '#333', borderRadius: '50%' }}></div>
                      <div>
                        <p style={{ color: 'white', fontWeight: 'bold', margin: 0 }}>{post.user.displayName}</p>
                        <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: 0 }}>{post.user.handle} · {post.timestamp}</p>
                      </div>
                    </div>
                    <p style={{ color: 'white', marginBottom: '0.5rem' }}>{post.content}</p>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <button 
                        style={{ 
                          padding: '0.25rem 0.5rem', 
                          backgroundColor: 'transparent', 
                          color: '#9ca3af', 
                          border: 'none', 
                          cursor: 'pointer'
                        }}
                        onClick={() => handleLike(post.id)}
                      >
                        ❤️ {post.likes}
                      </button>
                      <button 
                        style={{ 
                          padding: '0.25rem 0.5rem', 
                          backgroundColor: 'transparent', 
                          color: '#9ca3af', 
                          border: 'none', 
                          cursor: 'pointer'
                        }}
                        onClick={() => handleComment(post.id)}
                      >
                        💬 {post.comments}
                      </button>
                      <button 
                        style={{ 
                          padding: '0.25rem 0.5rem', 
                          backgroundColor: 'transparent', 
                          color: '#9ca3af', 
                          border: 'none', 
                          cursor: 'pointer'
                        }}
                        onClick={() => handleShare(post.id)}
                      >
                        🔄 {post.shares}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
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
