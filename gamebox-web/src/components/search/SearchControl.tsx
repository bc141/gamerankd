'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { parseQuery, rpcSearchGames, rpcSearchUsers, nextToken, type Scope, type SearchGame, type SearchUser } from '@/lib/search';

type Props = {
  className?: string;
};

export default function SearchControl({ className }: Props) {
  const supabase = supabaseBrowser();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Scope>('all');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [games, setGames] = useState<SearchGame[]>([]);
  const [activeIdx, setActiveIdx] = useState<number>(-1); // arrow nav
  const focusRef = useRef<HTMLInputElement>(null);
  const reqRef = useRef<number>(0);

  // keyboard: "/" focus, Esc close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !/input|textarea/i.test((document.activeElement?.tagName ?? ''))) {
        e.preventDefault();
        focusRef.current?.focus();
      }
      if (e.key === 'Escape') setOpen(false);
      // quick scope hotkeys
      if ((e.metaKey || e.ctrlKey) && e.key === '1') setScope('all');
      if ((e.metaKey || e.ctrlKey) && e.key === '2') setScope('games');
      if ((e.metaKey || e.ctrlKey) && e.key === '3') setScope('users');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // derive bias from operators
  const derived = useMemo(() => parseQuery(q), [q]);

  // run search (debounced + out-of-order safe)
  useEffect(() => {
    const raw = q.trim();
    if (raw.length < 2) {
      setUsers([]); setGames([]); setBusy(false);
      return;
    }

    setBusy(true);
    const t = nextToken();
    reqRef.current = t;

    const doUsers = (scope === 'all' || scope === 'users') ? rpcSearchUsers(supabase, derived.q, 5) : Promise.resolve([]);
    const doGames = (scope === 'all' || scope === 'games') ? rpcSearchGames(supabase, derived.q, 5) : Promise.resolve([]);

    const h = setTimeout(() => {
      Promise.all([doUsers, doGames])
        .then(([u, g]) => {
          if (reqRef.current !== t) return; // a newer request finished
          setUsers(u);
          setGames(g);
          setActiveIdx(-1);
          setBusy(false);
          setOpen(true);
        })
        .catch(() => {
          if (reqRef.current !== t) return;
          setUsers([]); setGames([]); setBusy(false);
        });
    }, 250);

    return () => clearTimeout(h);
  }, [q, scope, supabase, derived.q]);

  // computed rows for keyboard nav (linearize)
  const linear: Array<{ type: 'user' | 'game'; key: string }> = useMemo(() => {
    const rows: Array<{ type: 'user' | 'game'; key: string }> = [];
    if (scope !== 'games') users.forEach(u => rows.push({ type: 'user', key: u.id }));
    if (scope !== 'users') games.forEach(g => rows.push({ type: 'game', key: String(g.id) }));
    return rows;
  }, [users, games, scope]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) setOpen(true);
    if (!open) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(linear.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(-1, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = linear[activeIdx];
      if (!row) return;
      if (row.type === 'user') {
        const u = users.find(x => x.id === row.key);
        if (u) window.location.href = u.username ? `/u/${u.username}` : '#';
      } else {
        const g = games.find(x => String(x.id) === row.key);
        if (g) window.location.href = `/game/${g.id}`;
      }
    }
  }

  const effScope = scope === 'all' && derived.scopeBias !== 'all' ? derived.scopeBias : scope;

  return (
    <div className={`relative ${className ?? ''}`} data-ignore-context>
      <div className="flex items-center gap-2">
        <div className="flex rounded-lg bg-white/10 focus-within:ring-2 focus-within:ring-indigo-500">
          <span className="pl-2 pr-1 self-center">🔍</span>
          <input
            ref={focusRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            onFocus={() => q.trim().length >= 2 && setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Search games or players…"
            className="bg-transparent px-2 py-1.5 outline-none w-64"
            aria-label="Search"
          />
          {q && (
            <button onClick={() => { setQ(''); setOpen(false); }} className="px-2 text-white/60 hover:text-white" aria-label="Clear">✕</button>
          )}
        </div>

        {/* scope chips (appear after typing) */}
        {q.trim().length >= 1 && (
          <div className="hidden sm:flex items-center gap-1">
            {(['all','games','users'] as Scope[]).map(s => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`px-2 py-1 rounded text-sm ${effScope===s ? 'bg-white/15 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                aria-pressed={effScope===s}
              >
                {s === 'all' ? 'All' : s === 'games' ? 'Games' : 'Users'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* dropdown */}
      {open && (users.length || games.length || busy) && (
        <div
          className="absolute z-50 mt-2 w-[520px] max-w-[90vw] rounded-lg border border-white/10 bg-neutral-900 shadow-xl p-2"
          onMouseDown={e => e.preventDefault()} /* keep input focus */
        >
          {busy && <div className="px-3 py-2 text-sm text-white/60">Searching…</div>}

          {/* USERS */}
          {effScope !== 'games' && users.length > 0 && (
            <div className="py-1">
              <div className="px-3 pb-1 text-xs uppercase tracking-wide text-white/40">Players</div>
              <ul>
                {users.map((u, idx) => {
                  const active = linear[activeIdx]?.type === 'user' && linear[activeIdx]?.key === u.id;
                  const href = u.username ? `/u/${u.username}` : '#';
                  return (
                    <li key={u.id}>
                      <Link
                        href={href}
                        className={`flex items-center gap-3 px-3 py-2 rounded ${active ? 'bg-white/10' : 'hover:bg-white/5'}`}
                        onClick={() => setOpen(false)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u.avatar_url || '/avatar-placeholder.svg'} alt="" className="h-7 w-7 rounded-full border border-white/10 object-cover" />
                        <div className="min-w-0">
                          <div className="text-sm text-white truncate">{u.display_name || u.username || 'Player'}</div>
                          {u.username && <div className="text-xs text-white/50 truncate">@{u.username}</div>}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* GAMES */}
          {effScope !== 'users' && games.length > 0 && (
            <div className="py-1 border-t border-white/10">
              <div className="px-3 pb-1 text-xs uppercase tracking-wide text-white/40">Games</div>
              <ul>
                {games.map((g) => {
                  const active = linear[activeIdx]?.type === 'game' && linear[activeIdx]?.key === String(g.id);
                  return (
                    <li key={g.id}>
                      <Link
                        href={`/game/${g.id}`}
                        className={`flex items-center gap-3 px-3 py-2 rounded ${active ? 'bg-white/10' : 'hover:bg-white/5'}`}
                        onClick={() => setOpen(false)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={g.cover_url || '/cover-fallback.png'} alt="" className="h-10 w-8 rounded object-cover border border-white/10" />
                        <div className="text-sm text-white truncate">{g.name}</div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {(!users.length && !games.length && !busy) && (
            <div className="px-3 py-2 text-sm text-white/60">
              No results. Tip: try <code className="text-white/70">game: Elden</code> or <code className="text-white/70">@name</code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}