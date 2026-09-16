/**
 * Trophies, titles and postseason appearances.
 *
 * Three sourcing decisions here, each because the obvious source is wrong:
 *
 *  - CHAMPIONSHIPS come from `trophy_case`, not from the game log. trophy_case
 *    runs from 2003 and `games` only from 2007, so `computeChampionships` — and
 *    the team page's current logic — necessarily miss four seasons of titles.
 *    The game-derived list is kept alongside as a cross-check.
 *  - GROUP TITLES are recomputed from final standings. The stored
 *    "Division Champ" trophy (id 18) has twelve rows covering 2019+ only.
 *  - PLAYOFF APPEARANCES come from `games`. `playoff_seeds` holds eight rows,
 *    all 2025, and seeds for a finished season are a projection anyway.
 */

import type { LeagueHistoryData, GroupTitle } from '../briefs/history';
import { playoffTeamsByYear } from '../briefs/cohorts';
import { CHAMPIONSHIP_TROPHY_ID, type TrophyCase } from '@/types/database';
import { type SeasonTables, rankSeason, regularSeasonSettled } from './tables';
import { countsTowardPoints, isPlayed } from './game-log';

export interface TrophyWin {
  trophyId: number;
  trophyName: string;
  year: number;
  /** A counter, not a row count — the weekly trophy increments it. */
  amount: number;
}

export interface Honors {
  /** Title years from trophy_case, covering 2003 onward. */
  championships: number[];
  /** Title years derivable from the game log (2007+), for cross-checking. */
  championshipsFromGames: number[];
  /**
   * Years the two sources disagree about, ignoring seasons with no game data.
   * Non-empty means one of them needs attention; it should always be empty.
   */
  championshipDisagreements: number[];
  groupTitles: GroupTitle[];
  playoffAppearances: number[];
  championshipGameAppearances: number[];
  /** Seasons the franchise led the league in regular-season points. */
  pointsTitles: number[];
  /**
   * Weekly high scores, DERIVED from the game log rather than read from the
   * Briefly Badass trophy. The stored trophy is incomplete — 2022, 2023 and
   * 2024 have no rows at all, and it totals 193 against 254 actual weekly
   * highs — so deriving is both more complete and self-consistent.
   */
  weeklyHighScores: number;
  weeklyHighScoresByYear: { year: number; count: number }[];
  /** The trophy case as recorded, for display. Not used for any derivation. */
  trophies: TrophyWin[];
}

/**
 * Who posted the highest score in each regular-season week, by team and year.
 *
 * Every regular-season week counts, including a play-in week — the award is for
 * scoring, and those games were played and scored. Verified against the stored
 * trophy for 2025, where Week 14 is included. Ties award both teams.
 */
export function weeklyHighScores(h: LeagueHistoryData): Map<string, number> {
  const weeks = new Map<string, { teamId: number; score: number }[]>();
  for (const g of h.games) {
    if (!isPlayed(g) || !countsTowardPoints(g)) continue;
    const k = `${g.year}:${g.week}`;
    if (!weeks.has(k)) weeks.set(k, []);
    weeks.get(k)!.push(
      { teamId: g.home_team_id, score: g.home_score! },
      { teamId: g.away_team_id, score: g.away_score! }
    );
  }

  const out = new Map<string, number>();
  for (const [k, entries] of weeks) {
    const year = k.split(':')[0];
    const max = Math.max(...entries.map(e => e.score));
    for (const e of entries) {
      if (e.score !== max) continue;
      const key = `${year}:${e.teamId}`;
      out.set(key, (out.get(key) ?? 0) + 1);
    }
  }
  return out;
}

