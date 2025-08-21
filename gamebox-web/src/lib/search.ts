// src/lib/search.ts
import { SupabaseClient } from '@supabase/supabase-js';

export type SearchUser = { id: string; username: string | null; display_name: string | null; avatar_url: string | null; score: number };
export type SearchGame = { id: number; name: string; cover_url: string | null; score: number };

export type Scope = 'all' | 'users' | 'games';

export function parseQuery(raw: string): { q: string; scopeBias: Scope } {
  let q = (raw ?? '').trim();
  if (q.startsWith('@')) return { q: q.slice(1), scopeBias: 'users' };

  const m = q.match(/^(user|users|game|games):(.*)$/i);
  if (m) {
    const tag = m[1].toLowerCase();
    q = m[2].trim();
    return { q, scopeBias: tag.startsWith('game') ? 'games' : 'users' };
  }

  return { q, scopeBias: 'all' };
}

let token = 0;
export function nextToken() { token += 1; return token; }

export async function rpcSearchUsers(supabase: SupabaseClient, q: string, limit = 8): Promise<SearchUser[]> {
  if (!q) return [];
  const { data, error } = await supabase.rpc('search_users', { q, limit_n: limit });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: String(r.id),
    username: r.username ?? null,
    display_name: r.display_name ?? null,
    avatar_url: r.avatar_url ?? null,
    score: Number(r.score ?? 0),
  }));
}

export async function rpcSearchGames(supabase: SupabaseClient, q: string, limit = 8): Promise<SearchGame[]> {
  if (!q) return [];
  const { data, error } = await supabase.rpc('search_games', { q, limit_n: limit });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: Number(r.id),
    name: String(r.name ?? ''),
    cover_url: r.cover_url ?? null,
    score: Number(r.score ?? 0),
  }));
}