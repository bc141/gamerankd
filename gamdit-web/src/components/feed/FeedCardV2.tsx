'use client';

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import clsx from 'clsx'
import { Heart, MessageCircle, Repeat2, MoreHorizontal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

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
  actions?: {
    onLike?: () => void
    onComment?: () => void
    onShare?: () => void
    disabled?: boolean
  }
}

export function FeedCardV2(props: FeedCardProps) {
  const { kind, author, createdAt, game, text, media = [], rating, counts, myReactions, actions } = props

  const authorName = author.displayName || author.username || 'User'
  const handle = author.username ? `@${author.username}` : ''
  const profileHandle = author.username ? `/u/${encodeURIComponent(author.username)}` : author.id ? `/u/${encodeURIComponent(author.id)}` : null

  const isVideo = (url: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)
  const enhanceMediaUrl = (url: string) => {
    if (!url) return url
    if (!/images\.igdb\.com\/igdb\/image\/upload\//.test(url)) return url
    return url.replace(/\/t_([^/]+)\//, (_, token: string) => {
      if (token.startsWith('screenshot')) {
        return '/t_screenshot_huge/'
      }
      return '/t_cover_big_2x/'
    })
  }
  const mediaUrls = media.map(enhanceMediaUrl)
  const getContainerWidthClass = (url: string) => {
    if (/images\.igdb\.com/.test(url)) {
      return 'max-w-[18rem] sm:max-w-[22rem]'
    }
    return 'max-w-[22rem] sm:max-w-[28rem] md:max-w-[32rem]'
  }

  const primaryBodyText = (() => {
    if (!text) return undefined
    if (kind === 'rating' && /^Rated\s+\d{1,3}\/100/i.test(text.trim())) {
      return undefined
    }
    return text
  })()

  return (
    <article className="sidebar-card p-4 md:p-5" role="article" aria-label={`${kind} by ${authorName}`}>
      <div className="space-y-5">
        <header className="flex items-start gap-3" aria-label="Post header">
          {profileHandle ? (
            <Link
              href={profileHandle}
              className="block h-10 w-10 shrink-0 overflow-hidden rounded-full ring-1 ring-white/10 transition hover:ring-[rgb(var(--brand-accent))]"
            >
              <Image
                src={author.avatarUrl || '/avatar-placeholder.svg'}
                alt=""
                width={40}
                height={40}
                className="h-full w-full object-cover"
              />
            </Link>
          ) : (
            <Image
              src={author.avatarUrl || '/avatar-placeholder.svg'}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 rounded-full object-cover ring-1 ring-white/10"
            />
          )}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {profileHandle ? (
                <Link
                  href={profileHandle}
                  className="flex items-center gap-2 truncate text-sm font-semibold text-white/95 transition hover:text-[rgb(var(--brand-accent))]"
                >
                  <span className="truncate">{authorName}</span>
                  {handle ? <span className="text-xs font-normal text-white/45">{handle}</span> : null}
                </Link>
              ) : (
                <p className="text-sm font-semibold text-white/95 truncate">{authorName}{handle ? <span className="ml-2 text-xs font-normal text-white/45">{handle}</span> : null}</p>
              )}
              {kind !== 'post' ? <KindBadge kind={kind} /> : null}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-white/40">
              <time title={new Date(createdAt).toLocaleString()}>{new Date(createdAt).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric' })}</time>
            </div>
            {game ? (
              <div>
                <GameBadge game={game} />
              </div>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Post options"
            className="rounded-full p-1 text-white/40 transition hover:bg-white/10 hover:text-white/80"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        {primaryBodyText ? (
          <div className="space-y-2 text-sm text-white/90" aria-label="Post body">
            {kind === 'review' ? (
              <>
                <p className="line-clamp-4 whitespace-pre-line">{primaryBodyText}</p>
                <button type="button" className="text-xs font-medium text-violet-300 hover:text-violet-200">Read full review</button>
              </>
            ) : (
              <p className={clsx('whitespace-pre-wrap', kind === 'post' ? 'leading-relaxed' : 'leading-snug')}>{primaryBodyText}</p>
            )}
          </div>
        ) : null}

        {kind === 'post' && mediaUrls.length > 0 ? (
          <div className={`mx-auto w-full ${getContainerWidthClass(mediaUrls[0])}`}>
            <div className="relative aspect-[4/3] sm:aspect-[16/9] overflow-hidden rounded-xl border border-white/10 bg-zinc-950/70">
              {mediaUrls.length === 1 ? (
                isVideo(mediaUrls[0]) ? (
                  <video
                    className="h-full w-full object-cover"
                    src={mediaUrls[0]}
                    controls
                    preload="metadata"
                  />
                ) : (
                  <Image
                    src={mediaUrls[0]}
                    alt=""
                    fill
                    sizes="(min-width: 1280px) 420px, (min-width: 768px) 55vw, 90vw"
                    quality={90}
                    className="object-cover"
                  />
                )
              ) : (
                <div className="grid h-full w-full grid-cols-2 gap-[2px] bg-zinc-900/60">
                  {mediaUrls.slice(0, 4).map((url, idx) => (
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
                          sizes="(min-width: 1280px) 210px, (min-width: 768px) 28vw, 45vw"
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

        {(kind === 'rating' || kind === 'review') && typeof rating === 'number' ? (
          <div className="flex items-center gap-3" aria-label="Rating">
            <StarRow value={rating} />
            {kind === 'review' ? <span className="text-xs uppercase tracking-wide text-white/35">Critic score</span> : null}
          </div>
        ) : null}

        <footer className="flex items-center justify-between gap-3 border-t border-white/5 pt-3" aria-label="Post actions">
          <ActionButton
            label="Like"
            count={counts.likes}
            active={!!myReactions?.liked}
            Icon={Heart}
            onClick={actions?.onLike}
            disabled={actions?.disabled}
          />
          <ActionButton
            label="Comment"
            count={counts.comments}
            active={!!myReactions?.commented}
            Icon={MessageCircle}
            onClick={actions?.onComment}
            disabled={actions?.disabled}
          />
          <ActionButton
            label="Share"
            count={counts.shares}
            active={!!myReactions?.shared}
            Icon={Repeat2}
            onClick={actions?.onShare}
            disabled={actions?.disabled}
          />
        </footer>
      </div>
    </article>
  )
}

type ActionButtonProps = {
  label: string
  count?: number
  active?: boolean
  Icon: LucideIcon
  onClick?: () => void
  disabled?: boolean
}

function ActionButton({ label, count, active, Icon, onClick, disabled }: ActionButtonProps) {
  const isInteractive = typeof onClick === 'function' && !disabled
  return (
    <button
      type="button"
      onClick={isInteractive ? onClick : undefined}
      disabled={!isInteractive}
      className={clsx(
        'flex h-9 flex-1 items-center justify-center gap-2 rounded-lg px-2 text-sm transition',
        active ? 'text-violet-300 bg-violet-500/10 ring-1 ring-violet-500/40' : 'text-white/70',
        isInteractive ? 'hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400' : 'cursor-default opacity-70'
      )}
      aria-pressed={active ? 'true' : 'false'}
      aria-label={label}
    >
      <Icon className={clsx('h-4 w-4', active ? 'text-violet-300' : 'text-white/50')} aria-hidden="true" />
      <span className="sr-only">{label}</span>
      <span className="text-xs text-white/60 tabular-nums">{typeof count === 'number' ? count : 0}</span>
    </button>
  )
}

function KindBadge({ kind }: { kind: FeedKind }) {
  if (kind === 'post') return null
  const label = kind === 'review' ? 'Review' : 'Rating'
  const palette = kind === 'review' ? 'bg-emerald-500/10 text-emerald-200' : 'bg-amber-500/10 text-amber-200'
  return (
    <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', palette)}>{label}</span>
  )
}

function GameBadge({ game }: { game?: { id: string | number; name?: string; coverUrl?: string } }) {
  if (!game?.id) return null
  const href = `/game/${encodeURIComponent(String(game.id))}`
  const cover = game.coverUrl || '/cover-fallback.png'

  return (
    <div className="group/game relative inline-flex">
      <Link
        href={href}
        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 transition hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-white"
      >
        <Image src={cover} alt="" width={28} height={36} className="h-9 w-7 rounded object-cover" />
        <span className="max-w-[150px] truncate font-medium text-white/90">{game.name || 'View game'}</span>
      </Link>
      <div className="pointer-events-none absolute left-0 top-full z-30 mt-2 w-64 -translate-y-1 rounded-xl border border-white/15 bg-zinc-950/95 p-3 opacity-0 shadow-2xl backdrop-blur transition duration-200 group-hover/game:translate-y-0 group-hover/game:opacity-100">
        <div className="flex items-start gap-3">
          <div className="relative h-16 w-12 overflow-hidden rounded-md border border-white/10 bg-white/5">
            <Image src={cover} alt="" fill className="object-cover" sizes="96px" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white/95">{game.name || 'Untitled game'}</p>
            <p className="text-xs text-white/50">Open the game hub for stats, reviews, and more.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function StarRow({ value }: { value: number }) {
  const stars = Math.max(0, Math.min(5, Math.round((value / 100) * 5)))
  const ratingOutOfFive = Math.round(((value / 100) * 5) * 10) / 10
  return (
    <div className="flex items-center gap-1" aria-label={`${ratingOutOfFive} out of 5 star rating`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < stars ? 'text-yellow-400' : 'text-white/20'} aria-hidden="true">★</span>
      ))}
    </div>
  )
}

export function FeedCardV2Skeleton({ kind = 'post' as FeedKind }) {
  return (
    <div className="sidebar-card p-4 md:p-5 animate-pulse">
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 rounded bg-white/10" />
            <div className="h-3 w-20 rounded bg-white/5" />
            <div className="h-6 w-40 rounded-full bg-white/5" />
          </div>
          <div className="h-6 w-6 rounded-full bg-white/5" />
        </div>

        {kind !== 'rating' ? <div className="h-16 rounded-lg bg-white/5" /> : null}

        {kind === 'post' ? <div className="h-48 rounded-xl bg-white/5" /> : null}

        {kind === 'rating' || kind === 'review' ? <div className="h-4 w-24 rounded bg-white/5" /> : null}

        <div className="flex items-center gap-3 border-t border-white/5 pt-3">
          <div className="h-9 flex-1 rounded-lg bg-white/5" />
          <div className="h-9 flex-1 rounded-lg bg-white/5" />
          <div className="h-9 flex-1 rounded-lg bg-white/5" />
        </div>
      </div>
    </div>
  )
}
