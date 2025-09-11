// src/components/OverflowActions.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { copyToClipboard } from '@/lib/copy';
import {
  getBlockSets,
  blockUser,
  unblockUser,
  broadcastBlockSync,
  type BlockSets,
} from '@/lib/blocks';
import {
  getMuteSet,
  muteUser,
  unmuteUser,
  broadcastMuteSync,
  type MuteSet,
} from '@/lib/mutes';

type Props = {
  targetId: string;
  username?: string;
  className?: string;
  /** Parent can refresh counts / following / banners immediately */
  onBlockChange?: (nextBlocked: boolean) => Promise<void> | void;
  onMuteChange?: (nextMuted: boolean) => Promise<void> | void;
};

export default function OverflowActions({
  targetId,
  username,
  className,
  onBlockChange,
  onMuteChange,
}: Props) {
  const supabase = supabaseBrowser();

  const [open, setOpen] = useState(false);
  const [copyOK, setCopyOK] = useState(false);

  // block state
  const [iBlocked, setIBlocked] = useState(false);    // I blocked them
  const [blockedMe, setBlockedMe] = useState(false);  // They blocked me
  const [blockBusy, setBlockBusy] = useState(false);

  // mute state (one-way: me → them)
  const [isMuted, setIsMuted] = useState(false);
  const [muteBusy, setMuteBusy] = useState(false);

  const [ready, setReady] = useState(false);
  const meRef = useRef<string | null>(null);

  // shareable profile URL
  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    try {
      return new URL(
        username ? `/u/${username}` : window.location.pathname,
        window.location.origin
      ).toString();
    } catch {
      return username ? `/u/${username}` : window.location.pathname;
    }
  }, [username]);

  async function refreshStates(force = false) {
    const { data: u } = await supabase.auth.getUser();
    const me = u?.user?.id ?? null;
    meRef.current = me;

    if (!me) {
      setIBlocked(false);
      setBlockedMe(false);
      setIsMuted(false);
      setReady(true);
      return;
    }

    const sets: BlockSets = await getBlockSets(supabase, me, { force });
    setIBlocked(sets.iBlocked.has(targetId));
    setBlockedMe(sets.blockedMe.has(targetId));

    const mset: MuteSet = await getMuteSet(supabase, me, { force });
    setIsMuted(mset.has(targetId));

    setReady(true);
  }

  // initial + respond to target change
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mounted) return;
      setReady(false);
      await refreshStates(true);
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, supabase]);

  // cross-tab sync (blocks + mutes)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'gb-block-sync' || e.key === 'gb-mute-sync') {
        refreshStates(true);
      }
    };
    try {
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    } catch {
      return () => {};
    }
  }, [supabase, targetId]);

  // actions
  async function onCopy() {
    const ok = await copyToClipboard(shareUrl);
    setCopyOK(ok);
    setTimeout(() => setCopyOK(false), 1200);
  }

  async function onToggleBlock() {
    if (!ready || blockBusy) return;
    setBlockBusy(true);

    const willBlock = !iBlocked;
    const prev = { iBlocked, blockedMe };

    // optimistic
    setIBlocked(willBlock);

    try {
      if (willBlock) {
        const { error } = await blockUser(supabase, targetId);
        if (error) throw error;
      } else {
        const { error } = await unblockUser(supabase, targetId);
        if (error) throw error;
      }
      try { broadcastBlockSync(); } catch {}
      await refreshStates(true);
      if (onBlockChange) await onBlockChange(willBlock);
    } catch (err: any) {
      setIBlocked(prev.iBlocked);
      setBlockedMe(prev.blockedMe);
      alert(err?.message || 'Failed to update block.');
      // eslint-disable-next-line no-console
      console.error('Block toggle failed:', err);
    } finally {
      setBlockBusy(false);
    }
  }

  async function onToggleMute() {
    if (!ready || muteBusy) return;
    // don’t allow mute actions when blocked either way
    if (iBlocked || blockedMe) return;

    setMuteBusy(true);

    const willMute = !isMuted;
    const prev = { isMuted };

    // optimistic
    setIsMuted(willMute);

    try {
      if (willMute) {
        const { error } = await muteUser(supabase, targetId);
        if (error) throw error;
      } else {
        const { error } = await unmuteUser(supabase, targetId);
        if (error) throw error;
      }
      try { broadcastMuteSync(); } catch {}
      await refreshStates(true);
      if (onMuteChange) await onMuteChange(willMute);
    } catch (err: any) {
      setIsMuted(prev.isMuted);
      alert(err?.message || 'Failed to update mute.');
      // eslint-disable-next-line no-console
      console.error('Mute toggle failed:', err);
    } finally {
      setMuteBusy(false);
    }
  }

  // labels/banners
  const blockedEitherWay = iBlocked || blockedMe;

  const blockLabel = blockBusy
    ? '…'
    : iBlocked
    ? `Unblock${username ? ` @${username}` : ''}`
    : blockedMe
    ? `Block back${username ? ` @${username}` : ''}`
    : `Block${username ? ` @${username}` : ''}`;

  const muteLabel = muteBusy
    ? '…'
    : isMuted
    ? `Unmute${username ? ` @${username}` : ''}`
    : `Mute${username ? ` @${username}` : ''}`;

  const banner =
    iBlocked
      ? 'You blocked this user.'
      : blockedMe
      ? 'This user has blocked you.'
      : isMuted
      ? 'You muted this user.'
      : 'Quick actions';

  return (
    <div className={className} data-ignore-context>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        className="px-2 py-1 rounded hover:bg-white/10"
        title="More actions"
      >
        ⋯
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-lg border border-white/10 bg-neutral-900 shadow-lg p-2 z-20"
          onMouseLeave={() => setOpen(false)}
        >
          <div className="px-3 py-2 text-sm text-white/60">{banner}</div>

          <button
            role="menuitem"
            onClick={onToggleBlock}
            disabled={!ready || blockBusy}
            className="w-full text-left px-3 py-2 rounded hover:bg-white/10 disabled:opacity-50"
            title={
              blockedMe && !iBlocked
                ? 'They blocked you; you can optionally block back.'
                : undefined
            }
          >
            {blockLabel}
          </button>

          {!blockedEitherWay && (
            <button
              role="menuitem"
              onClick={onToggleMute}
              disabled={!ready || muteBusy}
              className="w-full text-left px-3 py-2 rounded hover:bg-white/10 disabled:opacity-50"
            >
              {muteLabel}
            </button>
          )}

          <button
            role="menuitem"
            onClick={onCopy}
            className="w-full text-left px-3 py-2 rounded hover:bg-white/10"
          >
            Copy profile link
          </button>

          <div
            aria-live="polite"
            className={`px-3 pt-1 text-xs ${copyOK ? 'opacity-100' : 'opacity-0'} transition-opacity`}
          >
            {copyOK ? 'Link copied' : '\u00A0'}
          </div>
        </div>
      )}
    </div>
  );
}