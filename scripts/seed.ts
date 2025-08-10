// scripts/seed.ts
//--------------------------------------------------
// 0.  Load environment variables from .env
//--------------------------------------------------
import 'dotenv/config';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

//--------------------------------------------------
// 1.  Get a 60-day Twitch “app access token”
//--------------------------------------------------
async function getIgdbToken() {
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID!,
      client_secret: process.env.TWITCH_CLIENT_SECRET!,
      grant_type: 'client_credentials',
    }),
  });

  if (!res.ok) {
    throw new Error(`Twitch auth failed: ${res.status} ${await res.text()}`);
  }

  const { access_token } = (await res.json()) as { access_token: string };
  return access_token;
}

//--------------------------------------------------
// 2.  Fetch 50 well-rated games from IGDB
//--------------------------------------------------
async function fetchTopGames(token: string) {
  const query = `
    fields id,name,cover.url,summary;
    sort rating desc;
    where rating != null & cover != null;
    limit 50;
  `;

  const res = await fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: {
      'Client-ID': process.env.TWITCH_CLIENT_ID!,
      Authorization: `Bearer ${token}`,
    },
    body: query,
  });

  if (!res.ok) {
    throw new Error(`IGDB fetch failed: ${res.status} ${await res.text()}`);
  }

  return (await res.json()) as Array<{
    id: number;
    name: string;
    cover: { url: string };
    summary?: string;
  }>;
}

//--------------------------------------------------
// 3.  Upsert into Supabase (idempotent on igdb_id)
//--------------------------------------------------
async function main() {
  console.log('👋 seed.ts started');

  const token = await getIgdbToken();
  const games = await fetchTopGames(token);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY! // service-role key
  );

  const rows = games.map((g) => {
    // upgrade thumbnail size + normalize protocol
    let cover = g.cover?.url?.replace('t_thumb', 't_cover_big') ?? null;
    if (cover && cover.startsWith('//')) cover = `https:${cover}`;

    return {
      igdb_id: g.id,
      name: g.name,
      cover_url: cover,
      summary: g.summary ?? null,
    };
  });

  // ⚠️ The key bit: make upsert use the unique "igdb_id" constraint
  const { error } = await supabase
    .from('games')
    .upsert(rows, { onConflict: 'igdb_id' }); // or add ignoreDuplicates: true to skip updates

  if (error) throw error;

  console.log(`✅ Seeded/updated ${rows.length} games`);
}

main().catch((err) => {
  console.error('❌ Seed failed', err);
  process.exit(1);
});