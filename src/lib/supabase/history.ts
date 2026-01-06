/**
 * League history data fetching functions
 */

import { supabase } from './client';
import { getTeamProfiles, getTrophies } from '../contentful/api';

export interface LeagueChampion {
  year: number;
  team: string;
  owner: string;
  logo: string;
  record: string;
  playoffRecord: string;
}

export interface SeasonRecord {
  team: string;
  owner: string;
  value: number;
  year: number;
  additionalInfo?: string;
}

export interface GameRecord {
  team: string;
  owner: string;
  value: number;
  opponent: string;
  week: number;
  year: number;
  additionalInfo?: string;
}

export interface TrophyWinner {
  name: string;
  emoji: string;
  category: string;
  winners: string[];
}

export interface LeagueHistory {
  champions: LeagueChampion[];
  seasonRecords: {
    highestSeasonScore: SeasonRecord;
    lowestSeasonScore: SeasonRecord;
    mostWins: SeasonRecord;
    bestWinPercentage: SeasonRecord;
  };
  gameRecords: {
    highestSingleGame: GameRecord;
    lowestSingleGame: GameRecord;
    biggestBlowout: GameRecord;
    closestGame: GameRecord;
  };
  trophies: TrophyWinner[];
  milestones: Array<{ date: string; title: string; description?: string }>;
  rivalries: Array<{ name: string; teams: string[]; record: string; description?: string }>;
  allTime: {
    winPctLeaders: Array<{ team: string; teamId: number; percentage: number }>;
    ppgLeaders: Array<{ team: string; teamId: number; ppg: number }>;
    longestWinStreak?: { team: string; teamId: number; length: number; span?: string };
    longestLosingStreak?: { team: string; teamId: number; length: number; span?: string };
  };
}

/**
 * Get league champions from trophy_case
 */
