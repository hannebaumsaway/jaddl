/**
 * The per-team view of the game log, and the weekly score buckets the luck
 * metrics run on.
 *
 * Every other module in this directory reads games through here so the
 * filtering rules are stated once. Three of them are easy to get wrong and have
 * been got wrong elsewhere in this codebase:
 *
 *   1. A score of 0 is legal. Test `=== null`, never truthiness — the two
 *      functions in supabase/api.ts use `if (!game.home_score)` and silently
 *      drop shutouts.
 *   2. Playoff games store `week` as the ROUND (1-3), so they sort among early
 *      regular-season weeks. Anything walking a season in week order must
 *      separate them first.
 *   3. W-L-T eligibility is `countsTowardRecord`, but POINTS eligibility is
 *      not the same question — see `countsTowardPoints` below.
 */

import type { LeagueHistoryData, HistoryGame } from '../briefs/history';
import { getSeasonConfig, countsTowardRecord, getGameWeekLabel } from '../supabase/api';

export interface TeamGame {
  gameId: number;
  year: number;
  /** Regular-season week, or the playoff ROUND when `playoffs` is true. */
  week: number;
  playoffs: boolean;
  /** "Week 8" / "Semifinals". */
  label: string;
  teamId: number;
  opponentId: number;
  teamScore: number;
  opponentScore: number;
  /** Positive when the team won. */
  margin: number;
  result: 'W' | 'L' | 'T';
  /** Whether this game contributes to W-L-T. False for playoffs and play-ins. */
  countsTowardRecord: boolean;
  /** Whether this game's points contribute to regular-season points for/against. */
  countsTowardPoints: boolean;
}

/**
 * Whether a game's points count toward a REGULAR-SEASON points total.
 *
 * This deliberately differs from `countsTowardRecord`. 2025's Week 14 play-in
 * scored points but awarded no W-L, so its points belong in points-for even
 * though its result does not belong in the record — that is the whole reason
 * `recordExcludesWeeks` exists. Playoff points are excluded outright and
 * tracked separately.
 *
 * The two existing implementations both get this wrong in opposite directions:
 * `calculateStandings` adds PLAYOFF points into `points_for`, and
 * `recordsForSeason` drops the Week 14 points along with the Week 14 result.
 */
export function countsTowardPoints(game: Pick<HistoryGame, 'playoffs'>): boolean {
  return !game.playoffs;
}

/** True when both scores are recorded. A legitimate 0 must survive this. */
export function isPlayed(g: HistoryGame): boolean {
  return g.home_score !== null && g.away_score !== null;
}

/**
 * Every game a franchise has played, oldest first, with regular-season games
 * ahead of that season's playoffs.
 */
export function teamGameLog(h: LeagueHistoryData, teamId: number): TeamGame[] {
  const configs = new Map<number, ReturnType<typeof getSeasonConfig>>();
  const configFor = (year: number) => {
    if (!configs.has(year)) configs.set(year, getSeasonConfig(year));
    return configs.get(year)!;
  };

  const out: TeamGame[] = [];
  for (const g of h.games) {
    if (g.home_team_id !== teamId && g.away_team_id !== teamId) continue;
    if (!isPlayed(g)) continue;

    const isHome = g.home_team_id === teamId;
    const teamScore = (isHome ? g.home_score : g.away_score)!;
    const opponentScore = (isHome ? g.away_score : g.home_score)!;
    const playoffs = Boolean(g.playoffs);

    out.push({
      gameId: g.id,
      year: g.year,
      week: g.week,
      playoffs,
      label: getGameWeekLabel({ week: g.week, playoffs }),
      teamId,
      opponentId: isHome ? g.away_team_id : g.home_team_id,
      teamScore,
      opponentScore,
      margin: Math.round((teamScore - opponentScore) * 100) / 100,
      result: teamScore > opponentScore ? 'W' : teamScore < opponentScore ? 'L' : 'T',
      countsTowardRecord: countsTowardRecord(g as any, configFor(g.year)),
      countsTowardPoints: countsTowardPoints(g),
    });
  }

  // Regular season before playoffs within a year, since playoff `week` is a round.
  return out.sort(
    (a, b) =>
      a.year - b.year ||
      Number(a.playoffs) - Number(b.playoffs) ||
      a.week - b.week
  );
}

/** Only the regular-season games, in week order. Safe to walk for streaks. */
export function regularSeasonGames(log: TeamGame[], year?: number): TeamGame[] {
  return log.filter(g => !g.playoffs && (year === undefined || g.year === year));
}

export interface WeekScore {
  teamId: number;
  score: number;
}

/**
 * Every team's score in every week that counts toward the record, keyed
 * `${year}:${week}`.
 *
 * This is the substrate for all-play and expected wins: those ask "how would
 * this score have fared against the rest of the league that week", which is a
 * question about wins, so the week filter must match the W-L filter exactly.
 */
export function weeklyScoreBuckets(h: LeagueHistoryData): Map<string, WeekScore[]> {
  const configs = new Map<number, ReturnType<typeof getSeasonConfig>>();
  const configFor = (year: number) => {
    if (!configs.has(year)) configs.set(year, getSeasonConfig(year));
    return configs.get(year)!;
  };

  const buckets = new Map<string, WeekScore[]>();
  for (const g of h.games) {
    if (!isPlayed(g)) continue;
    if (!countsTowardRecord(g as any, configFor(g.year))) continue;

    const key = `${g.year}:${g.week}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(
      { teamId: g.home_team_id, score: g.home_score! },
      { teamId: g.away_team_id, score: g.away_score! }
    );
  }
  return buckets;
}

/** Seasons in which a franchise actually played, oldest first. */
export function seasonsPlayed(log: TeamGame[]): number[] {
  return [...new Set(log.map(g => g.year))].sort((a, b) => a - b);
}
