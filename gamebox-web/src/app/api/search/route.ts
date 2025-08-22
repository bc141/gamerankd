// src/app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
    const limit = Number(req.nextUrl.searchParams.get('limit') ?? '10');
    if (!q) return NextResponse.json({ items: [], meta: { route: 'v2' } });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase.rpc('game_search_v2', { q, lim: limit });

    if (error) {
      return NextResponse.json({ items: [], error: error.message, meta: { route: 'v2' } }, { status: 500 });
    }

    return NextResponse.json({ items: data ?? [], meta: { route: 'v2' } });
  } catch (e: any) {
    return NextResponse.json({ items: [], error: String(e?.message ?? e), meta: { route: 'v2' } }, { status: 400 });
  }
}