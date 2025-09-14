// src/app/discover/page.tsx
import Image from 'next/image';
import Link from 'next/link';
import { siteUrl } from '@/lib/site';

type Game = {
  id: number;
  name: string;
  cover_url: string | null;
  release_year: number | null;
  preview?: string | null;
};

async function fetchSections(sections = ['trending','new','top'] as const) {
  const res = await fetch(`${siteUrl()}/api/games/browse?sections=${sections.join(',')}&limit=12`, {
    cache: 'no-store',
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error('browse failed');
  return (await res.json()).sections as Record<typeof sections[number], Game[]>;
}

function Row({ title, games }: { title: string; games: Game[] }) {
  if (!games?.length) return null;
  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {/* <Link href={`/discover/${title.toLowerCase()}`} className="text-sm text-white/70 hover:text-white">See all</Link> */}
      </div>
      <ul className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {games.map(g => (
          <li key={g.id}>
            <Link href={`/game/${g.id}`} className="block rounded hover:bg-white/5 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={g.cover_url || '/cover-fallback.png'}
                alt=""
                className="w-full aspect-[3/4] object-cover rounded border border-white/10"
                loading="lazy"
                decoding="async"
              />
              <div className="mt-2 text-sm text-white truncate">{g.name}</div>
              {g.release_year && <div className="text-xs text-white/50">{g.release_year}</div>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function DiscoverPage() {
  const sections = await fetchSections();

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-2xl font-bold text-white mb-6">Discover</h1>
      <Row title="Trending this week" games={sections.trending} />
      <Row title="New & noteworthy" games={sections.new} />
      <Row title="Top rated (recent)" games={sections.top} />
    </main>
  );
}