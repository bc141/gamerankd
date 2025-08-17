'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import StarRating from '@/components/StarRating';
import { timeAgo } from '@/lib/timeAgo';
import CommentThread from '@/components/comments/CommentThread';

type Author = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type RawReviewRow = {
  rating?: number | null;
  review?: string | null;
  created_at?: string | null;
  games?: { id?: number | null; name?: string | null; cover_url?: string | null } | null;
};

type ReviewRow = {
  rating: number; // 1–100
  review: string | null;
  created_at: string;
  games: { id: number; name: string; cover_url: string | null } | null;
};

type Props = {
  supabase: SupabaseClient;
  viewerId: string | null;
  /** The owner of the review being commented on (i.e., the notification recipient) */
  reviewUserId: string;
  gameId: number;
  onClose: () => void;
};

export default function ReviewContextModal({
  supabase,
  viewerId,
  reviewUserId,
  gameId,
  onClose,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<ReviewRow | null>(null);
  const [author, setAuthor] = useState<Author | null>(null);

  // a11y/focus
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const startTrapRef = useRef<HTMLSpanElement>(null);
  const endTrapRef = useRef<HTMLSpanElement>(null);

  // lock body scroll while open and capture opener focus
  useEffect(() => {
    openerRef.current = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // focus panel for screen readers
    const t = setTimeout(() => panelRef.current?.focus(), 0);
    return () => {
      document.body.style.overflow = prev;
      clearTimeout(t);
      // restore focus to trigger
      openerRef.current?.focus?.();
    };
  }, []);

  // Close helper (restores focus after parent unmount)
  function closeAndRestore() {
    const opener = openerRef.current;
    onClose();
    setTimeout(() => opener?.focus?.(), 0);
  }

  // ESC to close + focus trap
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeAndRestore();
      } else if (e.key === 'Tab') {
        // trap tab within modal
        const panel = panelRef.current;
        if (!panel) return;
        const focusables = panel.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // fetch single review summary + author
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      const [rev, prof] = await Promise.all([
        supabase
          .from('reviews')
          .select('rating, review, created_at, games:game_id (id, name, cover_url)')
          .eq('user_id', reviewUserId)
          .eq('game_id', gameId)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('id,username,display_name,avatar_url')
          .eq('id', reviewUserId)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      if (!prof.error && prof.data) {
        const p = prof.data as any;
        setAuthor({
          id: String(p.id),
          username: p.username ?? null,
          display_name: p.display_name ?? null,
          avatar_url: p.avatar_url ?? null,
        });
      } else {
        setAuthor(null);
      }

      if (rev.error || !rev.data) {
        setRow(null);
        setLoading(false);
        return;
      }

      const d = rev.data as RawReviewRow;
      const g = d.games ?? null;
      setRow({
        rating: Number(d.rating ?? 0),
        review: d.review ?? null,
        created_at: d.created_at ?? new Date(0).toISOString(),
        games: g
          ? {
              id: Number(g.id ?? 0),
              name: String(g.name ?? 'Unknown game'),
              cover_url: g.cover_url ?? null,
            }
          : null,
      });

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, reviewUserId, gameId]);

  function onBackdropClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) closeAndRestore();
  }

  // small helpers
  const stars = row ? row.rating / 20 : 0; // convert 0–100 to 0–5
  const gameName = row?.games?.name ?? 'Unknown game';
  const cover = row?.games?.cover_url || '/cover-fallback.png';
  const absTime =
    row?.created_at ? new Date(row.created_at).toLocaleString() : undefined;

  const headingId = 'rcm-heading';

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      onMouseDown={onBackdropClick}
    >
      {/* focus trap sentinels */}
      <span ref={startTrapRef} tabIndex={0} className="sr-only" />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="w-full max-w-2xl rounded-2xl bg-neutral-900/95 border border-white/10 shadow-2xl overflow-hidden focus:outline-none"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Summary (single divider below) */}
        <div className="relative px-4 py-3 border-b border-white/10">
          {/* Close */}
          <button
            onClick={closeAndRestore}
            className="absolute right-2 top-2 px-2 py-1 rounded hover:bg-white/10 text-white/80"
            aria-label="Close"
          >
            ✕
          </button>

          {loading ? (
            <div className="flex items-center gap-3">
              <div className="h-16 w-12 rounded bg-white/10 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 rounded bg-white/10 animate-pulse" />
                <div className="h-4 w-24 rounded bg-white/10 animate-pulse" />
              </div>
            </div>
          ) : row ? (
            <div className="flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cover}
                alt={gameName}
                className="h-16 w-12 object-cover rounded border border-white/10"
              />
              <div className="flex-1 min-w-0">
                <h2 id={headingId} className="sr-only">
                  Review details
                </h2>

                <Link
                  href={row.games?.id ? `/game/${row.games.id}` : '#'}
                  className="font-medium hover:underline truncate inline-block"
                  aria-label={row.games?.id ? `Open ${gameName}` : undefined}
                  onClick={(e) => {
                    if (!row.games?.id) e.preventDefault();
                  }}
                >
                  {gameName}
                </Link>

                <div className="mt-1 flex items-center gap-2 flex-wrap text-sm">
                  {author ? (
                    <>
                      {/* author avatar */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={author.avatar_url || '/avatar-placeholder.svg'}
                        alt=""
                        className="h-4 w-4 rounded-full object-cover border border-white/10"
                      />
                      <span className="text-white/80">
                        by{' '}
                        <Link
                          href={author.username ? `/u/${author.username}` : '#'}
                          className="hover:underline"
                        >
                          {author.display_name || author.username || 'Player'}
                        </Link>
                      </span>
                      <span className="text-white/30">·</span>
                    </>
                  ) : null}

                  <StarRating value={stars} readOnly size={16} />
                  <span className="text-white/80">{stars.toFixed(1)} / 5</span>
                  <span className="text-white/30">·</span>
                  <time className="text-white/50" title={absTime}>
                    {timeAgo(row.created_at)}
                  </time>
                </div>

                {row.review && row.review.trim() !== '' && (
                  <p className="text-white/80 mt-2 whitespace-pre-wrap break-words">
                    {row.review.trim()}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-white/70">This rating no longer exists.</div>
          )}
        </div>

        {/* Comments thread */}
        {row && (
          <div className="max-h-[65vh] overflow-y-auto">
            <CommentThread
              supabase={supabase}
              viewerId={viewerId}
              reviewUserId={reviewUserId}
              gameId={gameId}
              onCountChange={() => {}}
              onClose={closeAndRestore}
              embed
            />
          </div>
        )}
      </div>
      <span ref={endTrapRef} tabIndex={0} className="sr-only" />
    </div>
  );
}