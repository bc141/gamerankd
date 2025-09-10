import type { Session } from '@supabase/supabase-js';

export async function waitForSession(
  supabase: any,
  tries = 10,
  delayMs = 150
): Promise<Session | null> {
  for (let i = 0; i < tries; i++) {
    const { data } = await supabase.auth.getSession();
    if (data.session) return data.session;
    await new Promise(r => setTimeout(r, delayMs));
  }
  return null;
}