// Simple test script to debug database connection
const { createClient } = require('@supabase/supabase-js');

const SB_URL = 'http://127.0.0.1:54321';
const SB_SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

async function testDB() {
  const sb = createClient(SB_URL, SB_SERVICE);
  
  try {
    console.log('Testing basic connection...');
    const { data: games, error: gamesError } = await sb
      .from('games')
      .select('id, name, release_year')
      .limit(5);
    
    if (gamesError) {
      console.error('Games query error:', gamesError);
    } else {
      console.log('Games found:', games?.length || 0);
      console.log('Sample games:', games);
    }
    
    console.log('\nTesting new section query...');
    const { data: newGames, error: newError } = await sb
      .from('games')
      .select('id,igdb_id,name,cover_url,release_year,parent_igdb_id,preview')
      .is('parent_igdb_id', null)
      .not('release_year', 'is', null)
      .order('release_year', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (newError) {
      console.error('New games query error:', newError);
    } else {
      console.log('New games found:', newGames?.length || 0);
      console.log('Sample new games:', newGames);
    }
    
  } catch (err) {
    console.error('Test failed:', err);
  }
}

testDB();
