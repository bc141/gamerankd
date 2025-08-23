import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(req: NextRequest) {
  const section = (req.nextUrl.searchParams.get('section') ?? 'popular').toLowerCase();
  const lim = Number(req.nextUrl.searchParams.get('limit') ?? '20');
  const off = Number(req.nextUrl.searchParams.get('offset') ?? '0');

  const sb = createClient(SB_URL, SB_SERVICE);
  const { data, error } = await sb.rpc('browse_games', { section, lim, off });
  if (error) return NextResponse.json({ items: [], error: error.message }, { status: 500 });

  return NextResponse.json({ items: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}