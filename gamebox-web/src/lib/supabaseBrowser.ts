// src/lib/supabaseBrowser.ts
'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const globalForSupabase = globalThis as unknown as {
  __gamebox_supabase?: SupabaseClient;
};

function newClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,     // ✅ let the SDK parse #access_token
        storageKey: 'gamebox-auth',
      },
    }
  );
}

export const supabaseBrowser = () =>
  (globalForSupabase.__gamebox_supabase ??= newClient());