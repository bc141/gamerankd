'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { waitForSession } from '@/lib/waitForSession';

export default function UsernameOnboarding() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // session gates
  const [me, setMe] = useState<{ id: string } | null>(null);
  const [checking, setChecking] = useState(true);

  // 1) Hydrate session ASAP, then stop "checking"
  useEffect(() => {
    let mounted = true;

    (async () => {
      const session = await waitForSession(supabase); // tolerates 100–300ms auth hydrate
      const user = session?.user ?? null;
      if (!mounted) return;

      if (!user) {
        setMe(null);
        setChecking(false);
        return;
      }

      setMe({ id: user.id });

      // If a username already exists, skip this page
      const { data: prof } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();

      if (prof?.username) {
        router.replace(`/u/${prof.username}`);
        return;
      }

      setChecking(false);
    })();

    // keep in sync with auth events (e.g., magic link tab)
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      const user = session?.user ?? null;
      setMe(user ? { id: user.id } : null);
      setChecking(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase, router]);

  // 2) Enable Save only when everything’s ready
  const u = useMemo(() => username.trim().toLowerCase(), [username]);
  const valid = /^[a-z0-9_]{3,20}$/.test(u);
  const canSave = !!me && !checking && valid && !saving;

  async function save() {
    if (!canSave) return;
    setError(null);
    setSaving(true);

    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: me!.id, username: u }, { onConflict: 'id' })
      .select('username')
      .single();

    setSaving(false);

    if (error) {
      // unique violation from our lower(username) index
      // @ts-ignore - supabase types don't narrow pg error codes
      if (error.code === '23505') setError('That username is taken.');
      else setError(error.message);
      return;
    }

    // nudge other tabs and bounce to profile
    try { localStorage.setItem('gb-auth-sync', String(Date.now())); } catch {}
    router.replace(`/u/${data?.username ?? u}`);
    router.refresh();
  }

  return (
    <main className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Choose a username</h1>

      {!me && !checking && (
        <p className="mb-3 text-sm text-white/70">
          You’re not signed in. <a className="underline" href="/login">Sign in</a> to continue.
        </p>
      )}

      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="yourname"
        className="w-full border border-white/20 bg-neutral-900 text-white rounded px-3 py-2"
      />

      <button
        onClick={save}
        disabled={!canSave}
        className="mt-3 bg-indigo-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      <p className="mt-2 text-sm text-white/60">Allowed: a–z, 0–9, underscore; 3–20 chars.</p>
    </main>
  );
}