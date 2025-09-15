'use client'

import React from 'react'
import { FeedCardV2, FeedCardV2Skeleton } from '@/components/feed/FeedCardV2'

export default function FeedCardTestPage() {
  const now = new Date().toISOString()
  return (
    <main className="mx-auto max-w-2xl p-4 space-y-4">
      <h1 className="text-xl font-semibold mb-2">FeedCardV2 Test</h1>

      <FeedCardV2
        kind="post"
        author={{ id: 'u1', username: 'sam', displayName: 'Sam', avatarUrl: '' }}
        createdAt={now}
        game={{ id: 'g1', name: 'Elden Ring' }}
        text={'Hitting level 100 today!'}
        media={[
          'https://placehold.co/640x360.png',
          'https://placehold.co/640x360.jpg',
        ]}
        counts={{ likes: 12, comments: 3, shares: 2 }}
        myReactions={{ liked: true }}
      />

      <FeedCardV2
        kind="review"
        author={{ id: 'u2', username: 'lea', displayName: 'Lea' }}
        createdAt={now}
        game={{ id: 'g2', name: 'Baldur\'s Gate 3' }}
        text={'A masterclass in storytelling and player agency.'}
        rating={92}
        counts={{ likes: 48, comments: 6, shares: 5 }}
      />

      <FeedCardV2
        kind="rating"
        author={{ id: 'u3', username: 'kai', displayName: 'Kai' }}
        createdAt={now}
        game={{ id: 'g3', name: 'Stardew Valley' }}
        rating={85}
        counts={{ likes: 5, comments: 1, shares: 0 }}
      />

      <FeedCardV2Skeleton kind="post" />
      <FeedCardV2Skeleton kind="review" />
      <FeedCardV2Skeleton kind="rating" />
    </main>
  )
}


