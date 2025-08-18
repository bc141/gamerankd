// src/lib/supabaseBrowser.ts
'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * We stash a single Supabase client on globalThis so the module can be
 * imported in multiple places without creating duplicate clients or
 * duplicate auth listeners.
 */
const globalForSupabase = globalThis as unknown as {
  __gamebox_supabase?: SupabaseClient;
  __gamebox_supabase_auth_bound?: boolean;
};

function newClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // allow parsing #access_token on callback
        storageKey: 'gamebox-auth',
      },
    }
  );
}

/**
 * Returns the singleton browser client.
 * Also exposes it as window.__supabase for easy prod-console debugging,
 * and sets up ONE cross-tab auth sync broadcaster.
 */
export function supabaseBrowser(): SupabaseClient {
  const client =
    (globalForSupabase.__gamebox_supabase ??=
      newClient());

  // Browser-only helpers
  if (typeof window !== 'undefined') {
    // Debug handle: run `window.__supabase` in the console
    (window as any).__supabase = client;

    // One-time auth change broadcaster for cross-tab sync
    if (!globalForSupabase.__gamebox_supabase_auth_bound) {
      client.auth.onAuthStateChange(() => {
        try {
          localStorage.setItem('gb-auth-sync', String(Date.now()));
        } catch {
          /* no-op */
        }
      });
      globalForSupabase.__gamebox_supabase_auth_bound = true;
    }
  }

  return client;
}

export type { SupabaseClient };