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

-- Note: Profile inserts removed - they require valid auth.users entries
-- Profiles will be created automatically when users sign up through the auth system

-- Note: Review inserts removed - they require valid user_id references
-- Reviews will be created when users actually use the platform

-- Create some sample library entries (if library table exists)
-- Note: This assumes a library table exists. Adjust based on actual schema.
-- INSERT INTO public.library (user_id, game_id, status, added_at) VALUES
-- ('00000000-0000-0000-0000-000000000001', 1, 'completed', NOW() - INTERVAL '5 days'),
-- ('00000000-0000-0000-0000-000000000001', 2, 'playing', NOW() - INTERVAL '3 days'),
-- ('00000000-0000-0000-0000-000000000002', 1, 'completed', NOW() - INTERVAL '2 days'),
-- ('00000000-0000-0000-0000-000000000002', 3, 'playing', NOW() - INTERVAL '1 day')
-- ON CONFLICT (user_id, game_id) DO NOTHING;
