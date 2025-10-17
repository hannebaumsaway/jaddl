import { supabase, handleSupabaseError } from './client';
import type { 
  Team, 
  Game, 
  TeamSeason, 
  LeagueSeason, 
  Division, 
  Quad, 
  Trophy, 
  TrophyCase, 
  TeamRecord, 
  Standings,
  WeeklyMatchup,
  TeamBio,
  FranchiseHistory,
  Draft,
  Article
} from '@/types/database';

// Teams
export async function getTeams(activeOnly = true): Promise<Team[]> {
  try {
    let query = supabase
      .from('teams')
      .select('*')
      .order('team_id'); // Use team_id which is the actual primary key

    // Note: active column may not exist, so skip the filter for now
    // if (activeOnly) {
    //   query = query.eq('active', true);
    // }

    const { data, error } = await (query as any);

    if (error) {
      handleSupabaseError(error, 'getTeams');
    }

    return data || [];
  } catch (error) {
    handleSupabaseError(error, 'getTeams');
    return [];
  }
}

export async function getTeamById(id: number): Promise<Team | null> {
  try {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('team_id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      handleSupabaseError(error, 'getTeamById');
    }

    return data;
  } catch (error) {
    handleSupabaseError(error, 'getTeamById');
    return null;
  }
}

export async function getTeamRecords(seasonYear: number): Promise<TeamRecord[]> {
  try {
    // Get all games for the season
    const games = await getGames(seasonYear);
    
    // Get all teams that played in this season
    const { data: teamSeasons, error: teamSeasonsError } = await supabase
      .from('team_seasons')
      .select(`
        *,
        team:teams(*)
      `)
      .eq('year', seasonYear) as { data: any[] | null, error: any };

    if (teamSeasonsError) {
      handleSupabaseError(teamSeasonsError, 'getTeamRecords');
      return [];
    }

    // Calculate records for each team
    const teamRecords: TeamRecord[] = [];
    
    for (const teamSeason of (teamSeasons || [])) {
      const teamId = teamSeason.team_id;
      const teamGames = games.filter(g => 
        g.home_team_id === teamId || g.away_team_id === teamId
      );

      let wins = 0;
      let losses = 0;
      let ties = 0;
      let pointsFor = 0;
      let pointsAgainst = 0;

      for (const game of teamGames) {
        if (!game.home_score || !game.away_score) continue; // Skip incomplete games
        
        const isHome = game.home_team_id === teamId;
        const teamScore = isHome ? game.home_score : game.away_score;
        const oppScore = isHome ? game.away_score : game.home_score;
        
        pointsFor += teamScore;
        pointsAgainst += oppScore;
        
        if (teamScore > oppScore) {
          wins++;
        } else if (teamScore < oppScore) {
          losses++;
        } else {
          ties++;
        }
      }

      const totalGames = wins + losses + ties;
      const winPercentage = totalGames > 0 ? wins / totalGames : 0;

      teamRecords.push({
        team_id: teamId,
        team: teamSeason.team as Team,
        wins,
        losses,
        ties,
        points_for: pointsFor,
        points_against: pointsAgainst,
        point_differential: pointsFor - pointsAgainst,
        win_percentage: winPercentage,
      });
    }

    return teamRecords.sort((a, b) => b.win_percentage - a.win_percentage);
  } catch (error) {
    handleSupabaseError(error, 'getTeamRecords');
    return [];
  }
}

