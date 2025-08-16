'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import StarRating from '@/components/StarRating';
import { timeAgo } from '@/lib/timeAgo';
import CommentThread from '@/components/comments/CommentThread';

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
  const panelRef = useRef<HTMLDivElement>(null);

  // lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // ESC to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // fetch single review summary
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from('reviews')
        .select('rating, review, created_at, games:game_id (id, name, cover_url)')
        .eq('user_id', reviewUserId)
        .eq('game_id', gameId)
        .maybeSingle(); // ok if null

      if (cancelled) return;

      if (error || !data) {
        setRow(null);
        setLoading(false);
        return;
      }

      const d = data as unknown as RawReviewRow;
      const g = d.games ?? null;

      const normalized: ReviewRow = {
        rating: Number(d.rating ?? 0),
        review: d.review ?? null,
        created_at: d.created_at ?? new Date(0).toISOString(),
        games: g && g.id != null
          ? {
              id: Number(g.id),
              name: String(g.name ?? 'Unknown game'),
              cover_url: g.cover_url ?? null,
            }
          : null,
      };

      setRow(normalized);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, reviewUserId, gameId]);

  function onBackdropClick(e: MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  // small helpers
  const stars = row ? row.rating / 20 : 0; // convert 0–100 to 0–5
  const gameName = row?.games?.name ?? 'Unknown game';
  const cover = row?.games?.cover_url ?? '';

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="View in context"
      onMouseDown={onBackdropClick}
    >
      <div
        ref={panelRef}
        className="w-full max-w-2xl rounded-2xl bg-neutral-900/95 border border-white/10 shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h2 className="text-base font-semibold text-white">View in context</h2>
          <button
            onClick={onClose}
            className="px-2 py-1 rounded hover:bg-white/10 text-white/80"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Review summary */}
        <div className="px-4 py-3 border-b border-white/10">
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
                <div className="font-medium truncate">{gameName}</div>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <StarRating value={stars} readOnly size={18} />
                  <span className="text-sm text-white/60">{stars.toFixed(1)} / 5</span>
                  <span className="text-white/30">·</span>
                  <span className="text-xs text-white/40">{timeAgo(row.created_at)}</span>
                </div>
                {row.review && row.review.trim() !== '' && (
                  <p className="text-white/70 mt-2 whitespace-pre-wrap break-words">
                    {row.review.trim()}
                  </p>
                )}
              </div>
              <a
                href={`/game/${gameId}`}
                className="shrink-0 text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10"
              >
                Open game
              </a>
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
              onClose={onClose}
            />
          </div>
        )}
      </div>
    </div>
  );
}