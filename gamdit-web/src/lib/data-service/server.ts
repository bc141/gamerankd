// Server-side data service - Uses service role key, bypasses RLS

import { createClient } from '@supabase/supabase-js'
import type {
  FeedPost,
  UserPreview,
  WhoToFollow,
  TrendingTopic,
  GameProgress,
  PaginatedResponse,
  CreatePostInput,
  CreateCommentInput,
  FollowUserInput,
  ReactionInput,
  Cursor,
  DataServiceResult,
  DataServiceError
} from './types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

class ServerDataService {
  private handleError(error: any, operation: string): DataServiceError {
    console.error(`Server data service error in ${operation}:`, error)
    return {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'An unexpected error occurred',
      details: error.details
    }
  }

  // Unified feed contract (mixed content: posts, reviews, ratings)
  async getFeed(params: {
    viewerId?: string | null
    tab: 'following' | 'for-you'
    filter: 'all' | 'clips' | 'reviews' | 'screens'
    cursor?: { created_at: string; id: string } | null
    limit?: number
  }): Promise<DataServiceResult<PaginatedResponse<FeedPost>>> {
    const { viewerId, tab, filter, cursor, limit = 20 } = params
    try {
      // Build query from unified feed view
      let baseQuery = supabase
        .from('feed_unified_v1')
        .select(`
          id,
          user_id,
          created_at,
          kind,
          body,
          rating_score,
          media_urls,
          game_id,
          game_name,
          game_cover_url,
          like_count,
          comment_count,
          username,
          display_name,
          avatar_url
        `)

      // Tab filter: for-you shows all public content, following shows self + followees
      if (tab === 'following' && viewerId) {
        const followingResult = await this.getFollowingIds(viewerId)
        if (!followingResult.success) {
          // Return empty result for following if we can't get following list
          return {
            success: true,
            data: {
              data: [],
              next_cursor: undefined,
              has_more: false
            }
          }
        }
        const authorIds = [viewerId, ...followingResult.data] // Include self
        baseQuery = baseQuery.in('user_id', authorIds)
      }

      // Kind-aware content filters
      if (filter === 'reviews') {
        baseQuery = baseQuery.in('kind', ['review', 'rating'])
      } else if (filter === 'clips') {
        baseQuery = baseQuery.eq('kind', 'post')
        // Note: video detection will be done in client-side filtering for now
        // TODO: Add proper video detection in SQL if needed
      } else if (filter === 'screens') {
        baseQuery = baseQuery.eq('kind', 'post')
        // Note: image-only detection will be done in client-side filtering for now
        // TODO: Add proper image-only detection in SQL if needed
      }
      // filter === 'all' applies no additional filter

      // Cursor pagination (created_at DESC, tie-breaker id)
      if (cursor) {
        baseQuery = baseQuery.or(
          `and(created_at.lt.${cursor.created_at}),and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
        )
      }

      const { data, error } = await baseQuery
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('[serverDataService.getFeed] query error:', error)
        throw error
      }
      
      console.log('[serverDataService.getFeed] raw data count:', data?.length || 0)

      // Apply client-side filters for clips/screens (until we add SQL detection)
      let filteredData = data || []
      if (filter === 'clips') {
        const isVideo = (url: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)
        filteredData = filteredData.filter((item: any) => 
          item.kind === 'post' && Array.isArray(item.media_urls) && item.media_urls.some(isVideo)
        )
      } else if (filter === 'screens') {
        const isVideo = (url: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)
        filteredData = filteredData.filter((item: any) => 
          item.kind === 'post' && Array.isArray(item.media_urls) && 
          item.media_urls.length > 0 && item.media_urls.every((url: string) => !isVideo(url))
        )
      }

      const posts: FeedPost[] = filteredData.map((item: any) => ({
        id: item.id,
        content: item.body,
        created_at: item.created_at,
        updated_at: item.created_at,
        user_id: item.user_id,
        user: {
          id: item.user_id || '',
          username: item.username || '',
          display_name: item.display_name || '',
          avatar_url: item.avatar_url || null,
          bio: undefined,
          followers_count: 0,
          following_count: 0,
          posts_count: 0,
          is_following: false,
          is_verified: false
        },
        game_id: item.game_id,
        game: item.game_id
          ? {
              id: item.game_id,
              name: item.game_name,
              cover_url: item.game_cover_url,
              last_played_at: item.created_at,
              playtime_minutes: 0,
              progress_percentage: 0,
              status: 'playing'
            }
          : undefined,
        media_urls: item.media_urls || [],
        reaction_counts: { likes: item.like_count || 0, comments: item.comment_count || 0, shares: 0, views: 0 },
        user_reactions: { liked: false, commented: false, shared: false },
        _cursor: { id: item.id, created_at: item.created_at },
        // Add extras for FeedCardV2
        kind: item.kind,
        rating_score: item.rating_score
      }))

      if (viewerId && posts.length > 0) {
        try {
          const targetIds = posts
            .filter(post => post.kind === 'post')
            .map(post => post.id)

          if (targetIds.length > 0) {
            const { data: likedRows, error: likedError } = await supabase
              .from('post_likes')
              .select('post_id')
              .eq('user_id', viewerId)
              .in('post_id', targetIds)

            if (!likedError && Array.isArray(likedRows)) {
              const likedSet = new Set(likedRows.map(row => String(row.post_id)))
              posts.forEach(post => {
                if (likedSet.has(post.id)) {
                  post.user_reactions.liked = true
                }
              })
            }
          }
        } catch (likeLookupError) {
          console.warn('[serverDataService.getFeed] like lookup failed', likeLookupError)
        }
      }

      const next_cursor = posts.length === limit ? posts[posts.length - 1]._cursor : undefined

      // Debug logging to verify multiple authors in For-You
      const distinctUsers = new Set(filteredData.map((r: any) => r.user_id)).size
      console.log('[feed]', tab, 'items:', filteredData.length, 'distinctUsers:', distinctUsers, filteredData.slice(0,5).map((r: any) => r.user_id))
      
      // If distinctUsers is 1, check for RLS leakage by comparing anon vs admin
      if (distinctUsers === 1 && tab === 'for-you') {
        console.warn('[feed] RLS LEAKAGE DETECTED: Only 1 distinct user in For-You feed')
        try {
          // Test with anon client to see if RLS is blocking
          const anonClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
          )
          const { data: anonData } = await anonClient
            .from('feed_unified_v1')
            .select('user_id')
            .limit(5)
          const anonUsers = new Set(anonData?.map((r: any) => r.user_id) || []).size
          console.log('[feed] anon client distinct users:', anonUsers)
          console.log('[feed] admin client distinct users:', distinctUsers)
        } catch (anonError) {
          console.log('[feed] anon client error (expected):', anonError instanceof Error ? anonError.message : String(anonError))
        }
      }
      
      console.log('[serverDataService.getFeed] posts:', posts.length, 'tab:', tab, 'filter:', filter, 'viewerId:', viewerId ?? 'anon')
      // Return PaginatedResponse<FeedPost> to satisfy types; API maps to {items,nextCursor,hasMore}
      return {
        success: true,
        data: {
          data: posts,
          next_cursor,
          has_more: posts.length === limit
        }
      }
    } catch (error: any) {
      // Log when fallback triggers for debugging
      console.warn('[serverDataService.getFeed] unified view error – falling back to posts-only preload:', error.message)
      const fallback = await this.preloadFeedPosts(params.limit ?? 20)
      if (fallback.success) {
        return fallback
      }

      return { success: false, error: this.handleError(error, 'getFeed') }
    }
  }

  // Preload feed posts for SSR
  async preloadFeedPosts(limit = 10): Promise<DataServiceResult<PaginatedResponse<FeedPost>>> {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id,
          content,
          created_at,
          updated_at,
          user_id,
          game_id,
          media_urls,
          user:profiles!posts_user_id_fkey (
            id,
            username,
            display_name,
            avatar_url,
            bio,
            followers_count,
            following_count,
            posts_count,
            is_verified
          ),
          game:games!posts_game_id_fkey (
            id,
            name,
            cover_url
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error

      const posts: FeedPost[] = (data || []).map(post => ({
        id: post.id,
        content: post.content,
        created_at: post.created_at,
        updated_at: post.updated_at,
        user_id: post.user_id,
        user: {
          id: (post.user as any)?.id || '',
          username: (post.user as any)?.username || '',
          display_name: (post.user as any)?.display_name || '',
          avatar_url: (post.user as any)?.avatar_url,
          bio: (post.user as any)?.bio,
          followers_count: (post.user as any)?.followers_count || 0,
          following_count: (post.user as any)?.following_count || 0,
          posts_count: (post.user as any)?.posts_count || 0,
          is_following: false,
          is_verified: (post.user as any)?.is_verified || false
        },
        game_id: post.game_id,
        game: post.game ? {
          id: (post.game as any)?.id || '',
          name: (post.game as any)?.name || '',
          cover_url: (post.game as any)?.cover_url,
          last_played_at: post.created_at,
          playtime_minutes: 0,
          progress_percentage: 0,
          status: 'playing' as const
        } : undefined,
        media_urls: post.media_urls || [],
        reaction_counts: {
          likes: 0,
          comments: 0,
          shares: 0,
          views: 0
        },
        user_reactions: {
          liked: false,
          commented: false,
          shared: false
        },
        _cursor: {
          id: post.id,
          created_at: post.created_at
        }
      }))

      const next_cursor = posts.length === limit ? posts[posts.length - 1]._cursor : undefined

      console.log('[serverDataService.preloadFeedPosts] posts:', posts.length)
      // Return PaginatedResponse<FeedPost> to satisfy types; API maps to {items,nextCursor,hasMore}
      return {
        success: true,
        data: {
          data: posts,
          next_cursor,
          has_more: posts.length === limit
        }
      }
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error, 'preloadFeedPosts')
      }
    }
  }

  // Preload sidebar data
  async preloadSidebarData(): Promise<DataServiceResult<{
    whoToFollow: WhoToFollow[]
    trendingTopics: TrendingTopic[]
    continuePlaying: GameProgress[]
  }>> {
    try {
      const [whoToFollowResult, trendingResult, continueResult] = await Promise.all([
        this.getWhoToFollow(5),
        this.getTrendingTopics(5),
        this.getContinuePlaying(5)
      ])

      return {
        success: true,
        data: {
          whoToFollow: whoToFollowResult.success ? whoToFollowResult.data : [],
          trendingTopics: trendingResult.success ? trendingResult.data : [],
          continuePlaying: continueResult.success ? continueResult.data : []
        }
      }
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error, 'preloadSidebarData')
      }
    }
  }

  // Following ids for a viewer (service role; bypass RLS)
  async getFollowingIds(viewerId: string): Promise<DataServiceResult<string[]>> {
    try {
      const { data, error } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', viewerId)

      if (error) throw error

      const ids = (data || []).map((row: any) => String(row.following_id)).filter(Boolean)
      return { success: true, data: ids }
    } catch (error) {
      return { success: false, error: this.handleError(error, 'getFollowingIds') }
    }
  }

  async getWhoToFollow(limit = 5): Promise<DataServiceResult<WhoToFollow[]>> {
    try {
      const { data, error } = await supabase
        .rpc('get_who_to_follow', { limit_count: limit })

      if (error) throw error

      return {
        success: true,
        data: data || []
      }
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error, 'getWhoToFollow')
      }
    }
  }

  async getTrendingTopics(limit = 5): Promise<DataServiceResult<TrendingTopic[]>> {
    try {
      const { data, error } = await supabase
        .rpc('get_trending_topics', { limit_count: limit })

      if (error) throw error

      return {
        success: true,
        data: data || []
      }
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error, 'getTrendingTopics')
      }
    }
  }

  async getContinuePlaying(limit = 5): Promise<DataServiceResult<GameProgress[]>> {
    try {
      const { data, error } = await supabase
        .rpc('get_continue_playing', { limit_count: limit })

      if (error) throw error

      return {
        success: true,
        data: data || []
      }
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error, 'getContinuePlaying')
      }
    }
  }
}

export const serverDataService = new ServerDataService()
