-- Preview Database Seed Data
-- This file contains safe, non-sensitive test data for preview environments

-- Insert some sample games for testing
INSERT INTO public.games (igdb_id, name, cover_url, summary, release_year) VALUES
(1942, 'The Witcher 3: Wild Hunt', 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1tmu.jpg', 'The Witcher 3: Wild Hunt is a story-driven, next-generation open world RPG set in a visually stunning fantasy universe full of meaningful choices and impactful consequences.', 2015),
(1944, 'Cyberpunk 2077', 'https://images.igdb.com/igdb/image/upload/t_cover_big/co2rpf.jpg', 'Cyberpunk 2077 is an open-world, action-adventure story set in Night City, a megalopolis obsessed with power, glamour and ceaseless body modification.', 2020),
(1945, 'Elden Ring', 'https://images.igdb.com/igdb/image/upload/t_cover_big/co2rpg.jpg', 'The Golden Order has been broken. Rise, Tarnished, and be guided by grace to brandish the power of the Elden Ring and become an Elden Lord in the Lands Between.', 2022),
(1946, 'Baldur''s Gate 3', 'https://images.igdb.com/igdb/image/upload/t_cover_big/co2rph.jpg', 'Gather your party and return to the Forgotten Realms in a tale of fellowship and betrayal, sacrifice and survival, and the lure of absolute power.', 2023),
(1947, 'Hogwarts Legacy', 'https://images.igdb.com/igdb/image/upload/t_cover_big/co2rpi.jpg', 'Hogwarts Legacy is an immersive, open-world action RPG set in the world first introduced in the Harry Potter books.', 2023)
ON CONFLICT (igdb_id) DO NOTHING;

-- Insert some sample profiles for testing
INSERT INTO public.profiles (id, username, display_name, bio, avatar_url) VALUES
('00000000-0000-0000-0000-000000000001', 'testuser1', 'Test User 1', 'A test user for preview environments', null),
('00000000-0000-0000-0000-000000000002', 'testuser2', 'Test User 2', 'Another test user for preview environments', null),
('00000000-0000-0000-0000-000000000003', 'gamer123', 'Gamer 123', 'Just a gamer testing the platform', null)
ON CONFLICT (id) DO NOTHING;

-- Insert some sample reviews for testing
INSERT INTO public.reviews (user_id, game_id, rating, review, created_at) VALUES
('00000000-0000-0000-0000-000000000001', 1, 95, 'Absolutely incredible game! The story, world, and characters are all top-notch.', NOW() - INTERVAL '5 days'),
('00000000-0000-0000-0000-000000000001', 2, 75, 'Good game but had some technical issues at launch. Still enjoyable though.', NOW() - INTERVAL '3 days'),
('00000000-0000-0000-0000-000000000002', 1, 90, 'One of the best RPGs I''ve ever played. Highly recommended!', NOW() - INTERVAL '2 days'),
('00000000-0000-0000-0000-000000000002', 3, 88, 'Challenging but fair. The open world is beautiful and the combat is satisfying.', NOW() - INTERVAL '1 day'),
('00000000-0000-0000-0000-000000000003', 4, 92, 'Amazing D&D experience. The story and characters are fantastic.', NOW() - INTERVAL '4 hours')
ON CONFLICT (user_id, game_id) DO NOTHING;
