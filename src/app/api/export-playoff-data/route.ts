import { NextResponse } from 'next/server';
import { calculateStandings, calculatePlayoffSeeds, savePlayoffSeeds, getPlayoffSeeds, getPlayoffPods, getSeasonConfig } from '@/lib/supabase/api';
import { getGames } from '@/lib/supabase/api';
import { getTeams } from '@/lib/supabase/api';

// Reads only — the shared anon client is correct here. This route previously
// built its own client falling back from the service key to the anon key,
// which meant a service key, if present, was used for plain reads too.
import { supabase } from '@/lib/supabase/client';

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
      const { data } = await (supabase as any)
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
    const { data: leagueSeason } = await (supabase as any)
      .from('league_seasons')
      .select('*')
      .eq('year', year)
      .single();

    // Season format: playoff field size, wildcard rule, regular-season length.
    const config = getSeasonConfig(year);
    const regularSeasonEnd = config.regularSeasonWeeks;

    // Structure comes from league_seasons. Note the divisions and quads tables
    // have no year column — a season's grouping lives in team_seasons — so they
    // must not be filtered by year.
    const structureType = leagueSeason?.structure_type || 'single_league';
    const useQuads = structureType === 'quads';
    const groupLabel = useQuads ? 'Quad' : 'Division';

    const allGames = await getGames(year, undefined, undefined, false);
    const teams = await getTeams();

    // Projected playoff field as of right now. Reusing calculatePlayoffSeeds
    // keeps this export consistent with the real seeding logic — group winners
    // on top, wildcards filling the rest, same tiebreaker chain — instead of
    // re-deriving winners here. allowCompletedSeason is set because exporting a
    // finished season for analysis is a legitimate projection.
    const projectedSeeds = await calculatePlayoffSeeds(year, { allowCompletedSeason: true });
    const divisionWinners = new Set(
      projectedSeeds.filter(s => s.isDivisionWinner).map(s => s.team_id)
    );
    const seededTeamIds = new Set(projectedSeeds.map(s => s.team_id));

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
    const { data: remainingGamesWithTeamsFromDb } = await (supabase as any)
      .from('games')
      .select('*, home_team:teams!home_team_id(team_name), away_team:teams!away_team_id(team_name)')
      .eq('year', year)
      .gte('week', currentWeek)
      .eq('playoffs', false)
      .order('week', { ascending: true })
      .order('id', { ascending: true });

    const remainingGamesWithTeams = [...(remainingGamesWithTeamsFromDb || [])];

    // Format output. Field size comes from the season config — league_seasons
    // has no playoff_teams column.
    const playoffTeams = config.playoffTeams;
    const totalTeams = leagueSeason?.team_count || teams.length;
    const groupWinnerCount = divisionWinners.size;
    const wildcardCount = Math.max(0, playoffTeams - groupWinnerCount);
    const wildcardBasis = config.wildcardRule === 'points'
      ? 'highest total season points'
      : 'best overall record';

    let output = `# Fantasy Football League Playoff Scenario Analysis\n\n`;
    output += `**Season:** ${year}\n`;
    output += `**Current Week:** ${currentWeek}\n`;
    output += `**Total Teams:** ${totalTeams}\n`;
    output += `**Playoff Structure:**\n`;
    
    output += `- **Structure:** ${groupWinnerCount} ${groupLabel.toLowerCase()}${groupWinnerCount === 1 ? '' : 's'}, ${totalTeams} teams\n`;
    output += `- **Playoff Field:** ${playoffTeams} teams — ${groupWinnerCount} ${groupLabel.toLowerCase()} winner${groupWinnerCount === 1 ? '' : 's'} + ${wildcardCount} wildcard${wildcardCount === 1 ? '' : 's'}\n`;

    if (config.usesPods) {
      output += `- **Regular Season (${groupLabel} Standings):** Weeks 1-${regularSeasonEnd - 1} only (Week ${regularSeasonEnd} does NOT count toward ${groupLabel.toLowerCase()} standings)\n`;
      output += `- **Week ${regularSeasonEnd}:** Counts only toward the points title and wildcard qualification\n`;
      output += `- **Playoff Seeding:**\n`;
      output += `  - Seeds 1-${groupWinnerCount}: ${groupLabel} winners (seeded by overall record)\n`;
      output += `  - Seeds ${groupWinnerCount + 1}-${playoffTeams}: Wildcards (${wildcardBasis})\n`;
      output += `- **Week 15 Playoffs:**\n`;
      output += `  - Seeds 1-2: BYE (automatically advance to semifinals)\n`;
      output += `  - Pod A: Seeds 3, 5, 8 (highest score advances to semifinals)\n`;
      output += `  - Pod B: Seeds 4, 6, 7 (highest score advances to semifinals)\n`;
      output += `- **Weeks 16-17:** Semifinals and Championship\n\n`;
    } else {
      output += `- **Regular Season:** Weeks 1-${regularSeasonEnd} (all weeks count toward records)\n`;
      output += `- **Playoff Seeding:**\n`;
      output += `  - Seeds 1-${groupWinnerCount}: ${groupLabel} winners — first-round BYE\n`;
      output += `  - Seeds ${groupWinnerCount + 1}-${playoffTeams}: Wildcards (${wildcardBasis})\n`;
      output += `- **Playoffs:** ${playoffTeams}-team bracket recorded as rounds — Round 1 (quarterfinals), Round 2 (semifinals), Round 3 (championship)\n\n`;
    }

    output += `## Current Standings (Regular Season Only)\n\n`;
    output += `| Rank | Team | W | L | T | Win % | Points For | Points Against | Point Diff | Status |\n`;
    output += `|------|------|---|---|---|-------|------------|---------------|------------|--------|\n`;

    standings.forEach((team, index) => {
      const seed = projectedSeeds.find(s => s.team_id === team.team_id);
      let status = '⚪';
      if (seed?.isDivisionWinner) {
        status = config.usesPods
          ? `🏆 ${groupLabel} winner (seed ${seed.seed})`
          : `🏆 ${groupLabel} winner — BYE (seed ${seed.seed})`;
      } else if (seed) {
        status = `🎯 Wildcard (seed ${seed.seed})`;
      } else if (config.usesPods && currentWeek >= regularSeasonEnd) {
        status = '🔶 Play-in';
      }
      const winPct = team.wins + team.losses + team.ties > 0
        ? ((team.wins + team.ties * 0.5) / (team.wins + team.losses + team.ties) * 100).toFixed(1)
        : '0.0';
      output += `| ${index + 1} | ${team.team.team_name} | ${team.wins} | ${team.losses} | ${team.ties} | ${winPct}% | ${team.points_for.toFixed(1)} | ${team.points_against.toFixed(1)} | ${team.point_differential.toFixed(1)} | ${status} |\n`;
    });

    output += `\n*🏆 = Projected ${groupLabel.toLowerCase()} winner | 🎯 = Projected wildcard | ⚪ = Outside the field*\n`;
    output += `*Projection reflects results through Week ${currentWeek}.*\n\n`;

    // Show division/quad standings if applicable
    if (useQuads && standingsData.quads) {
      output += `## ${groupLabel} Standings\n\n`;
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

    output += `## Remaining Schedule (Weeks ${currentWeek}-${regularSeasonEnd})\n\n`;

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
        // Only pod-format seasons treat the final week as a play-in round.
        const isPlayInWeek = config.usesPods && weekNum === regularSeasonEnd;
        output += `### Week ${weekNum}${isPlayInWeek ? ' (Play-in Round)' : ''}\n`;
        if (isPlayInWeek) {
          output += `*${groupWinnerCount} ${groupLabel.toLowerCase()} winners have BYEs this week*\n\n`;
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

    // Projected bracket. Pod seasons frame the final week as a play-in race on
    // points; every other season is a straight race for the wildcard spots.
    const describe = (t: typeof standings[number]) =>
      `${t.team.team_name} (${t.wins}-${t.losses}-${t.ties}, ${t.points_for.toFixed(1)} PF)`;

    if (config.usesPods) {
      if (currentWeek >= regularSeasonEnd - 1) {
        output += `## Week ${regularSeasonEnd} Play-in Race\n\n`;
        output += `**Important:** Week ${regularSeasonEnd} does NOT count toward ${groupLabel.toLowerCase()} standings. `;
        output += `It counts only toward the points title and wildcard qualification.\n\n`;

        output += `### ${groupLabel} Winners (Weeks 1-${regularSeasonEnd - 1} only):\n`;
        standings
          .filter(s => divisionWinners.has(s.team_id))
          .forEach((team, index) => {
            output += `${index + 1}. ${describe(team)}\n`;
          });

        output += `\n### Wildcard Race (top ${wildcardCount} by total season points advance):\n`;
        standings
          .filter(s => !divisionWinners.has(s.team_id))
          .sort((a, b) => b.points_for - a.points_for)
          .forEach((team, index) => {
            output += `${index + 1}. ${index < wildcardCount ? '✅' : '❌'} ${describe(team)}\n`;
          });
        output += `\n*✅ = currently in | ❌ = currently out. Week ${regularSeasonEnd} points DO count here.*\n\n`;
      }
    } else {
      output += `## Projected Playoff Field\n\n`;
      output += `### In the field (${projectedSeeds.length} of ${playoffTeams}):\n`;
      projectedSeeds.forEach(seed => {
        const label = seed.isDivisionWinner
          ? `🏆 ${groupLabel} winner${seed.seed <= Math.max(0, playoffTeams - wildcardCount) ? ' — BYE' : ''}`
          : '🎯 Wildcard';
        output += `**Seed ${seed.seed}:** ${describe(seed.teamRecord)} — ${label}\n`;
      });

      const bubble = standings.filter(s => !seededTeamIds.has(s.team_id));
      if (bubble.length > 0) {
        output += `\n### On the outside (wildcards ranked by ${wildcardBasis}):\n`;
        bubble.forEach((team, index) => {
          output += `${index + 1}. ❌ ${describe(team)}\n`;
        });
      }
      output += `\n*Projection as of Week ${currentWeek} of ${regularSeasonEnd}.*\n\n`;
    }


    // Official (persisted) seeds, once the regular season is done.
    if (currentWeek >= regularSeasonEnd) {
      let seedRows = await getPlayoffSeeds(year);
      if (seedRows.length < playoffTeams) {
        // Not saved yet. This refuses seasons whose playoffs already happened,
        // so it can't overwrite a stored historical bracket.
        try {
          seedRows = await savePlayoffSeeds(year);
        } catch (error) {
          console.error('Could not save playoff seeds:', error);
        }
      }

      if (seedRows.length >= playoffTeams) {
        // Get calculated seeds for display (includes team records and names).
        // This is a planning export, so projecting over a finished season is
        // intentional here — the seed rows themselves still come from the DB.
        const calculatedSeeds = await calculatePlayoffSeeds(year, { allowCompletedSeason: true });
        const seedMap = new Map(calculatedSeeds.map(s => [s.seed, s]));

        output += `## Official Playoff Seeds (After Week ${regularSeasonEnd})\n\n`;
        seedRows.forEach(seedRow => {
          const calculatedSeed = seedMap.get(seedRow.seed);
          const teamName = calculatedSeed?.team.team_name || `Team ${seedRow.team_id}`;
          const typeLabel = seedRow.is_division_winner ? `🏆 ${groupLabel} Winner` : '🎯 Wildcard';
          const record = calculatedSeed
            ? `(${calculatedSeed.teamRecord.wins}-${calculatedSeed.teamRecord.losses}-${calculatedSeed.teamRecord.ties}, ${calculatedSeed.teamRecord.points_for.toFixed(1)} PF)`
            : '';
          // Pods carry their own bye markers; otherwise group winners get the bye.
          const bracketNote = seedRow.pod
            ? ` [Pod ${seedRow.pod}]`
            : config.usesPods
            ? (seedRow.seed <= 2 ? ' [BYE]' : '')
            : (seedRow.is_division_winner ? ' [BYE]' : '');
          output += `**Seed ${seedRow.seed}:** ${teamName} ${typeLabel}${record ? ' ' + record : ''}${bracketNote}\n`;
        });
        output += `\n`;
        
        const playoffPods = await getPlayoffPods(year, 15);
        if (playoffPods && currentWeek >= 15) {
          output += `## Week 15 Playoff Pods\n\n`;
          output += `### BYE (Advance to Semifinals):\n`;
          playoffPods.byes.forEach(bye => {
            output += `- **Seed ${bye.seed}:** ${bye.team.team_name}\n`;
          });
          output += `\n### Pod A (Highest score advances to Semifinals):\n`;
          playoffPods.podA.forEach(team => {
            output += `- **Seed ${team.seed}:** ${team.team.team_name}\n`;
          });
          output += `\n### Pod B (Highest score advances to Semifinals):\n`;
          playoffPods.podB.forEach(team => {
            output += `- **Seed ${team.seed}:** ${team.team.team_name}\n`;
          });
          output += `\n`;
        }
      }
    }

    output += `## Playoff Qualification Rules\n\n`;
    
    output += `### ${groupLabel} Winners (Seeds 1-${groupWinnerCount}):\n`;
    if (config.usesPods) {
      output += `- Top team in each ${groupLabel.toLowerCase()} by Weeks 1-${regularSeasonEnd - 1} only (Week ${regularSeasonEnd} does NOT count)\n`;
      output += `- Automatic bid; seeds 1-2 get a BYE in Week 15\n\n`;
    } else {
      output += `- Top team in each ${groupLabel.toLowerCase()} by the tiebreaker rules below\n`;
      output += `- Automatic bid and a first-round BYE\n\n`;
    }

    output += `### Wildcards (Seeds ${groupWinnerCount + 1}-${playoffTeams}):\n`;
    output += `- The ${wildcardCount} non-${groupLabel.toLowerCase()}-winners with the ${wildcardBasis}\n`;
    if (config.usesPods) {
      output += `- Week ${regularSeasonEnd} points DO count toward wildcard qualification\n\n`;
    } else {
      output += `- Ranked by the same tiebreaker chain as the winners\n\n`;
    }

    if (config.usesPods) {
      output += `### Week 15 Playoffs (Pod Structure):\n`;
      output += `- **Seeds 1-2:** BYE (automatically advance to semifinals)\n`;
      output += `- **Pod A:** Seeds 3, 5, 8 play - highest score advances\n`;
      output += `- **Pod B:** Seeds 4, 6, 7 play - highest score advances\n`;
      output += `- The 2 pod winners join seeds 1-2 in the semifinals\n\n`;
    } else {
      output += `### Bracket:\n`;
      output += `- **Round 1 (quarterfinals):** seeds ${groupWinnerCount + 1}-${playoffTeams} play; ${groupLabel.toLowerCase()} winners have byes\n`;
      output += `- **Round 2 (semifinals):** round 1 winners join the ${groupWinnerCount} ${groupLabel.toLowerCase()} winner${groupWinnerCount === 1 ? '' : 's'}\n`;
      output += `- **Round 3:** championship\n\n`;
    }

    output += `### Tiebreaker Rules (seeding order):\n`;
    output += `1. Overall record (win %)\n`;
    output += `2. Head-to-head record\n`;
    output += `3. ${groupLabel} record (win %)\n`;
    output += `4. Total points scored\n`;
    output += `\n*Head-to-head only settles a two-way tie; three or more tied teams are separated by a mini round-robin among just those teams.*\n\n`;

    output += `---\n\n`;
    output += `*Use this data to analyze playoff scenarios, ${groupLabel.toLowerCase()} winner races, wildcard positioning, and remaining matchups that could affect qualification.*\n`;

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

