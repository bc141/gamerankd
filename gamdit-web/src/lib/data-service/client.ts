// Client-side data service - Uses anon key, enforces RLS

import { supabaseBrowser } from '@/lib/supabaseBrowser'
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

class ClientDataService {
  private async handleError(error: any, operation: string): DataServiceError {
    console.error(`Data service error in ${operation}:`, error)
    return {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'An unexpected error occurred',
      details: error.details
    }
  }

  // Feed operations
  async getFeedPosts(cursor?: Cursor, limit = 10): Promise<DataServiceResult<PaginatedResponse<FeedPost>>> {
    try {
      const sb = supabaseBrowser()
      
      let query = sb
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
          ),
          reaction_counts:post_reactions (
            likes,
            comments,
            shares,
            views
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (cursor) {
        query = query.lt('created_at', cursor.created_at)
      }

      const { data, error } = await query

      if (error) throw error

      const posts: FeedPost[] = (data || []).map(post => ({
        id: post.id,
        content: post.content,
        created_at: post.created_at,
        updated_at: post.updated_at,
        user_id: post.user_id,
        user: {
          id: post.user.id,
          username: post.user.username,
          display_name: post.user.display_name,
          avatar_url: post.user.avatar_url,
          bio: post.user.bio,
          followers_count: post.user.followers_count || 0,
          following_count: post.user.following_count || 0,
          posts_count: post.user.posts_count || 0,
          is_following: false, // Will be populated by user context
          is_verified: post.user.is_verified || false
        },
        game_id: post.game_id,
        game: post.game ? {
          id: post.game.id,
          name: post.game.name,
          cover_url: post.game.cover_url,
          last_played_at: post.created_at, // Approximate
          playtime_minutes: 0, // Would need separate query
          progress_percentage: 0, // Would need separate query
          status: 'playing' as const
        } : undefined,
        media_urls: post.media_urls || [],
        reaction_counts: {
          likes: post.reaction_counts?.likes || 0,
          comments: post.reaction_counts?.comments || 0,
          shares: post.reaction_counts?.shares || 0,
          views: post.reaction_counts?.views || 0
        },
        user_reactions: {
          liked: false, // Will be populated by user context
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
        error: await this.handleError(error, 'getFeedPosts')
      }
    }
  }

  // User operations
  async getWhoToFollow(limit = 5): Promise<DataServiceResult<WhoToFollow[]>> {
    try {
      const sb = supabaseBrowser()
      
      const { data, error } = await sb
        .rpc('get_who_to_follow', { limit_count: limit })

      if (error) throw error

      return {
        success: true,
        data: data || []
      }
    } catch (error) {
      return {
        success: false,
        error: await this.handleError(error, 'getWhoToFollow')
      }
    }
  }

  // Trending topics
  async getTrendingTopics(limit = 5): Promise<DataServiceResult<TrendingTopic[]>> {
    try {
      const sb = supabaseBrowser()
      
      const { data, error } = await sb
        .rpc('get_trending_topics', { limit_count: limit })

      if (error) throw error

      return {
        success: true,
        data: data || []
      }
    } catch (error) {
      return {
        success: false,
        error: await this.handleError(error, 'getTrendingTopics')
      }
    }
  }

  // Game progress
  async getContinuePlaying(limit = 5): Promise<DataServiceResult<GameProgress[]>> {
    try {
      const sb = supabaseBrowser()
      
      const { data, error } = await sb
        .rpc('get_continue_playing', { limit_count: limit })

      if (error) throw error

      return {
        success: true,
        data: data || []
      }
    } catch (error) {
      return {
        success: false,
        error: await this.handleError(error, 'getContinuePlaying')
      }
    }
  }

  // Mutations with optimistic updates
  async createPost(input: CreatePostInput): Promise<DataServiceResult<FeedPost>> {
    try {
      const sb = supabaseBrowser()
      
      const { data, error } = await sb
        .from('posts')
        .insert({
          content: input.content,
          game_id: input.game_id,
          media_urls: input.media_urls
        })
        .select(`
          id,
          content,
          created_at,
          updated_at,
          user_id,
          game_id,
          media_urls
        `)
        .single()

      if (error) throw error

      // Return minimal post data - will be refetched
      const post: FeedPost = {
        id: data.id,
        content: data.content,
        created_at: data.created_at,
        updated_at: data.updated_at,
        user_id: data.user_id,
        user: {} as UserPreview, // Will be populated by refetch
        game_id: data.game_id,
        media_urls: data.media_urls || [],
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
          id: data.id,
          created_at: data.created_at
        }
      }

      return {
        success: true,
        data: post
      }
    } catch (error) {
      return {
        success: false,
        error: await this.handleError(error, 'createPost')
      }
    }
  }

  async toggleReaction(input: ReactionInput): Promise<DataServiceResult<ReactionCounts>> {
    try {
      const sb = supabaseBrowser()
      
      const { data, error } = await sb
        .rpc('toggle_reaction', {
          post_id: input.post_id,
          reaction_type: input.reaction_type,
          action: input.action
        })

      if (error) throw error

      return {
        success: true,
        data: data
      }
    } catch (error) {
      return {
        success: false,
        error: await this.handleError(error, 'toggleReaction')
      }
    }
  }

  async followUser(input: FollowUserInput): Promise<DataServiceResult<boolean>> {
    try {
      const sb = supabaseBrowser()
      
      const { data, error } = await sb
        .rpc('follow_user', {
          target_user_id: input.user_id,
          follow: input.follow
        })

      if (error) throw error

      return {
        success: true,
        data: data
      }
    } catch (error) {
      return {
        success: false,
        error: await this.handleError(error, 'followUser')
      }
    }
  }
}

export const clientDataService = new ClientDataService()
