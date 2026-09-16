/**
 * Season-by-season totals for every team, built in one pass over the game log.
 *
 * `recordsForSeason` in briefs/history.ts answers the same question but must be
 * called once per season, and each call re-walks all ~1600 games. A dossier
 * needs every season at once, so this builds the whole grid in a single pass
 * and everything downstream indexes into it.
 *
 * It also splits regular season from playoffs, which nothing else does: the
 * standings page folds playoff points into `points_for`, and `recordsForSeason`
 * drops the 2025 Week 14 points along with the Week 14 result.
 */

import type { LeagueHistoryData } from '../briefs/history';
import { getSeasonConfig, countsTowardRecord } from '../supabase/api';
import { countsTowardPoints, isPlayed } from './game-log';

export interface SeasonTotals {
  teamId: number;
  year: number;
  wins: number;
  losses: number;
  ties: number;
  /** Regular season only, and INCLUDING weeks excluded from the record. */
  pointsFor: number;
  pointsAgainst: number;
  /**
   * Regular-season games played, the correct denominator for points per game.
   *
   * This is NOT `wins + losses + ties`: 2025's Week 14 contributed points but
   * no result, so dividing its points by its record games overstates every
   * 2025 scoring average by 14/13.
   */
  pointsGames: number;
  playoffWins: number;
  playoffLosses: number;
  playoffTies: number;
  playoffPointsFor: number;
  playoffPointsAgainst: number;
  /**
   * Record against teams in the same division/quad that season.
   *
   * This is the SECOND tiebreaker, ahead of points for — omitting it picked the
   * wrong quad winner in 2022, where Mighty Boom and Tulsa both finished 6-8,
   * Tulsa had more points, and Mighty Boom took the quad 3-1.
   */
  groupWins: number;
  groupLosses: number;
  groupTies: number;
}

export interface PlayoffShape {
  /** Highest round recorded that season; playoff `week` holds the round. */
  finalRound: number;
  /** The title game, when the final round is a single game. */
  championId: number | null;
  runnerUpId: number | null;
}

/**
 * How far a season has actually got.
 *
 * Without this everything downstream silently treats an in-progress season as
 * finished. One week into 2026 the code had already handed out two division
 * titles and a points title, and rewritten nine franchises' best-or-worst
 * season ever as a 1-0 or 0-1 record.
 */
export interface SeasonProgress {
  year: number;
  /** Highest regular-season week with a recorded result. */
  regularWeeksPlayed: number;
  scheduledWeeks: number;
  /** 0-1. Used to weight a partial season rather than discard it. */
  fraction: number;
  /** Every regular-season week is in. Division and points titles are settled. */
  regularSeasonComplete: boolean;
  hasPlayoffs: boolean;
  /** Regular season done and a champion resolved. The season is history. */
  complete: boolean;
}

export interface SeasonTables {
  /** year -> teamId -> totals */
  byYear: Map<number, Map<number, SeasonTotals>>;
  /** Deepest playoff round each team reached, keyed `${year}:${teamId}`. */
  deepestRound: Map<string, number>;
  playoffShape: Map<number, PlayoffShape>;
  progress: Map<number, SeasonProgress>;
  years: number[];
}

const blank = (teamId: number, year: number): SeasonTotals => ({
  teamId, year,
  wins: 0, losses: 0, ties: 0,
  pointsFor: 0, pointsAgainst: 0, pointsGames: 0,
  playoffWins: 0, playoffLosses: 0, playoffTies: 0,
  playoffPointsFor: 0, playoffPointsAgainst: 0,
  groupWins: 0, groupLosses: 0, groupTies: 0,
});

/** `${year}:${teamId}` -> the division/quad key that team sat in. */
function groupKeys(h: LeagueHistoryData): Map<string, string> {
  const out = new Map<string, string>();
  for (const season of h.leagueSeasons) {
    if (season.structure_type === 'single_league') continue;
    for (const ts of h.teamSeasons) {
      if (ts.year !== season.year) continue;
      const key =
        season.structure_type === 'quads' && ts.quad_id != null
          ? `q${ts.quad_id}`
          : season.structure_type === 'divisions' && ts.division_id != null
            ? `d${ts.division_id}`
            : null;
      if (key) out.set(`${ts.year}:${ts.team_id}`, key);
    }
  }
  return out;
}

