-- Force-replace problematic functions regardless of existing signatures

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY['toggle_block','toggle_mute','app_notify_follow','app_notify_like','app_notify_comment'] LOOP
    PERFORM 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = fn LIMIT 1;
    IF FOUND THEN
      EXECUTE format(
        'DO $$BEGIN FOR r IN SELECT oid FROM pg_proc WHERE pronamespace = %s::regnamespace AND proname = %L LOOP EXECUTE format(''DROP FUNCTION IF EXISTS %%s'', r.oid::regprocedure); END LOOP; END$$;',
        'public',''||fn||''
      );
    END IF;
  END LOOP;
END$$;

-- Recreate with canonical signatures

-- toggle_block(target uuid)
CREATE OR REPLACE FUNCTION public.toggle_block(target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, extensions
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.blocks WHERE blocker_id = auth.uid() AND blocked_id = target) THEN
    DELETE FROM public.blocks WHERE blocker_id = auth.uid() AND blocked_id = target;
  ELSE
    INSERT INTO public.blocks(blocker_id, blocked_id) VALUES (auth.uid(), target);
  END IF;
END;
$$;

-- toggle_mute(target uuid) using mutes(user_id, muted_id)
CREATE OR REPLACE FUNCTION public.toggle_mute(target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, extensions
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.mutes WHERE user_id = auth.uid() AND muted_id = target) THEN
    DELETE FROM public.mutes WHERE user_id = auth.uid() AND muted_id = target;
  ELSE
    INSERT INTO public.mutes(user_id, muted_id) VALUES (auth.uid(), target);
  END IF;
END;
$$;

-- app_notify_follow(p_user_id uuid)
CREATE OR REPLACE FUNCTION public.app_notify_follow(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, extensions
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE type = 'follow' AND user_id = p_user_id AND actor_id = auth.uid()
  ) THEN
    INSERT INTO public.notifications(user_id, type, actor_id, meta)
    VALUES (p_user_id, 'follow', auth.uid(), '{}'::jsonb);
  END IF;
END;
$$;

-- app_notify_like(p_user_id uuid, p_game_id bigint)
CREATE OR REPLACE FUNCTION public.app_notify_like(p_user_id uuid, p_game_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, extensions
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE type = 'like' AND user_id = p_user_id AND actor_id = auth.uid() AND game_id = p_game_id
  ) THEN
    INSERT INTO public.notifications(user_id, type, actor_id, game_id, meta)
    VALUES (p_user_id, 'like', auth.uid(), p_game_id, '{}'::jsonb);
  END IF;
END;
$$;

-- app_notify_comment(p_user_id uuid, p_game_id bigint, p_comment_id uuid)
CREATE OR REPLACE FUNCTION public.app_notify_comment(p_user_id uuid, p_game_id bigint, p_comment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, extensions
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE type = 'comment' AND user_id = p_user_id AND actor_id = auth.uid() AND game_id = p_game_id AND comment_id = p_comment_id
  ) THEN
    INSERT INTO public.notifications(user_id, type, actor_id, game_id, comment_id, meta)
    VALUES (p_user_id, 'comment', auth.uid(), p_game_id, p_comment_id, '{}'::jsonb);
  END IF;
END;
$$;


