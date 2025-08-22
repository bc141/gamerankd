// src/components/comments/CommentButton.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import CommentThread from './CommentThread';
import {
  commentKey,
  addCommentCountListener,
  fetchCommentCountsBulk,
  broadcastCommentDelta,
} from '@/lib/comments';

type Props = {
  supabase: SupabaseClient;             // your supabaseBrowser() instance type also works
  viewerId: string | null;
  reviewUserId: string;
  gameId: number;
  /** If you already loaded counts on the page, pass it here */
  initialCount?: number;
  /** Optional: reflect live changes upward */
  onCountChange?: (next: number) => void;
  /** Optional extra class names for the button */
  className?: string;
  /** Optional custom label (defaults to just the count with a bubble) */
  label?: string;
};

export default function CommentButton({
  supabase,
  viewerId,
  reviewUserId,
  gameId,
  initialCount = 0,
  onCountChange,
  className = '',
  label,
}: Props) {
  const k = useMemo(() => commentKey(reviewUserId, gameId), [reviewUserId, gameId]);

  const [open, setOpen] = useState(false);
  const [count, setCount] = useState<number>(initialCount);
  const [syncing, setSyncing] = useState(false);

  // Cross-tab / same-tab deltas (e.g., posting from another place)
  useEffect(() => {
    return addCommentCountListener(({ reviewUserId: u, gameId: g, delta }) => {
      if (commentKey(u, g) !== k) return;
      setCount((c) => Math.max(0, c + delta));
      onCountChange?.(Math.max(0, count + delta));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);

  // If the parent updates initialCount later, hydrate once
  useEffect(() => {
    setCount((c) => (c === initialCount ? c : initialCount));
  }, [initialCount]);

  const btnTitle = label ?? 'View comments';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`ml-2 text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-50 ${className}`}
        title={btnTitle}
        aria-expanded={open}
        aria-label={btnTitle}
        disabled={syncing}
      >
        {/* bubble icon */}
        <span aria-hidden>💬</span>{' '}
        {count}
      </button>

      {open && (
        <CommentThread
          supabase={supabase}
          viewerId={viewerId}
          reviewUserId={reviewUserId}
          gameId={gameId}
          // While open, get live total directly from the thread (no flicker)
          onCountChange={(next) => {
            setCount(next);
            onCountChange?.(next);
          }}
          // When the sheet closes, double-check the truth once, compute delta, broadcast,
          // then close. Keeps badges elsewhere consistent without visible flicker.
          onClose={async () => {
            try {
              setSyncing(true);
              const map = await fetchCommentCountsBulk(supabase, [{ reviewUserId, gameId }]);
              const next = map[k] ?? count;
              if (next !== count) {
                const delta = next - count;
                setCount(next);
                onCountChange?.(next);
                if (delta) broadcastCommentDelta(reviewUserId, gameId, delta);
              }
            } finally {
              setSyncing(false);
              setOpen(false);
            }
          }}
        />
      )}
    </>
  );
}