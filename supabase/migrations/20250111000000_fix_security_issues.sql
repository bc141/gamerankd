-- Fix Supabase security linter errors
-- This migration addresses rls_disabled_in_public issues
-- Note: Security definer views will be addressed separately as they may have complex dependencies

-- Enable RLS on tables that don't have it enabled
-- These tables need RLS policies to be secure

-- Enable RLS on games table
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

-- Enable RLS on post_media table
ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY;

-- Enable RLS on post_tags table
ALTER TABLE public.post_tags ENABLE ROW LEVEL SECURITY;

-- Enable RLS on reactions table
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

-- Enable RLS on comments table
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Enable RLS on review_entities table
ALTER TABLE public.review_entities ENABLE ROW LEVEL SECURITY;

-- Enable RLS on rating_agg table
ALTER TABLE public.rating_agg ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies for the newly secured tables
-- These are permissive policies that allow all operations for now
-- You may want to customize these based on your specific security requirements

-- Games table policies (read-only for public)
CREATE POLICY "Games are viewable by everyone" ON public.games
    FOR SELECT USING (true);

-- Post media policies (users can manage their own post media)
CREATE POLICY "Users can manage their own post media" ON public.post_media
    FOR ALL USING (auth.uid() = (SELECT user_id FROM public.posts WHERE id = post_id));

-- Post tags policies (users can manage tags for their own posts)
CREATE POLICY "Users can manage tags for their own posts" ON public.post_tags
    FOR ALL USING (auth.uid() = (SELECT user_id FROM public.posts WHERE id = post_id));

-- Reactions policies (users can manage their own reactions)
CREATE POLICY "Users can manage their own reactions" ON public.reactions
    FOR ALL USING (auth.uid() = user_id);

-- Comments policies (users can manage their own comments)
CREATE POLICY "Users can manage their own comments" ON public.comments
    FOR ALL USING (auth.uid() = user_id);

-- Review entities policies (permissive for now)
CREATE POLICY "Review entities are manageable by everyone" ON public.review_entities
    FOR ALL USING (true);

-- Rating agg policies (read-only for public)
CREATE POLICY "Rating agg is viewable by everyone" ON public.rating_agg
    FOR SELECT USING (true);
