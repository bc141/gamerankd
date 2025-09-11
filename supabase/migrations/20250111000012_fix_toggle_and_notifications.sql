-- Fix toggle_* functions to reference current tables
-- Fix notification functions to avoid ON CONFLICT errors and type mismatches

-- 1) toggle_block → use public.blocks (blocker_id, blocked_id)
DROP FUNCTION IF EXISTS public.toggle_block(uuid);
CREATE OR REPLACE FUNCTION public.toggle_block(target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, extensions
AS $$
BEGIN
  IF exists(select 1 from public.blocks where blocker_id = auth.uid() and blocked_id = target) THEN
    delete from public.blocks where blocker_id = auth.uid() and blocked_id = target;
  ELSE
    insert into public.blocks(blocker_id, blocked_id) values (auth.uid(), target);
  END IF;
END;
$$;

-- 2) toggle_mute → use public.mutes (muter_id, muted_id)
DROP FUNCTION IF EXISTS public.toggle_mute(uuid);
CREATE OR REPLACE FUNCTION public.toggle_mute(target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, extensions
AS $$
BEGIN
  IF exists(select 1 from public.mutes where muter_id = auth.uid() and muted_id = target) THEN
    delete from public.mutes where muter_id = auth.uid() and muted_id = target;
  ELSE
    insert into public.mutes(muter_id, muted_id) values (auth.uid(), target);
  END IF;
END;
$$;

-- 3) app_notify_follow: insert if not exists (avoid ON CONFLICT requirement)
DROP FUNCTION IF EXISTS public.app_notify_follow(uuid);
CREATE OR REPLACE FUNCTION public.app_notify_follow(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, extensions
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE type = 'follow'
      AND user_id = p_user_id
      AND actor_id = auth.uid()
  ) THEN
    INSERT INTO public.notifications(user_id, type, actor_id, meta)
    VALUES (p_user_id, 'follow', auth.uid(), '{}'::jsonb);
  END IF;
END;
$$;

-- 4) app_notify_like: insert if not exists
DROP FUNCTION IF EXISTS public.app_notify_like(uuid,bigint);
CREATE OR REPLACE FUNCTION public.app_notify_like(p_user_id uuid, p_game_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, extensions
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE type = 'like'
      AND user_id = p_user_id
      AND actor_id = auth.uid()
      AND game_id = p_game_id
  ) THEN
    INSERT INTO public.notifications(user_id, type, actor_id, game_id, meta)
    VALUES (p_user_id, 'like', auth.uid(), p_game_id, '{}'::jsonb);
  END IF;
END;
$$;

-- 5) app_notify_comment: ensure comment_id uuid and insert if not exists
DROP FUNCTION IF EXISTS public.app_notify_comment(uuid,bigint,uuid);
CREATE OR REPLACE FUNCTION public.app_notify_comment(
  p_user_id uuid,
  p_game_id bigint,
  p_comment_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, extensions
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE type = 'comment'
      AND user_id = p_user_id
      AND actor_id = auth.uid()
      AND game_id = p_game_id
      AND comment_id = p_comment_id
  ) THEN
    INSERT INTO public.notifications(user_id, type, actor_id, game_id, comment_id, meta)
    VALUES (p_user_id, 'comment', auth.uid(), p_game_id, p_comment_id, '{}'::jsonb);
  END IF;
END;
$$;


