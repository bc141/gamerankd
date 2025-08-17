'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { waitForSession } from '@/lib/waitForSession';

type Props = { targetId: string; username?: string | null };

export default function BlockButtons({ targetId, username }: Props) {
  const supabase = supabaseBrowser();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function withMe<T>(fn: (me: string) => Promise<T>) {
    setErr(null);
    setBusy(true);
    try {
      const me = (await waitForSession(supabase))?.user?.id;
      if (!me) throw new Error('Please sign in');
      return await fn(me);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function block() {
    await withMe(async (me) => {
      const { error } = await supabase.from('blocks').upsert({ blocker_id: me, blocked_id: targetId });
      if (error) throw error;
    });
  }
  async function unblock() {
    await withMe(async (me) => {
      const { error } = await supabase.from('blocks').delete().eq('blocker_id', me).eq('blocked_id', targetId);
      if (error) throw error;
    });
  }
  async function mute() {
    await withMe(async (me) => {
      const { error } = await supabase.from('blocks').upsert({ blocker_id: me, blocked_id: targetId, muted_reviews: true });
      if (error) throw error;
    });
  }
  async function unmute() {
    await withMe(async (me) => {
      const { error } = await supabase.from('blocks').update({ muted_reviews: false }).eq('blocker_id', me).eq('blocked_id', targetId);
      if (error) throw error;
    });
  }

  return (
    <div className="flex gap-2">
      <button
        disabled={busy}
        onClick={block}
        className="px-3 py-1.5 text-sm rounded bg-white/10 hover:bg-white/15 disabled:opacity-50"
        title={`Block ${username ?? 'user'}`}
      >
        Block
      </button>
      <button
        disabled={busy}
        onClick={unblock}
        className="px-3 py-1.5 text-sm rounded bg-white/10 hover:bg-white/15 disabled:opacity-50"
      >
        Unblock
      </button>
      <button
        disabled={busy}
        onClick={mute}
        className="px-3 py-1.5 text-sm rounded bg-white/10 hover:bg-white/15 disabled:opacity-50"
        title={`Mute ${username ?? 'user'}’s reviews`}
      >
        Mute
      </button>
      <button
        disabled={busy}
        onClick={unmute}
        className="px-3 py-1.5 text-sm rounded bg-white/10 hover:bg-white/15 disabled:opacity-50"
      >
        Unmute
      </button>
      {err ? <span className="text-xs text-red-400">{err}</span> : null}
    </div>
  );
}