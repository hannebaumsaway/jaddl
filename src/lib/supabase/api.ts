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
  Article,
  PlayoffSeedResult,
  PlayoffSeedRow,
  PlayoffPods
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

/**
 * Per-season format configuration. Keeping this in one place is what lets the
 * rest of the code stay year-agnostic.
 *
 * 2025 was the pod experiment: an 8-team field where the four quad winners took
 * seeds 1-4, wildcards were ranked purely on points, and Week 14 was a play-in
 * (points counted, W-L did not), pushing playoffs to NFL week 15.
 * 2026 returns to the historical format used every year from 2007-2024: a 6-team
 * field, group winners on top with byes, and wildcards ranked by record.
 *
 * `regularSeasonWeeks` is the last NFL week imported as a regular-season game.
 * Playoff games are NOT stored by NFL week — every season since 2007 records them
 * as rounds (week 1 = quarterfinal, 2 = semifinal, 3 = championship) with
 * playoffs=true, so they are entered separately rather than through the weekly
 * Sleeper import.
 */
export interface SeasonConfig {
  playoffTeams: number;
  usesPods: boolean;
  wildcardRule: 'points' | 'record';
  regularSeasonWeeks: number;
  /**
   * Regular-season weeks whose games do NOT count toward W-L-T. Points still
   * count. 2025's Week 14 was a play-in scored on points alone, so it belongs
   * here rather than as an inline `year === 2025` check at the call site —
   * anything deriving a record (W-L, streak, tiebreaks) must honour the same
   * rule or the columns silently disagree with each other.
   */
  recordExcludesWeeks: number[];
}

export function getSeasonConfig(seasonYear: number): SeasonConfig {
  // Verified against the games table: 2007-2020 ran 13-week regular seasons,
  // 2021 onward run 14.
  const regularSeasonWeeks = seasonYear >= 2021 ? 14 : 13;

  if (seasonYear === 2025) {
    return {
      playoffTeams: 8,
      usesPods: true,
      wildcardRule: 'points',
      regularSeasonWeeks,
      recordExcludesWeeks: [14],
    };
  }
  return {
    playoffTeams: 6,
    usesPods: false,
    wildcardRule: 'record',
    regularSeasonWeeks,
    recordExcludesWeeks: [],
  };
}

/**
 * The single predicate for "does this game count toward a team's record?"
 * Playoff games never do — they are stored with `week` holding the ROUND
 * (1-3), so they also sort as if they were early-season games. Both the W-L
 * tally and the streak walk must filter through this.
 */
export function countsTowardRecord(game: Game, config: SeasonConfig): boolean {
  if (game.playoffs) return false;
  if (config.recordExcludesWeeks.includes(game.week)) return false;
  return true;
}

/** Win pct within a team's division/quad, whichever the season uses. */
function getGroupWinPct(record: TeamRecord): number {
  const groupWins = (record as any).quad_wins ?? record.division_wins ?? 0;
  const groupLosses = (record as any).quad_losses ?? record.division_losses ?? 0;
  const groupTies = (record as any).quad_ties ?? record.division_ties ?? 0;
  const total = groupWins + groupLosses + groupTies;
  return total > 0 ? (groupWins + groupTies * 0.5) / total : 0;
}

/** Head-to-head wins keyed `${winnerId}:${loserId}`, regular season only. */
type HeadToHead = Map<string, number>;

function buildHeadToHead(games: Game[]): HeadToHead {
  const h2h: HeadToHead = new Map();

  games.forEach(game => {
    if (game.playoffs) return;
    if (game.home_score === null || game.away_score === null) return;
    if (game.home_score === game.away_score) return; // ties create no edge

    const winner = game.home_score! > game.away_score! ? game.home_team_id : game.away_team_id;
    const loser = game.home_score! > game.away_score! ? game.away_team_id : game.home_team_id;
    const key = `${winner}:${loser}`;
    h2h.set(key, (h2h.get(key) || 0) + 1);
  });

  return h2h;
}

/** Fallback chain once record and head-to-head are exhausted. */
function compareGroupThenPoints(a: TeamRecord, b: TeamRecord): number {
  const aGroup = getGroupWinPct(a);
  const bGroup = getGroupWinPct(b);
  if (aGroup !== bGroup) return bGroup - aGroup;
  return b.points_for - a.points_for;
}

