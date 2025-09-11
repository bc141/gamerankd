'use client';

import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import ReviewContextModal from './ReviewContextModal';

export function useReviewContextModal(
  supabase: SupabaseClient,
  viewerId: string | null
) {
  const [ctx, setCtx] =
    useState<{ reviewUserId: string; gameId: number } | null>(null);

  const open = (reviewUserId: string, gameId: number) =>
    setCtx({ reviewUserId, gameId });
  const close = () => setCtx(null);

  const modal = ctx ? (
    <ReviewContextModal
      supabase={supabase}
      viewerId={viewerId}
      reviewUserId={ctx.reviewUserId}
      gameId={ctx.gameId}
      onClose={close}
    />
  ) : null;

  return { open, close, modal };
}