// src/app/page.tsx
import Link from 'next/link';
import WhoToFollow from '@/components/WhoToFollow';
import { createClient } from '@supabase/supabase-js';

export default async function Home() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: games, error } = await supabase
    .from('games')
    .select('id,name,cover_url')
    .order('name', { ascending: true })
    .limit(32);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        {/* Left: game grid */}
        <section className="min-w-0">
          <h1 className="text-2xl font-bold mb-4">Popular games</h1>

          {error ? (
            <pre className="text-red-400 text-sm">
              Failed to load games: {error.message}
            </pre>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {(games ?? []).map((g) => (
                <a key={g.id} href={`/game/${g.id}`} className="block group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={g.cover_url ?? ''}
                    alt={g.name}
                    className="rounded border border-white/10 group-hover:border-white/20 transition-colors"
                  />
                  <p className="mt-2 text-sm text-white/90 truncate">{g.name}</p>
                </a>
              ))}
            </div>
          )}
        </section>

        {/* Right: feed CTA + suggestions */}
        <aside className="lg:sticky lg:top-16 space-y-4">
          <div className="rounded-lg border border-white/10 bg-neutral-900/70 p-4">
            <h2 className="font-semibold mb-1">Your feed</h2>
            <p className="text-sm text-white/70 mb-3">
              Follow players to see what they’re rating and reviewing.
            </p>
            <div className="flex gap-2">
              <Link href="/feed" className="bg-indigo-600 text-white px-3 py-1 rounded">
                Open feed
              </Link>
              <Link href="/search" className="bg-white/10 px-3 py-1 rounded">
                Find games
              </Link>
            </div>
          </div>

          <WhoToFollow limit={6} />
        </aside>
      </div>
    </main>
  );
}