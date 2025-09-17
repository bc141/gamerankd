-- RPC functions for data service

-- Get who to follow (users with mutual connections)
CREATE OR REPLACE FUNCTION get_who_to_follow(limit_count INTEGER DEFAULT 5)
RETURNS TABLE (
  id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  followers_count BIGINT,
  is_following BOOLEAN,
  mutual_follows_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.bio,
    COALESCE(p.followers_count, 0) as followers_count,
    FALSE as is_following, -- Will be updated by client context
    COALESCE(mutual.mutual_count, 0) as mutual_follows_count
  FROM profiles p
  LEFT JOIN (
    SELECT 
      f2.following_id,
      COUNT(*) as mutual_count
    FROM follows f1
    JOIN follows f2 ON f1.following_id = f2.follower_id
    WHERE f1.follower_id = auth.uid()
    GROUP BY f2.following_id
  ) mutual ON p.id = mutual.following_id
  WHERE p.id != auth.uid()
  AND p.id NOT IN (
    SELECT following_id FROM follows WHERE follower_id = auth.uid()
  )
  ORDER BY mutual_follows_count DESC, followers_count DESC
  LIMIT limit_count;
END;
$$;

-- Get trending topics (hashtags with recent activity)
CREATE OR REPLACE FUNCTION get_trending_topics(limit_count INTEGER DEFAULT 5)
RETURNS TABLE (
  id TEXT,
  name TEXT,
  posts_count BIGINT,
  growth_rate NUMERIC,
  category TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'trending-' || ROW_NUMBER() OVER (ORDER BY recent_posts DESC) as id,
    topic_name as name,
    recent_posts as posts_count,
    CASE 
      WHEN previous_posts > 0 THEN 
        ROUND(((recent_posts::NUMERIC - previous_posts::NUMERIC) / previous_posts::NUMERIC) * 100, 2)
      ELSE 100.0
    END as growth_rate,
    'gaming' as category
  FROM (
    SELECT 
      'Gaming' as topic_name,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as recent_posts,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '48 hours' AND created_at < NOW() - INTERVAL '24 hours') as previous_posts
    FROM posts
    WHERE content ILIKE '%#gaming%'
    
    UNION ALL
    
    SELECT 
      'NewGame' as topic_name,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as recent_posts,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '48 hours' AND created_at < NOW() - INTERVAL '24 hours') as previous_posts
    FROM posts
    WHERE content ILIKE '%#newgame%'
    
    UNION ALL
    
    SELECT 
      'Tech' as topic_name,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as recent_posts,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '48 hours' AND created_at < NOW() - INTERVAL '24 hours') as previous_posts
    FROM posts
    WHERE content ILIKE '%#tech%'
  ) trending
  ORDER BY recent_posts DESC
  LIMIT limit_count;
END;
$$;

-- Get continue playing games (recently played by user)
CREATE OR REPLACE FUNCTION get_continue_playing(limit_count INTEGER DEFAULT 5)
RETURNS TABLE (
  id UUID,
  name TEXT,
  cover_url TEXT,
  last_played_at TIMESTAMPTZ,
  playtime_minutes INTEGER,
  progress_percentage INTEGER,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.id,
    g.name,
    g.cover_url,
    COALESCE(MAX(p.created_at), g.created_at) as last_played_at,
    COALESCE(SUM(EXTRACT(EPOCH FROM (p.updated_at - p.created_at)) / 60), 0)::INTEGER as playtime_minutes,
    CASE 
      WHEN COUNT(p.id) > 0 THEN LEAST(100, (COUNT(p.id) * 10)::INTEGER)
      ELSE 0
    END as progress_percentage,
    CASE 
      WHEN COUNT(p.id) > 0 THEN 'playing'
      ELSE 'paused'
    END as status
  FROM games g
  LEFT JOIN posts p ON g.id = p.game_id AND p.user_id = auth.uid()
  WHERE g.id IN (
    SELECT DISTINCT game_id 
    FROM posts 
    WHERE user_id = auth.uid() 
    AND game_id IS NOT NULL
    AND created_at >= NOW() - INTERVAL '7 days'
  )
  GROUP BY g.id, g.name, g.cover_url, g.created_at
  ORDER BY last_played_at DESC
  LIMIT limit_count;
END;
$$;

-- Toggle reaction (like/unlike, etc.)
CREATE OR REPLACE FUNCTION toggle_reaction(
  post_id UUID,
  reaction_type TEXT,
  action TEXT
)
RETURNS TABLE (
  likes BIGINT,
  comments BIGINT,
  shares BIGINT,
  views BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id UUID := auth.uid();
BEGIN
  -- Insert or update reaction
  IF action = 'add' THEN
    INSERT INTO post_reactions (post_id, user_id, reaction_type)
    VALUES (post_id, user_id, reaction_type)
    ON CONFLICT (post_id, user_id, reaction_type) DO NOTHING;
  ELSE
    DELETE FROM post_reactions 
    WHERE post_id = post_id 
    AND user_id = user_id 
    AND reaction_type = reaction_type;
  END IF;

  -- Return updated counts
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE reaction_type = 'like') as likes,
    COUNT(*) FILTER (WHERE reaction_type = 'comment') as comments,
    COUNT(*) FILTER (WHERE reaction_type = 'share') as shares,
    COALESCE(MAX(p.views), 0) as views
  FROM post_reactions pr
  LEFT JOIN posts p ON pr.post_id = p.id
  WHERE pr.post_id = post_id;
END;
$$;

-- Follow/unfollow user
CREATE OR REPLACE FUNCTION follow_user(
  target_user_id UUID,
  follow BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id UUID := auth.uid();
BEGIN
  IF follow THEN
    INSERT INTO follows (follower_id, following_id)
    VALUES (user_id, target_user_id)
    ON CONFLICT (follower_id, following_id) DO NOTHING;
  ELSE
    DELETE FROM follows 
    WHERE follower_id = user_id 
    AND following_id = target_user_id;
  END IF;

  RETURN follow;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_who_to_follow(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_trending_topics(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_continue_playing(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_reaction(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION follow_user(UUID, BOOLEAN) TO authenticated;
