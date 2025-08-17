// src/components/CommentThread.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  listComments,
  addComment,
  broadcastCommentDelta,
  type CommentRow,
} from '@/lib/comments';
import { notifyComment, clearComment } from '@/lib/notifications';
import { timeAgo } from '@/lib/timeAgo';
import Link from 'next/link';
import { getBlockSets } from '@/lib/blocks'; // 👈 blocks helper

type Props = {
  supabase: SupabaseClient;
  viewerId: string | null;
  reviewUserId: string; // owner of the review being commented on
  gameId: number;
  onClose: () => void | Promise<void>;
  onCountChange?: (nextCount: number) => void;
  /** Render inline (embedded) instead of as a modal overlay */
  embed?: boolean;
};

export default function CommentThread({
  supabase,
  viewerId,
  reviewUserId,
  gameId,
  onClose,
  onCountChange,
  embed = false,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<CommentRow[]>([]);
  const [posting, setPosting] = useState(false);
  const [text, setText] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // NEW: visibility + interaction state from blocks/mutes
  const [hiddenAuthors, setHiddenAuthors] = useState<Set<string>>(new Set());
  const [cannotInteract, setCannotInteract] = useState(false); // true when either direction is BLOCKED

  // auto-grow the composer up to ~6 lines
  function autogrow(el: HTMLTextAreaElement) {
    el.style.height = '0px';
    const next = Math.min(el.scrollHeight, 6 * 24 + 16); // ~6 lines + padding
    el.style.height = next + 'px';
  }

  // ---- hydrate blocks/mutes (viewer-only) ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!viewerId) {
        if (!cancelled) {
          setHiddenAuthors(new Set());
          setCannotInteract(false);
        }
        return;
      }

      // blocks (two-way) via helper
      const { iBlocked, blockedMe } = await getBlockSets(supabase, viewerId);

      // mutes (one-way; only people YOU muted are hidden from your view)
      const mRes = await supabase
        .from('mutes') // table: mutes(muter_id, muted_id)
        .select('muted_id')
        .eq('muter_id', viewerId);

      const mutedIds = new Set<string>(
        ((mRes.data ?? []) as any[]).map((r) => String(r.muted_id))
      );

      if (cancelled) return;

      // hide authors that are: you blocked, blocked you, or you muted
      const hidden = new Set<string>([
        ...Array.from(iBlocked.values()),
        ...Array.from(blockedMe.values()),
        ...Array.from(mutedIds.values()),
      ]);
      setHiddenAuthors(hidden);

      // cannot interact only when BLOCKED either way (mute doesn't prevent posting)
      setCannotInteract(iBlocked.has(reviewUserId) || blockedMe.has(reviewUserId));
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, viewerId, reviewUserId]);

  // keep parent badge in sync WHILE OPEN (use VISIBLE count)
  const visibleRows = useMemo(() => {
    if (!hiddenAuthors.size) return rows;
    return rows.filter((r) => {
      const uid = r.commenter?.id;
      return !(uid && hiddenAuthors.has(uid));
    });
  }, [rows, hiddenAuthors]);

  useEffect(() => onCountChange?.(visibleRows.length), [visibleRows.length, onCountChange]);

  // initial fetch
  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      const { rows: initial, error } = await listComments(
        supabase,
        reviewUserId,
        gameId,
        200
      );
      if (!mounted) return;
      if (!error) setRows(initial);
      setLoading(false);
    })();

    // Only add ESC-to-close when we're in modal mode
    if (!embed) {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') safeClose();
      };
      try {
        window.addEventListener('keydown', onKey);
      } catch {}
      return () => {
        mounted = false;
        try {
          window.removeEventListener('keydown', onKey);
        } catch {}
      };
    }

    return () => {
      mounted = false;
    };
  }, [supabase, reviewUserId, gameId, embed]);

  // auto focus when opened (if signed in & allowed)
  useEffect(() => {
    if (viewerId && !cannotInteract) {
      inputRef.current?.focus();
      if (inputRef.current) autogrow(inputRef.current);
    }
  }, [viewerId, cannotInteract]);

  // scroll to bottom on load / length change (visible list)
  useEffect(() => {
    if (loading) return;
    requestAnimationFrame(() => {
      const el = boxRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [loading, visibleRows.length]);

  function safeClose() {
    onClose?.();
  }

  async function submit() {
    if (posting) return;
    const body = text.trim();
    if (!viewerId) {
      alert('Please sign in to comment.');
      return;
    }
    if (cannotInteract) {
      alert("You can't comment here.");
      return;
    }
    if (!body) return;

    setPosting(true);

    // optimistic (temp id so we can distinguish)
    const tempId = `temp_${Date.now()}`;
    const temp: CommentRow = {
      id: tempId, // temp marker
      body,
      created_at: new Date().toISOString(),
      commenter: { id: viewerId, username: null, display_name: 'You', avatar_url: null },
    };
    setRows((p) => [...p, temp]);
    setText('');
    if (inputRef.current) autogrow(inputRef.current);

    try {
      const { row, error } = await addComment(
        supabase,
        viewerId,
        reviewUserId,
        gameId,
        body
      );
      if (error || !row) {
        // revert optimistic
        setRows((p) => p.filter((r) => r.id !== tempId));
        alert(error?.message ?? 'Failed to post comment.');
        return;
      }

      // swap optimistic with authoritative row
      setRows((p) => p.map((r) => (r.id === tempId ? row : r)));

      // update badges immediately
      broadcastCommentDelta(reviewUserId, gameId, +1);

      // 🔔 Fire-and-forget notification (row.id is UUID string)
      try {
        const commentIdStr = String(row.id);
        const preview = body.slice(0, 140);
        notifyComment(supabase, reviewUserId, gameId, commentIdStr, preview).catch(() => {});
      } catch {
        // never block UX on notif issues
      }

      // keep focus, reset height, and scroll
      requestAnimationFrame(() => {
        if (inputRef.current) {
          autogrow(inputRef.current);
          inputRef.current.focus();
        }
        const el = boxRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
    } finally {
      setPosting(false);
    }
  }

  async function remove(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    if (!viewerId || row.commenter?.id !== viewerId) return; // only own comments

    // Optimistic temp row? just drop locally.
    if (String(id).startsWith('temp_')) {
      setRows((p) => p.filter((r) => r.id !== id));
      return;
    }

    // optimistic remove
    setRows((p) => p.filter((r) => r.id !== id));

    try {
      const { error } = await supabase
        .from('review_comments')
        .delete()
        .eq('id', id);
      if (error) throw error;

      // update badges immediately
      broadcastCommentDelta(reviewUserId, gameId, -1);

      // 🔔 clear notif (UUID string)
      clearComment(supabase, reviewUserId, gameId, String(id)).catch(() => {});
    } catch (err: any) {
      // restore on failure
      setRows((p) => {
        const exists = p.some((r) => r.id === id);
        if (exists) return p;
        return [...p, row].sort((a, b) => a.created_at.localeCompare(b.created_at));
      });
      alert(err?.message ?? 'Failed to delete comment.');
    }
  }

  const headerTitle = useMemo(() => 'Comments', []);
  const canPost = Boolean(viewerId) && !cannotInteract;

  // ---------- INLINE (embed) ----------
  if (embed) {
    return (
      <div className="flex flex-col max-h-[65vh]">
        {/* Header (no close; parent modal has one) */}
        <div className="flex items-center justify-between px-3 pt-2 pb-1">
          <h2 className="text-lg font-semibold text-white">{headerTitle}</h2>
        </div>

        {/* List */}
        <div ref={boxRef} className="flex-1 overflow-y-auto p-3 space-y-3" aria-live="polite">
          {loading ? (
            <div className="text-white/60 text-sm">Loading…</div>
          ) : visibleRows.length === 0 ? (
            <div className="text-white/60 text-sm">No comments yet.</div>
          ) : (
            visibleRows.map((c) => {
              const name = c.commenter?.display_name || c.commenter?.username || 'Player';
              const avatar = c.commenter?.avatar_url || '/avatar-placeholder.svg';
              const canDelete = viewerId && c.commenter?.id === viewerId;

              return (
                <div key={c.id} className="flex items-start gap-3">
                  {/* avatar (clickable if username exists) */}
                  {c.commenter?.username ? (
                    <Link
                      href={`/u/${c.commenter.username}`}
                      prefetch={false}
                      className="shrink-0"
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Open ${c.commenter.display_name || c.commenter.username}'s profile`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={avatar}
                        alt=""
                        className="h-8 w-8 rounded-full object-cover border border-white/10"
                      />
                    </Link>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatar}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover border border-white/10"
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {c.commenter?.username ? (
                        <Link
                          href={`/u/${c.commenter.username}`}
                          prefetch={false}
                          className="text-white font-medium text-sm hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {c.commenter.display_name || c.commenter.username}
                        </Link>
                      ) : (
                        <span className="text-white font-medium text-sm">{name}</span>
                      )}
                      <span className="text-white/40 text-xs">{timeAgo(c.created_at)}</span>

                      {canDelete && (
                        <button
                          onClick={() => remove(c.id)}
                          className="ml-auto text-xs px-2 py-0.5 rounded bg-white/10 hover:bg-white/15 text-white/80"
                          title="Delete"
                          data-ignore-context
                        >
                          Delete
                        </button>
                      )}
                    </div>

                    <p className="text-white/90 whitespace-pre-wrap break-words text-sm">
                      {c.body}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Composer */}
        <div className="p-3 border-t border-white/10">
          <div className="flex items-end gap-2" data-ignore-context>
            <textarea
              ref={inputRef}
              value={text}
              onFocus={(e) => autogrow(e.currentTarget)}
              onChange={(e) => {
                setText(e.target.value);
                autogrow(e.currentTarget);
              }}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !posting && text.trim()) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              placeholder={
                canPost ? 'Write a comment…' : cannotInteract ? "You can't comment here." : 'Sign in to comment'
              }
              disabled={!canPost || posting}
              className="flex-1 resize-none rounded-lg border border-white/15 bg-neutral-900 text-white px-3 py-2 disabled:opacity-60"
              maxLength={800}
            />
            <button
              onClick={submit}
              disabled={!canPost || posting || text.trim() === ''}
              className="shrink-0 px-3 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-50"
            >
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- MODAL (default) ----------
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) safeClose();
      }}
    >
      <div className="w-full max-w-xl rounded-2xl bg-neutral-900/95 border border-white/10 shadow-xl">
        {/* Header (tight, no divider; summary above handles borders) */}
        <div className="flex items-center justify-between px-3 pt-2 pb-1">
          <h2 className="text-sm font-semibold text-white/80">Comments</h2>
          <button
            onClick={safeClose}
            className="px-2 py-1 rounded hover:bg-white/10 text-white/80"
            aria-label="Close comments"
          >
            ✕
          </button>
        </div>

        {/* List */}
        <div ref={boxRef} className="max-h-[60vh] overflow-y-auto p-3 space-y-3" aria-live="polite">
          {loading ? (
            <div className="text-white/60 text-sm">Loading…</div>
          ) : visibleRows.length === 0 ? (
            <div className="text-white/60 text-sm">No comments yet.</div>
          ) : (
            visibleRows.map((c) => {
              const name = c.commenter?.display_name || c.commenter?.username || 'Player';
              const avatar = c.commenter?.avatar_url || '/avatar-placeholder.svg';
              const canDelete = viewerId && c.commenter?.id === viewerId;

              return (
                <div key={c.id} className="flex items-start gap-3">
                  {/* avatar (clickable if username exists) */}
                  {c.commenter?.username ? (
                    <Link
                      href={`/u/${c.commenter.username}`}
                      prefetch={false}
                      className="shrink-0"
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Open ${c.commenter.display_name || c.commenter.username}'s profile`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={avatar}
                        alt=""
                        className="h-8 w-8 rounded-full object-cover border border-white/10"
                      />
                    </Link>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatar}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover border border-white/10"
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {c.commenter?.username ? (
                        <Link
                          href={`/u/${c.commenter.username}`}
                          prefetch={false}
                          className="text-white font-medium text-sm hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {c.commenter.display_name || c.commenter.username}
                        </Link>
                      ) : (
                        <span className="text-white font-medium text-sm">{name}</span>
                      )}
                      <span className="text-white/40 text-xs">{timeAgo(c.created_at)}</span>

                      {canDelete && (
                        <button
                          onClick={() => remove(c.id)}
                          className="ml-auto text-xs px-2 py-0.5 rounded bg-white/10 hover:bg-white/15 text-white/80"
                          title="Delete"
                          data-ignore-context
                        >
                          Delete
                        </button>
                      )}
                    </div>

                    <p className="text-white/90 whitespace-pre-wrap break-words text-sm">
                      {c.body}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Composer */}
        <div className="p-3 border-t border-white/10">
          <div className="flex items-end gap-2" data-ignore-context>
            <textarea
              ref={inputRef}
              value={text}
              onFocus={(e) => autogrow(e.currentTarget)}
              onChange={(e) => {
                setText(e.target.value);
                autogrow(e.currentTarget);
              }}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !posting && text.trim()) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              placeholder={
                canPost ? 'Write a comment…' : cannotInteract ? "You can't comment here." : 'Sign in to comment'
              }
              disabled={!canPost || posting}
              className="flex-1 resize-none rounded-lg border border-white/15 bg-neutral-900 text-white px-3 py-2 disabled:opacity-60"
              maxLength={800}
            />
            <button
              onClick={submit}
              disabled={!canPost || posting || text.trim() === ''}
              className="shrink-0 px-3 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-50"
            >
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}