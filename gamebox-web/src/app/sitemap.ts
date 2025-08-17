// app/sitemap.ts
import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

// Optional: revalidate the sitemap hourly
export const revalidate = 60 * 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://example.com';

  // Query Supabase with anon key on the server. RLS must allow public reads.
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let games: { id: number; updated_at: string | null }[] = [];
  let profs: { username: string | null; updated_at: string | null }[] = [];

  if (supaUrl && supaAnon) {
    try {
      const supabase = createClient(supaUrl, supaAnon, {
        auth: { persistSession: false }, // no cookies in a route file
      });

      const [g, p] = await Promise.all([
        supabase
          .from('games')
          .select('id,updated_at')
          .order('updated_at', { ascending: false })
          .limit(1000),
        supabase
          .from('profiles')
          .select('username,updated_at')
          .not('username', 'is', null)
          .order('updated_at', { ascending: false })
          .limit(1000),
      ]);

      games = (g.data ?? []) as any;
      profs = (p.data ?? []) as any;
    } catch (err) {
      console.error('sitemap query failed:', err);
    }
  } else {
    console.warn('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  const gameUrls: MetadataRoute.Sitemap = games.map((g) => ({
    url: `${base}/game/${g.id}`,
    lastModified: g.updated_at ?? new Date().toISOString(),
    changeFrequency: 'daily',
    priority: 0.8,
  }));

  const profileUrls: MetadataRoute.Sitemap = profs
    .filter((p) => p.username)
    .map((p) => ({
      url: `${base}/u/${p.username}`,
      lastModified: p.updated_at ?? new Date().toISOString(),
      changeFrequency: 'weekly',
      priority: 0.6,
    }));

  return [
    {
      url: base,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    ...gameUrls,
    ...profileUrls,
  ];
}