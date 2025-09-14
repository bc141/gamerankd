// Server-side preload functions for SSR

import { serverDataService } from './server'
import { QueryClient } from '@tanstack/react-query'
import { queryKeys } from './hooks'

export async function preloadHomeData() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30000,
        gcTime: 300000,
      },
    },
  })

  try {
    // Preload feed posts
    const feedResult = await serverDataService.preloadFeedPosts(10)
    if (feedResult.success) {
      queryClient.setQueryData(queryKeys.feedPosts(), {
        pages: [{ success: true, data: feedResult.data }],
        pageParams: [undefined]
      })
    }

    // Preload sidebar data
    const sidebarResult = await serverDataService.preloadSidebarData()
    if (sidebarResult.success) {
      queryClient.setQueryData(queryKeys.whoToFollow(), {
        success: true,
        data: sidebarResult.data.whoToFollow
      })
      
      queryClient.setQueryData(queryKeys.trendingTopics(), {
        success: true,
        data: sidebarResult.data.trendingTopics
      })
      
      queryClient.setQueryData(queryKeys.continuePlaying(), {
        success: true,
        data: sidebarResult.data.continuePlaying
      })
    }

    return queryClient
  } catch (error) {
    console.error('Error preloading data:', error)
    return queryClient
  }
}
