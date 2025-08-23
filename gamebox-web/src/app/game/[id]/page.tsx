// app/game/[id]/page.tsx
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import GamePageClient from './GamePageClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Fallback live aggregate function for when materialized view doesn't exist
async function getCommunityStatsFallback(gameId: number) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase
    .from('reviews')
    .select('rating')
    .eq('game_id', gameId);

  if (error) {
    console.error('reviews aggregate error', error);
    return { count: 0, avg5: 0 };
  }

  const list = (data ?? []).map(r => Number(r.rating) || 0);
  const count = list.length;
  const avg100 = count ? list.reduce((a, b) => a + b, 0) / count : 0;

  const avg5 = Number((avg100 / 20).toFixed(1));
  return { count, avg5 };
}

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { id } = await params;
  const gameId = Number(id);
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

    // pass the child *page id* so we can highlight it on the parent
    if (parent?.id && parent.id !== game.id) {
      redirect(`/game/${parent.id}?edition=${gameId}`);
    }
  }

  // Editions for parent page
  const { data: editions } = await supabase
    .from('games')
    .select('id, name, cover_url, release_year')
    .eq('parent_igdb_id', game.igdb_id)
    .order('release_year', { ascending: false })
    .order('name');

  // Try materialized view first, fallback to live aggregate
  let count = 0;
  let avg5 = 0;
  
  try {
    const { data: stats } = await supabase
      .from('game_rating_stats')
      .select('review_count, avg_rating_100')
      .eq('game_id', gameId)
      .maybeSingle();

    count = stats?.review_count ?? 0;
    avg5 = count ? Number(((Number(stats!.avg_rating_100) || 0) / 20).toFixed(1)) : 0;
  } catch (error) {
    // Materialized view doesn't exist yet, use fallback
    console.log('Materialized view not found, using live aggregate fallback');
    const fallback = await getCommunityStatsFallback(gameId);
    count = fallback.count;
    avg5 = fallback.avg5;
  }

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
      initialStats={{
        ratingsCount: count,
        avgStars: count > 0 ? avg5 : null,
      }}
    />
  );
}