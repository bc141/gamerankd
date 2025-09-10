-- Production Seed Data
-- This file contains deterministic test data for development and preview environments

-- Insert sample games for testing
INSERT INTO public.games (igdb_id, name, cover_url, summary, release_year) VALUES
(1942, 'The Witcher 3: Wild Hunt', 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1tmu.jpg', 'The Witcher 3: Wild Hunt is a story-driven, next-generation open world RPG set in a visually stunning fantasy universe full of meaningful choices and impactful consequences.', 2015),
(1944, 'Cyberpunk 2077', 'https://images.igdb.com/igdb/image/upload/t_cover_big/co2rpf.jpg', 'Cyberpunk 2077 is an open-world, action-adventure story set in Night City, a megalopolis obsessed with power, glamour and ceaseless body modification.', 2020),
(1945, 'Elden Ring', 'https://images.igdb.com/igdb/image/upload/t_cover_big/co2rpg.jpg', 'The Golden Order has been broken. Rise, Tarnished, and be guided by grace to brandish the power of the Elden Ring and become an Elden Lord in the Lands Between.', 2022),
(1946, 'Baldur''s Gate 3', 'https://images.igdb.com/igdb/image/upload/t_cover_big/co2rph.jpg', 'Gather your party and return to the Forgotten Realms in a tale of fellowship and betrayal, sacrifice and survival, and the lure of absolute power.', 2023),
(1947, 'Hogwarts Legacy', 'https://images.igdb.com/igdb/image/upload/t_cover_big/co2rpi.jpg', 'Hogwarts Legacy is an immersive, open-world action RPG set in the world first introduced in the Harry Potter books.', 2023),
(1948, 'God of War', 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1wyy.jpg', 'His vengeance against the Gods of Olympus years behind him, Kratos now lives as a man in the realm of Norse Gods and monsters.', 2018),
(1949, 'The Last of Us Part II', 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1wyz.jpg', 'Set five years after the events of The Last of Us, Ellie embarks on another journey through a post-apocalyptic world.', 2020),
(1950, 'Ghost of Tsushima', 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1wz0.jpg', 'In the late 13th century, the Mongol empire has laid waste to entire nations along their campaign to conquer the East.', 2020)
ON CONFLICT (igdb_id) DO NOTHING;

-- Insert sample profiles for testing (using deterministic UUIDs)
INSERT INTO public.profiles (id, username, display_name, bio, avatar_url) VALUES
('00000000-0000-0000-0000-000000000001', 'testuser1', 'Test User 1', 'A test user for development and preview environments', null),
('00000000-0000-0000-0000-000000000002', 'testuser2', 'Test User 2', 'Another test user for development and preview environments', null),
('00000000-0000-0000-0000-000000000003', 'gamer123', 'Gamer 123', 'Just a gamer testing the platform', null),
('00000000-0000-0000-0000-000000000004', 'reviewer', 'Review Master', 'Professional game reviewer', null),
('00000000-0000-0000-0000-000000000005', 'indie', 'Indie Gamer', 'Loves discovering hidden gems', null)
ON CONFLICT (id) DO NOTHING;

-- Insert sample reviews for testing
INSERT INTO public.reviews (user_id, game_id, rating, review, created_at) VALUES
('00000000-0000-0000-0000-000000000001', 1, 95, 'Absolutely incredible game! The story, world, and characters are all top-notch. One of the best RPGs I''ve ever played.', NOW() - INTERVAL '5 days'),
('00000000-0000-0000-0000-000000000001', 2, 75, 'Good game but had some technical issues at launch. Still enjoyable though, especially after patches.', NOW() - INTERVAL '3 days'),
('00000000-0000-0000-0000-000000000002', 1, 90, 'One of the best RPGs I''ve ever played. Highly recommended! The DLC is also fantastic.', NOW() - INTERVAL '2 days'),
('00000000-0000-0000-0000-000000000002', 3, 88, 'Challenging but fair. The open world is beautiful and the combat is satisfying. A masterpiece.', NOW() - INTERVAL '1 day'),
('00000000-0000-0000-0000-000000000003', 4, 92, 'Amazing D&D experience. The story and characters are fantastic. Perfect for RPG fans.', NOW() - INTERVAL '4 hours'),
('00000000-0000-0000-0000-000000000003', 5, 78, 'Fun Harry Potter game with good exploration. Some repetitive elements but overall enjoyable.', NOW() - INTERVAL '2 hours'),
('00000000-0000-0000-0000-000000000004', 6, 96, 'Masterpiece of storytelling and gameplay. Kratos'' journey is emotional and powerful.', NOW() - INTERVAL '6 days'),
('00000000-0000-0000-0000-000000000004', 7, 89, 'Controversial but brilliant. The gameplay is tight and the story is thought-provoking.', NOW() - INTERVAL '3 days'),
('00000000-0000-0000-0000-000000000005', 8, 85, 'Beautiful samurai game with great combat. The world is stunning and immersive.', NOW() - INTERVAL '1 week'),
('00000000-0000-0000-0000-000000000005', 2, 82, 'Improved significantly since launch. The story is engaging and the world is detailed.', NOW() - INTERVAL '5 days')
ON CONFLICT (user_id, game_id) DO NOTHING;

-- Create some sample library entries (if library table exists)
-- Note: This assumes a library table exists. Adjust based on actual schema.
-- INSERT INTO public.library (user_id, game_id, status, added_at) VALUES
-- ('00000000-0000-0000-0000-000000000001', 1, 'completed', NOW() - INTERVAL '5 days'),
-- ('00000000-0000-0000-0000-000000000001', 2, 'playing', NOW() - INTERVAL '3 days'),
-- ('00000000-0000-0000-0000-000000000002', 1, 'completed', NOW() - INTERVAL '2 days'),
-- ('00000000-0000-0000-0000-000000000002', 3, 'playing', NOW() - INTERVAL '1 day')
-- ON CONFLICT (user_id, game_id) DO NOTHING;
