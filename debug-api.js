// Debug script to test the games browse API
const { createClient } = require('@supabase/supabase-js');

// Use the live database credentials
const SB_URL = 'https://your-project.supabase.co'; // Replace with actual URL
const SB_SERVICE = 'your-service-key'; // Replace with actual service key

async function debugAPI() {
  console.log('Testing games browse API...');
  
  try {
    // Test the new section query
    console.log('\n1. Testing new section query...');
    const sb = createClient(SB_URL, SB_SERVICE);
    
    const { data: newGames, error: newError } = await sb
      .from('games')
      .select('id,igdb_id,name,cover_url,release_year,parent_igdb_id,preview')
      .is('parent_igdb_id', null)
      .not('release_year', 'is', null)
      .order('release_year', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (newError) {
      console.error('New section error:', newError);
    } else {
      console.log('New section success:', newGames?.length || 0, 'games');
    }
    
    // Test the top section query
    console.log('\n2. Testing top section query...');
    const since = new Date(Date.now() - 90 * 864e5).toISOString();
    const { data: reviews, error: reviewsError } = await sb
      .from('reviews')
      .select('game_id, rating, created_at')
      .gte('created_at', since)
      .limit(8000);
    
    if (reviewsError) {
      console.error('Reviews query error:', reviewsError);
    } else {
      console.log('Reviews query success:', reviews?.length || 0, 'reviews');
    }
    
  } catch (error) {
    console.error('Debug error:', error);
  }
}

debugAPI();