export async function getAllTimeTeamRecords(): Promise<TeamRecord[]> {
  try {
    // Get all games across all years
    const games = await getGames();
    
    // Get all team seasons across all years
    const { data: teamSeasons, error: teamSeasonsError } = await supabase
      .from('team_seasons')
      .select(`
        *,
        team:teams(*)
      `) as { data: any[] | null, error: any };

    if (teamSeasonsError) {
      handleSupabaseError(teamSeasonsError, 'getAllTimeTeamRecords');
      return [];
    }

    // Group games by year and team
    const teamRecordsByYear: { [key: string]: TeamRecord } = {};
    
    for (const teamSeason of (teamSeasons || [])) {
      const teamId = teamSeason.team_id;
      const year = teamSeason.year;
      const key = `${teamId}-${year}`;
      
      const teamGames = games.filter(g => 
        g.year === year && (g.home_team_id === teamId || g.away_team_id === teamId)
      );

      let wins = 0;
      let losses = 0;
      let ties = 0;
      let pointsFor = 0;
      let pointsAgainst = 0;

      for (const game of teamGames) {
        if (!game.home_score || !game.away_score) continue; // Skip incomplete games
        
        const isHome = game.home_team_id === teamId;
        const teamScore = isHome ? game.home_score : game.away_score;
        const oppScore = isHome ? game.away_score : game.home_score;
        
        pointsFor += teamScore;
        pointsAgainst += oppScore;
        
        if (teamScore > oppScore) {
          wins++;
        } else if (teamScore < oppScore) {
          losses++;
        } else {
          ties++;
        }
      }

      const totalGames = wins + losses + ties;
      const winPercentage = totalGames > 0 ? wins / totalGames : 0;

      teamRecordsByYear[key] = {
        team_id: teamId,
        team: teamSeason.team as Team,
        year: year,
        wins,
        losses,
        ties,
        points_for: pointsFor,
        points_against: pointsAgainst,
        point_differential: pointsFor - pointsAgainst,
        win_percentage: winPercentage,
      };
    }

    return Object.values(teamRecordsByYear);
  } catch (error) {
    handleSupabaseError(error, 'getAllTimeTeamRecords');
    return [];
  }
}

export async function getTeamsByIds(ids: number[]): Promise<Team[]> {
  try {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .in('id', ids)
      .order('name');

    if (error) {
      handleSupabaseError(error, 'getTeamsByIds');
    }

    return data || [];
  } catch (error) {
    handleSupabaseError(error, 'getTeamsByIds');
    return [];
  }
}

