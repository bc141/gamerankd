'use client';

import { useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

export default function AuthCallback() {
  const supabase = supabaseBrowser();

  useEffect(() => {
    (async () => {
      try {
        const url = window.location.href;
        const hash = window.location.hash;

        // 1) Try PKCE first (?code=...)
        let ok = false;
        const tryPkce = async () => {
          const res = await supabase.auth.exchangeCodeForSession(url);
          if (res.data?.session) ok = true;
          return res;
        };

        // 2) If no PKCE session, try hash tokens (#access_token=...)
        const tryHash = async () => {
          if (!hash?.includes('access_token')) return { ok: false };
          const params = new URLSearchParams(hash.slice(1));
          const access_token = params.get('access_token') || undefined;
          const refresh_token = params.get('refresh_token') || undefined;
          if (access_token && refresh_token) {
            const res = await supabase.auth.setSession({ access_token, refresh_token });
            if (res.data?.session) ok = true;
            return { ok: !!res.data?.session };
          }
          return { ok: false };
        };

        // Do PKCE then hash (covers both email link formats)
        await tryPkce();
        if (!ok) await tryHash();

        // 3) Final sanity loop (dev can be slow to persist)
        for (let i = 0; i < 10 && !ok; i++) {
          const s = await supabase.auth.getSession();
          if (s.data.session) ok = true;
          else await new Promise(r => setTimeout(r, 150));
        }

        if (!ok) {
          // Couldn’t set a session; back to login
          window.location.replace('/login');
          return;
        }

        // 4) Ping other tabs and go to onboarding (it will redirect to /u/<name> if present)
        try { localStorage.setItem('gb-auth-sync', String(Date.now())); } catch {}
        window.location.replace('/onboarding/username');
      } catch (e: any) {
        console.error('[auth/callback] fatal:', e?.message || e);
        window.location.replace('/login');
      }
    })();
  }, [supabase]);

  return <main className="p-8">Signing you in…</main>;
}