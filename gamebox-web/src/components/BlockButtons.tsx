// src/components/BlockButtons.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  /** Render as compact overflow menu (⋯) instead of inline buttons */
  asMenu?: boolean;
  className?: string;
};

export default function BlockButtons({ targetId, username, asMenu = false, className }: Props) {
  const supabase = supabaseBrowser();

  const [viewerId, setViewerId] = useState<string | null>(null);
  const [iBlocked, setIBlocked] = useState(false);
  const [blockedMe, setBlockedMe] = useState(false);
  const [iMuted, setIMuted] = useState(false);
  const [busy, setBusy] = useState(false);

  // local dropdown state (when asMenu)
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // fetch/refresh relationship state
  const refreshState = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id ?? null;
    setViewerId(uid);

    if (!uid) {
      setIBlocked(false);
      setBlockedMe(false);
      setIMuted(false);
      return;
    }
    const sets = await getBlockSets(supabase, uid);
    setIBlocked(sets.iBlocked.has(targetId));
    setBlockedMe(sets.blockedMe.has(targetId));
    setIMuted(sets.iMuted.has(targetId));
  }, [supabase, targetId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await refreshState();
      // cross-tab sync
      const onStorage = (e: StorageEvent) => {
        if (e.key === 'gb-block-sync') refreshState();
      };
      try { window.addEventListener('storage', onStorage); } catch {}
      return () => {
        mounted = false;
        try { window.removeEventListener('storage', onStorage); } catch {}
      };
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId]);

  // close the dropdown on outside click / Esc
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const label = useMemo(() => (username ? `@${username}` : 'this user'), [username]);

  if (!viewerId || viewerId === targetId) return null; // no controls when logged out or self

  async function onBlock() {
    setBusy(true);
    const { error } = await blockUser(supabase, targetId);
    setBusy(false);
    if (error) return alert(error.message);
    setIBlocked(true);
    setOpen(false);
    broadcastBlockSync();
  }

  async function onUnblock() {
    setBusy(true);
    const { error } = await unblockUser(supabase, targetId);
    setBusy(false);
    if (error) return alert(error.message);
    setIBlocked(false);
    setOpen(false);
    broadcastBlockSync();
  }

  async function onMute() {
    setBusy(true);
    const { error } = await muteUser(supabase, targetId);
    setBusy(false);
    if (error) return alert(error.message);
    setIMuted(true);
    setOpen(false);
    broadcastBlockSync();
  }

  async function onUnmute() {
    setBusy(true);
    const { error } = await unmuteUser(supabase, targetId);
    setBusy(false);
    if (error) return alert(error.message);
    setIMuted(false);
    setOpen(false);
    broadcastBlockSync();
  }

  // ---------- MENU MODE ----------
  if (asMenu) {
    return (
      <div className={className} data-ignore-context>
        <div className="relative inline-block text-left">
          <button
            ref={btnRef}
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
            disabled={busy}
            aria-haspopup="menu"
            aria-expanded={open}
            className="px-2.5 py-1.5 rounded bg-white/10 hover:bg-white/15 text-sm"
            title="More actions"
          >
            ⋯
          </button>

          {open && (
            <div
              ref={menuRef}
              role="menu"
              aria-orientation="vertical"
              tabIndex={-1}
              className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-lg border border-white/10 bg-neutral-900/98 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Block / Unblock */}
              <button
                role="menuitem"
                onClick={iBlocked ? onUnblock : onBlock}
                disabled={busy}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-white/10 ${
                  iBlocked ? 'text-white/90' : 'text-red-300'
                } disabled:opacity-50`}
                title={iBlocked ? undefined : (blockedMe ? 'They already blocked you' : undefined)}
              >
                {iBlocked ? `Unblock ${label}` : `Block ${label}`}
              </button>

              {/* Mute / Unmute */}
              <button
                role="menuitem"
                onClick={iMuted ? onUnmute : onMute}
                disabled={busy}
                className="w-full text-left px-3 py-2 text-sm text-white/90 hover:bg-white/10 disabled:opacity-50"
              >
                {iMuted ? `Unmute ${label}` : `Mute ${label}`}
              </button>

              {/* Info row */}
              {blockedMe && (
                <div className="px-3 py-2 text-xs text-white/50 border-t border-white/10">
                  You’re blocked by {label}.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------- INLINE BUTTONS ----------
  return (
    <div className={className} data-ignore-context>
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