// Games
export async function getGames(
  seasonYear?: number,
  week?: number,
  teamId?: number,
  includeTeams = true
): Promise<Game[]> {
  try {
    let query = supabase.from('games');
    
    if (includeTeams) {
      query = (query as any).select(`
        *,
        home_team:home_team_id(*),
        away_team:away_team_id(*)
      `);
    } else {
      query = (query as any).select('*');
    }

    if (seasonYear) {
      query = (query as any).eq('year', seasonYear);
    }

    if (week) {
      query = (query as any).eq('week', week);
    }

    if (teamId) {
      query = (query as any).or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`);
    }

    query = (query as any).order('week', { ascending: true });

    const { data, error } = await (query as any);

    if (error) {
      handleSupabaseError(error, 'getGames');
    }

    return data || [];
  } catch (error) {
    handleSupabaseError(error, 'getGames');
    return [];
  }
}

export async function getWeeklyMatchups(
  seasonYear: number,
  week: number
): Promise<WeeklyMatchup[]> {
  try {
    const games = await getGames(seasonYear, week, undefined, true);
    
    return games.map(game => ({
      game,
      home_team: game.home_team!,
      away_team: game.away_team!,
      is_completed: game.home_score !== null && game.away_score !== null,
      winner: game.home_score !== null && game.away_score !== null
        ? (game.home_score > game.away_score ? game.home_team! : game.away_team!)
        : undefined,
      margin_of_victory: game.home_score !== null && game.away_score !== null
        ? Math.abs(game.home_score - game.away_score)
        : undefined,
    }));
  } catch (error) {
    handleSupabaseError(error, 'getWeeklyMatchups');
    return [];
  }
}

// Standings calculation
export async function calculateStandings(seasonYear: number): Promise<Standings> {
  try {
    const [games, teams, teamSeasons, leagueSeasons] = await Promise.all([
      getGames(seasonYear, undefined, undefined, false),
      getTeams(),
      getTeamSeasons(seasonYear),
      getLeagueSeasons(),
    ]);
    
    // Get league structure info for this year
    const currentLeagueSeason = leagueSeasons.find(ls => ls.year === seasonYear);
    const structureType = currentLeagueSeason?.structure_type || 'single_league';
    
    // Fetch divisions and quads based on structure type
    let divisions: Division[] = [];
    let quads: Quad[] = [];
    
    if (structureType === 'divisions') {
      divisions = await getDivisions();
    } else if (structureType === 'quads') {
      quads = await getQuads();
    }

    const teamRecords: Map<number, TeamRecord> = new Map();

    // Build quick lookup for each team's division and quad for this season
    const teamIdToDivisionId: Map<number, number | null | undefined> = new Map();
    const teamIdToQuadId: Map<number, number | null | undefined> = new Map();
    teamSeasons.forEach(ts => {
      teamIdToDivisionId.set(ts.team_id, ts.division_id);
      teamIdToQuadId.set(ts.team_id, ts.quad_id);
    });

    // Initialize team records
    teams.forEach(team => {
      teamRecords.set(team.team_id, {
        team_id: team.team_id,
        team,
        wins: 0,
        losses: 0,
        ties: 0,
        points_for: 0,
        points_against: 0,
        point_differential: 0,
        win_percentage: 0,
        division_wins: 0,
        division_losses: 0,
        division_ties: 0,
      });
    });

    // Calculate records from completed games
    games.forEach(game => {
      if (game.home_score !== null && game.away_score !== null) {
        const homeRecord = teamRecords.get(game.home_team_id);
        const awayRecord = teamRecords.get(game.away_team_id);

        if (homeRecord && awayRecord) {
          homeRecord.points_for += game.home_score!;
          homeRecord.points_against += game.away_score!;
          awayRecord.points_for += game.away_score!;
          awayRecord.points_against += game.home_score!;

          if (game.home_score! > game.away_score!) {
            homeRecord.wins++;
            awayRecord.losses++;
          } else if (game.away_score! > game.home_score!) {
            awayRecord.wins++;
            homeRecord.losses++;
          } else {
            homeRecord.ties++;
            awayRecord.ties++;
          }

          // Division record updates (only if both teams share a valid division, regular season only)
          const homeDivisionId = teamIdToDivisionId.get(game.home_team_id);
          const awayDivisionId = teamIdToDivisionId.get(game.away_team_id);
          const isDivisionGame = homeDivisionId !== null && homeDivisionId !== undefined && homeDivisionId === awayDivisionId;
          const isRegularSeason = !game.playoffs;

          if (isDivisionGame && isRegularSeason) {
            if (game.home_score! > game.away_score!) {
              homeRecord.division_wins = (homeRecord.division_wins || 0) + 1;
              awayRecord.division_losses = (awayRecord.division_losses || 0) + 1;
            } else if (game.away_score! > game.home_score!) {
              awayRecord.division_wins = (awayRecord.division_wins || 0) + 1;
              homeRecord.division_losses = (homeRecord.division_losses || 0) + 1;
            } else {
              homeRecord.division_ties = (homeRecord.division_ties || 0) + 1;
              awayRecord.division_ties = (awayRecord.division_ties || 0) + 1;
            }
          }

          // Quad record updates (only if both teams share a valid quad, regular season only)
          const homeQuadId = teamIdToQuadId.get(game.home_team_id);
          const awayQuadId = teamIdToQuadId.get(game.away_team_id);
          const isQuadGame = homeQuadId !== null && homeQuadId !== undefined && homeQuadId === awayQuadId;

          if (isQuadGame && isRegularSeason) {
            if (game.home_score! > game.away_score!) {
              homeRecord.quad_wins = (homeRecord.quad_wins || 0) + 1;
              awayRecord.quad_losses = (awayRecord.quad_losses || 0) + 1;
            } else if (game.away_score! > game.home_score!) {
              awayRecord.quad_wins = (awayRecord.quad_wins || 0) + 1;
              homeRecord.quad_losses = (homeRecord.quad_losses || 0) + 1;
            } else {
              homeRecord.quad_ties = (homeRecord.quad_ties || 0) + 1;
              awayRecord.quad_ties = (awayRecord.quad_ties || 0) + 1;
            }
          }
        }
      }
    });

    // Calculate win percentages, point differentials, and streaks
    teamRecords.forEach(record => {
      const totalGames = record.wins + record.losses + record.ties;
      record.win_percentage = totalGames > 0 ? (record.wins + record.ties * 0.5) / totalGames : 0;
      record.point_differential = record.points_for - record.points_against;
      
      // Calculate current streak
      const teamGames = games
        .filter(g => 
          (g.home_team_id === record.team_id || g.away_team_id === record.team_id) &&
          g.home_score !== null && 
          g.away_score !== null
        )
        .sort((a, b) => a.week - b.week); // Sort by week ascending
      
      let streak = 0;
      let streakType: 'W' | 'L' | 'T' | null = null;
      
      // Loop backwards through games to find current streak
      for (let i = teamGames.length - 1; i >= 0; i--) {
        const game = teamGames[i];
        const isHome = game.home_team_id === record.team_id;
        const teamScore = isHome ? game.home_score! : game.away_score!;
        const oppScore = isHome ? game.away_score! : game.home_score!;
        
        let result: 'W' | 'L' | 'T';
        if (teamScore > oppScore) {
          result = 'W';
        } else if (teamScore < oppScore) {
          result = 'L';
        } else {
          result = 'T';
        }
        
        if (streakType === null) {
          streakType = result;
          streak = 1;
        } else if (streakType === result) {
          streak++;
        } else {
          break; // Streak is broken
        }
      }
      
      record.streak = streakType ? `${streakType}${streak}` : '-';
    });

    // Filter out teams with 0 games (not part of league that year)
    const activeRecords = Array.from(teamRecords.values()).filter(record => 
      (record.wins + record.losses + record.ties) > 0
    );
    
    const getGroupWinPct = (record: TeamRecord): number => {
      const groupWins = (record as any).quad_wins ?? record.division_wins ?? 0;
      const groupLosses = (record as any).quad_losses ?? record.division_losses ?? 0;
      const groupTies = (record as any).quad_ties ?? record.division_ties ?? 0;
      const total = groupWins + groupLosses + groupTies;
      return total > 0 ? (groupWins + groupTies * 0.5) / total : 0;
    };

    const sortedRecords = activeRecords.sort((a, b) => {
      // 1) Overall record (win %)
      if (a.win_percentage !== b.win_percentage) {
        return b.win_percentage - a.win_percentage;
      }
      // 2) Division/Quad record
      const aGroup = getGroupWinPct(a);
      const bGroup = getGroupWinPct(b);
      if (aGroup !== bGroup) {
        return bGroup - aGroup;
      }
      // 3) Points scored
      return b.points_for - a.points_for;
    });

    const standings: Standings = {
      season_year: seasonYear,
      overall: sortedRecords,
    };

    // Group by divisions based on team_seasons data
    const divisionsMap = new Map<number, TeamRecord[]>();
    const quadsMap = new Map<number, TeamRecord[]>();
    
    teamSeasons.forEach(ts => {
      const teamRecord = sortedRecords.find(record => record.team_id === ts.team_id);
      if (teamRecord) {
        // Group by division_id if it exists
        if (ts.division_id !== null && ts.division_id !== undefined) {
          if (!divisionsMap.has(ts.division_id)) {
            divisionsMap.set(ts.division_id, []);
          }
          divisionsMap.get(ts.division_id)!.push(teamRecord);
        }
        
        // Group by quad_id if it exists
        if (ts.quad_id !== null && ts.quad_id !== undefined) {
          if (!quadsMap.has(ts.quad_id)) {
            quadsMap.set(ts.quad_id, []);
          }
          quadsMap.get(ts.quad_id)!.push(teamRecord);
        }
      }
    });

    // Create division standings if divisions exist
    if (divisionsMap.size > 0 && divisions.length > 0) {
      standings.divisions = {};
      divisionsMap.forEach((teams, divisionId) => {
        const division = divisions.find(d => d.division_id === divisionId);
        const divisionName = division?.division_name || `Division ${divisionId}`;
        
        // Sort teams within the division
        const sortedDivisionTeams = teams.sort((a, b) => {
          if (a.win_percentage !== b.win_percentage) {
            return b.win_percentage - a.win_percentage;
          }
          const aGroup = getGroupWinPct(a);
          const bGroup = getGroupWinPct(b);
          if (aGroup !== bGroup) {
            return bGroup - aGroup;
          }
          return b.points_for - a.points_for;
        });
        standings.divisions![divisionName] = sortedDivisionTeams;
      });
    }

    // Create quad standings if quads exist
    if (quadsMap.size > 0 && quads.length > 0) {
      standings.quads = {};
      quadsMap.forEach((teams, quadId) => {
        const quad = quads.find(q => q.quad_id === quadId);
        const quadName = quad?.quad_name || `Quad ${quadId}`;
        
        // Sort teams within the quad
        const sortedQuadTeams = teams.sort((a, b) => {
          if (a.win_percentage !== b.win_percentage) {
            return b.win_percentage - a.win_percentage;
          }
          const aGroup = getGroupWinPct(a);
          const bGroup = getGroupWinPct(b);
          if (aGroup !== bGroup) {
            return bGroup - aGroup;
          }
          return b.points_for - a.points_for;
        });
        standings.quads![quadName] = sortedQuadTeams;
      });
    }

    return standings;
  } catch (error) {
    handleSupabaseError(error, 'calculateStandings');
    return {
      season_year: seasonYear,
      overall: [],
    };
  }
}

// Team Seasons
export async function getTeamSeasons(seasonYear?: number): Promise<TeamSeason[]> {
  try {
    let query = supabase
      .from('team_seasons')
      .select(`
        *
      `);
      // Note: Skip foreign key joins since divisions/quads tables don't exist
      // team:team_id(*),
      // division:division_id(*),
      // quad:quad_id(*)
      // Note: active column may not exist, so skip the filter for now
      // .eq('active', true);

    if (seasonYear) {
      query = (query as any).eq('year', seasonYear);
    }

    const { data, error } = await (query as any);

    if (error) {
      handleSupabaseError(error, 'getTeamSeasons');
    }

    return data || [];
  } catch (error) {
    handleSupabaseError(error, 'getTeamSeasons');
    return [];
  }
}

// League Seasons
export async function getCurrentSeason(): Promise<LeagueSeason | null> {
  try {
    // Get the most recent season (since is_current column doesn't exist)
    const { data, error } = await supabase
      .from('league_seasons')
      .select('*')
      .order('year', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // If still no data, return null
      if (error.code === 'PGRST116') return null;
      handleSupabaseError(error, 'getCurrentSeason');
    }

    return data;
  } catch (error) {
    handleSupabaseError(error, 'getCurrentSeason');
    return null;
  }
}

export async function getLeagueSeasons(): Promise<LeagueSeason[]> {
  try {
    const { data, error } = await supabase
      .from('league_seasons')
      .select('*')
      .order('year', { ascending: false });

    if (error) {
      handleSupabaseError(error, 'getLeagueSeasons');
    }

    return data || [];
  } catch (error) {
    handleSupabaseError(error, 'getLeagueSeasons');
    return [];
  }
}

export async function getAvailableYears(): Promise<number[]> {
  try {
    const { data, error } = await supabase
      .from('games')
      .select('year')
      .order('year', { ascending: false });

    if (error) {
      handleSupabaseError(error, 'getAvailableYears');
    }

    // Get unique years
    const years = Array.from(new Set((data || []).map((game: any) => game.year)));
    return years.sort((a, b) => b - a);
  } catch (error) {
    handleSupabaseError(error, 'getAvailableYears');
    return [];
  }
}

// Divisions and Quads
export async function getDivisions(): Promise<Division[]> {
  try {
    const { data, error } = await supabase
      .from('divisions')
      .select('*')
      .order('division_id');

    if (error) {
      handleSupabaseError(error, 'getDivisions');
    }

    return data || [];
  } catch (error) {
    handleSupabaseError(error, 'getDivisions');
    return [];
  }
}

export async function getQuads(): Promise<Quad[]> {
  try {
    const { data, error } = await supabase
      .from('quads')
      .select('*')
      .order('quad_id');

    if (error) {
      handleSupabaseError(error, 'getQuads');
    }

    return data || [];
  } catch (error) {
    handleSupabaseError(error, 'getQuads');
    return [];
  }
}

// Trophies
export async function getTrophies(): Promise<Trophy[]> {
  try {
    const { data, error } = await supabase
      .from('trophies')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      handleSupabaseError(error, 'getTrophies');
    }

    return data || [];
  } catch (error) {
    handleSupabaseError(error, 'getTrophies');
    return [];
  }
}

export async function getTrophyCase(
  seasonYear?: number,
  teamId?: number
): Promise<TrophyCase[]> {
  try {
    let query = supabase
      .from('trophy_case')
      .select(`
        *,
        trophy:trophy_id(*),
        team:team_id(*)
      `)
      .order('year', { ascending: false });

    if (seasonYear) {
      query = (query as any).eq('year', seasonYear);
    }

    if (teamId) {
      query = (query as any).eq('team_id', teamId);
    }

    const { data, error } = await (query as any);

    if (error) {
      handleSupabaseError(error, 'getTrophyCase');
    }

    return data || [];
  } catch (error) {
    handleSupabaseError(error, 'getTrophyCase');
    return [];
  }
}

// Team Bios
export async function getTeamBio(teamId: number, seasonYear: number): Promise<TeamBio | null> {
  try {
    const { data, error } = await supabase
      .from('team_bios')
      .select(`
        *,
        team:team_id(*)
      `)
      .eq('team_id', teamId)
      .eq('season_year', seasonYear)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      handleSupabaseError(error, 'getTeamBio');
    }

    return data;
  } catch (error) {
    handleSupabaseError(error, 'getTeamBio');
    return null;
  }
}

// Franchise History
export async function getFranchiseHistory(teamId?: number): Promise<FranchiseHistory[]> {
  try {
    let query = supabase
      .from('franchise_history')
      .select(`
        *,
        team:team_id(*)
      `)
      .order('change_date', { ascending: false });

    if (teamId) {
      query = (query as any).eq('team_id', teamId);
    }

    const { data, error } = await (query as any);

    if (error) {
      handleSupabaseError(error, 'getFranchiseHistory');
    }

    return data || [];
  } catch (error) {
    handleSupabaseError(error, 'getFranchiseHistory');
    return [];
  }
}

// Draft History
export async function getDraftHistory(
  seasonYear?: number,
  teamId?: number
): Promise<Draft[]> {
  try {
    let query = supabase
      .from('drafts')
      .select(`
        *,
        team:team_id(*)
      `)
      .order('season_year', { ascending: false })
      .order('pick', { ascending: true });

    if (seasonYear) {
      query = (query as any).eq('season_year', seasonYear);
    }

    if (teamId) {
      query = (query as any).eq('team_id', teamId);
    }

    const { data, error } = await (query as any);

    if (error) {
      handleSupabaseError(error, 'getDraftHistory');
    }

    return data || [];
  } catch (error) {
    handleSupabaseError(error, 'getDraftHistory');
    return [];
  }
}

// Articles
export async function getArticles(
  featuredTeamId?: number,
  limit = 10,
  offset = 0
): Promise<Article[]> {
  try {
    let query = supabase
      .from('articles')
      .select(`
        *,
        featured_team:featured_team_id(*)
      `)
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (featuredTeamId) {
      query = (query as any).eq('featured_team_id', featuredTeamId);
    }

    const { data, error } = await (query as any);

    if (error) {
      handleSupabaseError(error, 'getArticles');
    }

    return data || [];
  } catch (error) {
    handleSupabaseError(error, 'getArticles');
    return [];
  }
}

// Survivor
export interface SurvivorEntry {
  year: number;
  week: number;
  team_id: number;
  score: number | null;
  eliminated: boolean;
  team?: Team;
}

export interface SurvivorData {
  year: number;
  teams: SurvivorEntry[];
  eliminationWeek: number | null; // Week when team was eliminated (null if still alive)
}

export async function getSurvivorData(year: number): Promise<SurvivorData[]> {
  try {
    // Get all games for the season
    const games = await getGames(year);
    
    // Get all teams that played in this season
    const { data: teamSeasons, error: teamSeasonsError } = await supabase
      .from('team_seasons')
      .select(`
        *,
        team:teams(*)
      `)
      .eq('year', year) as { data: any[] | null, error: any };

    if (teamSeasonsError) {
      handleSupabaseError(teamSeasonsError, 'getSurvivorData');
      return [];
    }

    const teams = (teamSeasons || []).map(ts => ts.team as Team);
    
    // Get all weeks in the season
    const weeks = Array.from(new Set(games.map(g => g.week))).sort((a, b) => a - b);
    
    // Calculate survivor data
    const survivorData: SurvivorData[] = [];
    let activeTeams = new Set(teams.map(t => t.team_id));
    
    for (const week of weeks) {
      const weekGames = games.filter(g => g.week === week && !g.playoffs);
      
      if (weekGames.length === 0) continue;
      
      // Calculate weekly scores for active teams
      const weeklyScores: { team_id: number; score: number; team: Team }[] = [];
      
      for (const teamId of Array.from(activeTeams)) {
        const teamGames = weekGames.filter(g => 
          g.home_team_id === teamId || g.away_team_id === teamId
        );
        
        if (teamGames.length === 0) continue;
        
        const game = teamGames[0]; // Should only be one game per team per week
        const isHome = game.home_team_id === teamId;
        const score = isHome ? game.home_score : game.away_score;
        
        if (score !== null && score !== undefined) {
          const team = teams.find(t => t.team_id === teamId);
          if (team) {
            weeklyScores.push({ team_id: teamId, score, team });
          }
        }
      }
      
      // Sort by score (ascending - lowest score gets eliminated)
      weeklyScores.sort((a, b) => a.score - b.score);
      
      // Add survivor entries for this week
      const weekData: SurvivorData = {
        year,
        teams: weeklyScores.map((entry, index) => ({
          year,
          week,
          team_id: entry.team_id,
          score: entry.score,
          eliminated: false, // Will be set below for the lowest scorer
          team: entry.team
        })),
        eliminationWeek: null
      };
      
      // Mark the lowest scorer as eliminated
      if (weeklyScores.length > 0) {
        const eliminatedTeamId = weeklyScores[0].team_id;
        const eliminatedTeam = weekData.teams.find(t => t.team_id === eliminatedTeamId);
        if (eliminatedTeam) {
          eliminatedTeam.eliminated = true;
          weekData.eliminationWeek = week;
        }
        activeTeams.delete(eliminatedTeamId);
      }
      
      survivorData.push(weekData);
      
      // Stop if only one team left
      if (activeTeams.size <= 1) break;
    }
    
    return survivorData;
  } catch (error) {
    handleSupabaseError(error, 'getSurvivorData');
    return [];
  }
}
