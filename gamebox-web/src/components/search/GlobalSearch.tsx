'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

type Result = {
  kind: 'user' | 'game';
  id: string;       // text
  label: string | null;
  sublabel: string | null;
  image_url: string | null;
  rank: number | null;
};

export default function GlobalSearch({ className }: { className?: string }) {
  const supabase = supabaseBrowser();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Result[]>([]);
  const [idx, setIdx] = useState<number>(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQ = useDebounce(q, 250);
  const canSearch = debouncedQ.trim().length >= 2;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!canSearch) {
        if (!cancelled) setRows([]);
        return;
      }
      setLoading(true);
      const { data, error } = await supabase.rpc('search_all', { q: debouncedQ, lim: 8 });
      if (!cancelled) {
        setRows((data as Result[]) ?? []);
        setLoading(false);
        setOpen(true);
        setIdx(-1);
      }
      if (error) {
        // eslint-disable-next-line no-console
        console.error('search_all error', error);
      }
    })();
    return () => { cancelled = true; };
  }, [debouncedQ, supabase, canSearch]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || rows.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIdx((i) => Math.min(i + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && idx >= 0) {
      e.preventDefault();
      const r = rows[idx];
      go(r);
    } else if (e.key === 'Escape') {
      setOpen(false);
      (e.target as HTMLInputElement).blur();
    }
  }

  function go(r: Result) {
    const href = r.kind === 'user'
      ? (r.sublabel?.startsWith('@') ? `/u/${r.sublabel.slice(1)}` : '#')
      : `/game/${r.id}`;
    window.location.href = href;
  }

  // Close on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div ref={boxRef} className={`relative ${className ?? ''}`}>
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => q.length >= 1 && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search games or players…"
        className="w-72 md:w-96 rounded-lg border border-white/15 bg-neutral-900 px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        aria-label="Search"
        autoComplete="off"
      />

      {open && (loading || rows.length > 0 || (canSearch && !loading)) && (
        <div
          className="absolute z-50 mt-2 w-full rounded-lg border border-white/10 bg-neutral-900 shadow-xl overflow-hidden"
          role="listbox"
        >
          {loading ? (
            <div className="px-3 py-2 text-sm text-white/60">Searching…</div>
          ) : rows.length === 0 ? (
            <div className="px-3 py-2 text-sm text-white/50">No results.</div>
          ) : (
            <ul>
              {rows.map((r, i) => {
                const active = i === idx;
                const href =
                  r.kind === 'user'
                    ? (r.sublabel?.startsWith('@') ? `/u/${r.sublabel.slice(1)}` : '#')
                    : `/game/${r.id}`;
                return (
                  <li
                    key={`${r.kind}-${r.id}-${i}`}
                    role="option"
                    aria-selected={active}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${active ? 'bg-white/10' : 'hover:bg-white/5'}`}
                    onMouseEnter={() => setIdx(i)}
                    onMouseDown={(e) => { e.preventDefault(); }}  // avoid input blur before click
                    onClick={() => go(r)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={r.image_url || (r.kind === 'user' ? '/avatar-placeholder.svg' : '/cover-fallback.png')}
                      alt=""
                      className={`h-7 w-7 rounded ${r.kind === 'game' ? 'object-cover border border-white/10' : 'object-cover border border-white/10'}`}
                    />
                    <div className="min-w-0">
                      <div className="text-sm text-white truncate">{r.label || (r.kind === 'user' ? 'Player' : 'Game')}</div>
                      {r.sublabel && <div className="text-xs text-white/50 truncate">{r.sublabel}</div>}
                    </div>
                    <span className="ml-auto text-[10px] uppercase text-white/30">{r.kind}</span>
                    <Link href={href} className="sr-only">Open</Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function useDebounce<T>(val: T, ms = 250) {
  const [v, setV] = useState(val);
  useEffect(() => {
    const t = setTimeout(() => setV(val), ms);
    return () => clearTimeout(t);
  }, [val, ms]);
  return v;
}