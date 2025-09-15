/**
 * Supabase integration for games table operations
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Use service role key for server-side operations, fallback to anon key
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export interface Game {
  id?: number;
  year: number;
  week: number;
  playoffs: boolean;
  away_team_id: number;
  home_team_id: number;
  away_score: number | null;
  home_score: number | null;
}

export interface TrophyCase {
  id?: number;
  team_id: number;
  trophy_id: number;
  year: number;
  week: number;
  count: number;
}

/**
 * Insert games into the Supabase games table
 */
export async function insertGames(games: Game[]): Promise<{ success: boolean; error?: string; insertedCount?: number }> {
  try {
    // Create objects without id fields - let the database auto-generate them
    const gamesToInsert = games.map(game => ({
      year: game.year,
      week: game.week,
      playoffs: game.playoffs,
      away_team_id: game.away_team_id,
      home_team_id: game.home_team_id,
      away_score: game.away_score,
      home_score: game.home_score,
    }));

    console.log('Inserting games (auto-generated IDs):', JSON.stringify(gamesToInsert, null, 2));

    const { data, error } = await supabase
      .from('games')
      .insert(gamesToInsert)
      .select();

    if (error) {
      console.error('Error inserting games:', error);
      return { success: false, error: error.message };
    }

    return { success: true, insertedCount: data?.length || 0 };
  } catch (error) {
    console.error('Error inserting games:', error);
    return { success: false, error: 'Failed to insert games' };
  }
}

/**
 * Check if games already exist for a given week/year
 */
export async function checkGamesExist(year: number, week: number): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('games')
      .select('id')
      .eq('year', year)
      .eq('week', week)
      .limit(1);

    if (error) {
      console.error('Error checking existing games:', error);
      return false;
    }

    return data && data.length > 0;
  } catch (error) {
    console.error('Error checking existing games:', error);
    return false;
  }
}

/**
 * Get the highest scoring team for a specific week
 */
export async function getHighestScoringTeam(year: number, week: number): Promise<{
  team_id: number;
  score: number;
  is_away: boolean;
} | null> {
  try {
    // Get all games for the week
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('away_team_id, home_team_id, away_score, home_score')
      .eq('year', year)
      .eq('week', week);

    if (gamesError) {
      console.error('Error fetching games for trophy:', gamesError);
      return null;
    }

    if (!games || games.length === 0) {
      return null;
    }

    // Find the highest score
    let highestScore = 0;
    let highestTeam = null;
    let isAway = false;

    games.forEach(game => {
      if (game.away_score && game.away_score > highestScore) {
        highestScore = game.away_score;
        highestTeam = game.away_team_id;
        isAway = true;
      }
      if (game.home_score && game.home_score > highestScore) {
        highestScore = game.home_score;
        highestTeam = game.home_team_id;
        isAway = false;
      }
    });

    return highestTeam ? { team_id: highestTeam, score: highestScore, is_away: isAway } : null;
  } catch (error) {
    console.error('Error getting highest scoring team:', error);
    return null;
  }
}

/**
 * Award or increment a trophy for a team
 */
export async function awardTrophy(
  team_id: number,
  trophy_id: number,
  year: number,
  week: number
): Promise<{ success: boolean; error?: string; isNew?: boolean }> {
  try {
    // Check if trophy already exists for this team/year (any week)
    const { data: existing, error: checkError } = await supabase
      .from('trophy_case')
      .select('team_id, trophy_id, year, amount')
      .eq('team_id', team_id)
      .eq('trophy_id', trophy_id)
      .eq('year', year)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error checking existing trophy:', checkError);
      return { success: false, error: checkError.message };
    }

    if (existing) {
      // Increment existing trophy amount
      const { error: updateError } = await supabase
        .from('trophy_case')
        .update({ amount: existing.amount + 1 })
        .eq('team_id', team_id)
        .eq('trophy_id', trophy_id)
        .eq('year', year);

      if (updateError) {
        console.error('Error updating trophy amount:', updateError);
        return { success: false, error: updateError.message };
      }

      return { success: true, isNew: false };
    } else {
      // Create new trophy entry
      const { error: insertError } = await supabase
        .from('trophy_case')
        .insert({
          team_id,
          trophy_id,
          year,
          amount: 1
        });

      if (insertError) {
        console.error('Error inserting new trophy:', insertError);
        return { success: false, error: insertError.message };
      }

      return { success: true, isNew: true };
    }
  } catch (error) {
    console.error('Error awarding trophy:', error);
    return { success: false, error: 'Failed to award trophy' };
  }
}

/**
 * Get team name by team_id
 */
export async function getTeamName(team_id: number): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('teams')
      .select('team_name')
      .eq('team_id', team_id)
      .single();

    if (error) {
      console.error('Error fetching team name:', error);
      return null;
    }

    return data?.team_name || null;
  } catch (error) {
    console.error('Error fetching team name:', error);
    return null;
  }
}