export async function getLeagueChampions(): Promise<LeagueChampion[]> {
  try {
    // Get championship trophies (trophy_id 1 is championship)
    const { data: championshipTrophies, error } = await supabase
      .from('trophy_case')
      .select(`
        year,
        team_id,
        amount,
        teams(team_name)
      `)
      .eq('trophy_id', 1) // trophy_id 1 is championship
      .order('year', { ascending: false });

    if (error) {
      console.error('Error fetching championship trophies:', error);
      return [];
    }

    if (!championshipTrophies || championshipTrophies.length === 0) {
      console.log('No championship trophies found');
      return [];
    }

    // Get team profiles for logos
    const contentfulTeams = await getTeamProfiles();
    const teamLookup = new Map(contentfulTeams.map(team => [team.teamId, team]));

    const champions: LeagueChampion[] = [];

    for (const trophy of championshipTrophies || []) {
      const trophyData = trophy as any;
      const teamId = trophyData.team_id;
      const year = trophyData.year;
      
      // Handle case where teams relationship might be missing
      const teamName = trophyData.teams?.team_name || `Team ${teamId}`;
      
      const contentfulTeam = teamLookup.get(teamId);
      
      // Get season record for this team/year
      const { data: games } = await supabase
        .from('games')
        .select('home_team_id, away_team_id, home_score, away_score, playoffs')
        .eq('year', year)
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`);

      let wins = 0;
      let losses = 0;
      let playoffWins = 0;
      let playoffLosses = 0;

      games?.forEach((game: any) => {
        const isHome = game.home_team_id === teamId;
        const teamScore = isHome ? game.home_score : game.away_score;
        const opponentScore = isHome ? game.away_score : game.home_score;

        if (teamScore && opponentScore) {
          if (game.playoffs) {
            if (teamScore > opponentScore) playoffWins++;
            else playoffLosses++;
          } else {
            if (teamScore > opponentScore) wins++;
            else losses++;
          }
        }
      });

      champions.push({
        year: year,
        team: teamName,
        owner: 'N/A', // Owner info not available in current schema
        logo: contentfulTeam?.logo?.url || '🏈',
        record: `${wins}-${losses}`,
        playoffRecord: `${playoffWins}-${playoffLosses}`
      });
    }

    return champions;
  } catch (error) {
    console.error('Error getting league champions:', error);
    return [];
  }
}

/**
 * Get season records
 */
export async function getSeasonRecords(): Promise<LeagueHistory['seasonRecords']> {
  try {
    // Get Contentful team data for short names
    const contentfulTeams = await getTeamProfiles();
    const teamMap = new Map<number, any>();
    contentfulTeams.forEach(team => {
      teamMap.set(team.teamId, team);
    });

    // Get all games with team info
    const { data: games, error } = await supabase
      .from('games')
      .select(`
        year,
        home_team_id,
        away_team_id,
        home_score,
        away_score,
        playoffs,
        home_team:teams!games_home_team_id_fkey(team_name),
        away_team:teams!games_away_team_id_fkey(team_name)
      `)
      .not('home_score', 'is', null)
      .not('away_score', 'is', null);

    if (error) {
      console.error('Error fetching games for records:', error);
      return {
        highestSeasonScore: { team: 'N/A', owner: 'N/A', value: 0, year: 0 },
        lowestSeasonScore: { team: 'N/A', owner: 'N/A', value: 0, year: 0 },
        mostWins: { team: 'N/A', owner: 'N/A', value: 0, year: 0 },
        bestWinPercentage: { team: 'N/A', owner: 'N/A', value: 0, year: 0 }
      };
    }

    // Calculate season totals for each team/year
    const teamSeasonStats = new Map<string, {
      team: string;
      owner: string;
      year: number;
      totalPoints: number;
      wins: number;
      losses: number;
    }>();

    // Helper function to get short name from Contentful data
    const getTeamShortName = (teamId: number, fallbackName: string) => {
      const contentfulTeam = teamMap.get(teamId);
      return contentfulTeam?.shortName || fallbackName;
    };

    // Determine current season (latest year) and exclude from seasonRecords calculations
    const currentSeasonYear = (games && games.length > 0)
      ? Math.max(...games.map((g: any) => g.year as number))
      : undefined;

    games?.forEach((game: any) => {
      const isCurrentSeason = currentSeasonYear !== undefined && game.year === currentSeasonYear;
      const homeKey = `${game.home_team_id}-${game.year}`;
      const awayKey = `${game.away_team_id}-${game.year}`;

      // Home team stats
      if (!teamSeasonStats.has(homeKey)) {
        teamSeasonStats.set(homeKey, {
          team: getTeamShortName(game.home_team_id, game.home_team.team_name),
          owner: 'N/A', // Owner info not available in current schema
          year: game.year,
          totalPoints: 0,
          wins: 0,
          losses: 0
        });
      }
      const homeStats = teamSeasonStats.get(homeKey)!;
      homeStats.totalPoints += game.home_score || 0;
      if (!game.playoffs && !isCurrentSeason) {
        if ((game.home_score || 0) > (game.away_score || 0)) {
          homeStats.wins++;
        } else {
          homeStats.losses++;
        }
      }

      // Away team stats
      if (!teamSeasonStats.has(awayKey)) {
        teamSeasonStats.set(awayKey, {
          team: getTeamShortName(game.away_team_id, game.away_team.team_name),
          owner: 'N/A', // Owner info not available in current schema
          year: game.year,
          totalPoints: 0,
          wins: 0,
          losses: 0
        });
      }
      const awayStats = teamSeasonStats.get(awayKey)!;
      awayStats.totalPoints += game.away_score || 0;
      if (!game.playoffs && !isCurrentSeason) {
        if ((game.away_score || 0) > (game.home_score || 0)) {
          awayStats.wins++;
        } else {
          awayStats.losses++;
        }
      }
    });

    const stats = Array.from(teamSeasonStats.values());

    // Find records
    const highestSeasonScore = stats.reduce((max, stat) => 
      stat.totalPoints > max.totalPoints ? stat : max, stats[0] || { totalPoints: 0, team: 'N/A', owner: 'N/A', year: 0 });

    const lowestSeasonScore = stats.reduce((min, stat) => 
      stat.totalPoints < min.totalPoints ? stat : min, stats[0] || { totalPoints: 0, team: 'N/A', owner: 'N/A', year: 0 });

    const mostWins = stats.reduce((max, stat) => 
      stat.wins > max.wins ? stat : max, stats[0] || { wins: 0, team: 'N/A', owner: 'N/A', year: 0 });

    const bestWinPercentage = stats.reduce((max, stat) => {
      const denom = stat.wins + stat.losses;
      const percentage = denom > 0 ? stat.wins / denom : 0;
      const maxDenom = max.wins + max.losses;
      const maxPercentage = maxDenom > 0 ? max.wins / maxDenom : 0;
      return percentage > maxPercentage ? { ...stat, percentage } : { ...max, percentage: maxPercentage };
    }, stats[0] || { wins: 0, losses: 0, team: 'N/A', owner: 'N/A', year: 0 });

    // Calculate the final percentage for the best team
    const finalPercentage = (bestWinPercentage.wins + bestWinPercentage.losses) > 0 
      ? bestWinPercentage.wins / (bestWinPercentage.wins + bestWinPercentage.losses) 
      : 0;

    return {
      highestSeasonScore: {
        team: highestSeasonScore.team,
        owner: highestSeasonScore.owner,
        value: highestSeasonScore.totalPoints,
        year: highestSeasonScore.year
      },
      lowestSeasonScore: {
        team: lowestSeasonScore.team,
        owner: lowestSeasonScore.owner,
        value: lowestSeasonScore.totalPoints,
        year: lowestSeasonScore.year
      },
      mostWins: {
        team: mostWins.team,
        owner: mostWins.owner,
        value: mostWins.wins,
        year: mostWins.year
      },
      bestWinPercentage: {
        team: bestWinPercentage.team,
        owner: bestWinPercentage.owner,
        value: finalPercentage,
        year: bestWinPercentage.year,
      }
    };
  } catch (error) {
    console.error('Error getting season records:', error);
    return {
      highestSeasonScore: { team: 'N/A', owner: 'N/A', value: 0, year: 0 },
      lowestSeasonScore: { team: 'N/A', owner: 'N/A', value: 0, year: 0 },
      mostWins: { team: 'N/A', owner: 'N/A', value: 0, year: 0 },
      bestWinPercentage: { team: 'N/A', owner: 'N/A', value: 0, year: 0 }
    };
  }
}

/**
 * Get game records
 */
export async function getGameRecords(): Promise<LeagueHistory['gameRecords']> {
  try {
    // Get Contentful team data for short names
    const contentfulTeams = await getTeamProfiles();
    const teamMap = new Map<number, any>();
    contentfulTeams.forEach(team => {
      teamMap.set(team.teamId, team);
    });

    const { data: games, error } = await supabase
      .from('games')
      .select(`
        year,
        week,
        home_team_id,
        away_team_id,
        home_score,
        away_score,
        home_team:teams!games_home_team_id_fkey(team_name),
        away_team:teams!games_away_team_id_fkey(team_name)
      `)
      .not('home_score', 'is', null)
      .not('away_score', 'is', null);

    if (error || !games) {
      console.error('Error fetching games for records:', error);
      return {
        highestSingleGame: { team: 'N/A', owner: 'N/A', value: 0, opponent: 'N/A', week: 0, year: 0 },
        lowestSingleGame: { team: 'N/A', owner: 'N/A', value: 0, opponent: 'N/A', week: 0, year: 0 },
        biggestBlowout: { team: 'N/A', owner: 'N/A', value: 0, opponent: 'N/A', week: 0, year: 0 },
        closestGame: { team: 'N/A', owner: 'N/A', value: 0, opponent: 'N/A', week: 0, year: 0 }
      };
    }

    let highestSingleGame = { team: 'N/A', owner: 'N/A', value: 0, opponent: 'N/A', week: 0, year: 0 };
    let lowestSingleGame = { team: 'N/A', owner: 'N/A', value: 999, opponent: 'N/A', week: 0, year: 0 };
    let biggestBlowout = { team: 'N/A', owner: 'N/A', value: 0, opponent: 'N/A', week: 0, year: 0 };
    let closestGame = { team: 'N/A', owner: 'N/A', value: 999, opponent: 'N/A', week: 0, year: 0 };

    // Helper function to get short name from Contentful data
    const getTeamShortName = (teamId: number, fallbackName: string) => {
      const contentfulTeam = teamMap.get(teamId);
      return contentfulTeam?.shortName || fallbackName;
    };

    games.forEach((game: any) => {
      const homeScore = game.home_score || 0;
      const awayScore = game.away_score || 0;
      const margin = Math.abs(homeScore - awayScore);

      // Highest single game
      if (homeScore > highestSingleGame.value) {
        highestSingleGame = {
          team: getTeamShortName(game.home_team_id, game.home_team.team_name),
          owner: 'N/A',
          value: homeScore,
          opponent: getTeamShortName(game.away_team_id, game.away_team.team_name),
          week: game.week,
          year: game.year
        };
      }
      if (awayScore > highestSingleGame.value) {
        highestSingleGame = {
          team: getTeamShortName(game.away_team_id, game.away_team.team_name),
          owner: 'N/A',
          value: awayScore,
          opponent: getTeamShortName(game.home_team_id, game.home_team.team_name),
          week: game.week,
          year: game.year
        };
      }

      // Lowest single game
      if (homeScore < lowestSingleGame.value) {
        lowestSingleGame = {
          team: getTeamShortName(game.home_team_id, game.home_team.team_name),
          owner: 'N/A',
          value: homeScore,
          opponent: getTeamShortName(game.away_team_id, game.away_team.team_name),
          week: game.week,
          year: game.year
        };
      }
      if (awayScore < lowestSingleGame.value) {
        lowestSingleGame = {
          team: getTeamShortName(game.away_team_id, game.away_team.team_name),
          owner: 'N/A',
          value: awayScore,
          opponent: getTeamShortName(game.home_team_id, game.home_team.team_name),
          week: game.week,
          year: game.year
        };
      }

      // Biggest blowout
      if (margin > biggestBlowout.value) {
        const winnerId = homeScore > awayScore ? game.home_team_id : game.away_team_id;
        const loserId = homeScore > awayScore ? game.away_team_id : game.home_team_id;
        const winnerName = homeScore > awayScore ? game.home_team.team_name : game.away_team.team_name;
        const loserName = homeScore > awayScore ? game.away_team.team_name : game.home_team.team_name;
        
        biggestBlowout = {
          team: getTeamShortName(winnerId, winnerName),
          owner: 'N/A',
          value: margin,
          opponent: getTeamShortName(loserId, loserName),
          week: game.week,
          year: game.year,
        };
      }

      // Closest game
      if (margin < closestGame.value && margin > 0) {
        const winnerId = homeScore > awayScore ? game.home_team_id : game.away_team_id;
        const loserId = homeScore > awayScore ? game.away_team_id : game.home_team_id;
        const winnerName = homeScore > awayScore ? game.home_team.team_name : game.away_team.team_name;
        const loserName = homeScore > awayScore ? game.away_team.team_name : game.home_team.team_name;
        
        closestGame = {
          team: getTeamShortName(winnerId, winnerName),
          owner: 'N/A',
          value: margin,
          opponent: getTeamShortName(loserId, loserName),
          week: game.week,
          year: game.year,
        };
      }
    });

    return {
      highestSingleGame,
      lowestSingleGame,
      biggestBlowout,
      closestGame
    };
  } catch (error) {
    console.error('Error getting game records:', error);
    return {
      highestSingleGame: { team: 'N/A', owner: 'N/A', value: 0, opponent: 'N/A', week: 0, year: 0 },
      lowestSingleGame: { team: 'N/A', owner: 'N/A', value: 0, opponent: 'N/A', week: 0, year: 0 },
      biggestBlowout: { team: 'N/A', owner: 'N/A', value: 0, opponent: 'N/A', week: 0, year: 0 },
      closestGame: { team: 'N/A', owner: 'N/A', value: 0, opponent: 'N/A', week: 0, year: 0 }
    };
  }
}

/**
 * Get trophy winners
 */
export async function getTrophyWinners(): Promise<TrophyWinner[]> {
  try {
    // Get trophy data from both Supabase and Contentful
    const [supabaseTrophies, contentfulTrophies] = await Promise.all([
      supabase
        .from('trophies')
        .select(`
          trophy_id,
          trophy_name,
          trophy_case!inner(
            year,
            amount,
            teams!inner(team_name)
          )
        `)
        .order('trophy_name'),
      getTrophies()
    ]);

    if (supabaseTrophies.error) {
      console.error('Error fetching trophies from Supabase:', supabaseTrophies.error);
      return [];
    }

    // Create a map of Contentful trophies by trophyId for easy lookup
    const contentfulTrophyMap = new Map(
      contentfulTrophies.map((trophy: any) => [trophy.trophyId, trophy])
    );

    const trophyMap = new Map<number, TrophyWinner>();

    supabaseTrophies.data?.forEach((trophy: any) => {
      if (!trophyMap.has(trophy.trophy_id)) {
        const contentfulTrophy = contentfulTrophyMap.get(trophy.trophy_id);
        
        trophyMap.set(trophy.trophy_id, {
          name: trophy.trophy_name,
          emoji: contentfulTrophy?.trophyImage?.emoji || '🏆',
          category: 'special', // Default category since not in current schema
          winners: []
        });
      }

      const trophyWinner = trophyMap.get((trophy as any).trophy_id)!;
      (trophy as any).trophy_case.forEach((winner: any) => {
        const winnerText = `${winner.teams.team_name} (${winner.year}${winner.amount > 1 ? ` - ${winner.amount}x` : ''})`;
        trophyWinner.winners.push(winnerText);
      });
    });

    return Array.from(trophyMap.values());
  } catch (error) {
    console.error('Error getting trophy winners:', error);
    return [];
  }
}

/**
 * Get complete league history
 */
export async function getLeagueHistory(): Promise<LeagueHistory> {
  try {
    const [champions, seasonRecords, gameRecords, trophies] = await Promise.all([
      getLeagueChampions(),
      getSeasonRecords(),
      getGameRecords(),
      getTrophyWinners()
    ]);

    // Ensure all arrays are defined
    const safeChampions = champions || [];
    const safeTrophies = trophies || [];

    // Milestones from league_seasons
    const { data: leagueSeasons } = await supabase
      .from('league_seasons')
      .select('*');

    const milestones = (leagueSeasons || [])
      .map((ls: any) => ({
        year: (ls.year ?? ls.season_year) as number | undefined,
        notes: (ls.notes ?? ls.note) as string | undefined,
      }))
      .filter((x) => x.year && x.notes && x.notes.trim().length > 0)
      .sort((a, b) => (a.year! - b.year!))
      .map((x) => ({
        date: `${x.year}-09-01`,
        title: `${x.year}`,
        description: x.notes,
      }));

    // Historic rivalries from rivals/rivalries and games
    const { data: rivalriesRows } = await supabase
      .from('rivalries')
      .select('rivalry_id, rivalry_name, trophy_id');
    const { data: rivalsRows } = await supabase
      .from('rivals')
      .select('team_id, rivalry_id');

    let rivalries: Array<{ name: string; teams: string[]; record: string; description?: string }> = [];
    if (rivalriesRows && rivalsRows && rivalsRows.length > 0) {
      // Map team_id -> team_name via Supabase (more reliable for IDs)
      // Fetch team names for all involved team_ids in one query
      const teamIds: number[] = Array.from(new Set((rivalsRows || []).map((r: any) => r.team_id)));
      const { data: teamsRows } = await supabase
        .from('teams')
        .select('team_id, team_name')
        .in('team_id', teamIds);
      const nameById = new Map<number, string>((teamsRows || []).map((t: any) => [t.team_id, t.team_name]));

      // Preload all games to compute head-to-head
      const { data: allGames } = await supabase
        .from('games')
        .select('home_team_id, away_team_id, home_score, away_score, year');

      rivalries = rivalriesRows.map((rv: any) => {
        const members = (rivalsRows || [])
          .filter((r: any) => r.rivalry_id === rv.rivalry_id)
          .map((r: any) => r.team_id)
          .slice(0, 2);
        const [a, b] = members;
        if (a == null || b == null) {
          return { name: rv.rivalry_name || 'Rivalry', teams: [], record: 'No games', description: undefined };
        }
        let aWins = 0, bWins = 0;
        (allGames || []).forEach((g: any) => {
          const involves = (g.home_team_id === a && g.away_team_id === b) || (g.home_team_id === b && g.away_team_id === a);
          if (!involves) return;
          if (g.home_score == null || g.away_score == null) return;
          const aScore = g.home_team_id === a ? g.home_score : g.away_score;
          const bScore = g.home_team_id === a ? g.away_score : g.home_score;
          if (aScore > bScore) aWins++; else if (bScore > aScore) bWins++;
        });
        const teamsNames = [nameById.get(a) || `Team ${a}`, nameById.get(b) || `Team ${b}`];
        const leader = aWins === bWins ? 'Tied' : (aWins > bWins ? teamsNames[0] : teamsNames[1]);
        const record = `${leader} ${Math.max(aWins,bWins)}-${Math.min(aWins,bWins)}`;
        return { name: rv.rivalry_name || `${teamsNames[0]} vs ${teamsNames[1]}`, teams: teamsNames, record, description: undefined };
      });
    }

    // All-time aggregates
    const { data: allGames } = await supabase
      .from('games')
      .select('year, week, home_team_id, away_team_id, home_score, away_score')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null);

    const { data: allTeams } = await supabase
      .from('teams')
      .select('team_id, team_name');
    const teamName = new Map<number, string>((allTeams || []).map((t: any) => [t.team_id, t.team_name]));

    // Get active teams from Contentful
    let activeTeamIds = new Set<number>();
    try {
      const teamProfiles = await getTeamProfiles();
      activeTeamIds = new Set(
        teamProfiles
          .filter(profile => profile.active !== false) // Include teams where active is true or undefined
          .map(profile => profile.teamId)
      );
    } catch (error) {
      console.error('Error fetching Contentful team profiles:', error);
      // Fallback: use all teams from Supabase if Contentful fails
      activeTeamIds = new Set((allTeams || []).map((t: any) => t.team_id));
    }

    const totals = new Map<number, { points: number; games: number; wins: number; losses: number; ties: number }>();
    
    // Enhanced streak tracking with spans
    const teamStreaks = new Map<number, {
      currentWinStreak: number;
      currentLossStreak: number;
      longestWinStreak: { length: number; startYear: number; startWeek: number; endYear: number; endWeek: number };
      longestLossStreak: { length: number; startYear: number; startWeek: number; endYear: number; endWeek: number };
      currentWinStart?: { year: number; week: number };
      currentLossStart?: { year: number; week: number };
    }>();

    // Sort games chronologically (by year, then by week)
    const sortedGames = (allGames || []).sort((a: any, b: any) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.week - b.week;
    });

    sortedGames.forEach((g: any) => {
      const entries = [
        { id: g.home_team_id, for: g.home_score as number, against: g.away_score as number },
        { id: g.away_team_id, for: g.away_score as number, against: g.home_score as number },
      ];
      
      entries.forEach(({ id, for: pf, against: pa }) => {
        // Update totals
        const t = totals.get(id) || { points: 0, games: 0, wins: 0, losses: 0, ties: 0 };
        t.points += pf || 0;
        t.games += 1;
        if (pf > pa) t.wins += 1; else if (pf < pa) t.losses += 1; else t.ties += 1;
        totals.set(id, t);

        // Update streaks
        const streak = teamStreaks.get(id) || {
          currentWinStreak: 0,
          currentLossStreak: 0,
          longestWinStreak: { length: 0, startYear: 0, startWeek: 0, endYear: 0, endWeek: 0 },
          longestLossStreak: { length: 0, startYear: 0, startWeek: 0, endYear: 0, endWeek: 0 }
        };

        if (pf > pa) {
          // Win
          streak.currentWinStreak += 1;
          streak.currentLossStreak = 0;
          streak.currentLossStart = undefined;
          
          if (!streak.currentWinStart) {
            streak.currentWinStart = { year: g.year, week: g.week };
          }
          
          // Check if this is the longest win streak
          if (streak.currentWinStreak > streak.longestWinStreak.length) {
            streak.longestWinStreak = {
              length: streak.currentWinStreak,
              startYear: streak.currentWinStart.year,
              startWeek: streak.currentWinStart.week,
              endYear: g.year,
              endWeek: g.week
            };
          }
        } else if (pf < pa) {
          // Loss
          streak.currentLossStreak += 1;
          streak.currentWinStreak = 0;
          streak.currentWinStart = undefined;
          
          if (!streak.currentLossStart) {
            streak.currentLossStart = { year: g.year, week: g.week };
          }
          
          // Check if this is the longest loss streak
          if (streak.currentLossStreak > streak.longestLossStreak.length) {
            streak.longestLossStreak = {
              length: streak.currentLossStreak,
              startYear: streak.currentLossStart.year,
              startWeek: streak.currentLossStart.week,
              endYear: g.year,
              endWeek: g.week
            };
          }
        } else {
          // Tie - breaks both streaks
          streak.currentWinStreak = 0;
          streak.currentLossStreak = 0;
          streak.currentWinStart = undefined;
          streak.currentLossStart = undefined;
        }

        teamStreaks.set(id, streak);
      });
    });

    const winPctLeaders = Array.from(totals.entries())
      .filter(([id]) => activeTeamIds.has(id)) // Only include active teams
      .map(([id, t]) => ({
        team: teamName.get(id) || `Team ${id}`,
        teamId: id,
        percentage: t.games > 0 ? (t.wins + 0.5 * t.ties) / t.games : 0,
      })).sort((a, b) => b.percentage - a.percentage).slice(0, 12);

    const ppgLeaders = Array.from(totals.entries())
      .filter(([id]) => activeTeamIds.has(id)) // Only include active teams
      .map(([id, t]) => ({
        team: teamName.get(id) || `Team ${id}`,
        teamId: id,
        ppg: t.games > 0 ? t.points / t.games : 0,
      })).sort((a, b) => b.ppg - a.ppg).slice(0, 12);


    let longestWinStreak: { team: string; teamId: number; length: number; span?: string } | undefined;
    let longestLosingStreak: { team: string; teamId: number; length: number; span?: string } | undefined;
    
    teamStreaks.forEach((streak, id) => {
      // Only consider active teams for streaks
      if (!activeTeamIds.has(id)) return;
      
      const name = teamName.get(id) || `Team ${id}`;
      
      // Check win streak
      if (streak.longestWinStreak.length > 0 && (!longestWinStreak || streak.longestWinStreak.length > longestWinStreak.length)) {
        const span = `${streak.longestWinStreak.startYear} wk ${streak.longestWinStreak.startWeek} - ${streak.longestWinStreak.endYear} wk ${streak.longestWinStreak.endWeek}`;
        longestWinStreak = { 
          team: name, 
          teamId: id, 
          length: streak.longestWinStreak.length,
          span
        };
      }
      
      // Check loss streak
      if (streak.longestLossStreak.length > 0 && (!longestLosingStreak || streak.longestLossStreak.length > longestLosingStreak.length)) {
        const span = `${streak.longestLossStreak.startYear} wk ${streak.longestLossStreak.startWeek} - ${streak.longestLossStreak.endYear} wk ${streak.longestLossStreak.endWeek}`;
        longestLosingStreak = { 
          team: name, 
          teamId: id, 
          length: streak.longestLossStreak.length,
          span
        };
      }
    });

    return {
      champions: safeChampions,
      seasonRecords,
      gameRecords,
      trophies: safeTrophies,
      milestones,
      rivalries,
      allTime: {
        winPctLeaders,
        ppgLeaders,
        longestWinStreak,
        longestLosingStreak,
      }
    };
  } catch (error) {
    console.error('Error getting league history:', error);
    return {
      champions: [],
      seasonRecords: {
        highestSeasonScore: { team: 'N/A', owner: 'N/A', value: 0, year: 0 },
        lowestSeasonScore: { team: 'N/A', owner: 'N/A', value: 0, year: 0 },
        mostWins: { team: 'N/A', owner: 'N/A', value: 0, year: 0 },
        bestWinPercentage: { team: 'N/A', owner: 'N/A', value: 0, year: 0 }
      },
      gameRecords: {
        highestSingleGame: { team: 'N/A', owner: 'N/A', value: 0, opponent: 'N/A', week: 0, year: 0 },
        lowestSingleGame: { team: 'N/A', owner: 'N/A', value: 0, opponent: 'N/A', week: 0, year: 0 },
        biggestBlowout: { team: 'N/A', owner: 'N/A', value: 0, opponent: 'N/A', week: 0, year: 0 },
        closestGame: { team: 'N/A', owner: 'N/A', value: 0, opponent: 'N/A', week: 0, year: 0 }
      },
      trophies: [],
      milestones: [],
      rivalries: [],
      allTime: {
        winPctLeaders: [],
        ppgLeaders: [],
        longestWinStreak: undefined,
        longestLosingStreak: undefined,
      }
    };
  }
}
