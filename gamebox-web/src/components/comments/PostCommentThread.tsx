'use client';

import { useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { waitForSession } from '@/lib/waitForSession';
import { timeAgo } from '@/lib/timeAgo';

type Row = {
  id: string;
  created_at: string;
  body: string;
  author: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

export default function PostCommentThread({
  postId,
  viewerId,
  onClose,
}: {
  postId: string;
  viewerId: string | null;
  onClose?: () => void;
}) {
  const sb = supabaseBrowser();
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  // fetch comments
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await sb
        .from('post_comments')
        .select(`
          id, created_at, body,
          author:profiles!post_comments_user_id_profiles_fkey (
            id, username, display_name, avatar_url
          )
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      if (!alive) return;
      if (error) setErr(error.message);
      else setRows(
        (data ?? []).map((r: any): Row => ({
          id: String(r.id),
          created_at: String(r.created_at),
          body: String(r.body ?? ''),
          author: r.author
            ? {
                id: String(r.author.id),
                username: r.author.username ?? null,
                display_name: r.author.display_name ?? null,
                avatar_url: r.author.avatar_url ?? null,
              }
            : null,
        }))
      );
    })();
    return () => {
      alive = false;
    };
  }, [sb, postId]);

  // close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      let uid = viewerId;
      if (!uid) {
        const session = await waitForSession(supabaseBrowser());
        uid = session?.user?.id ?? null;
      }
      if (!uid) {
        window.location.href = '/login';
        return;
      }

      const { data, error } = await sb
        .from('post_comments')
        .insert({ post_id: postId, user_id: uid, body })
        .select(`
          id, created_at, body,
          author:profiles!post_comments_user_id_profiles_fkey (
            id, username, display_name, avatar_url
          )
        `)
        .single();

      if (error) return;
      setRows((r) => r.concat([{
        id: String(data!.id),
        created_at: String(data!.created_at),
        body: String(data!.body ?? ''),
        author: data!.author?.[0] ? {
          id: String(data!.author[0].id),
          username: data!.author[0].username ?? null,
          display_name: data!.author[0].display_name ?? null,
          avatar_url: data!.author[0].avatar_url ?? null,
        } : null
      }]));
      setText('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-neutral-900 text-white">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="text-sm font-semibold">Comments</h3>
          <button onClick={onClose} className="text-white/60 hover:text-white">✕</button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-3 space-y-3">
          {err && <div className="text-red-400 text-sm">{err}</div>}
          {rows.length === 0 ? (
            <div className="text-sm text-white/60">No comments yet.</div>
          ) : rows.map((c) => (
            <div key={c.id} className="flex items-start gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.author?.avatar_url || '/avatar-placeholder.svg'}
                alt=""
                className="h-7 w-7 rounded-full object-cover border border-white/10"
                loading="lazy"
                decoding="async"
              />
              <div className="min-w-0">
                <div className="text-xs text-white/80">
                  {c.author?.display_name || c.author?.username || 'Player'} ·{' '}
                  <span className="text-white/40">{timeAgo(c.created_at)}</span>
                </div>
                <div className="text-sm whitespace-pre-wrap">{c.body}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-white/10">
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write a comment…"
              className="flex-1 rounded border border-white/10 bg-black/30 px-3 py-2 text-sm"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            <button
              onClick={send}
              disabled={busy || !text.trim()}
              className="px-3 py-2 rounded bg-indigo-600 text-sm disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