export function buildHonors(
  h: LeagueHistoryData,
  tables: SeasonTables,
  teamId: number,
  trophyCase: TrophyCase[],
  groupTitles: GroupTitle[]
): Honors {
  const mine = trophyCase.filter(t => t.team_id === teamId);

  const championships = [
    ...new Set(mine.filter(t => t.trophy_id === CHAMPIONSHIP_TROPHY_ID).map(t => t.year)),
  ].sort((a, b) => a - b);

  const championshipsFromGames: number[] = [];
  const championshipGameAppearances: number[] = [];
  for (const [year, shape] of tables.playoffShape) {
    if (shape.championId === teamId) championshipsFromGames.push(year);
    if (shape.championId === teamId || shape.runnerUpId === teamId) {
      championshipGameAppearances.push(year);
    }
  }
  championshipsFromGames.sort((a, b) => a - b);
  championshipGameAppearances.sort((a, b) => a - b);

  // Only seasons the game log actually covers can be compared.
  const gameYears = new Set(tables.years);
  const disagreements = [
    ...new Set([
      ...championships.filter(y => gameYears.has(y) && !championshipsFromGames.includes(y)),
      ...championshipsFromGames.filter(y => !championships.includes(y)),
    ]),
  ].sort((a, b) => a - b);

  const playoffs = playoffTeamsByYear(h);
  const playoffAppearances = [...playoffs.entries()]
    .filter(([, teams]) => teams.has(teamId))
    .map(([year]) => year)
    .sort((a, b) => a - b);

  const pointsTitles: number[] = [];
  for (const year of tables.years) {
    // Nobody leads the league in points until the league has finished scoring.
    if (!regularSeasonSettled(tables, year)) continue;
    const table = tables.byYear.get(year)!;
    const played = [...table.values()].filter(t => t.wins + t.losses + t.ties > 0);
    if (played.length === 0) continue;
    const leader = played.reduce((a, t) => (t.pointsFor > a.pointsFor ? t : a));
    if (leader.teamId === teamId) pointsTitles.push(year);
  }

  const highs = weeklyHighScores(h);
  const weeklyHighScoresByYear = tables.years
    .map(year => ({ year, count: highs.get(`${year}:${teamId}`) ?? 0 }))
    .filter(r => r.count > 0);
  const weeklyHighTotal = weeklyHighScoresByYear.reduce((a, r) => a + r.count, 0);

  const trophies: TrophyWin[] = mine
    .map(t => ({
      trophyId: t.trophy_id,
      trophyName: t.trophy?.trophy_name ?? `Trophy ${t.trophy_id}`,
      year: t.year,
      amount: t.amount ?? 1,
    }))
    .sort((a, b) => b.year - a.year || a.trophyId - b.trophyId);

  return {
    championships,
    championshipsFromGames,
    championshipDisagreements: disagreements,
    groupTitles: groupTitles.filter(Boolean),
    playoffAppearances,
    championshipGameAppearances,
    pointsTitles,
    weeklyHighScores: weeklyHighTotal,
    weeklyHighScoresByYear,
    trophies,
  };
}

/**
 * Division/quad titles recomputed from the season tables.
 *
 * `computeGroupTitles` in briefs/history.ts answers the same question, but
 * ranks on a points-for total that excludes a play-in week's points — which can
 * reorder a tie. This uses the same points the standings display, so the two
 * can diverge in 2025; the dossier CLI cross-checks them.
 */
export function computeGroupTitlesFromTables(
  h: LeagueHistoryData,
  tables: SeasonTables
): Map<number, GroupTitle[]> {
  const out = new Map<number, GroupTitle[]>();

  for (const season of h.leagueSeasons) {
    if (season.structure_type === 'single_league') continue;
    // A division is not won at week 1. Wait for the regular season to finish.
    if (!regularSeasonSettled(tables, season.year)) continue;
    const table = tables.byYear.get(season.year);
    if (!table) continue;
    const order = rankSeason(table);
    if (order.length === 0) continue;

    const groups = new Map<string, number[]>();
    for (const ts of h.teamSeasons) {
      if (ts.year !== season.year) continue;
      const key =
        season.structure_type === 'quads' && ts.quad_id != null
          ? `q${ts.quad_id}`
          : season.structure_type === 'divisions' && ts.division_id != null
            ? `d${ts.division_id}`
            : null;
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(ts.team_id);
    }

    for (const [key, members] of groups) {
      const winner = order.find(id => members.includes(id));
      if (winner === undefined) continue;
      if (!out.has(winner)) out.set(winner, []);
      out.get(winner)!.push({ year: season.year, groupName: h.groupNames.get(key) ?? key });
    }
  }

  for (const list of out.values()) list.sort((a, b) => a.year - b.year);
  return out;
}
