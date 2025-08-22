// src/lib/search.ts

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

export async function apiSearchUsers(q: string, limit = 8): Promise<SearchUser[]> {
  if (!q) return [];
  
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=${limit}`, {
      cache: 'no-store',
      next: { revalidate: 0 },
    });
    const { items } = await res.json();
    
    // Transform API response to match SearchUser type
    return (items || []).map((r: any) => ({
      id: String(r.id),
      username: r.username ?? null,
      display_name: r.display_name ?? null,
      avatar_url: r.avatar_url ?? null,
      score: Number(r.score ?? 0),
    }));
  } catch (error) {
    console.error('User search error:', error);
    return [];
  }
}

export async function apiSearchGames(q: string, limit = 8): Promise<SearchGame[]> {
  if (!q) return [];
  
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=${limit}`, {
      cache: 'no-store',
      next: { revalidate: 0 },
    });
    const { items } = await res.json();
    
    // Transform API response to match SearchGame type
    return (items || []).map((r: any) => ({
      id: Number(r.id),
      name: String(r.name ?? ''),
      cover_url: r.cover_url ?? null,
      score: Number(r.score ?? 0),
    }));
  } catch (error) {
    console.error('Game search error:', error);
    return [];
  }
}