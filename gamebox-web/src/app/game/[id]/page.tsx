// app/game/[id]/page.tsx
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import GamePageClient from './GamePageClient';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function GamePage({ params }: { params: { id: string } }) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const gameId = Number(params.id);
  if (!Number.isFinite(gameId)) notFound();

  // Load requested game
  const { data: game, error } = await supabase
    .from('games')
    .select('id, igdb_id, name, summary, cover_url, release_year, parent_igdb_id')
    .eq('id', gameId)
    .single();

  if (error) notFound();
  if (!game) notFound();

  // If child edition, hop to parent
  if (game.parent_igdb_id) {
    const { data: parent } = await supabase
      .from('games')
      .select('id')
      .eq('igdb_id', game.parent_igdb_id)
      .single();

    if (parent?.id && parent.id !== game.id) {
      redirect(`/game/${parent.id}`);
    }
  }

  // Editions for parent page
  const { data: editions } = await supabase
    .from('games')
    .select('id, name, cover_url, release_year')
    .eq('parent_igdb_id', game.igdb_id)
    .order('release_year', { ascending: false })
    .order('name');

  return (
    <GamePageClient
      gameId={game.id}
      editions={editions ?? []}
      initialGame={{
        id: game.id,
        name: game.name,
        summary: game.summary,
        cover_url: game.cover_url,
        // optional: if you later want initial reviews, add them here too
      }}
    />
  );
}