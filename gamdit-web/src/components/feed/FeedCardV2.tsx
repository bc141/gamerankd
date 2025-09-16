'use client';

import React from 'react'
import Image from 'next/image'

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
    <article className="sidebar-card p-4 md:p-5" role="article" aria-label={`${kind} by ${authorName}`}>
      <div className="space-y-4">
        {/* Header */}
        <header className="flex items-center gap-3" aria-label="Header">
          <Image
            src={author.avatarUrl || '/avatar-placeholder.svg'}
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 rounded-full object-cover border border-white/10"
          />
          <div className="min-w-0">
            <div className="text-sm font-medium text-white/90 truncate">{authorName}{handle ? <span className="text-white/40 ml-2">{handle}</span> : null}</div>
            <div className="text-xs text-white/40 truncate flex items-center gap-2">
              {game?.coverUrl ? (
                <Image src={game.coverUrl} alt="" width={16} height={16} className="h-4 w-4 rounded object-cover" />
              ) : null}
              {game?.name ? <span className="truncate">{game.name}</span> : null}
              <span className="text-white/30">·</span>
              <time title={new Date(createdAt).toLocaleString()}>{new Date(createdAt).toLocaleDateString()}</time>
            </div>
          </div>
        </header>

        {/* Text Body */}
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

          {kind === 'rating' && text ? (
            <p className="text-sm text-white/90">{text}</p>
          ) : null}
        </div>

        {/* Media Block */}
        {kind === 'post' && media.length > 0 ? (
          <div className="mx-auto w-full max-w-lg md:max-w-xl">
            <div className="relative aspect-[4/3] sm:aspect-[16/9] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/60">
              {media.length === 1 ? (
                isVideo(media[0]) ? (
                  <video
                    className="h-full w-full object-cover"
                    src={media[0]}
                    controls
                    preload="metadata"
                  />
                ) : (
                  <Image
                    src={media[0]}
                    alt=""
                    fill
                    sizes="(min-width: 1280px) 560px, (min-width: 768px) 70vw, 100vw"
                    quality={90}
                    className="object-cover"
                  />
                )
              ) : (
                <div className="grid h-full w-full grid-cols-2 gap-[2px] bg-zinc-900/50">
                  {media.slice(0, 4).map((url, idx) => (
                    <div key={idx} className="relative overflow-hidden">
                      {isVideo(url) ? (
                        <video
                          className="h-full w-full object-cover"
                          src={url}
                          controls
                          preload="metadata"
                        />
                      ) : (
                        <Image
                          src={url}
                          alt=""
                          fill
                          sizes="(min-width: 1280px) 280px, (min-width: 768px) 35vw, 50vw"
                          quality={90}
                          className="object-cover"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Rating Strip */}
        {(kind === 'rating' || kind === 'review') && typeof rating === 'number' ? (
          <div className="flex items-center gap-2" aria-label="Rating">
            <StarRow value={rating} />
          </div>
        ) : null}

        {/* Actions */}
        <footer className="flex items-center justify-between gap-4 py-2 border-t border-white/10" aria-label="Actions">
          <ActionButton label="Like" active={!!myReactions?.liked} count={counts.likes} />
          <ActionButton label="Comment" active={!!myReactions?.commented} count={counts.comments} />
          <ActionButton label="Share" active={!!myReactions?.shared} count={counts.shares} />
        </footer>
      </div>
    </article>
  )
}

function ActionButton({ label, active, count }: { label: string; active?: boolean; count?: number }) {
  return (
    <button
      type="button"
      className={`h-8 px-3 rounded-md flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500/60 ${active ? 'bg-white/10' : 'hover:bg-white/5'}`}
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
    <div className="sidebar-card p-4 md:p-5 animate-pulse">
      <div className="space-y-4">
        {/* Header skeleton */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-white/10" />
          <div className="flex-1">
            <div className="h-3 w-32 bg-white/10 rounded" />
            <div className="h-2 w-24 bg-white/5 rounded mt-2" />
          </div>
        </div>
        
        {/* Text body skeleton */}
        {kind !== 'rating' ? <div className="h-20 bg-white/5 rounded" /> : null}
        
        {/* Media block skeleton */}
        {kind === 'post' ? <div className="h-48 bg-white/5 rounded-lg" /> : null}
        
        {/* Rating skeleton */}
        {kind === 'rating' || kind === 'review' ? <div className="h-4 w-20 bg-white/5 rounded" /> : null}
        
        {/* Actions skeleton */}
        <div className="flex items-center justify-between gap-4 py-2 border-t border-white/10">
          <div className="h-8 w-16 bg-white/5 rounded" />
          <div className="h-8 w-20 bg-white/5 rounded" />
          <div className="h-8 w-16 bg-white/5 rounded" />
        </div>
      </div>
    </div>
  )
}

