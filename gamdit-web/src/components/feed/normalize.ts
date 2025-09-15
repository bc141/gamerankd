import type { FeedCardProps } from './FeedCardV2'

export type LegacyItem = any

export function normalizeToFeedCard(item: LegacyItem): FeedCardProps {
  // Heuristic: mixed items already shaped by server; fall back to legacy post shape
  const kind = (item.kind as string) || 'post'
  const author = item.user || item.author || {}
  const game = item.game || null
  const content = item.content || item.text || ''
  const media = item.media_urls || item.media || []
  const rating = typeof item.rating === 'number' ? item.rating : undefined
  const counts = item.reaction_counts || item.counts || { likes: 0, comments: 0, shares: 0 }
  const my = item.user_reactions || item.myReactions || {}

  return {
    kind: kind === 'review' || kind === 'rating' || kind === 'post' ? (kind as any) : 'post',
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
    media: Array.isArray(media) ? media : [],
    rating,
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


