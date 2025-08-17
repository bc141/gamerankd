// src/components/BlockButtons.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import {
  getBlockSets,
  blockUser,
  unblockUser,
  muteUser,
  unmuteUser,
  broadcastBlockSync,
} from '@/lib/blocks';

type Props = {
  targetId: string;
  username?: string;
  className?: string;
};

export default function BlockButtons({ targetId, username, className }: Props) {
  const supabase = supabaseBrowser();

  const [viewerId, setViewerId] = useState<string | null>(null);
  const [iBlocked, setIBlocked] = useState(false);
  const [blockedMe, setBlockedMe] = useState(false);
  const [iMuted, setIMuted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (!mounted) return;
      setViewerId(uid);
      if (!uid) return;

      const sets = await getBlockSets(supabase, uid);
      if (!mounted) return;
      setIBlocked(sets.iBlocked.has(targetId));
      setBlockedMe(sets.blockedMe.has(targetId));
      setIMuted(sets.iMuted.has(targetId));
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId]);

  if (!viewerId || viewerId === targetId) return null; // no buttons when logged out or self

  const label = username ?? 'user';

  async function onBlock() {
    setBusy(true);
    const { error } = await blockUser(supabase, targetId);
    setBusy(false);
    if (error) return alert(error.message);
    setIBlocked(true);
    broadcastBlockSync();
  }

  async function onUnblock() {
    setBusy(true);
    const { error } = await unblockUser(supabase, targetId);
    setBusy(false);
    if (error) return alert(error.message);
    setIBlocked(false);
    broadcastBlockSync();
  }

  async function onMute() {
    setBusy(true);
    const { error } = await muteUser(supabase, targetId);
    setBusy(false);
    if (error) return alert(error.message);
    setIMuted(true);
    broadcastBlockSync();
  }

  async function onUnmute() {
    setBusy(true);
    const { error } = await unmuteUser(supabase, targetId);
    setBusy(false);
    if (error) return alert(error.message);
    setIMuted(false);
    broadcastBlockSync();
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        {iBlocked ? (
          <button
            onClick={onUnblock}
            disabled={busy}
            className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 text-sm"
          >
            Unblock
          </button>
        ) : (
          <button
            onClick={onBlock}
            disabled={busy}
            className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 text-sm"
            title={blockedMe ? 'They already blocked you' : undefined}
          >
            Block
          </button>
        )}

        {iMuted ? (
          <button
            onClick={onUnmute}
            disabled={busy}
            className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 text-sm"
          >
            Unmute
          </button>
        ) : (
          <button
            onClick={onMute}
            disabled={busy}
            className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 text-sm"
          >
            Mute
          </button>
        )}

        {blockedMe && (
          <span className="text-xs text-white/50 self-center">
            You’re blocked by {label}.
          </span>
        )}
      </div>
    </div>
  );
}