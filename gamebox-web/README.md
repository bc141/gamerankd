# GameBox Web

A Next.js web application for managing your game library and reviews.

## API Endpoints

### Search
- `GET /api/search?q=<query>&limit=<number>` - Search for games via IGDB and upsert to database

### Games Management
- `POST /api/seed-games` - Bulk import games by name (requires `x-seed-secret` header)
- `POST /api/backfill-games` - One-time backfill of existing games missing summary/cover data

### Backfill Games Endpoint

The `/api/backfill-games` endpoint helps populate missing data and establish parent-child relationships for existing games in your database. It:

1. **Parent-Child Relationships**: Finds games without `parent_igdb_id` and queries IGDB to establish edition relationships
2. **Data Enrichment**: Can also refetch missing summary/cover data from IGDB
3. **Smart Updates**: Only updates fields that are actually missing (preserves existing data)
4. **Rate Limiting**: Includes throttling to be respectful to IGDB

**Usage:**
```bash
# Establish parent-child relationships (default)
curl -X POST https://YOUR_HOST/api/backfill-games \
  -H "Content-Type: application/json" \
  -d '{"op": "parents", "limit": 200}'

# Dry run to see what would be updated
curl -X POST https://YOUR_HOST/api/backfill-games \
  -H "Content-Type: application/json" \
  -d '{"op": "parents", "limit": 200, "dryRun": true}'
```

**Response:**
```json
{
  "updated": 42,
  "scanned": 200
}
```

This endpoint is essential for establishing the edition hierarchy that enables the collapsed search results.

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

- **Collapsed Editions**: Search results automatically group editions by canonical parent, showing only the best version
- **Rich Game Data**: Stores summaries, release years, aliases, cover images, and parent-child relationships
- **Smart Upserts**: Never overwrites existing data with null values
- **Rate Limiting**: Respectful API usage with built-in throttling
- **Edition Management**: Tracks parent-child relationships between base games and remasters/ports
- AI loop validation Wed Sep 10 23:53:54 CEST 2025
- AI loop validation Wed Sep 10 23:54:02 CEST 2025
