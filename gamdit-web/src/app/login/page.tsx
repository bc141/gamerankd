// src/app/login/page.tsx
'use client';

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { siteUrl } from '@/lib/site';

export default function LoginPage() {
  const supabase = supabaseBrowser();

  // If we're on a preview (vercel.app), use that origin; else use canonical domain.
  const isBrowser = typeof window !== 'undefined';
  const hostname = isBrowser ? window.location.hostname : '';
  const runtimeOrigin = isBrowser ? window.location.origin : undefined;
  const isPreview = isBrowser && /\.vercel\.app$/.test(hostname);

  const REDIRECT_BASE = isPreview
    ? (runtimeOrigin ?? 'http://localhost:3000')
    : siteUrl();

  return (
    <main className="max-w-md mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Sign in</h1>
      <Auth
        supabaseClient={supabase}
        providers={[]}
        view="magic_link"
        showLinks={false}
        redirectTo={`${REDIRECT_BASE}/auth/callback`}
        appearance={{
          theme: ThemeSupa,
          variables: {
            default: {
              colors: {
                brand: '#6366f1',
                brandAccent: '#4f46e5',
                inputText: 'white',
                inputPlaceholder: 'rgba(255,255,255,0.55)',
                inputBorder: 'rgba(255,255,255,0.2)',
                inputBackground: 'rgb(23 23 23)',
              },
              radii: { inputBorderRadius: '0.5rem', buttonBorderRadius: '0.375rem' },
            },
          },
          className: {
            container: 'bg-transparent text-white',
            label: 'text-white',
            input:
              'bg-neutral-900 text-white placeholder:text-white/60 border border-white/20 focus:border-white/40 focus:ring-0',
            button: 'bg-indigo-600 hover:bg-indigo-500',
            message: 'text-white',
            anchor: 'text-indigo-400',
          },
        }}
      />
    </main>
  );
}