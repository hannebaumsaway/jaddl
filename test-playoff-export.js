/**
 * Test script for playoff export functionality
 * 
 * Usage: node test-playoff-export.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials. Check your .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testBasicData() {
  console.log('🔍 Testing basic data availability...\n');
  
  try {
    // Test 1: Check if we have teams
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('team_id, team_name')
      .limit(5);
    
    if (teamsError) {
      console.error('❌ Error fetching teams:', teamsError.message);
      return false;
    }
    console.log(`✅ Teams: Found ${teams?.length || 0} teams`);
    if (teams && teams.length > 0) {
      console.log(`   Sample: ${teams[0].team_name} (ID: ${teams[0].team_id})`);
    }
    
    // Test 2: Check if we have games
    const currentYear = new Date().getFullYear();
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('year, week, home_team_id, away_team_id, home_score, away_score, playoffs')
      .eq('year', currentYear)
      .limit(5);
    
    if (gamesError) {
      console.error('❌ Error fetching games:', gamesError.message);
      return false;
    }
    console.log(`✅ Games: Found ${games?.length || 0} games for ${currentYear}`);
    if (games && games.length > 0) {
      const completed = games.filter(g => g.home_score !== null && g.away_score !== null);
      console.log(`   Completed games: ${completed.length}`);
      console.log(`   Sample week: ${games[0].week}`);
    }
    
    // Test 3: Check league seasons
    const { data: leagueSeason, error: seasonError } = await supabase
      .from('league_seasons')
      .select('*')
      .eq('year', currentYear)
      .single();
    
    if (seasonError && seasonError.code !== 'PGRST116') {
      console.error('❌ Error fetching league season:', seasonError.message);
      return false;
    }
    if (leagueSeason) {
      console.log(`✅ League Season: ${currentYear} (${leagueSeason.team_count} teams, ${leagueSeason.playoff_teams || 'N/A'} playoff spots)`);
    } else {
      console.log(`⚠️  No league season data for ${currentYear}`);
    }
    
    // Test 4: Check team seasons (for divisions/quads)
    const { data: teamSeasons, error: tsError } = await supabase
      .from('team_seasons')
      .select('*')
      .eq('year', currentYear)
      .limit(5);
    
    if (tsError) {
      console.error('❌ Error fetching team seasons:', tsError.message);
      return false;
    }
    console.log(`✅ Team Seasons: Found ${teamSeasons?.length || 0} team seasons for ${currentYear}`);
    if (teamSeasons && teamSeasons.length > 0) {
      const withQuads = teamSeasons.filter(ts => ts.quad_id !== null && ts.quad_id !== undefined);
      const withDivs = teamSeasons.filter(ts => ts.division_id !== null && ts.division_id !== undefined);
      console.log(`   Teams with quads: ${withQuads.length}`);
      console.log(`   Teams with divisions: ${withDivs.length}`);
    }
    
    // Test 5: Check quads/divisions
    const { data: quads, error: quadsError } = await supabase
      .from('quads')
      .select('*')
      .eq('year', currentYear);
    
    const { data: divisions, error: divsError } = await supabase
      .from('divisions')
      .select('*')
      .eq('year', currentYear);
    
    if (quads && quads.length > 0) {
      console.log(`✅ Quads: Found ${quads.length} quads`);
      quads.forEach(q => console.log(`   - ${q.quad_name}`));
    } else if (divisions && divisions.length > 0) {
      console.log(`✅ Divisions: Found ${divisions.length} divisions`);
      divisions.forEach(d => console.log(`   - ${d.division_name}`));
    } else {
      console.log(`⚠️  No quads or divisions found for ${currentYear}`);
    }
    
    console.log('\n✅ Basic data checks passed!\n');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

async function testAPIEndpoint() {
  console.log('🌐 Testing API endpoint (requires dev server running)...\n');
  console.log('   To test:');
  console.log('   1. Start dev server: pnpm dev');
  console.log('   2. Visit: http://localhost:3000/api/export-playoff-data?year=2025');
  console.log('   3. Or use curl:');
  console.log('      curl "http://localhost:3000/api/export-playoff-data?year=2025" | jq .markdown\n');
}

async function testCommandLineScript() {
  console.log('📝 Testing command-line script...\n');
  console.log('   To test:');
  console.log('   node export-playoff-data.js 2025 4\n');
}

async function main() {
  console.log('🧪 Playoff Export Test Suite\n');
  console.log('='.repeat(50) + '\n');
  
  const basicTest = await testBasicData();
  
  if (basicTest) {
    await testAPIEndpoint();
    await testCommandLineScript();
    
    console.log('='.repeat(50));
    console.log('\n✅ All tests completed!');
    console.log('\nNext steps:');
    console.log('1. Start your dev server: pnpm dev');
    console.log('2. Log into admin: http://localhost:3000/admin/login');
    console.log('3. Navigate to "Playoff Export" tab');
    console.log('4. Select year/week and click "Export Data"');
    console.log('5. Copy the markdown and paste into ChatGPT\n');
  } else {
    console.log('\n❌ Basic tests failed. Please check your database setup.\n');
    process.exit(1);
  }
}

main();


