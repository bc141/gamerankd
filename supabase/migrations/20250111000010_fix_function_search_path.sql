-- Fix linter WARN: function_search_path_mutable
-- We set a fixed search_path for flagged functions without changing their bodies/signatures.
-- This DO block finds the exact regprocedure for each name and applies ALTER FUNCTION ... SET search_path.

DO $$
DECLARE
  fn TEXT;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'touch_updated_at',
    'library_set_updated_at',
    'prevent_blocked_notification',
    'delete_like_notifs',
    'set_updated_at',
    'rating_agg_apply',
    'trg_reviews_rating_ins',
    'trg_reviews_rating_upd',
    'trg_reviews_rating_del',
    'app_notify_follow',
    'app_notify_like',
    'app_clear_like',
    'app_notify_comment',
    'get_notifications',
    'mark_notifications_read',
    'mark_all_notifications_read',
    'toggle_block',
    'toggle_mute',
    'tg_set_updated_at',
    'get_game_rating_stats',
    'current_user_id',
    '_set_path',
    'is_authenticated',
    'game_search',
    'game_search_v2',
    'verify_database_health'
  ] LOOP
    PERFORM 1
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname = fn
    LIMIT 1;

    IF FOUND THEN
      -- Iterate all overloads for this name
      FOR fn IN
        SELECT (p.oid)::regprocedure::text
        FROM pg_proc p
        WHERE p.pronamespace = 'public'::regnamespace
          AND p.proname = fn
      LOOP
        EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions', fn);
      END LOOP;
    END IF;
  END LOOP;
END $$;


