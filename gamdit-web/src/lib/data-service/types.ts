// Data service types - Single source of truth for all data contracts

export interface Cursor {
  id: string
  created_at: string
}

export interface FeedPost {
  id: string
  content: string
  created_at: string
  updated_at: string
  user_id: string
  user: UserPreview
  game_id?: string
  game?: GameProgress
  media_urls?: string[]
  reaction_counts: ReactionCounts
  user_reactions: {
    liked: boolean
    commented: boolean
    shared: boolean
  }
  _cursor: Cursor
}

export interface UserPreview {
  id: string
  username: string
  display_name: string
  avatar_url?: string
  bio?: string
  followers_count: number
  following_count: number
  posts_count: number
  is_following: boolean
  is_verified: boolean
}

export interface WhoToFollow {
  id: string
  username: string
  display_name: string
  avatar_url?: string
  bio?: string
  followers_count: number
  is_following: boolean
  mutual_follows_count: number
}

export interface TrendingTopic {
  id: string
  name: string
  posts_count: number
  growth_rate: number
  category: 'gaming' | 'tech' | 'general'
}

export interface GameProgress {
  id: string
  name: string
  cover_url?: string
  last_played_at: string
  playtime_minutes: number
  progress_percentage: number
  status: 'playing' | 'completed' | 'paused' | 'dropped'
}

export interface ReactionCounts {
  likes: number
  comments: number
  shares: number
  views: number
}

export interface PaginatedResponse<T> {
  data: T[]
  next_cursor?: Cursor
  has_more: boolean
  total_count?: number
}

export interface CreatePostInput {
  content: string
  game_id?: string
  media_urls?: string[]
}

export interface CreateCommentInput {
  post_id: string
  content: string
  parent_id?: string
}

export interface FollowUserInput {
  user_id: string
  follow: boolean
}

export interface ReactionInput {
  post_id: string
  reaction_type: 'like' | 'comment' | 'share'
  action: 'add' | 'remove'
}

export interface DataServiceError {
  code: string
  message: string
  details?: any
}

export type DataServiceResult<T> = 
  | { success: true; data: T }
  | { success: false; error: DataServiceError }
