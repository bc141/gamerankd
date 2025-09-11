import { SupabaseClient } from '@supabase/supabase-js';

export type LibraryStatus = 'Backlog' | 'Playing' | 'Completed' | 'Dropped';
export const LIBRARY_STATUSES: LibraryStatus[] = ['Backlog','Playing','Completed','Dropped'];

export async function getMyLibraryForGame(
  supabase: SupabaseClient,
  userId: string,
  gameId: number
) {
  const { data, error } = await supabase
    .from('library')
    .select('status, updated_at')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .maybeSingle();

  if (error) return { status: null as LibraryStatus | null, error };
  return { status: (data?.status as LibraryStatus) ?? null, error: null };
}

export async function setLibraryStatus(
  supabase: SupabaseClient,
  userId: string,
  gameId: number,
  status: LibraryStatus
) {
  const { error } = await supabase
    .from('library')
    .upsert({ user_id: userId, game_id: gameId, status }, { onConflict: 'user_id,game_id' });
  return { error };
}

export async function removeFromLibrary(
  supabase: SupabaseClient,
  userId: string,
  gameId: number
) {
  const { error } = await supabase
    .from('library')
    .delete()
    .eq('user_id', userId)
    .eq('game_id', gameId);
  return { error };
}