export function buildSeasonTables(h: LeagueHistoryData): SeasonTables {
  const byYear = new Map<number, Map<number, SeasonTotals>>();
  const groups = groupKeys(h);
  const regularWeeks = new Map<number, number>();
  const deepestRound = new Map<string, number>();
  const playoffGamesByYear = new Map<number, { round: number; winner: number; loser: number }[]>();

  const configs = new Map<number, ReturnType<typeof getSeasonConfig>>();
  const configFor = (year: number) => {
    if (!configs.has(year)) configs.set(year, getSeasonConfig(year));
    return configs.get(year)!;
  };

  const touch = (year: number, teamId: number) => {
    if (!byYear.has(year)) byYear.set(year, new Map());
    const table = byYear.get(year)!;
    if (!table.has(teamId)) table.set(teamId, blank(teamId, year));
    return table.get(teamId)!;
  };

  for (const g of h.games) {
    if (!isPlayed(g)) continue;

    const home = touch(g.year, g.home_team_id);
    const away = touch(g.year, g.away_team_id);
    const hs = g.home_score!;
    const as = g.away_score!;

    if (g.playoffs) {
      home.playoffPointsFor += hs;
      home.playoffPointsAgainst += as;
      away.playoffPointsFor += as;
      away.playoffPointsAgainst += hs;

      if (hs > as) { home.playoffWins++; away.playoffLosses++; }
      else if (as > hs) { away.playoffWins++; home.playoffLosses++; }
      else { home.playoffTies++; away.playoffTies++; }

      for (const id of [g.home_team_id, g.away_team_id]) {
        const key = `${g.year}:${id}`;
        deepestRound.set(key, Math.max(deepestRound.get(key) ?? 0, g.week));
      }
      if (!playoffGamesByYear.has(g.year)) playoffGamesByYear.set(g.year, []);
      playoffGamesByYear.get(g.year)!.push({
        round: g.week,
        winner: hs >= as ? g.home_team_id : g.away_team_id,
        loser: hs >= as ? g.away_team_id : g.home_team_id,
      });
      continue;
    }

    regularWeeks.set(g.year, Math.max(regularWeeks.get(g.year) ?? 0, g.week));

    // Points count for every regular-season game, including a play-in week
    // whose result does not count toward the record.
    if (countsTowardPoints(g)) {
      home.pointsFor += hs;
      home.pointsAgainst += as;
      home.pointsGames++;
      away.pointsFor += as;
      away.pointsAgainst += hs;
      away.pointsGames++;
    }

    if (!countsTowardRecord(g as any, configFor(g.year))) continue;
    if (hs > as) { home.wins++; away.losses++; }
    else if (as > hs) { away.wins++; home.losses++; }
    else { home.ties++; away.ties++; }

    const homeGroup = groups.get(`${g.year}:${g.home_team_id}`);
    const awayGroup = groups.get(`${g.year}:${g.away_team_id}`);
    if (homeGroup && homeGroup === awayGroup) {
      if (hs > as) { home.groupWins++; away.groupLosses++; }
      else if (as > hs) { away.groupWins++; home.groupLosses++; }
      else { home.groupTies++; away.groupTies++; }
    }
  }

  const playoffShape = new Map<number, PlayoffShape>();
  for (const [year, games] of playoffGamesByYear) {
    const finalRound = Math.max(...games.map(g => g.round));
    const finals = games.filter(g => g.round === finalRound);
    // Several games in the deepest round means it is not a title game — a
    // third-place game or an incomplete bracket. Do not guess a champion.
    playoffShape.set(year, {
      finalRound,
      championId: finals.length === 1 ? finals[0].winner : null,
      runnerUpId: finals.length === 1 ? finals[0].loser : null,
    });
  }

  const progress = new Map<number, SeasonProgress>();
  for (const year of byYear.keys()) {
    const scheduledWeeks = configFor(year).regularSeasonWeeks;
    const regularWeeksPlayed = regularWeeks.get(year) ?? 0;
    const regularSeasonComplete = regularWeeksPlayed >= scheduledWeeks;
    const shape = playoffShape.get(year);
    progress.set(year, {
      year,
      regularWeeksPlayed,
      scheduledWeeks,
      fraction: Math.min(regularWeeksPlayed / scheduledWeeks, 1),
      regularSeasonComplete,
      hasPlayoffs: Boolean(shape),
      complete: regularSeasonComplete && shape?.championId != null,
    });
  }

  return {
    byYear,
    deepestRound,
    playoffShape,
    progress,
    years: [...byYear.keys()].sort((a, b) => a - b),
  };
}

/** Whether a season's regular season has finished, defaulting to yes when unknown. */
export const regularSeasonSettled = (tables: SeasonTables, year: number) =>
  tables.progress.get(year)?.regularSeasonComplete ?? true;

/** Games that counted toward the record. Use `pointsGames` for scoring rates. */
export const totalGames = (t: SeasonTotals) => t.wins + t.losses + t.ties;

export const winPctOf = (wins: number, losses: number, ties: number) => {
  const n = wins + losses + ties;
  return n > 0 ? (wins + ties * 0.5) / n : 0;
};

/**
 * Teams ranked within a season: overall win percentage, then division/quad win
 * percentage, then points for. That is the order CLAUDE.md documents for the
 * standings, and it is the order the league actually used — validated against
 * the stored Division Champ and Eastern Goblet trophies, which agree with it
 * 21 of 21 times.
 *
 * Note this omits the head-to-head chain that playoff SEEDING uses
 * (`sortForSeeding`); it matches how the standings page displays a table, which
 * is what a "finished 3rd" claim means.
 */
export function rankSeason(table: Map<number, SeasonTotals>): number[] {
  return [...table.values()]
    .filter(t => totalGames(t) > 0)
    .sort(
      (a, b) =>
        winPctOf(b.wins, b.losses, b.ties) - winPctOf(a.wins, a.losses, a.ties) ||
        winPctOf(b.groupWins, b.groupLosses, b.groupTies) -
          winPctOf(a.groupWins, a.groupLosses, a.groupTies) ||
        b.pointsFor - a.pointsFor
    )
    .map(t => t.teamId);
}
