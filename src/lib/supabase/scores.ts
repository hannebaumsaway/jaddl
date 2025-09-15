/**
 * Utility functions for scores page
 */

import { supabase } from './client';

export interface MostRecentWeek {
  year: number;
  week: number;
  isPlayoff: boolean;
}

/**
 * Get the most recent available week with games
 */
export async function getMostRecentWeek(): Promise<MostRecentWeek> {
  try {
    // Get the most recent game (highest year, then highest week)
    const { data: mostRecentGame, error } = await supabase
      .from('games')
      .select('year, week, playoffs')
      .order('year', { ascending: false })
      .order('week', { ascending: false })
      .limit(1)
      .single();

    if (error || !mostRecentGame) {
      // Fallback to 2024 week 1 if no games found
      return { year: 2024, week: 1, isPlayoff: false };
    }

    return {
      year: (mostRecentGame as any).year,
      week: (mostRecentGame as any).week,
      isPlayoff: (mostRecentGame as any).playoffs
    };
  } catch (error) {
    console.error('Error getting most recent week:', error);
    // Fallback to 2024 week 1
    return { year: 2024, week: 1, isPlayoff: false };
  }
}
