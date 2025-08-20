// src/components/search/SearchPageClient.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import {
  parseQuery,
  rpcSearchGames,
  rpcSearchUsers,
  nextToken,
  type Scope,
  type SearchUser,
  type SearchGame,
} from '@/lib/search';
import { SearchIcon, XMarkIcon } from '@/components/icons';

export default function SearchPageClient() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const sp = useSearchParams();

  // URL state
  const qParam = sp.get('q') ?? '';
  const scopeParam = (sp.get('scope') as Scope) ?? 'all';

  // UI state
  const [q, setQ] = useState(qParam);
  const [scope, setScope] = useState<Scope>(scopeParam);
  const [busy, setBusy] = useState(false);
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [games, setGames] = useState<SearchGame[]>([]);
  const reqRef = useRef<number>(0);

  // derive “@” / “game:” bias
  const derived = useMemo(() => parseQuery(q), [q]);
  const effScope: Scope =
    scope === 'all' && derived.scopeBias !== 'all' ? derived.scopeBias : scope;

  // keep URL in sync (shallow)
  useEffect(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (scope !== 'all') params.set('scope', scope);
    const qs = params.toString();
    router.replace(qs ? `/search?${qs}` : '/search', { scroll: false });
  }, [q, scope, router]);

  // perform search (debounced + race-proof)
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setUsers([]);
      setGames([]);
      setBusy(false);
      return;
    }

    setBusy(true);
    const t = nextToken();
    reqRef.current = t;

    const wantUsers = effScope === 'all' || effScope === 'users';
    const wantGames = effScope === 'all' || effScope === 'games';

    const timer = setTimeout(() => {
      Promise.all([
        wantUsers ? rpcSearchUsers(supabase, derived.q, 20) : Promise.resolve([]),
        wantGames ? rpcSearchGames(supabase, derived.q, 20) : Promise.resolve([]),
      ])
        .then(([u, g]) => {
          if (reqRef.current !== t) return; // a newer request finished
          setUsers(u);
          setGames(g);
          setBusy(false);
        })
        .catch(() => {
          if (reqRef.current !== t) return;
          setUsers([]);
          setGames([]);
          setBusy(false);
        });
    }, 250);

    return () => clearTimeout(timer);
  }, [q, effScope, supabase, derived.q]);

  // helpers
  const hasUsers = effScope !== 'games' && users.length > 0;
  const hasGames = effScope !== 'users' && games.length > 0;
  const nothing = !busy && !hasUsers && !hasGames && q.trim().length >= 2;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">Search</h1>

      {/* Input + scope */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <div className="flex items-center rounded-lg bg-white/10 focus-within:ring-2 focus-within:ring-indigo-500 w-full sm:w-auto">
        <span className="pl-2 pr-1 self-center text-white/60">
  <SearchIcon className="h-4 w-4" />
</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search games or players…"
            className="bg-transparent px-2 py-2 outline-none w-full sm:w-[420px]"
            aria-label="Search"
          />
          {q && (
  <button
    onClick={() => setQ('')}
    className="px-2 text-white/60 hover:text-white"
    aria-label="Clear"
    type="button"
  >
    <XMarkIcon className="h-4 w-4" />
  </button>
)}
        </div>

        <div className="flex items-center gap-1">
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
      </div>

      {busy && <p className="mt-3 text-sm text-white/60">Searching…</p>}

      {/* USERS */}
      {hasUsers && (
        <section className="mt-6">
          <div className="text-xs uppercase tracking-wide text-white/40 mb-2">Players</div>
          <ul className="space-y-2">
            {users.map(u => {
              const href = u.username ? `/u/${u.username}` : '#';
              return (
                <li key={u.id}>
                  <Link
                    href={href}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/5"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={u.avatar_url || '/avatar-placeholder.svg'}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover border border-white/10"
                    />
                    <div className="min-w-0">
                      <div className="text-sm text-white truncate">
                        {u.display_name || u.username || 'Player'}
                      </div>
                      {u.username && (
                        <div className="text-xs text-white/50 truncate">@{u.username}</div>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* GAMES */}
      {hasGames && (
        <section className="mt-8">
          <div className="text-xs uppercase tracking-wide text-white/40 mb-2">Games</div>
          <ul className="space-y-2">
            {games.map(g => (
              <li key={g.id}>
                <Link
                  href={`/game/${g.id}`}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/5"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={g.cover_url || '/cover-fallback.png'}
                    alt={g.name}
                    className="h-10 w-8 rounded object-cover border border-white/10"
                  />
                  <div className="text-sm text-white truncate">{g.name}</div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {nothing && (
        <p className="mt-6 text-white/60">
          No results. Tip: try <code className="text-white/70">game: elden</code> or <code className="text-white/70">@name</code>.
        </p>
      )}
    </main>
  );
}