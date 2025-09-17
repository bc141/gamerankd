// Server actions for mutations with rate limiting and validation

'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import type {
  CreatePostInput,
  CreateCommentInput,
  FollowUserInput,
  ReactionInput,
  DataServiceResult
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

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(userId: string, action: string, limit = 10, windowMs = 60000): boolean {
  const key = `${userId}:${action}`
  const now = Date.now()
  const userLimit = rateLimitStore.get(key)

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (userLimit.count >= limit) {
    return false
  }

  userLimit.count++
  return true
}

async function getCurrentUser() {
  const headersList = await headers()
  const authorization = headersList.get('authorization')
  
  if (!authorization) {
    throw new Error('No authorization header')
  }

  const token = authorization.replace('Bearer ', '')
  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    throw new Error('Invalid token')
  }

  return user
}

export async function createPostAction(input: CreatePostInput): Promise<DataServiceResult<string>> {
  try {
    const user = await getCurrentUser()
    
    // Rate limiting
    if (!checkRateLimit(user.id, 'create_post', 5, 60000)) {
      return {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many posts created. Please wait before creating another post.'
        }
      }
    }

    // Input validation
    if (!input.content || input.content.trim().length === 0) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Post content is required'
        }
      }
    }

    if (input.content.length > 280) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Post content must be 280 characters or less'
        }
      }
    }

    const { data, error } = await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        content: input.content.trim(),
        game_id: input.game_id,
        media_urls: input.media_urls
      })
      .select('id')
      .single()

    if (error) throw error

    revalidatePath('/')
    revalidatePath('/test/v0')

    return {
      success: true,
      data: data.id
    }
  } catch (error) {
    console.error('Create post error:', error)
    return {
      success: false,
      error: {
        code: 'CREATE_POST_ERROR',
        message: 'Failed to create post'
      }
    }
  }
}

export async function toggleReactionAction(input: ReactionInput): Promise<DataServiceResult<boolean>> {
  try {
    const user = await getCurrentUser()
    
    // Rate limiting
    if (!checkRateLimit(user.id, 'reaction', 50, 60000)) {
      return {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many reactions. Please wait before reacting again.'
        }
      }
    }

    const { data, error } = await supabase
      .rpc('toggle_reaction', {
        post_id: input.post_id,
        reaction_type: input.reaction_type,
        action: input.action
      })

    if (error) throw error

    revalidatePath('/')
    revalidatePath('/test/v0')

    return {
      success: true,
      data: data
    }
  } catch (error) {
    console.error('Toggle reaction error:', error)
    return {
      success: false,
      error: {
        code: 'REACTION_ERROR',
        message: 'Failed to toggle reaction'
      }
    }
  }
}

export async function followUserAction(input: FollowUserInput): Promise<DataServiceResult<boolean>> {
  try {
    const user = await getCurrentUser()
    
    // Rate limiting
    if (!checkRateLimit(user.id, 'follow', 20, 60000)) {
      return {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many follow actions. Please wait before following again.'
        }
      }
    }

    // Prevent self-follow
    if (user.id === input.user_id) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Cannot follow yourself'
        }
      }
    }

    const { data, error } = await supabase
      .rpc('follow_user', {
        target_user_id: input.user_id,
        follow: input.follow
      })

    if (error) throw error

    revalidatePath('/')
    revalidatePath('/test/v0')

    return {
      success: true,
      data: data
    }
  } catch (error) {
    console.error('Follow user error:', error)
    return {
      success: false,
      error: {
        code: 'FOLLOW_ERROR',
        message: 'Failed to follow user'
      }
    }
  }
}

export async function createCommentAction(input: CreateCommentInput): Promise<DataServiceResult<string>> {
  try {
    const user = await getCurrentUser()
    
    // Rate limiting
    if (!checkRateLimit(user.id, 'create_comment', 20, 60000)) {
      return {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many comments created. Please wait before commenting again.'
        }
      }
    }

    // Input validation
    if (!input.content || input.content.trim().length === 0) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Comment content is required'
        }
      }
    }

    if (input.content.length > 500) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Comment content must be 500 characters or less'
        }
      }
    }

    const { data, error } = await supabase
      .from('comments')
      .insert({
        user_id: user.id,
        post_id: input.post_id,
        content: input.content.trim(),
        parent_id: input.parent_id
      })
      .select('id')
      .single()

    if (error) throw error

    revalidatePath('/')
    revalidatePath('/test/v0')

    return {
      success: true,
      data: data.id
    }
  } catch (error) {
    console.error('Create comment error:', error)
    return {
      success: false,
      error: {
        code: 'CREATE_COMMENT_ERROR',
        message: 'Failed to create comment'
      }
    }
  }
}
