# GameBox Web

A Next.js web application for managing your game library and reviews.

## API Endpoints

### Search
- `GET /api/search?q=<query>&limit=<number>` - Search for games via IGDB and upsert to database

### Games Management
- `POST /api/seed-games` - Bulk import games by name (requires `x-seed-secret` header)
- `POST /api/backfill-games` - One-time backfill of existing games missing summary/cover data

### Backfill Games Endpoint

The `/api/backfill-games` endpoint helps populate missing data for existing games in your database. It:

1. Finds games missing summary or cover data
2. Refetches them from IGDB by name
3. Updates only the missing fields (preserves existing data)
4. Includes rate limiting to be respectful to IGDB

**Usage:**
```bash
curl -X POST https://YOUR_HOST/api/backfill-games
```

**Response:**
```json
{
  "updated": 42
}
```

This endpoint is useful for one-time data enrichment of your existing game database.

## Environment Variables

Required environment variables:
- `IGDB_CLIENT_ID` - IGDB API client ID
- `IGDB_CLIENT_SECRET` - IGDB API client secret
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `SEED_SECRET` - Secret key for seed-games endpoint (optional)

## Development

```bash
npm install
npm run dev
```

## Features

- **Collapsed Editions**: Search results prefer base titles over remasters/ports
- **Rich Game Data**: Stores summaries, release years, aliases, and cover images
- **Smart Upserts**: Never overwrites existing data with null values
- **Rate Limiting**: Respectful API usage with built-in throttling
