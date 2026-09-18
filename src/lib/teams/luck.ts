/**
 * Luck metrics: how much of a franchise's record is scoring, and how much is
 * the schedule.
 *
 * Nothing in this codebase computed these before. They are the stats a fantasy
 * owner actually argues about, and they are pure derivations of the game log.
 *
 * The central idea is the all-play record: instead of asking whether you beat
 * the one team you were drawn against, ask how you would have fared against
 * every team that week. A team can score the second-most points in the league
 * and lose, and over a season that is the whole difference between 9-5 and 5-9.
 *
 * Every week filter here matches `countsTowardRecord`, because all of these are
 * questions about WINS. 2025's Week 14 awarded no W-L, so it contributes no
 * expected wins either.
 */

import type { LeagueHistoryData } from '../briefs/history';
import { weeklyScoreBuckets } from './game-log';
import type { SeasonTables } from './tables';
import { careerTotalsForAll } from './records';

/** Margin at or below which a game is "close". Fantasy margins run wide. */
export const CLOSE_GAME_MARGIN = 10;
/** Margin at or above which a game is a blowout. */
export const BLOWOUT_MARGIN = 40;

export interface AllPlayRecord {
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
}

export interface SeasonLuck {
  year: number;
  actualWins: number;
  expectedWins: number;
  /** Positive means the team won more than its scoring deserved. */
  luckDelta: number;
  allPlay: AllPlayRecord;
}

export interface LuckProfile {
  allPlay: AllPlayRecord;
  actualWins: number;
  expectedWins: number;
  luckDelta: number;
  closeGames: { wins: number; losses: number; ties: number; margin: number };
  blowouts: { wins: number; losses: number; margin: number };
  /** 1 = most points conceded per game in league history. */
  pointsAgainstRank: { rank: number; of: number };
  bySeason: SeasonLuck[];
}

interface Tally {
  allPlayW: number;
  allPlayL: number;
  allPlayT: number;
  expected: number;
  actual: number;
}

const emptyTally = (): Tally => ({ allPlayW: 0, allPlayL: 0, allPlayT: 0, expected: 0, actual: 0 });

/**
 * Walk every week the team played and compare its score against the rest of
 * the league that week.
 *
 * Ties split: a team scoring exactly what you scored counts half a win and half
 * a loss. That keeps the league-wide identity that expected wins sum to games
 * played, which is the invariant worth testing.
 */
function tallyWeeks(
  h: LeagueHistoryData,
  teamId: number
): { career: Tally; byYear: Map<number, Tally> } {
  const buckets = weeklyScoreBuckets(h);
  const career = emptyTally();
  const byYear = new Map<number, Tally>();

  for (const [key, entries] of buckets) {
    const mine = entries.find(e => e.teamId === teamId);
    if (!mine) continue;
    // A team can appear once per week; a bucket of one has nothing to compare.
    if (entries.length < 2) continue;

    const year = Number(key.split(':')[0]);
    if (!byYear.has(year)) byYear.set(year, emptyTally());
    const season = byYear.get(year)!;

    let lower = 0;
    let higher = 0;
    let equal = 0;
    for (const e of entries) {
      if (e.teamId === teamId) continue;
      if (e.score < mine.score) lower++;
      else if (e.score > mine.score) higher++;
      else equal++;
    }

    const opponents = entries.length - 1;
    const share = (lower + equal * 0.5) / opponents;

    for (const t of [career, season]) {
      t.allPlayW += lower;
      t.allPlayL += higher;
      t.allPlayT += equal;
      t.expected += share;
    }
  }

  return { career, byYear };
}

const toRecord = (t: Tally): AllPlayRecord => {
  const n = t.allPlayW + t.allPlayL + t.allPlayT;
  return {
    wins: t.allPlayW,
    losses: t.allPlayL,
    ties: t.allPlayT,
    winPct: n > 0 ? (t.allPlayW + t.allPlayT * 0.5) / n : 0,
  };
};

export function luckProfile(
  h: LeagueHistoryData,
  tables: SeasonTables,
  teamId: number
): LuckProfile {
  const { career, byYear } = tallyWeeks(h, teamId);

  // Actual wins come from the season tables so they are guaranteed to be the
  // same number the record and the standings use.
  for (const year of tables.years) {
    const t = tables.byYear.get(year)?.get(teamId);
    if (!t) continue;
    const season = byYear.get(year);
    if (season) season.actual = t.wins;
    career.actual += t.wins;
  }

  const closeGames = { wins: 0, losses: 0, ties: 0, margin: CLOSE_GAME_MARGIN };
  const blowouts = { wins: 0, losses: 0, margin: BLOWOUT_MARGIN };
  for (const g of h.games) {
    if (g.home_score === null || g.away_score === null) continue;
    if (g.playoffs) continue;
    if (g.home_team_id !== teamId && g.away_team_id !== teamId) continue;

    const isHome = g.home_team_id === teamId;
    const margin = (isHome ? g.home_score : g.away_score) - (isHome ? g.away_score : g.home_score);
    const abs = Math.abs(margin);

    if (abs === 0) {
      closeGames.ties++;
    } else if (abs <= CLOSE_GAME_MARGIN) {
      if (margin > 0) closeGames.wins++;
      else closeGames.losses++;
    }
    if (abs >= BLOWOUT_MARGIN) {
      if (margin > 0) blowouts.wins++;
      else blowouts.losses++;
    }
  }

  const totals = [...careerTotalsForAll(tables).entries()].filter(([, c]) => c.games > 0);
  const paOrder = [...totals].sort((a, b) => b[1].pa / b[1].games - a[1].pa / a[1].games);
  const paIdx = paOrder.findIndex(([id]) => id === teamId);

  const bySeason: SeasonLuck[] = [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, t]) => ({
      year,
      actualWins: t.actual,
      expectedWins: round2(t.expected),
      luckDelta: round2(t.actual - t.expected),
      allPlay: toRecord(t),
    }));

  return {
    allPlay: toRecord(career),
    actualWins: career.actual,
    expectedWins: round2(career.expected),
    luckDelta: round2(career.actual - career.expected),
    closeGames,
    blowouts,
    pointsAgainstRank: { rank: paIdx >= 0 ? paIdx + 1 : totals.length, of: totals.length },
    bySeason,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
