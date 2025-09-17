// React Query hooks for data fetching and caching

'use client'

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { clientDataService } from './client'
import { createPostAction, toggleReactionAction, followUserAction, createCommentAction } from './actions'
import type {
  FeedPost,
  UserPreview,
  WhoToFollow,
  TrendingTopic,
  GameProgress,
  CreatePostInput,
  CreateCommentInput,
  FollowUserInput,
  ReactionInput,
  Cursor
} from './types'

// Query keys - single source of truth
export const queryKeys = {
  feedPosts: (cursor?: Cursor) => ['feed-posts', cursor],
  whoToFollow: () => ['who-to-follow'],
  trendingTopics: () => ['trending-topics'],
  continuePlaying: () => ['continue-playing'],
  userProfile: (userId: string) => ['user-profile', userId]
} as const

// Feed posts with infinite scroll
export function useFeedPosts() {
  return useInfiniteQuery({
    queryKey: queryKeys.feedPosts(),
    queryFn: ({ pageParam }) => clientDataService.getFeedPosts(pageParam),
    initialPageParam: undefined as Cursor | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.success) return undefined
      return lastPage.data.next_cursor
    },
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
  })
}

// Sidebar data
export function useWhoToFollow() {
  return useQuery({
    queryKey: queryKeys.whoToFollow(),
    queryFn: () => clientDataService.getWhoToFollow(),
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
  })
}

export function useTrendingTopics() {
  return useQuery({
    queryKey: queryKeys.trendingTopics(),
    queryFn: () => clientDataService.getTrendingTopics(),
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
  })
}

export function useContinuePlaying() {
  return useQuery({
    queryKey: queryKeys.continuePlaying(),
    queryFn: () => clientDataService.getContinuePlaying(),
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
  })
}

// Mutations with optimistic updates
export function useCreatePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createPostAction,
    onMutate: async (newPost) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.feedPosts() })

      // Snapshot previous value
      const previousPosts = queryClient.getQueryData(queryKeys.feedPosts())

      // Optimistically update
      const optimisticPost: FeedPost = {
        id: `temp-${Date.now()}`,
        content: newPost.content,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: 'current-user', // Will be replaced by real data
        user: {} as UserPreview, // Will be populated
        game_id: newPost.game_id,
        game: undefined,
        media_urls: newPost.media_urls || [],
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
          id: `temp-${Date.now()}`,
          created_at: new Date().toISOString()
        }
      }

      queryClient.setQueryData(queryKeys.feedPosts(), (old: any) => {
        if (!old) return old
        return {
          ...old,
          pages: [
            {
              ...old.pages[0],
              data: [optimisticPost, ...old.pages[0].data]
            },
            ...old.pages.slice(1)
          ]
        }
      })

      return { previousPosts }
    },
    onError: (err, newPost, context) => {
      // Rollback on error
      if (context?.previousPosts) {
        queryClient.setQueryData(queryKeys.feedPosts(), context.previousPosts)
      }
    },
    onSettled: () => {
      // Refetch to get real data
      queryClient.invalidateQueries({ queryKey: queryKeys.feedPosts() })
    }
  })
}

export function useToggleReaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: toggleReactionAction,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.feedPosts() })

      const previousPosts = queryClient.getQueryData(queryKeys.feedPosts())

      // Optimistically update reaction counts
      queryClient.setQueryData(queryKeys.feedPosts(), (old: any) => {
        if (!old) return old

        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data.map((post: FeedPost) => {
              if (post.id === input.post_id) {
                const delta = input.action === 'add' ? 1 : -1
                const reactionKey = input.reaction_type === 'like' ? 'likes' : 
                                  input.reaction_type === 'comment' ? 'comments' : 'shares'
                
                return {
                  ...post,
                  reaction_counts: {
                    ...post.reaction_counts,
                    [reactionKey]: Math.max(0, post.reaction_counts[reactionKey] + delta)
                  },
                  user_reactions: {
                    ...post.user_reactions,
                    [input.reaction_type === 'like' ? 'liked' : 
                     input.reaction_type === 'comment' ? 'commented' : 'shared']: input.action === 'add'
                  }
                }
              }
              return post
            })
          }))
        }
      })

      return { previousPosts }
    },
    onError: (err, input, context) => {
      if (context?.previousPosts) {
        queryClient.setQueryData(queryKeys.feedPosts(), context.previousPosts)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feedPosts() })
    }
  })
}

export function useFollowUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: followUserAction,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.whoToFollow() })

      const previousWhoToFollow = queryClient.getQueryData(queryKeys.whoToFollow())

      // Optimistically update who to follow
      queryClient.setQueryData(queryKeys.whoToFollow(), (old: any) => {
        if (!old?.success) return old

        return {
          ...old,
          data: old.data.map((user: WhoToFollow) => {
            if (user.id === input.user_id) {
              return {
                ...user,
                is_following: input.follow
              }
            }
            return user
          })
        }
      })

      return { previousWhoToFollow }
    },
    onError: (err, input, context) => {
      if (context?.previousWhoToFollow) {
        queryClient.setQueryData(queryKeys.whoToFollow(), context.previousWhoToFollow)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.whoToFollow() })
    }
  })
}

export function useCreateComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createCommentAction,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.feedPosts() })

      const previousPosts = queryClient.getQueryData(queryKeys.feedPosts())

      // Optimistically update comment count
      queryClient.setQueryData(queryKeys.feedPosts(), (old: any) => {
        if (!old) return old

        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data.map((post: FeedPost) => {
              if (post.id === input.post_id) {
                return {
                  ...post,
                  reaction_counts: {
                    ...post.reaction_counts,
                    comments: post.reaction_counts.comments + 1
                  }
                }
              }
              return post
            })
          }))
        }
      })

      return { previousPosts }
    },
    onError: (err, input, context) => {
      if (context?.previousPosts) {
        queryClient.setQueryData(queryKeys.feedPosts(), context.previousPosts)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feedPosts() })
    }
  })
}
