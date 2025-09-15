// src/app/page.tsx
import HomeClientV0 from '@/components/home/HomeClientV0';
import { serverDataService } from '@/lib/data-service/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Page() {
  // Preload first page server-side so first post is visible immediately
  const preload = await serverDataService.preloadFeedPosts(10)
  const initialItems = preload.success ? preload.data.data : []
  const initialNextCursor = preload.success ? preload.data.next_cursor : undefined

  return <HomeClientV0 initialItems={initialItems} initialNextCursor={initialNextCursor} />;
}