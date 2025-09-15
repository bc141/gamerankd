'use client';

import React from 'react'

export type FeedKind = 'post' | 'review' | 'rating'

export type FeedCardProps = {
  kind: FeedKind
  author: { id: string; username?: string; displayName?: string; avatarUrl?: string }
  createdAt: string
  game?: { id: string | number; name?: string; coverUrl?: string }
  text?: string
  media?: string[]
  rating?: number // 0-100
  counts: { likes: number; comments: number; shares: number }
  myReactions?: { liked?: boolean; commented?: boolean; shared?: boolean }
}

export function FeedCardV2(props: FeedCardProps) {
  const { kind, author, createdAt, game, text, media = [], rating, counts, myReactions } = props

  const authorName = author.displayName || author.username || 'User'
  const handle = author.username ? `@${author.username}` : ''

  const isVideo = (url: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)

  return (
    <article className="sidebar-card" role="article" aria-label={`${kind} by ${authorName}`}>
      {/* Header */}
      <header className="flex items-center gap-3 mb-2" aria-label="Header">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={author.avatarUrl || '/avatar-placeholder.svg'}
          alt=""
          className="h-9 w-9 rounded-full object-cover border border-white/10"
          loading="lazy"
          decoding="async"
        />
        <div className="min-w-0">
          <div className="text-sm font-medium text-white/90 truncate">{authorName}{handle ? <span className="text-white/40 ml-2">{handle}</span> : null}</div>
          <div className="text-xs text-white/40 truncate flex items-center gap-2">
            {game?.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={game.coverUrl} alt="" className="h-4 w-4 rounded object-cover" />
            ) : null}
            {game?.name ? <span className="truncate">{game.name}</span> : null}
            <span className="text-white/30">·</span>
            <time title={new Date(createdAt).toLocaleString()}>{new Date(createdAt).toLocaleDateString()}</time>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="space-y-2" aria-label="Body">
        {kind === 'review' ? (
          <div>
            {text ? (
              <p className="text-sm text-white/90 line-clamp-2">{text}</p>
            ) : null}
            <button type="button" className="text-xs text-blue-400 hover:underline mt-1">Read review →</button>
          </div>
        ) : null}

        {kind === 'post' && text ? (
          <p className="text-sm text-white/90 whitespace-pre-wrap">{text}</p>
        ) : null}

        {/* Media reserved aspect boxes to avoid layout shift */}
        {kind === 'post' && media.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {media.slice(0, 4).map((url, idx) => (
              <div key={idx} className="relative w-full overflow-hidden rounded-md border border-white/10" style={{ paddingTop: '56.25%' }}>
                {isVideo(url) ? (
                  <video
                    className="absolute inset-0 w-full h-full object-cover"
                    src={url}
                    controls
                    preload="metadata"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="absolute inset-0 w-full h-full object-cover"
                    src={url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                )}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Rating Strip */}
      {(kind === 'rating' || kind === 'review') && typeof rating === 'number' ? (
        <div className="mt-3 flex items-center gap-2" aria-label="Rating">
          <span className="inline-flex items-center px-2 py-0.5 rounded bg-white/10 text-xs text-white/90">{Math.round(rating)}/100</span>
          <StarRow value={rating} />
          <span className="text-xs text-white/50">{rating >= 80 ? 'Loved' : rating >= 60 ? 'Liked' : 'Mixed'}</span>
        </div>
      ) : null}

      {/* Actions */}
      <footer className="mt-3 border-t border-white/10 pt-2" aria-label="Actions">
        <div className="flex items-center gap-4">
          <ActionButton label="Like" active={!!myReactions?.liked} count={counts.likes} />
          <ActionButton label="Comment" active={!!myReactions?.commented} count={counts.comments} />
          <ActionButton label="Share" active={!!myReactions?.shared} count={counts.shares} />
        </div>
      </footer>
    </article>
  )
}

function ActionButton({ label, active, count }: { label: string; active?: boolean; count?: number }) {
  return (
    <button
      type="button"
      className={`h-11 px-3 rounded-md flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500/60 ${active ? 'bg-white/10' : 'hover:bg-white/5'}`}
      aria-pressed={active ? 'true' : 'false'}
      aria-label={label}
    >
      <span className="text-sm text-white/90">{label}</span>
      <span className="text-xs text-white/50">{typeof count === 'number' ? count : 0}</span>
    </button>
  )
}

function StarRow({ value }: { value: number }) {
  const stars = Math.max(0, Math.min(5, Math.round((value / 100) * 5)))
  return (
    <div className="flex items-center gap-0.5" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < stars ? 'text-yellow-400' : 'text-white/20'}>★</span>
      ))}
    </div>
  )
}

export function FeedCardV2Skeleton({ kind = 'post' as FeedKind }) {
  return (
    <div className="sidebar-card p-4 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-9 w-9 rounded-full bg-white/10" />
        <div className="flex-1">
          <div className="h-3 w-32 bg-white/10 rounded" />
          <div className="h-2 w-24 bg-white/5 rounded mt-2" />
        </div>
      </div>
      {kind !== 'rating' ? <div className="h-20 bg-white/5 rounded" /> : null}
      <div className="h-6 bg-white/5 rounded mt-3" />
    </div>
  )
}


