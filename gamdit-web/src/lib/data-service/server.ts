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
      // gather author filter if following
      let authorIds: string[] | null = null
      if (tab === 'following' && viewerId) {
        const { data: follows, error: followsError } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', viewerId)
        if (followsError) throw followsError
        const followingIds = (follows || []).map((f: any) => String(f.following_id)).filter(Boolean)
        authorIds = Array.from(new Set([viewerId, ...followingIds]))
      }

      // Build base queries
      let postsQuery = supabase
        .from('post_feed_v2')
        .select(`
          id,
          user_id,
          created_at,
          body,
          media_urls,
          like_count,
          comment_count,
          username,
          display_name,
          avatar_url,
          game_id,
          game_name,
          game_cover_url
        `)

      if (authorIds && authorIds.length) {
        postsQuery = postsQuery.in('user_id', authorIds)
      }

      // Cursor for posts
      if (cursor) {
        postsQuery = postsQuery.or(
          `and(created_at.lt.${cursor.created_at}),and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
        )
      }

      postsQuery = postsQuery.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit)

      // Reviews table: user_id, game_id, rating, review, created_at
      let reviewsQuery = supabase
        .from('reviews')
        .select(`
          id,
          user_id,
          game_id,
          rating,
          review,
          created_at,
          user:profiles!reviews_user_id_fkey (username, display_name, avatar_url),
          game:games!reviews_game_id_fkey (name, cover_url)
        `)

      if (authorIds && authorIds.length) {
        reviewsQuery = reviewsQuery.in('user_id', authorIds)
      }

      if (cursor) {
        reviewsQuery = reviewsQuery.or(
          `and(created_at.lt.${cursor.created_at}),and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
        )
      }

      reviewsQuery = reviewsQuery.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit)

      const [postsRes, reviewsRes] = await Promise.all([
        postsQuery,
        reviewsQuery
      ])

      if ((postsRes as any).error) throw (postsRes as any).error
      if ((reviewsRes as any).error) throw (reviewsRes as any).error

      const postsRaw: any[] = (postsRes as any).data || []
      const reviewsRaw: any[] = (reviewsRes as any).data || []

      const isVideo = (url: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)

      type Mixed = {
        id: string
        created_at: string
        kind: 'post' | 'review' | 'rating'
        author: { id: string; username?: string; display_name?: string; avatar_url?: string | null }
        game?: { id: string | number; name?: string; cover_url?: string | null }
        content?: string | null
        media?: string[]
        reaction_counts: { likes: number; comments: number; shares: number; views: number }
      }

      const mixed: Mixed[] = []

      for (const p of postsRaw) {
        mixed.push({
          id: p.id,
          created_at: p.created_at,
          kind: 'post',
          author: { id: p.user_id, username: p.username, display_name: p.display_name, avatar_url: p.avatar_url },
          game: p.game_id ? { id: p.game_id, name: p.game_name, cover_url: p.game_cover_url } : undefined,
          content: p.body,
          media: Array.isArray(p.media_urls) ? p.media_urls : [],
          reaction_counts: { likes: p.like_count || 0, comments: p.comment_count || 0, shares: 0, views: 0 }
        })
      }

      for (const r of reviewsRaw) {
        const kind: 'review' | 'rating' = r.review && String(r.review).trim().length > 0 ? 'review' : 'rating'
        mixed.push({
          id: r.id,
          created_at: r.created_at,
          kind,
          author: { id: r.user_id, username: (r.user as any)?.username, display_name: (r.user as any)?.display_name, avatar_url: (r.user as any)?.avatar_url },
          game: r.game_id ? { id: r.game_id, name: (r.game as any)?.name, cover_url: (r.game as any)?.cover_url } : undefined,
          content: kind === 'review' ? String(r.review) : `Rated ${r.rating}/100`,
          media: [],
          reaction_counts: { likes: 0, comments: 0, shares: 0, views: 0 }
        })
      }

      // Apply filter semantics on mixed list
      const filtered: Mixed[] = mixed.filter(item => {
        if (filter === 'all') return true
        if (filter === 'reviews') return item.kind === 'review' || item.kind === 'rating'
        if (item.kind !== 'post') return false
        const media = item.media || []
        if (filter === 'clips') return media.some(m => isVideo(m))
        if (filter === 'screens') return media.length > 0 && media.every(m => !isVideo(m))
        return true
      })

      // Global sort and paginate by cursor
      filtered.sort((a, b) => {
        const ta = new Date(a.created_at).getTime()
        const tb = new Date(b.created_at).getTime()
        if (ta !== tb) return tb - ta
        return String(b.id).localeCompare(String(a.id))
      })

      const page = filtered.slice(0, limit)
      const last = page[page.length - 1]
      const next_cursor = last ? { id: String(last.id), created_at: String(last.created_at) } : undefined

      // Map to FeedPost-compatible shape the client expects
      const items: FeedPost[] = page.map((it) => ({
        id: String(it.id),
        content: it.content || '',
        created_at: it.created_at,
        updated_at: it.created_at,
        user_id: it.author.id,
        user: {
          id: it.author.id,
          username: (it as any).author?.username || it.author.username || '',
          display_name: (it as any).author?.display_name || it.author.display_name || '',
          avatar_url: (it as any).author?.avatar_url || it.author.avatar_url || undefined,
          bio: undefined,
          followers_count: 0,
          following_count: 0,
          posts_count: 0,
          is_following: false,
          is_verified: false
        },
        game_id: (it.game as any)?.id ? String((it.game as any).id) : undefined,
        game: it.game
          ? {
              id: String((it.game as any).id),
              name: (it.game as any).name,
              cover_url: (it.game as any).cover_url,
              last_played_at: it.created_at,
              playtime_minutes: 0,
              progress_percentage: 0,
              status: 'playing'
            }
          : undefined,
        media_urls: it.media || [],
        reaction_counts: it.reaction_counts,
        user_reactions: { liked: false, commented: false, shared: false },
        _cursor: { id: String(it.id), created_at: it.created_at }
      }))

      console.log('[serverDataService.getFeed] posts:', items.length, 'tab:', tab, 'filter:', filter, 'viewerId:', viewerId ?? 'anon')
      return {
        success: true,
        data: {
          data: items,
          next_cursor,
          has_more: items.length === limit
        }
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