/**
 * Break a tie among teams with identical overall records.
 *
 * Head-to-head is only a valid ordering for a pair, so for three or more tied
 * teams we fall back to a mini round-robin win pct among just those teams —
 * the standard resolution, since pairwise h2h can be circular (A beat B, B beat
 * C, C beat A) and would make the sort order depend on input order.
 */
function resolveTie(tied: TeamRecord[], h2h: HeadToHead): TeamRecord[] {
  if (tied.length < 2) return tied;

  if (tied.length === 2) {
    const [a, b] = tied;
    const aWins = h2h.get(`${a.team_id}:${b.team_id}`) || 0;
    const bWins = h2h.get(`${b.team_id}:${a.team_id}`) || 0;
    if (aWins !== bWins) return aWins > bWins ? [a, b] : [b, a];
    return [...tied].sort(compareGroupThenPoints);
  }

  const mini = new Map<number, { wins: number; losses: number }>();
  tied.forEach(t => mini.set(t.team_id, { wins: 0, losses: 0 }));

  for (let i = 0; i < tied.length; i++) {
    for (let j = i + 1; j < tied.length; j++) {
      const a = tied[i].team_id;
      const b = tied[j].team_id;
      const aWins = h2h.get(`${a}:${b}`) || 0;
      const bWins = h2h.get(`${b}:${a}`) || 0;
      mini.get(a)!.wins += aWins;
      mini.get(a)!.losses += bWins;
      mini.get(b)!.wins += bWins;
      mini.get(b)!.losses += aWins;
    }
  }

  const miniPct = (teamId: number): number => {
    const m = mini.get(teamId)!;
    const total = m.wins + m.losses;
    return total > 0 ? m.wins / total : 0;
  };

  return [...tied].sort((a, b) => {
    const diff = miniPct(b.team_id) - miniPct(a.team_id);
    if (diff !== 0) return diff;
    return compareGroupThenPoints(a, b);
  });
}

/**
 * Order teams for playoff seeding: overall record, then head-to-head, then
 * division/quad record, then total points.
 */
