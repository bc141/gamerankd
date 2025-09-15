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

  // Unified feed contract
  async getFeed(params: {
    viewerId?: string | null
    tab: 'following' | 'for-you'
    filter: 'all' | 'clips' | 'reviews' | 'screens'
    cursor?: { created_at: string; id: string } | null
    limit?: number
  }): Promise<DataServiceResult<PaginatedResponse<FeedPost>>> {
    const { viewerId, tab, filter, cursor, limit = 20 } = params
    try {
      let baseQuery = supabase
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
            avatar_url
          ),
          game:games!posts_game_id_fkey (
            id,
            name,
            cover_url
          )
        `)

      // Tab filter
      if (tab === 'following' && viewerId) {
        const { data: follows, error: followsError } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', viewerId)

        if (followsError) throw followsError

        const followingIds = (follows || []).map(f => (f as any).following_id)
        const ids = [...new Set([viewerId, ...followingIds])]
        if (ids.length === 0) {
          return {
            success: true,
            data: { data: [], next_cursor: undefined, has_more: false }
          }
        }
        baseQuery = baseQuery.in('user_id', ids)
      }

      // Content filter (simple heuristic on content/media)
      if (filter === 'clips') {
        baseQuery = baseQuery.or('content.ilike.%clip%,content.ilike.%video%')
      } else if (filter === 'reviews') {
        baseQuery = baseQuery.or('content.ilike.%review%,content.ilike.%rating%')
      } else if (filter === 'screens') {
        baseQuery = baseQuery.or('content.ilike.%screenshot%,content.ilike.%screen%')
      }

      // Cursor pagination (created_at DESC, tie-breaker id)
      if (cursor) {
        baseQuery = baseQuery.lt('created_at', cursor.created_at)
      }

      const { data, error } = await baseQuery
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error

      const posts: FeedPost[] = (data || []).map((post: any) => ({
        id: post.id,
        content: post.content,
        created_at: post.created_at,
        updated_at: post.updated_at,
        user_id: post.user_id,
        user: {
          id: post.user?.id || '',
          username: post.user?.username || '',
          display_name: post.user?.display_name || '',
          avatar_url: post.user?.avatar_url,
          bio: undefined,
          followers_count: 0,
          following_count: 0,
          posts_count: 0,
          is_following: false,
          is_verified: false
        },
        game_id: post.game?.id,
        game: post.game
          ? {
              id: post.game.id,
              name: post.game.name,
              cover_url: post.game.cover_url,
              last_played_at: post.created_at,
              playtime_minutes: 0,
              progress_percentage: 0,
              status: 'playing'
            }
          : undefined,
        media_urls: post.media_urls || [],
        reaction_counts: { likes: 0, comments: 0, shares: 0, views: 0 },
        user_reactions: { liked: false, commented: false, shared: false },
        _cursor: { id: post.id, created_at: post.created_at }
      }))

      const next_cursor = posts.length === limit ? posts[posts.length - 1]._cursor : undefined

      return {
        success: true,
        data: { data: posts, next_cursor, has_more: posts.length === limit }
      }
    } catch (error) {
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
