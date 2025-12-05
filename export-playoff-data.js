/**
 * Export playoff scenario data for ChatGPT analysis
 * 
 * Usage: node export-playoff-data.js [year] [week]
 * Example: node export-playoff-data.js 2025 4
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials. Check your .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Get command line arguments
const year = parseInt(process.argv[2]) || new Date().getFullYear();
const currentWeek = parseInt(process.argv[3]) || null;

async function getCurrentWeek(year) {
  if (currentWeek) return currentWeek;
  
  const { data } = await supabase
    .from('games')
    .select('week')
    .eq('year', year)
    .order('week', { ascending: false })
    .limit(1)
    .single();
  
  return data?.week || 1;
}

async function getStandings(year) {
  // Get all games for the season
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .eq('year', year);
  
  // Get all teams
  const { data: teams } = await supabase
    .from('teams')
    .select('*')
    .order('team_id');
  
  // Get team seasons
  const { data: teamSeasons } = await supabase
    .from('team_seasons')
    .select('*')
    .eq('year', year);
  
  // Get league season info
  const { data: leagueSeason } = await supabase
    .from('league_seasons')
    .select('*')
    .eq('year', year)
    .single();
  
  // Calculate standings
  const teamRecords = {};
  
  teams.forEach(team => {
    teamRecords[team.team_id] = {
      team_id: team.team_id,
      team_name: team.team_name,
      wins: 0,
      losses: 0,
      ties: 0,
      points_for: 0,
      points_against: 0,
    };
  });
  
  // Process completed games
  (games || []).forEach(game => {
    if (game.home_score !== null && game.away_score !== null && !game.playoffs) {
      const home = teamRecords[game.home_team_id];
      const away = teamRecords[game.away_team_id];
      
      if (home && away) {
        home.points_for += game.home_score;
        home.points_against += game.away_score;
        away.points_for += game.away_score;
        away.points_against += game.home_score;
        
        if (game.home_score > game.away_score) {
          home.wins++;
          away.losses++;
        } else if (game.away_score > game.home_score) {
          away.wins++;
          home.losses++;
        } else {
          home.ties++;
          away.ties++;
        }
      }
    }
  });
  
  // Calculate win percentage and sort
  const standings = Object.values(teamRecords)
    .map(record => ({
      ...record,
      win_pct: (record.wins + record.ties * 0.5) / (record.wins + record.losses + record.ties || 1),
      games_played: record.wins + record.losses + record.ties,
    }))
    .sort((a, b) => {
      if (b.win_pct !== a.win_pct) return b.win_pct - a.win_pct;
      return b.points_for - a.points_for;
    });
  
  return {
    standings,
    playoff_teams: leagueSeason?.playoff_teams || 6,
    total_teams: leagueSeason?.team_count || teams.length,
  };
}

async function getHeadToHeadRecords(year) {
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .eq('year', year)
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
    .eq('playoffs', false);
  
  const { data: teams } = await supabase
    .from('teams')
    .select('team_id, team_name')
    .order('team_id');
  
  const teamMap = new Map(teams.map(t => [t.team_id, t.team_name]));
  const h2h = {};
  
  // Initialize all pairs
  teams.forEach(t1 => {
    teams.forEach(t2 => {
      if (t1.team_id !== t2.team_id) {
        const key = [t1.team_id, t2.team_id].sort().join('-');
        if (!h2h[key]) {
          h2h[key] = {
            team1_id: Math.min(t1.team_id, t2.team_id),
            team1_name: teamMap.get(Math.min(t1.team_id, t2.team_id)),
            team2_id: Math.max(t1.team_id, t2.team_id),
            team2_name: teamMap.get(Math.max(t1.team_id, t2.team_id)),
            team1_wins: 0,
            team2_wins: 0,
            ties: 0,
            games: [],
          };
        }
      }
    });
  });
  
  // Process games
  (games || []).forEach(game => {
    const key = [game.home_team_id, game.away_team_id].sort().join('-');
    const record = h2h[key];
    
    if (record) {
      const isTeam1Home = game.home_team_id === record.team1_id;
      const team1Score = isTeam1Home ? game.home_score : game.away_score;
      const team2Score = isTeam1Home ? game.away_score : game.home_score;
      
      record.games.push({
        week: game.week,
        team1_score: team1Score,
        team2_score: team2Score,
      });
      
      if (team1Score > team2Score) {
        record.team1_wins++;
      } else if (team2Score > team1Score) {
        record.team2_wins++;
      } else {
        record.ties++;
      }
    }
  });
  
  // Filter to only pairs with games played
  return Object.values(h2h).filter(r => r.games.length > 0);
}

async function getRemainingSchedule(year, week) {
  const { data: games } = await supabase
    .from('games')
    .select('*, home_team:teams!home_team_id(team_name), away_team:teams!away_team_id(team_name)')
    .eq('year', year)
    .gte('week', week)
    .eq('playoffs', false)
    .order('week', { ascending: true })
    .order('id', { ascending: true });
  
  return games || [];
}

function formatOutput(data) {
  const { standings, playoff_teams, total_teams, h2h, remaining, week, year } = data;
  
  let output = `# Fantasy Football League Playoff Scenario Analysis\n\n`;
  output += `**Season:** ${year}\n`;
  output += `**Current Week:** ${week}\n`;
  output += `**Total Teams:** ${total_teams}\n`;
  output += `**Playoff Structure:**\n`;
  output += `- **Regular Season:** Weeks 1-13\n`;
  output += `- **Week 14 (Play-in Round):** 4 Division/Quad winners get BYEs. Remaining 8 teams play in Week 14.\n`;
  output += `- **After Week 14:** Top 4 TOTAL SEASON points scorers from the 8 non-division/quad winner teams advance.\n`;
  output += `- **Weeks 15-17 (Playoffs):** 8 teams (4 Division/Quad winners + 4 highest total points from play-in teams)\n\n`;
  output += `*Note: Advancement is based on total points for the entire season, not just Week 14 performance.*\n`;
  output += `*For detailed division/quad standings and winner identification, use the web interface.*\n\n`;
  
  output += `## Current Standings (Regular Season Only)\n\n`;
  output += `| Rank | Team | W | L | T | Win % | Points For | Points Against | Point Diff |\n`;
  output += `|------|------|---|---|---|-------|------------|---------------|------------|\n`;
  
  standings.forEach((team, index) => {
    const status = index < playoff_teams ? '✅' : index < playoff_teams + 2 ? '🔶' : '';
    output += `| ${index + 1}${status} | ${team.team_name} | ${team.wins} | ${team.losses} | ${team.ties} | ${(team.win_pct * 100).toFixed(1)}% | ${team.points_for.toFixed(1)} | ${team.points_against.toFixed(1)} | ${(team.points_for - team.points_against).toFixed(1)} |\n`;
  });
  
  output += `\n*✅ = In playoffs | 🔶 = On the bubble*\n\n`;
  
  output += `## Head-to-Head Records\n\n`;
  output += `*Only showing teams that have played each other*\n\n`;
  
  h2h.forEach(record => {
    output += `### ${record.team1_name} vs ${record.team2_name}\n`;
    output += `- **Record:** ${record.team1_name} ${record.team1_wins}-${record.team2_wins}-${record.ties} ${record.team2_name}\n`;
    output += `- **Games:**\n`;
    record.games.forEach(game => {
      output += `  - Week ${game.week}: ${record.team1_name} ${game.team1_score}, ${record.team2_name} ${game.team2_score}\n`;
    });
    output += `\n`;
  });
  
  output += `## Remaining Schedule (Weeks ${week}-14)\n\n`;
  
  const gamesByWeek = {};
  remaining.forEach(game => {
    if (!gamesByWeek[game.week]) {
      gamesByWeek[game.week] = [];
    }
    gamesByWeek[game.week].push(game);
  });
  
  Object.keys(gamesByWeek).sort((a, b) => a - b).forEach(weekNum => {
    output += `### Week ${weekNum}\n`;
    gamesByWeek[weekNum].forEach(game => {
      const homeName = game.home_team?.team_name || `Team ${game.home_team_id}`;
      const awayName = game.away_team?.team_name || `Team ${game.away_team_id}`;
      const score = game.home_score !== null && game.away_score !== null
        ? ` (${game.home_score} - ${game.away_score})`
        : '';
      output += `- ${homeName} vs ${awayName}${score}\n`;
    });
    output += `\n`;
  });
  
  output += `## Tiebreaker Rules\n\n`;
  output += `1. Head-to-head record\n`;
  output += `2. Total points scored\n`;
  output += `3. Points against (lower is better)\n`;
  output += `4. Coin flip (if still tied)\n\n`;
  
  output += `---\n\n`;
  output += `*Use this data to analyze playoff scenarios, potential tiebreakers, and remaining matchups that could affect playoff positioning.*\n`;
  
  return output;
}

async function main() {
  try {
    console.log(`Exporting playoff data for ${year}...`);
    
    const week = await getCurrentWeek(year);
    console.log(`Current week: ${week}`);
    
    const [standingsData, h2h, remaining] = await Promise.all([
      getStandings(year),
      getHeadToHeadRecords(year),
      getRemainingSchedule(year, week),
    ]);
    
    const output = formatOutput({
      ...standingsData,
      h2h,
      remaining,
      week,
      year,
    });
    
    console.log('\n' + '='.repeat(80));
    console.log(output);
    console.log('='.repeat(80));
    console.log('\n✅ Data exported! Copy the output above and paste it into ChatGPT.');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();

