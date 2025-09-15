// src/app/page.tsx
import HomeClientV0 from '@/components/home/HomeClientV0';
import { serverDataService } from '@/lib/data-service/server'

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Page() {
  // SSR: fetch via server feed contract (no viewer on initial paint) to avoid RLS
  const result = await serverDataService.getFeed({
    viewerId: null,
    tab: 'for-you',
    filter: 'all',
    cursor: null,
    limit: 10
  })

  const initialItems = result.success ? result.data.data : []
  const initialNextCursor = result.success ? result.data.next_cursor : undefined
  const initialHasMore = result.success ? result.data.has_more : false

  return <HomeClientV0 initialItems={initialItems} initialNextCursor={initialNextCursor} initialHasMore={initialHasMore} />;
}