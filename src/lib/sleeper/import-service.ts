/**
 * Main service for importing Sleeper scores and awarding trophies
 */

import { getMatchups, processMatchupsIntoGames } from './api';
import { getTeamIdFromRosterId } from './mapping';
import { insertGames, checkGamesExist, getHighestScoringTeam, awardTrophy, getTeamName } from '../supabase/games';

export interface ImportResult {
  success: boolean;
  message: string;
  gamesImported?: number;
  trophyAwarded?: {
    team_id: number;
    team_name: string;
    score: number;
    isNew: boolean;
  };
  error?: string;
}

/**
 * Import scores for a specific week and year
 */
export async function importWeekScores(
  year: number,
  week: number
): Promise<ImportResult> {
  try {
    // Check if games already exist for this week
    const gamesExist = await checkGamesExist(year, week);
    if (gamesExist) {
      return {
        success: false,
        message: `Games for ${year} Week ${week} already exist in the database`,
        error: 'Games already exist'
      };
    }

    // Fetch matchups from Sleeper
    const matchups = await getMatchups(week);
    if (matchups.length === 0) {
      return {
        success: false,
        message: `No matchups found for Week ${week}`,
        error: 'No matchups found'
      };
    }

    // Process matchups into games
    const sleeperGames = processMatchupsIntoGames(matchups);
    if (sleeperGames.length === 0) {
      return {
        success: false,
        message: `No valid games found for Week ${week}`,
        error: 'No valid games found'
      };
    }

    // Convert Sleeper games to Supabase format
    const games = sleeperGames.map(sleeperGame => {
      const awayTeamId = getTeamIdFromRosterId(sleeperGame.away_roster_id);
      const homeTeamId = getTeamIdFromRosterId(sleeperGame.home_roster_id);

      if (!awayTeamId || !homeTeamId) {
        throw new Error(`Unknown roster IDs: ${sleeperGame.away_roster_id}, ${sleeperGame.home_roster_id}`);
      }

      // Special handling for 2025: Week 14 is not playoffs (it has special rules)
      // For 2025: Week 14 = regular season (but doesn't count for division standings in logic)
      //           Week 15+ = playoffs
      // For other years: Week 14+ = playoffs (as before)
      const isPlayoffs = year === 2025 ? week >= 15 : week >= 14;

      return {
        year,
        week,
        playoffs: isPlayoffs,
        away_team_id: awayTeamId,
        home_team_id: homeTeamId,
        away_score: sleeperGame.away_score,
        home_score: sleeperGame.home_score,
      };
    });

    // Insert games into Supabase
    const insertResult = await insertGames(games);
    if (!insertResult.success) {
      return {
        success: false,
        message: `Failed to insert games: ${insertResult.error}`,
        error: insertResult.error
      };
    }

    // Award trophy to highest scoring team
    const highestScorer = await getHighestScoringTeam(year, week);
    let trophyResult = null;

    if (highestScorer) {
      const trophyAwardResult = await awardTrophy(
        highestScorer.team_id,
        6, // Trophy ID 6 for Briefly Badass
        year,
        week
      );

      if (trophyAwardResult.success) {
        const teamName = await getTeamName(highestScorer.team_id);
        trophyResult = {
          team_id: highestScorer.team_id,
          team_name: teamName || `Team ${highestScorer.team_id}`,
          score: highestScorer.score,
          isNew: trophyAwardResult.isNew || false
        };
      }
    }

    return {
      success: true,
      message: `Successfully imported ${insertResult.insertedCount} games for ${year} Week ${week}`,
      gamesImported: insertResult.insertedCount,
      trophyAwarded: trophyResult || undefined
    };

  } catch (error) {
    console.error('Error importing week scores:', error);
    return {
      success: false,
      message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Validate roster mapping before import
 */
export async function validateImportSetup(): Promise<{
  valid: boolean;
  issues: string[];
}> {
  const issues: string[] = [];

  // Check if roster mapping is configured
  const { valid: mappingValid, missing } = await import('./mapping').then(m => m.validateRosterMapping());
  if (!mappingValid) {
    issues.push(`Missing roster mappings for roster IDs: ${missing.join(', ')}`);
  }

  // Check if we can connect to Sleeper API
  try {
    const { getLeagueInfo } = await import('./api');
    const leagueInfo = await getLeagueInfo();
    if (!leagueInfo) {
      issues.push('Cannot connect to Sleeper API or league not found');
    }
  } catch (error) {
    issues.push('Error connecting to Sleeper API');
  }

  return {
    valid: issues.length === 0,
    issues
  };
}
