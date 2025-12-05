import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateStandings } from '@/lib/supabase/api';
import { getGames } from '@/lib/supabase/api';
import { getTeams } from '@/lib/supabase/api';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || '') || new Date().getFullYear();
    const week = parseInt(searchParams.get('week') || '') || null;

    // Get current week if not provided
    let currentWeek: number;
    if (week !== null && week > 0) {
      currentWeek = week;
    } else {
      const { data } = await supabase
        .from('games')
        .select('week')
        .eq('year', year)
        .order('week', { ascending: false })
        .limit(1)
        .single();
      currentWeek = (data?.week ?? 1) as number;
    }

    // Get standings
    const standingsData = await calculateStandings(year);
    const standings = standingsData.overall;

    // Get league season info
    const { data: leagueSeason } = await supabase
      .from('league_seasons')
      .select('*')
      .eq('year', year)
      .single();

    // Get team seasons to identify division/quad winners
    const { data: teamSeasons } = await supabase
      .from('team_seasons')
      .select('*')
      .eq('year', year);

    // Get divisions/quads
    const { data: quads } = await supabase
      .from('quads')
      .select('*')
      .eq('year', year)
      .order('quad_id');

    const { data: divisions } = await supabase
      .from('divisions')
      .select('*')
      .eq('year', year)
      .order('division_id');

    // Determine structure type
    const structureType = leagueSeason?.structure_type || (quads && quads.length > 0 ? 'quads' : divisions && divisions.length > 0 ? 'divisions' : 'single_league');
    const useQuads = structureType === 'quads';

    // Get all games first (needed for clinch calculations)
    const allGames = await getGames(year, undefined, undefined, false);
    
    // Get teams (needed for Week 13 matchup lookup)
    const teams = await getTeams();
    
    // Get remaining games to calculate clinch scenarios
    const { data: remainingGamesFromDb } = await supabase
      .from('games')
      .select('*')
      .eq('year', year)
      .gte('week', currentWeek)
      .lte('week', 13) // Regular season ends Week 13
      .eq('playoffs', false);

    // Add Week 13 matchups if they don't exist in database yet
    // These are the known Week 13 matchups for 2025 season
    let remainingGames = [...(remainingGamesFromDb || [])];
    if (currentWeek <= 13 && year === 2025) {
      const week13Matchups = [
        { home: 'Fightin\' Longshanks', away: 'Team Odouls' },
        { home: 'In Pursuit of Perfection', away: 'Bad News Bensons' },
        { home: 'Lanniesters', away: 'Mighty Boom' },
        { home: 'Tulsa Angry Monkeys', away: 'Red Hornets' },
        { home: 'Team Hauloll', away: 'Nate\'s Dinos or Whoever' },
        { home: 'Lawrence Football Jesus', away: 'Millennium Falcons' },
      ];

      const existingWeek13 = remainingGames.filter(g => g.week === 13);
      const existingWeek13Teams = new Set(
        existingWeek13.map(g => {
          const homeName = teams.find(t => t.team_id === g.home_team_id)?.team_name;
          const awayName = teams.find(t => t.team_id === g.away_team_id)?.team_name;
          return [homeName, awayName].filter(Boolean).sort().join('-');
        })
      );

      week13Matchups.forEach(matchup => {
        const matchupKey = [matchup.home, matchup.away].sort().join('-');
        if (!existingWeek13Teams.has(matchupKey)) {
          const homeTeam = teams.find(t => t.team_name === matchup.home);
          const awayTeam = teams.find(t => t.team_name === matchup.away);
          if (homeTeam && awayTeam) {
            remainingGames.push({
              id: null, // Not in DB yet
              year: year,
              week: 13,
              home_team_id: homeTeam.team_id,
              away_team_id: awayTeam.team_id,
              home_score: null,
              away_score: null,
              playoffs: false,
            });
          }
        }
      });
    }

    // Build lookup for team division/quad IDs
    const teamIdToDivisionId = new Map<number, number | null | undefined>();
    const teamIdToQuadId = new Map<number, number | null | undefined>();
    (teamSeasons || []).forEach(ts => {
      teamIdToDivisionId.set(ts.team_id, ts.division_id);
      teamIdToQuadId.set(ts.team_id, ts.quad_id);
    });

    // Identify division/quad winners (current leaders based on standings)
    const divisionWinners = new Set<number>();
    
    if (useQuads && quads && quads.length > 0) {
      quads.forEach(quad => {
        const quadStandings = standingsData.quads?.[quad.quad_name] || [];
        if (quadStandings.length > 0) {
          const leader = quadStandings[0];
          divisionWinners.add(leader.team_id);
        }
      });
    } else if (divisions && divisions.length > 0) {
      divisions.forEach(division => {
        const divStandings = standingsData.divisions?.[division.division_name] || [];
        if (divStandings.length > 0) {
          const leader = divStandings[0];
          divisionWinners.add(leader.team_id);
        }
      });
    }

    // Get completed regular season games for head-to-head
    const regularSeasonGames = allGames.filter(g => !g.playoffs && g.home_score !== null && g.away_score !== null);

    // Calculate head-to-head records (teams already fetched above)
    const teamMap = new Map(teams.map(t => [t.team_id, t]));
    const h2hMap = new Map<string, any>();

    regularSeasonGames.forEach(game => {
      const team1Id = Math.min(game.home_team_id, game.away_team_id);
      const team2Id = Math.max(game.home_team_id, game.away_team_id);
      const key = `${team1Id}-${team2Id}`;

      if (!h2hMap.has(key)) {
        h2hMap.set(key, {
          team1_id: team1Id,
          team1_name: teamMap.get(team1Id)?.team_name || `Team ${team1Id}`,
          team2_id: team2Id,
          team2_name: teamMap.get(team2Id)?.team_name || `Team ${team2Id}`,
          team1_wins: 0,
          team2_wins: 0,
          ties: 0,
          games: [],
        });
      }

      const record = h2hMap.get(key)!;
      const isTeam1Home = game.home_team_id === team1Id;
      const team1Score = isTeam1Home ? game.home_score! : game.away_score!;
      const team2Score = isTeam1Home ? game.away_score! : game.home_score!;

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
    });

    const h2h = Array.from(h2hMap.values()).filter(r => r.games.length > 0);

    // Get remaining schedule (with team names for display)
    const { data: remainingGamesWithTeamsFromDb } = await supabase
      .from('games')
      .select('*, home_team:teams!home_team_id(team_name), away_team:teams!away_team_id(team_name)')
      .eq('year', year)
      .gte('week', currentWeek)
      .eq('playoffs', false)
      .order('week', { ascending: true })
      .order('id', { ascending: true });

    // Add Week 13 matchups if they don't exist in database yet
    let remainingGamesWithTeams = [...(remainingGamesWithTeamsFromDb || [])];
    if (currentWeek <= 13 && year === 2025) {
      const week13Matchups = [
        { home: 'Fightin\' Longshanks', away: 'Team Odouls' },
        { home: 'In Pursuit of Perfection', away: 'Bad News Bensons' },
        { home: 'Lanniesters', away: 'Mighty Boom' },
        { home: 'Tulsa Angry Monkeys', away: 'Red Hornets' },
        { home: 'Team Hauloll', away: 'Nate\'s Dinos or Whoever' },
        { home: 'Lawrence Football Jesus', away: 'Millennium Falcons' },
      ];

      const existingWeek13 = remainingGamesWithTeams.filter(g => g.week === 13);
      const existingWeek13Teams = new Set(
        existingWeek13.map(g => [
          g.home_team?.team_name || teams.find(t => t.team_id === g.home_team_id)?.team_name,
          g.away_team?.team_name || teams.find(t => t.team_id === g.away_team_id)?.team_name
        ].filter(Boolean).sort().join('-'))
      );

      week13Matchups.forEach(matchup => {
        const matchupKey = [matchup.home, matchup.away].sort().join('-');
        if (!existingWeek13Teams.has(matchupKey)) {
          const homeTeam = teams.find(t => t.team_name === matchup.home);
          const awayTeam = teams.find(t => t.team_name === matchup.away);
          if (homeTeam && awayTeam) {
            remainingGamesWithTeams.push({
              id: null,
              year: year,
              week: 13,
              home_team_id: homeTeam.team_id,
              away_team_id: awayTeam.team_id,
              home_score: null,
              away_score: null,
              playoffs: false,
              home_team: { team_name: matchup.home },
              away_team: { team_name: matchup.away },
            });
          }
        }
      });
    }

    // Format output
    const playoffTeams = leagueSeason?.playoff_teams || 8;
    const totalTeams = leagueSeason?.team_count || teams.length;

    let output = `# Fantasy Football League Playoff Scenario Analysis\n\n`;
    output += `**Season:** ${year}\n`;
    output += `**Current Week:** ${currentWeek}\n`;
    output += `**Total Teams:** ${totalTeams}\n`;
    output += `**Playoff Structure:**\n`;
    output += `- **Regular Season:** Weeks 1-13\n`;
    output += `- **Week 14 (Play-in Round):** 4 ${useQuads ? 'Quad' : 'Division'} winners get BYEs. Remaining 8 teams play in Week 14.\n`;
    output += `- **After Week 14:** Top 4 TOTAL SEASON points scorers from the 8 non-${useQuads ? 'quad' : 'division'} winner teams advance.\n`;
    output += `- **Weeks 15-17 (Playoffs):** 8 teams (4 ${useQuads ? 'Quad' : 'Division'} winners + 4 highest total points from play-in teams)\n\n`;

    output += `## Current Standings (Regular Season Only)\n\n`;
    output += `| Rank | Team | W | L | T | Win % | Points For | Points Against | Point Diff | Status |\n`;
    output += `|------|------|---|---|---|-------|------------|---------------|------------|--------|\n`;

    standings.forEach((team, index) => {
      const isDivisionWinner = divisionWinners.has(team.team_id);
      let status = '⚪';
      if (isDivisionWinner) {
        status = '🏆 BYE (Week 14)';
      } else if (currentWeek >= 14) {
        status = '🔶 Play-in';
      }
      const winPct = team.wins + team.losses + team.ties > 0
        ? ((team.wins + team.ties * 0.5) / (team.wins + team.losses + team.ties) * 100).toFixed(1)
        : '0.0';
      output += `| ${index + 1} | ${team.team.team_name} | ${team.wins} | ${team.losses} | ${team.ties} | ${winPct}% | ${team.points_for.toFixed(1)} | ${team.points_against.toFixed(1)} | ${team.point_differential.toFixed(1)} | ${status} |\n`;
    });

    output += `\n*🏆 = Current ${useQuads ? 'Quad' : 'Division'} Leader | 🔶 = In Week 14 Play-in | ⚪ = Regular season*\n\n`;

    // Show division/quad standings if applicable
    if (useQuads && standingsData.quads) {
      output += `## ${useQuads ? 'Quad' : 'Division'} Standings\n\n`;
      Object.entries(standingsData.quads).forEach(([quadName, quadStandings]) => {
        output += `### ${quadName}\n`;
        output += `| Rank | Team | W | L | T | Win % | Points For | Div W | Div L | Div T |\n`;
        output += `|------|------|---|---|---|-------|------------|-------|-------|-------|\n`;
        quadStandings.forEach((team, index) => {
          const isWinner = index === 0;
          const winPct = team.wins + team.losses + team.ties > 0
            ? ((team.wins + team.ties * 0.5) / (team.wins + team.losses + team.ties) * 100).toFixed(1)
            : '0.0';
          const divWins = (team as any).quad_wins ?? team.division_wins ?? 0;
          const divLosses = (team as any).quad_losses ?? team.division_losses ?? 0;
          const divTies = (team as any).quad_ties ?? team.division_ties ?? 0;
          const status = isWinner ? '🏆' : '';
          output += `| ${index + 1}${status} | ${team.team.team_name} | ${team.wins} | ${team.losses} | ${team.ties} | ${winPct}% | ${team.points_for.toFixed(1)} | ${divWins} | ${divLosses} | ${divTies} |\n`;
        });
        output += `\n`;
      });
    } else if (standingsData.divisions) {
      output += `## Division Standings\n\n`;
      Object.entries(standingsData.divisions).forEach(([divName, divStandings]) => {
        output += `### ${divName}\n`;
        output += `| Rank | Team | W | L | T | Win % | Points For | Div W | Div L | Div T |\n`;
        output += `|------|------|---|---|---|-------|------------|-------|-------|-------|\n`;
        divStandings.forEach((team, index) => {
          const isWinner = index === 0;
          const winPct = team.wins + team.losses + team.ties > 0
            ? ((team.wins + team.ties * 0.5) / (team.wins + team.losses + team.ties) * 100).toFixed(1)
            : '0.0';
          const divWins = team.division_wins ?? 0;
          const divLosses = team.division_losses ?? 0;
          const divTies = team.division_ties ?? 0;
          const status = isWinner ? '🏆' : '';
          output += `| ${index + 1}${status} | ${team.team.team_name} | ${team.wins} | ${team.losses} | ${team.ties} | ${winPct}% | ${team.points_for.toFixed(1)} | ${divWins} | ${divLosses} | ${divTies} |\n`;
        });
        output += `\n`;
      });
    }

    output += `## Head-to-Head Records\n\n`;
    output += `*Only showing teams that have played each other*\n\n`;

    h2h.forEach(record => {
      output += `### ${record.team1_name} vs ${record.team2_name}\n`;
      output += `- **Record:** ${record.team1_name} ${record.team1_wins}-${record.team2_wins}-${record.ties} ${record.team2_name}\n`;
      output += `- **Games:**\n`;
      record.games.forEach((game: any) => {
        output += `  - Week ${game.week}: ${record.team1_name} ${game.team1_score}, ${record.team2_name} ${game.team2_score}\n`;
      });
      output += `\n`;
    });

    output += `## Remaining Schedule (Weeks ${currentWeek}-14)\n\n`;

    const gamesByWeek: Record<number, any[]> = {};
    (remainingGamesWithTeams || []).forEach((game: any) => {
      if (!gamesByWeek[game.week]) {
        gamesByWeek[game.week] = [];
      }
      gamesByWeek[game.week].push(game);
    });

    Object.keys(gamesByWeek)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach(weekNum => {
        const isPlayInWeek = weekNum === 14;
        output += `### Week ${weekNum}${isPlayInWeek ? ' (Play-in Round)' : ''}\n`;
        if (isPlayInWeek) {
          output += `*4 ${useQuads ? 'Quad' : 'Division'} winners have BYEs this week*\n\n`;
        }
        gamesByWeek[weekNum].forEach((game: any) => {
          const homeName = game.home_team?.team_name || `Team ${game.home_team_id}`;
          const awayName = game.away_team?.team_name || `Team ${game.away_team_id}`;
          const homeHasBye = isPlayInWeek && divisionWinners.has(game.home_team_id);
          const awayHasBye = isPlayInWeek && divisionWinners.has(game.away_team_id);
          const score = game.home_score !== null && game.away_score !== null
            ? ` (${game.home_score} - ${game.away_score})`
            : '';
          const byeNote = homeHasBye || awayHasBye ? ' 🏆 BYE' : '';
          output += `- ${homeName} vs ${awayName}${score}${byeNote}\n`;
        });
        output += `\n`;
      });

    // Show Week 14 play-in scenario if we're at or past Week 13
    if (currentWeek >= 13) {
      output += `## Week 14 Play-in Scenario\n\n`;
      output += `### ${useQuads ? 'Quad' : 'Division'} Winners (BYE Week 14):\n`;
      const winnerTeams = standings.filter(s => divisionWinners.has(s.team_id));
      winnerTeams.forEach((team, index) => {
        output += `${index + 1}. ${team.team.team_name} (${team.wins}-${team.losses}-${team.ties}, ${team.points_for.toFixed(1)} total PF)\n`;
      });
      output += `\n### Teams in Week 14 Play-in (Top 4 TOTAL SEASON points advance):\n`;
      const playInTeams = standings
        .filter(s => !divisionWinners.has(s.team_id))
        .sort((a, b) => b.points_for - a.points_for); // Sort by total points
      playInTeams.forEach((team, index) => {
        const status = index < 4 ? '✅' : '❌';
        output += `${index + 1}. ${status} ${team.team.team_name} (${team.wins}-${team.losses}-${team.ties}, ${team.points_for.toFixed(1)} total PF)\n`;
      });
      output += `\n*✅ = Currently in top 4 total points | ❌ = Outside top 4*\n`;
      output += `*Note: Final standings after Week 14 determine which 4 teams advance*\n\n`;
    }

    output += `## Playoff Qualification Rules\n\n`;
    output += `### ${useQuads ? 'Quad' : 'Division'} Winners:\n`;
    output += `- Top team in each ${useQuads ? 'quad' : 'division'} determined by tiebreaker rules below\n`;
    output += `- Receive automatic playoff bid and BYE in Week 14\n\n`;
    output += `### Week 14 Play-in:\n`;
    output += `- Remaining 8 teams play in Week 14\n`;
    output += `- After Week 14, top 4 TOTAL SEASON points scorers from these 8 teams advance\n`;
    output += `- Join the 4 ${useQuads ? 'Quad' : 'Division'} winners for 8-team playoff bracket\n`;
    output += `- *Advancement is based on total points for the entire season, not just Week 14 performance*\n\n`;
    output += `### Tiebreaker Rules (for ${useQuads ? 'Quad' : 'Division'} winners):\n`;
    output += `1. Overall record (win %)\n`;
    output += `2. Division/Quad record (win %)\n`;
    output += `3. Head-to-head record\n`;
    output += `4. Total points scored\n\n`;

    output += `---\n\n`;
    output += `*Use this data to analyze playoff scenarios, ${useQuads ? 'quad' : 'division'} winner races, Week 14 play-in positioning, and remaining matchups that could affect playoff qualification.*\n`;

    return NextResponse.json({
      markdown: output,
      data: {
        year,
        week: currentWeek,
        playoff_teams: playoffTeams,
        total_teams: totalTeams,
        standings,
        head_to_head: h2h,
        remaining_schedule: remainingGamesWithTeams || [],
      },
    });
  } catch (error: any) {
    console.error('Error exporting playoff data:', error);
    return NextResponse.json(
      { error: 'Failed to export playoff data', details: error.message },
      { status: 500 }
    );
  }
}

