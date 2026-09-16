/**
 * Era-adjusted scoring.
 *
 * League scoring is not comparable across seasons. It sat around 92 points a
 * game from 2009 through 2017, then stepped up sharply — 101 in 2018, 122 in
 * 2019, and roughly 140 from 2020 on. That is a settings change, not a gradual
 * drift, so a raw career scoring average ranks franchises largely by WHEN they
 * played. The franchise with the highest career points per game in league
 * history joined in 2017 and was below average for its own era.
 *
 * The fix is the construction baseball uses for OPS+ and ERA+: express a team's
 * scoring as a percentage of the league's scoring level over the exact seasons
 * that team played. 100 is par.
 *
 *   index = teamPoints / SUM over seasons(leaguePointsPerGame(year) * gamesPlayed(year)) * 100
 *
 * Two alternatives were measured against the real data and rejected:
 *
 *  - Z-scores rank on a standard deviation estimated from twelve teams, which
 *    is unstable — 6.6 in 2017 against 13.9 in 2018. That noise lands straight
 *    in the career figure and reorders the middle of the table.
 *  - Percentile-of-field is robust but discards magnitude, and with twelve
 *    teams each rank step is a blunt nine points.
 *
 * The index denominator is games-weighted by construction, so a franchise that
 * played one 13-game season lands on the same scale as one with nineteen.
 *
 * Note the league average includes the team being measured — about a twelfth of
 * it — which pulls every index slightly toward 100. OPS+ has the same property.
 */

import { type SeasonTables, type SeasonTotals } from './tables';

export interface LeagueScoringLevel {
  year: number;
  /** Points per team-game across the whole league that season. */
  pointsPerGame: number;
  teamGames: number;
}

export interface EraAdjusted {
  /** 100 = exactly the league's scoring level for the seasons played. */
  index: number;
  rank: { rank: number; of: number };
}

export interface EraTotals {
  teamId: number;
  pointsFor: number;
  pointsAgainst: number;
  games: number;
  /** What an exactly-average team would have scored over the same schedule. */
  par: number;
  scoringIndex: number;
  concededIndex: number;
}

/**
 * The league's scoring level per season, as total points over total team-games.
 *
 * Deliberately points-weighted rather than a mean of team averages: the two are
 * identical when every team plays the same number of games, and the weighted
 * form keeps the league-wide index exactly 100, which is the invariant worth
 * being able to assert.
 */
export function leagueScoringLevels(tables: SeasonTables): Map<number, LeagueScoringLevel> {
  const out = new Map<number, LeagueScoringLevel>();
  for (const year of tables.years) {
    let points = 0;
    let teamGames = 0;
    for (const t of tables.byYear.get(year)!.values()) {
      points += t.pointsFor;
      teamGames += t.pointsGames;
    }
    if (teamGames === 0) continue;
    out.set(year, { year, pointsPerGame: points / teamGames, teamGames });
  }
  return out;
}

/** A single season's scoring index for one team, or null if they did not play. */
export function seasonIndexes(
  totals: SeasonTotals | undefined,
  level: LeagueScoringLevel | undefined
): { scoring: number; conceded: number } | null {
  if (!totals || !level || totals.pointsGames === 0 || level.pointsPerGame === 0) return null;
  const par = level.pointsPerGame * totals.pointsGames;
  return {
    scoring: round1((totals.pointsFor / par) * 100),
    conceded: round1((totals.pointsAgainst / par) * 100),
  };
}

/** Career era-adjusted totals for every franchise. */
export function eraTotalsForAll(tables: SeasonTables): Map<number, EraTotals> {
  const levels = leagueScoringLevels(tables);
  const out = new Map<number, EraTotals>();

  for (const year of tables.years) {
    const level = levels.get(year);
    if (!level) continue;
    for (const t of tables.byYear.get(year)!.values()) {
      if (t.pointsGames === 0) continue;
      if (!out.has(t.teamId)) {
        out.set(t.teamId, {
          teamId: t.teamId,
          pointsFor: 0, pointsAgainst: 0, games: 0, par: 0,
          scoringIndex: 0, concededIndex: 0,
        });
      }
      const e = out.get(t.teamId)!;
      e.pointsFor += t.pointsFor;
      e.pointsAgainst += t.pointsAgainst;
      e.games += t.pointsGames;
      e.par += level.pointsPerGame * t.pointsGames;
    }
  }

  for (const e of out.values()) {
    e.scoringIndex = e.par > 0 ? round1((e.pointsFor / e.par) * 100) : 0;
    e.concededIndex = e.par > 0 ? round1((e.pointsAgainst / e.par) * 100) : 0;
  }
  return out;
}

export interface EraRanks {
  scoring: EraAdjusted;
  conceded: EraAdjusted;
}

export function eraRanks(tables: SeasonTables, teamId: number): EraRanks {
  const all = [...eraTotalsForAll(tables).values()];
  const of = all.length;

  const build = (pick: (e: EraTotals) => number): EraAdjusted => {
    const ordered = [...all].sort((a, b) => pick(b) - pick(a));
    const idx = ordered.findIndex(e => e.teamId === teamId);
    const mine = all.find(e => e.teamId === teamId);
    return { index: mine ? pick(mine) : 0, rank: { rank: idx >= 0 ? idx + 1 : of, of } };
  };

  return {
    scoring: build(e => e.scoringIndex),
    // A high conceded index means the team faced more scoring than its era's
    // par — worse luck, or a harder schedule.
    conceded: build(e => e.concededIndex),
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
