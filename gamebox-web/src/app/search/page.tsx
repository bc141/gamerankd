'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

type Game = { id: number; name: string; cover_url: string | null };

export default function SearchPage() {
  const supabase = supabaseBrowser();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);

  // simple debounce
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canSearch = useMemo(() => q.trim().length >= 2, [q]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!canSearch) {
      setRows([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      const term = q.trim();
      // ILIKE for case-insensitive search; limit for safety
      const { data, error } = await supabase
        .from('games')
        .select('id,name,cover_url')
        .ilike('name', `%${term}%`)
        .limit(20);
      setLoading(false);
      if (!error) setRows((data ?? []) as Game[]);
    }, 200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold mb-4">Search games</h1>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Type at least 2 characters…"
        className="w-full border border-white/20 bg-neutral-900 text-white rounded px-3 py-2"
      />

      {loading && <p className="mt-3 text-sm text-white/60">Searching…</p>}

      <ul className="mt-6 space-y-3">
        {rows.map(g => (
          <li key={g.id} className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={g.cover_url ?? ''} alt={g.name} className="h-16 w-12 object-cover rounded" />
            <Link href={`/game/${g.id}`} className="hover:underline">{g.name}</Link>
          </li>
        ))}
      </ul>

      {!loading && canSearch && rows.length === 0 && (
        <p className="mt-4 text-white/60">No matches.</p>
      )}
    </main>
  );
}