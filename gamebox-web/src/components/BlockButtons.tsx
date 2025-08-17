// src/components/BlockButtons.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import {
  getBlockSets,
  blockUser,
  unblockUser,
  broadcastBlockSync,
} from '@/lib/blocks';

type Props = {
  targetId: string;
  username?: string;
  asMenu?: boolean;       // keeps your dropdown layout working
  className?: string;
};

export default function BlockButtons({ targetId, username, className }: Props) {
  const supabase = supabaseBrowser();

  const [viewerId, setViewerId] = useState<string | null>(null);
  const [iBlocked, setIBlocked] = useState(false);
  const [blockedMe, setBlockedMe] = useState(false);
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
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId]);

  if (!viewerId || viewerId === targetId) return null;

  const label = username ? `@${username}` : 'this user';

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

  return (
    <div className={className}>
      <div className="flex flex-col gap-1">
        {iBlocked ? (
          <button
            onClick={onUnblock}
            disabled={busy}
            className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 text-sm text-white"
          >
            Unblock {label}
          </button>
        ) : (
          <button
            onClick={onBlock}
            disabled={busy}
            className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 text-sm text-red-300"
            title={blockedMe ? 'They already blocked you' : undefined}
          >
            Block {label}
          </button>
        )}

        {blockedMe && (
          <span className="text-xs text-white/50 px-1 py-0.5">
            You’re blocked by {label}.
          </span>
        )}
      </div>
    </div>
  );
}