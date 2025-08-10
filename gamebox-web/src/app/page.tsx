// src/app/page.tsx
import { createClient } from '@supabase/supabase-js';

export default async function Home() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: games, error } = await supabase
    .from('games')
    .select('id,name,cover_url')
    .order('name');

  if (error) return <pre>Failed to load games: {error.message}</pre>;

  return (
    <main className="p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
      {games?.map((g) => (
        <a key={g.id} href={`/game/${g.id}`} className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={g.cover_url ?? ''} alt={g.name} className="rounded" />
          <p className="mt-2 text-sm">{g.name}</p>
        </a>
      ))}
    </main>
  );
}