export function sortForSeeding(records: TeamRecord[], h2h: HeadToHead): TeamRecord[] {
  const byRecord = [...records].sort((a, b) => b.win_percentage - a.win_percentage);
  const ordered: TeamRecord[] = [];

  let i = 0;
  while (i < byRecord.length) {
    let j = i;
    while (j + 1 < byRecord.length && byRecord[j + 1].win_percentage === byRecord[i].win_percentage) {
      j++;
    }
    ordered.push(...resolveTie(byRecord.slice(i, j + 1), h2h));
    i = j + 1;
  }

  return ordered;
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

    // Per-season record rules live in getSeasonConfig, not inline here.
    const seasonConfig = getSeasonConfig(seasonYear);
    const is2025 = seasonYear === 2025;
    // Division/quad standings stop at the last week that counts toward record.
    const divisionCutoffWeek = is2025 ? 13 : 14;

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
          // Always include points in totals (for wildcard calculations and points title)
          homeRecord.points_for += game.home_score!;
          homeRecord.points_against += game.away_score!;
          awayRecord.points_for += game.away_score!;
          awayRecord.points_against += game.home_score!;

          // Single source of truth — the streak walk below uses this same
          // predicate, so W-L and streak cannot disagree.
          const isRegularSeason = !game.playoffs;

          if (countsTowardRecord(game, seasonConfig)) {
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
          }

          // Division record updates (only if both teams share a valid division, regular season only, and within cutoff week)
          const homeDivisionId = teamIdToDivisionId.get(game.home_team_id);
          const awayDivisionId = teamIdToDivisionId.get(game.away_team_id);
          const isDivisionGame = homeDivisionId !== null && homeDivisionId !== undefined && homeDivisionId === awayDivisionId;
          const isDivisionEligible = isRegularSeason && game.week <= divisionCutoffWeek;

          if (isDivisionGame && isDivisionEligible) {
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

          // Quad record updates (only if both teams share a valid quad, regular season only, and within cutoff week)
          const homeQuadId = teamIdToQuadId.get(game.home_team_id);
          const awayQuadId = teamIdToQuadId.get(game.away_team_id);
          const isQuadGame = homeQuadId !== null && homeQuadId !== undefined && homeQuadId === awayQuadId;

          if (isQuadGame && isDivisionEligible) {
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
      
      // Calculate current streak.
      //
      // Must use the SAME predicate as the W-L tally above. Two ways this
      // previously went wrong:
      //   1. Playoff games were included. They store `week` as the ROUND (1-3),
      //      so they sorted in among early regular-season weeks rather than at
      //      the end. Latent in practice — the backward walk breaks before
      //      reaching them — but it would surface for an undefeated season.
      //   2. Weeks excluded from the record (2025's points-only Week 14 play-in)
      //      still counted toward the streak, so every 2025 streak was off by
      //      one and two of them pointed the wrong direction entirely.
      const teamGames = games
        .filter(g =>
          (g.home_team_id === record.team_id || g.away_team_id === record.team_id) &&
          g.home_score !== null &&
          g.away_score !== null &&
          countsTowardRecord(g, seasonConfig)
        )
        .sort((a, b) => a.week - b.week); // safe now: regular-season weeks only
      
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

/**
 * True when a season already has playoff games recorded.
 *
 * Playoff results are stored as rounds (playoffs=true, week 1-3), so their
 * presence means the bracket actually played out. For those seasons the games
 * table is the historical record; anything `calculatePlayoffSeeds` derives is a
 * recomputation from today's data and may not match what really happened —
 * verified: the computed field diverges from the actual field for 2014 and 2018.
 */
export async function hasRecordedPlayoffs(seasonYear: number): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('games')
      .select('week')
      .eq('year', seasonYear)
      .eq('playoffs', true)
      .limit(1);

    if (error) {
      handleSupabaseError(error, 'hasRecordedPlayoffs');
      return false;
    }

    return (data || []).length > 0;
  } catch (error) {
    handleSupabaseError(error, 'hasRecordedPlayoffs');
    return false;
  }
}

/**
 * Calculate playoff seeds for a given season.
 *
 * Group (division/quad) winners take the top seeds, ordered against each other;
 * wildcards fill the remaining spots. The field size and wildcard rule come from
 * `getSeasonConfig`, so the shape adapts to however many groups the season has:
 *   - 2025: 4 quad winners (seeds 1-4) + 4 wildcards by points (seeds 5-8)
 *   - 2026: 2 division winners (seeds 1-2) + 4 wildcards by record (seeds 3-6)
 *
 * Returns calculated seed results; does not save to the database.
 *
 * Refuses seasons whose playoffs already happened, so projected seeds can't be
 * mistaken for the historical bracket. Pass `allowCompletedSeason` when a
 * projection over a finished season is genuinely what you want.
 */
export async function calculatePlayoffSeeds(
  seasonYear: number,
  options: { allowCompletedSeason?: boolean } = {}
): Promise<PlayoffSeedResult[]> {
  if (!options.allowCompletedSeason && (await hasRecordedPlayoffs(seasonYear))) {
    throw new Error(
      `${seasonYear} already has playoff games recorded, so these seeds would be a projection ` +
        `rather than what actually happened — the real bracket is in the games table ` +
        `(playoffs=true, week = round). Pass { allowCompletedSeason: true } to compute anyway.`
    );
  }

  try {
    const [standings, teams, leagueSeasons, games] = await Promise.all([
      calculateStandings(seasonYear),
      getTeams(),
      getLeagueSeasons(),
      getGames(seasonYear, undefined, undefined, false),
    ]);

    const config = getSeasonConfig(seasonYear);
    const currentLeagueSeason = leagueSeasons.find(ls => ls.year === seasonYear);
    const structureType = currentLeagueSeason?.structure_type || 'single_league';

    const teamMap = new Map(teams.map(t => [t.team_id, t]));
    const h2h = buildHeadToHead(games);

    // Group standings for whichever structure this season used.
    const groups: TeamRecord[][] =
      structureType === 'quads' && standings.quads
        ? Object.values(standings.quads)
        : structureType === 'divisions' && standings.divisions
        ? Object.values(standings.divisions)
        : [];

    // A group winner is the top team in its group under the full tiebreaker chain.
    const groupWinners = new Set<number>();
    groups.forEach(groupStandings => {
      const ordered = sortForSeeding(groupStandings, h2h);
      if (ordered.length > 0) {
        groupWinners.add(ordered[0].team_id);
      }
    });

    const winnerRecords = sortForSeeding(
      standings.overall.filter(record => groupWinners.has(record.team_id)),
      h2h
    );

    const remainingSpots = Math.max(0, config.playoffTeams - winnerRecords.length);
    const nonWinners = standings.overall.filter(record => !groupWinners.has(record.team_id));

    const wildcardRecords = (
      config.wildcardRule === 'points'
        ? [...nonWinners].sort((a, b) => b.points_for - a.points_for)
        : sortForSeeding(nonWinners, h2h)
    ).slice(0, remainingSpots);

    const toSeed = (
      record: TeamRecord,
      seed: number,
      isGroupWinner: boolean
    ): PlayoffSeedResult | null => {
      const team = teamMap.get(record.team_id);
      if (!team) return null;
      return {
        seed,
        team_id: record.team_id,
        team,
        teamRecord: record,
        isDivisionWinner: isGroupWinner,
        isWildcard: !isGroupWinner,
      };
    };

    const seeds = [
      ...winnerRecords.map((r, i) => toSeed(r, i + 1, true)),
      ...wildcardRecords.map((r, i) => toSeed(r, winnerRecords.length + i + 1, false)),
    ].filter((s): s is PlayoffSeedResult => s !== null);

    return seeds.sort((a, b) => a.seed - b.seed);
  } catch (error) {
    handleSupabaseError(error, 'calculatePlayoffSeeds');
    return [];
  }
}

/**
 * Save playoff seeds to database with pod assignments.
 *
 * Pods are a 2025-only concept: seeds 1-2 get pod=NULL (byes), Pod A = seeds
 * 3,5,8 and Pod B = seeds 4,6,7. Every other season stores pod=NULL throughout.
 *
 * This deletes and re-inserts every seed row for the season, so it refuses
 * seasons whose playoffs already happened — re-seeding those would silently
 * replace the stored bracket with a recomputation from current data.
 */
export async function savePlayoffSeeds(
  seasonYear: number,
  options: { force?: boolean } = {}
): Promise<PlayoffSeedRow[]> {
  if (!options.force && (await hasRecordedPlayoffs(seasonYear))) {
    throw new Error(
      `Refusing to re-seed ${seasonYear}: that season's playoffs are already recorded. ` +
        `Saving now would replace the stored seeding with a recomputation from current data ` +
        `(the stored 2025 rows, for example, predate later score corrections). ` +
        `Pass { force: true } to override.`
    );
  }

  try {
    const config = getSeasonConfig(seasonYear);
    // Guarded above: reaching here means the season is unfinished or force was set.
    const calculatedSeeds = await calculatePlayoffSeeds(seasonYear, { allowCompletedSeason: true });

    if (calculatedSeeds.length !== config.playoffTeams) {
      throw new Error(
        `Expected ${config.playoffTeams} playoff seeds for ${seasonYear}, got ${calculatedSeeds.length}. ` +
          `Check that league_seasons and team_seasons are populated for this year.`
      );
    }

    // Delete existing seeds for this season
    const { error: deleteError } = await supabase
      .from('playoff_seeds')
      .delete()
      .eq('season_year', seasonYear);

    if (deleteError) {
      throw deleteError;
    }

    // Determine pod assignments (pod-format seasons only)
    const getPod = (seed: number): 'A' | 'B' | null => {
      if (!config.usesPods) return null;
      if (seed <= 2) return null; // Seeds 1-2 get byes
      if ([3, 5, 8].includes(seed)) return 'A';
      if ([4, 6, 7].includes(seed)) return 'B';
      return null;
    };

    // Insert seeds with pod assignments
    const seedsToInsert = calculatedSeeds.map(seed => ({
      season_year: seasonYear,
      team_id: seed.team_id,
      seed: seed.seed,
      is_division_winner: seed.isDivisionWinner,
      is_wildcard: seed.isWildcard,
      pod: getPod(seed.seed),
    }));

    const { data, error } = await supabase
      .from('playoff_seeds')
      .insert(seedsToInsert as any)
      .select();

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    handleSupabaseError(error, 'savePlayoffSeeds');
    throw error;
  }
}

/**
 * Get playoff seeds from database for a season
 */
export async function getPlayoffSeeds(seasonYear: number): Promise<PlayoffSeedRow[]> {
  try {
    const { data, error } = await supabase
      .from('playoff_seeds')
      .select('*')
      .eq('season_year', seasonYear)
      .order('seed', { ascending: true });

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    handleSupabaseError(error, 'getPlayoffSeeds');
    return [];
  }
}

/**
 * Get playoff pod structure for Week 15 from database
 * For 2025: Pod A (seeds 3, 5, 8), Pod B (seeds 4, 6, 7), Seeds 1-2 get byes
 */
export async function getPlayoffPods(seasonYear: number, week: number): Promise<PlayoffPods | null> {
  // Only apply pod structure for 2025, Week 15
  if (seasonYear !== 2025 || week !== 15) {
    return null;
  }

  try {
    // Get seeds from database (should be saved after Week 14)
    const seedRows = await getPlayoffSeeds(seasonYear);
    
    if (seedRows.length < 8) {
      return null; // Seeds not saved yet
    }

    // Get teams for the seed rows
    const teams = await getTeams();
    const teamMap = new Map(teams.map(t => [t.team_id, t]));

    const byes = seedRows
      .filter(s => s.pod === null && s.seed <= 2)
      .map(seed => ({
        seed: seed.seed,
        team_id: seed.team_id,
        team: teamMap.get(seed.team_id)!,
      }));

    const podA = seedRows
      .filter(s => s.pod === 'A')
      .map(seed => ({
        seed: seed.seed,
        team_id: seed.team_id,
        team: teamMap.get(seed.team_id)!,
      }));

    const podB = seedRows
      .filter(s => s.pod === 'B')
      .map(seed => ({
        seed: seed.seed,
        team_id: seed.team_id,
        team: teamMap.get(seed.team_id)!,
      }));

    return {
      byes,
      podA,
      podB,
    };
  } catch (error) {
    handleSupabaseError(error, 'getPlayoffPods');
    return null;
  }
}

/**
 * Determine which teams advance from Week 15 pods based on highest scores
 * Returns the advancing teams from each pod
 */
export async function getPodWinners(seasonYear: number, week: number): Promise<{
  podAWinner: { team_id: number; seed: number; score: number } | null;
  podBWinner: { team_id: number; seed: number; score: number } | null;
} | null> {
  if (seasonYear !== 2025 || week !== 15) {
    return null;
  }

  try {
    const pods = await getPlayoffPods(seasonYear, week);
    if (!pods) return null;

    const week15Games = await getGames(seasonYear, week, undefined, false);
    
    // Get scores for each team in the pods
    const getTeamWeek15Score = (teamId: number): number => {
      const game = week15Games.find(g => 
        (g.home_team_id === teamId || g.away_team_id === teamId) &&
        g.home_score !== null && 
        g.away_score !== null
      );
      if (!game) return 0;
      return game.home_team_id === teamId ? game.home_score! : game.away_score!;
    };

    // Find highest scorer in Pod A
    let podAWinner: { team_id: number; seed: number; score: number } | null = null;
    pods.podA.forEach(team => {
      const score = getTeamWeek15Score(team.team_id);
      if (!podAWinner || score > podAWinner.score) {
        podAWinner = { team_id: team.team_id, seed: team.seed, score };
      }
    });

    // Find highest scorer in Pod B
    let podBWinner: { team_id: number; seed: number; score: number } | null = null;
    pods.podB.forEach(team => {
      const score = getTeamWeek15Score(team.team_id);
      if (!podBWinner || score > podBWinner.score) {
        podBWinner = { team_id: team.team_id, seed: team.seed, score };
      }
    });

    return { podAWinner, podBWinner };
  } catch (error) {
    handleSupabaseError(error, 'getPodWinners');
    return null;
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
