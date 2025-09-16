import type { FeedCardProps, FeedKind } from './FeedCardV2'

export type LegacyItem = any

export function normalizeToFeedCard(item: LegacyItem): FeedCardProps {
  // Use server-provided kind and rating_score from unified feed
  const kind = (item.kind as string) || 'post'
  const author = item.user || item.author || {}
  const game = item.game || null
  const content = item.content || item.text || ''
  const media = item.media_urls || item.media || []
  const rating = typeof item.rating_score === 'number' ? item.rating_score : 
    (typeof item.rating === 'number' ? item.rating : undefined)
  const ratingFromText = !rating && /Rated\s+(\d{1,3})\/100/i.test(String(content))
    ? Math.min(100, Math.max(0, Number(String(content).match(/Rated\s+(\d{1,3})\/100/i)![1])))
    : undefined
  const counts = item.reaction_counts || item.counts || { likes: 0, comments: 0, shares: 0 }
  const my = item.user_reactions || item.myReactions || {}

  const normalizedKind: FeedKind = kind === 'review' || kind === 'rating' || kind === 'post' ? (kind as FeedKind) : 'post'

  return {
    kind: normalizedKind,
    author: {
      id: String(author.id || item.user_id || ''),
      username: author.username,
      displayName: author.display_name || author.displayName,
      avatarUrl: author.avatar_url || author.avatarUrl,
    },
    createdAt: String(item.created_at || item.createdAt || new Date().toISOString()),
    game: game ? {
      id: String(game.id),
      name: game.name,
      coverUrl: game.cover_url || game.coverUrl,
    } : undefined,
    text: content,
    media: normalizedKind === 'post' && Array.isArray(media) ? media : [],
    rating: rating ?? ratingFromText,
    counts: {
      likes: Number(counts.likes || 0),
      comments: Number(counts.comments || 0),
      shares: Number(counts.shares || 0),
    },
    myReactions: {
      liked: !!my.liked,
      commented: !!my.commented,
      shared: !!my.shared,
    }
  }
}
