/**
 * Queries backing the scores page.
 *
 * These used to live inline in `src/app/(pages)/scores/page.tsx`, which built
 * its own `supabase.from('games')` query directly — the only page that reached
 * past the data layer.
 */

import { supabase } from './client';
import type { Game } from '@/types/database';

export interface MostRecentWeek {
  year: number;
  week: number;
  isPlayoff: boolean;
}

/**
 * The latest week that has games.
 *
 * Ordering is deliberately (year, playoffs, week) rather than (year, week):
 * playoff games store `week` as the ROUND (1-3), so a plain week-descending
 * sort ranks the championship (round 3) *below* regular-season week 14 and
 * this returns the wrong game as "most recent".
 */
export async function getMostRecentWeek(): Promise<MostRecentWeek> {
  try {
    const { data: mostRecentGame, error } = await supabase
      .from('games')
      .select('year, week, playoffs')
      .order('year', { ascending: false })
      .order('playoffs', { ascending: false })
      .order('week', { ascending: false })
      .limit(1)
      .single();

    if (error || !mostRecentGame) {
      return { year: 2024, week: 1, isPlayoff: false };
    }

    return {
      year: (mostRecentGame as any).year,
      week: (mostRecentGame as any).week,
      isPlayoff: (mostRecentGame as any).playoffs,
    };
  } catch (error) {
    console.error('Error getting most recent week:', error);
    return { year: 2024, week: 1, isPlayoff: false };
  }
}

export interface WeekOption {
  week: number;
  isPlayoff: boolean;
}

export interface SeasonWeekOptions {
  availableYears: number[];
  availableWeeks: WeekOption[];
}

/**
 * Years that have games, and the weeks available within one season.
 *
 * Regular weeks and playoff rounds are collected separately and concatenated
 * rather than merged and sorted: both are numbered from 1, so a single sort
 * would interleave "round 2" with "week 2".
 */
export async function getSeasonWeekOptions(seasonYear: number): Promise<SeasonWeekOptions> {
  try {
    const { data, error } = await supabase
      .from('games')
      .select('year, week, playoffs')
      .order('year', { ascending: false })
      .order('week', { ascending: false });

    if (error) throw error;
    const rows = (data || []) as any[];

    const availableYears = Array.from(new Set(rows.map(g => g.year)));
    const seasonRows = rows.filter(g => g.year === seasonYear);

    const uniqueSorted = (playoffs: boolean) =>
      Array.from(new Set(seasonRows.filter(g => !!g.playoffs === playoffs).map(g => g.week)))
        .sort((a, b) => a - b);

    return {
      availableYears,
      availableWeeks: [
        ...uniqueSorted(false).map(week => ({ week, isPlayoff: false })),
        ...uniqueSorted(true).map(week => ({ week, isPlayoff: true })),
      ],
    };
  } catch (error) {
    console.error('Error getting season week options:', error);
    return { availableYears: [], availableWeeks: [] };
  }
}

export type ScoreboardQuery =
  | { mode: 'week'; year: number; week: number; isPlayoffs: boolean }
  | { mode: 'allGames'; teamId: number }
  | { mode: 'headToHead'; teamId: number; opponentId: number };

/**
 * Games for the scores page, in the three shapes it renders: one week, one
 * team's full history, or a head-to-head series.
 */
export async function getScoreboardGames(params: ScoreboardQuery): Promise<Game[]> {
  try {
    let query = supabase.from('games').select('*') as any;

    if (params.mode === 'allGames') {
      query = query.or(
        `home_team_id.eq.${params.teamId},away_team_id.eq.${params.teamId}`
      );
    } else if (params.mode === 'headToHead') {
      const { teamId, opponentId } = params;
      query = query.or(
        `and(home_team_id.eq.${teamId},away_team_id.eq.${opponentId}),` +
        `and(home_team_id.eq.${opponentId},away_team_id.eq.${teamId})`
      );
    } else {
      query = query
        .eq('year', params.year)
        .eq('week', params.week)
        .eq('playoffs', params.isPlayoffs);
    }

    const { data, error } = await query
      .order('year', { ascending: false })
      .order('week', { ascending: false });

    if (error) throw error;
    return (data || []) as Game[];
  } catch (error) {
    console.error('Error getting scoreboard games:', error);
    return [];
  }
}
