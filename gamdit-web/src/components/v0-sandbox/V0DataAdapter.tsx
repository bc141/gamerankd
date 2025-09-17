"use client"

import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabaseBrowser'
import { waitForSession } from '@/lib/waitForSession'
import { timeAgo } from '@/lib/timeAgo'

// Data types for v0 sandbox
export interface V0Post {
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

export interface V0Game {
  id: string
  title: string
  cover: string
  progress: string
}

export interface V0User {
  id: string
  avatar: string
  displayName: string
  handle: string
  isFollowing: boolean
}

export interface V0Data {
  posts: V0Post[]
  continuePlayingGames: V0Game[]
  whoToFollow: V0User[]
  userAvatar?: string
  isLoading: boolean
}

// Thin adapter to map real data to v0 format
export function useV0Data(): V0Data {
  const [data, setData] = useState<V0Data>({
    posts: [],
    continuePlayingGames: [],
    whoToFollow: [],
    isLoading: true
  })

  useEffect(() => {
    async function loadData() {
      try {
        console.log('V0DataAdapter: Starting data load...')
        const sb = supabaseBrowser()
        const session = await waitForSession(sb)
        
        let userAvatar = '/avatar-placeholder.svg'
        if (session?.user) {
          userAvatar = session.user.user_metadata?.avatar_url || '/avatar-placeholder.svg'
        }

        // Load posts from existing API
        const { data: postsData, error: postsError } = await sb
          .from('post_feed_v2')
          .select('id,user_id,created_at,body,tags,media_urls,like_count,comment_count,username,display_name,avatar_url,game_id,game_name,game_cover_url')
          .order('created_at', { ascending: false })
          .limit(10)

        if (postsError) {
          console.error('Error loading posts:', postsError)
        }

        // Transform posts to v0 format
        const v0Posts: V0Post[] = (postsData || []).map((post: any) => ({
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
          shares: 0, // Not implemented yet
          isLiked: false, // Will be updated by like handlers
        }))

        // Load real games from database
        const { data: gamesData, error: gamesError } = await sb
          .from('games')
          .select('id, name, cover_url')
          .order('created_at', { ascending: false })
          .limit(5)

        if (gamesError) {
          console.error('Error loading games:', gamesError)
        }

        // Transform games to v0 format
        const v0Games: V0Game[] = (gamesData || []).map((game: any) => ({
          id: game.id,
          title: game.name,
          cover: game.cover_url || '/placeholder.jpg',
          progress: 'Recently played',
        }))

        // Load real users for who to follow
        const { data: usersData, error: usersError } = await sb
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .neq('id', session?.user?.id) // Exclude current user
          .limit(3)

        if (usersError) {
          console.error('Error loading users:', usersError)
        }

        // Transform users to v0 format
        const v0Users: V0User[] = (usersData || []).map((user: any) => ({
          id: user.id,
          avatar: user.avatar_url || '/avatar-placeholder.svg',
          displayName: user.display_name || user.username,
          handle: `@${user.username}`,
          isFollowing: false,
        }))

        setData({
          posts: v0Posts,
          continuePlayingGames: v0Games,
          whoToFollow: v0Users,
          userAvatar,
          isLoading: false
        })

      } catch (error) {
        console.error('Error loading v0 data:', error)
        // Set fallback data to prevent crashes
        setData({
          posts: [],
          continuePlayingGames: [],
          whoToFollow: [],
          userAvatar: '/avatar-placeholder.svg',
          isLoading: false
        })
      }
    }

    loadData()
  }, [])

  return data
}
