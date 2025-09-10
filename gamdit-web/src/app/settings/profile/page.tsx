// src/app/settings/profile/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { waitForSession } from '@/lib/waitForSession';

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null; // stored as public URL
};

function useUnsavedPrompt(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [enabled]);
}

export default function EditProfilePage() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [me, setMe] = useState<{ id: string; email?: string; user_metadata?: any } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  /**
   * Derive username for profile URL:
   * - If you already have `profile.username`, use that.
   * - Otherwise pull it from the session/profile load you're doing.
   */
  const profileUsername = (profile?.username ?? me?.user_metadata?.username ?? '').toString();
  const profileUrl = useMemo(
    () => (profileUsername ? `/u/${profileUsername}` : '/me'),
    [profileUsername]
  );

  /**
   * Capture the original values after you load them from DB once.
   * INITIALIZE THESE right after you set the form fields from Supabase.
   * For example, wherever you currently do:
   *   setDisplayName(db.display_name ?? '');
   *   setBio(db.bio ?? '');
   * ALSO add:
   *   setInitial({ name: db.display_name ?? '', bio: db.bio ?? '' });
   */
  const [initial, setInitial] = useState<{ name: string; bio: string } | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarVersion, setAvatarVersion] = useState<number>(0); // bust <img> cache after upload

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /**
   * Replace these variable names with your actual state if different.
   * Example assumes:
   *   const [displayName, setDisplayName] = useState('');
   *   const [bio, setBio] = useState('');
   * If you also track avatar changes, OR them into `dirty` with your own flag.
   */
  const dirty = useMemo(() => {
    if (!initial) return false;
    return (displayName ?? '') !== initial.name || (bio ?? '') !== initial.bio;
    // ^ if you don't track avatarDirty, remove it.
  }, [initial, displayName, bio]);

  // Warn on tab close while dirty
  useUnsavedPrompt(dirty);

  // Cmd/Ctrl+S shortcut to save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!saving && dirty) handleSaveAndExit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saving, dirty]);

  /** Back/cancel handler with confirm */
  function handleBackToProfile() {
    if (dirty && !confirm('Discard unsaved changes?')) return;
    router.push(profileUrl);
  }

  /** Save handler wrapper — call your existing save function, then redirect */
  async function handleSaveAndExit() {
    // If you already have a `save()` or `onSave()` function, call it here.
    // It should return a truthy value (or no error) on success.
    const ok = await saveBasics(); // <-- replace with your actual save function
    if (!ok) return;           // if your save throws, wrap in try/catch
    router.push(profileUrl);
  }

  // Load session + profile
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const session = await waitForSession(supabase);
      const user = session?.user ?? null;

      if (cancelled) return;

      if (!user) {
        router.replace('/login');
        return;
      }

      setMe({ id: user.id, email: user.email ?? undefined });

      const { data: prof } = await supabase
        .from('profiles')
        .select('id,username,display_name,bio,avatar_url')
        .eq('id', user.id)
        .single();

      if (cancelled) return;

      const p: Profile =
        prof ?? {
          id: user.id,
          username: null,
          display_name: null,
          bio: null,
          avatar_url: null,
        };

      setProfile(p);
      setDisplayName(p.display_name ?? '');
      setBio(p.bio ?? '');
      setInitial({ name: p.display_name ?? '', bio: p.bio ?? '' });
    })();

    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  // Derive avatar src with cache-busting after successful upload
  const avatarSrc = useMemo(() => {
    const base = profile?.avatar_url || '/avatar-placeholder.svg';
    return avatarVersion ? `${base}?v=${avatarVersion}` : base;
  }, [profile?.avatar_url, avatarVersion]);

  async function saveBasics() {
    if (!me) return false;
    setError(null);
    setSaving(true);

    const { error: updErr } = await supabase
      .from('profiles')
      .upsert(
        {
          id: me.id,
          display_name: displayName.trim() || null,
          bio: bio.trim() || null,
        },
        { onConflict: 'id' }
      );

    setSaving(false);

    if (updErr) {
      setError(updErr.message);
      return false;
    }

    setProfile((prev) =>
      prev
        ? {
            ...prev,
            display_name: displayName.trim() || null,
            bio: bio.trim() || null,
          }
        : prev
    );

    return true;
  }

  function onPickFile() {
    fileInputRef.current?.click();
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !me) return;

    setError(null);

    // Validations
    const MAX_MB = 5;
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Please choose an image under ${MAX_MB}MB.`);
      e.target.value = '';
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      e.target.value = '';
      return;
    }

    setUploading(true);
    try {
      // derive extension safely
      const extFromName = file.name.includes('.') ? file.name.split('.').pop() : null;
      const extFromType = file.type.split('/').pop() || 'jpg';
      const ext = (extFromName || extFromType || 'jpg').toLowerCase();

      const path = `${me.id}/${Date.now()}.${ext}`;

      // Upload to public bucket 'avatars'
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, cacheControl: '3600' });

      if (upErr) throw upErr;

      // Get a public URL for the uploaded file
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = pub.publicUrl;

      // Persist the URL on the profile
      const { error: dbErr } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', me.id);

      if (dbErr) throw dbErr;

      // Update local state and bust the image cache
      setProfile((prev) => (prev ? { ...prev, avatar_url: publicUrl } : prev));
      setAvatarVersion(Date.now());

      // Allow re-selecting the same file later
      e.target.value = '';
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Avatar upload failed.';
      setError(msg);
    } finally {
      setUploading(false);
    }
  }

  if (!me || !profile) {
    return <main className="p-8">Loading…</main>;
  }

  return (
    <main className="p-8 max-w-2xl mx-auto">
      <div className="mb-4">
        <button
          type="button"
          onClick={handleBackToProfile}
          className="inline-flex items-center gap-2 text-white/80 hover:text-white text-sm"
        >
          <span aria-hidden>←</span> Back to profile
        </button>
      </div>
      <h1 className="text-2xl font-bold mb-6">Edit profile</h1>

      {/* Avatar */}
      <section className="mb-8 flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarSrc}
          alt="avatar"
          className="h-20 w-20 rounded-full object-cover border border-white/20"
        />
        <div>
          <button
            type="button"
            className="bg-white/10 px-3 py-2 rounded"
            onClick={onPickFile}
            disabled={uploading}
          >
            {uploading ? 'Uploading…' : 'Change avatar'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={onFileChange}
          />
          <p className="text-xs text-white/60 mt-1">JPEG/PNG/WebP, up to 5MB.</p>
        </div>
      </section>

      {/* Display name */}
      <label className="block text-sm mb-1">Display name</label>
      <input
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="Your name"
        className="w-full border border-white/20 bg-neutral-900 text-white rounded px-3 py-2 mb-4"
      />

      {/* Bio */}
      <label className="block text-sm mb-1">Bio</label>
      <textarea
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        placeholder="Say something about yourself"
        rows={4}
        className="w-full border border-white/20 bg-neutral-900 text-white rounded px-3 py-2"
      />

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <div className="mt-6 flex gap-3">
        <button
          onClick={handleSaveAndExit}
          disabled={!dirty || saving}
          className="bg-indigo-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button
          onClick={handleBackToProfile}
          className="bg-white/10 px-4 py-2 rounded"
        >
          Cancel
        </button>
      </div>
    </main>
  );
}