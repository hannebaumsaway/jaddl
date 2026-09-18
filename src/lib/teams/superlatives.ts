/**
 * The extremes: best and worst games, longest runs, best and worst seasons.
 *
 * Streaks are measured WITHIN a season and in regular-season games only. That
 * is the same definition `streakRarity` uses, which is what makes the "only
 * four teams have ever done this" figure attached to each one comparable.
 * (The /history page instead reports cross-season streaks with spans like
 * "2014 wk 3 - 2015 wk 2"; the two answer different questions and will not
 * agree for a team whose run crossed a season boundary.)
 */

import type { LeagueHistoryData } from '../briefs/history';
import { streakRarity } from '../briefs/cohorts';
import type { TeamGame } from './game-log';
import { type SeasonTables, totalGames, winPctOf, regularSeasonSettled } from './tables';

export interface GameMark {
  year: number;
  label: string;
  playoffs: boolean;
  teamScore: number;
  opponentScore: number;
  margin: number;
  opponentId: number;
  opponentName: string;
  result: 'W' | 'L' | 'T';
}

export interface StreakMark {
  kind: 'W' | 'L';
  length: number;
  year: number;
  startWeek: number;
  endWeek: number;
  /** "2019, weeks 3-8". */
  span: string;
  /** How many team-seasons in league history have managed a run this long. */
  occurrences: number;
  longestEver: { length: number; teamId: number; year: number } | null;
}

export interface SeasonMark {
  year: number;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  pointsFor: number;
}

export interface Superlatives {
  highestScore: GameMark | null;
  lowestScore: GameMark | null;
  biggestWin: GameMark | null;
  worstLoss: GameMark | null;
  longestWinStreak: StreakMark | null;
  longestLoseStreak: StreakMark | null;
  bestSeasonByRecord: SeasonMark | null;
  worstSeasonByRecord: SeasonMark | null;
  bestSeasonByPoints: SeasonMark | null;
}

const toMark = (g: TeamGame, names: Map<number, string>): GameMark => ({
  year: g.year,
  label: g.label,
  playoffs: g.playoffs,
  teamScore: g.teamScore,
  opponentScore: g.opponentScore,
  margin: g.margin,
  opponentId: g.opponentId,
  opponentName: names.get(g.opponentId) ?? `Team ${g.opponentId}`,
  result: g.result,
});

/** The longest run of one result inside a single season. */
function longestRun(log: TeamGame[], kind: 'W' | 'L'):
  { length: number; year: number; startWeek: number; endWeek: number } | null {
  const byYear = new Map<number, TeamGame[]>();
  for (const g of log) {
    if (g.playoffs) continue;
    if (!byYear.has(g.year)) byYear.set(g.year, []);
    byYear.get(g.year)!.push(g);
  }

  let best: { length: number; year: number; startWeek: number; endWeek: number } | null = null;
  for (const [year, games] of byYear) {
    const ordered = [...games].sort((a, b) => a.week - b.week);
    let run = 0;
    let start = 0;
    for (const g of ordered) {
      if (g.result === kind) {
        if (run === 0) start = g.week;
        run++;
        if (!best || run > best.length) {
          best = { length: run, year, startWeek: start, endWeek: g.week };
        }
      } else {
        run = 0;
      }
    }
  }
  return best;
}

function streakMark(
  h: LeagueHistoryData,
  log: TeamGame[],
  kind: 'W' | 'L'
): StreakMark | null {
  const run = longestRun(log, kind);
  if (!run) return null;
  const rarity = streakRarity(h, kind, run.length);
  return {
    kind,
    length: run.length,
    year: run.year,
    startWeek: run.startWeek,
    endWeek: run.endWeek,
    span:
      run.startWeek === run.endWeek
        ? `${run.year}, week ${run.startWeek}`
        : `${run.year}, weeks ${run.startWeek}-${run.endWeek}`,
    occurrences: rarity.occurrences,
    longestEver: rarity.longestEver,
  };
}

export function superlatives(
  h: LeagueHistoryData,
  tables: SeasonTables,
  log: TeamGame[],
  teamId: number,
  teamNames: Map<number, string>
): Superlatives {
  const pick = (
    games: TeamGame[],
    score: (g: TeamGame) => number
  ): GameMark | null => {
    if (games.length === 0) return null;
    const best = games.reduce((a, g) => (score(g) > score(a) ? g : a));
    return toMark(best, teamNames);
  };

  const wins = log.filter(g => g.result === 'W');
  const losses = log.filter(g => g.result === 'L');

  // Only finished regular seasons can be a franchise best or worst. A team
  // sitting at 1-0 in week 1 is not having the greatest season of its life.
  const seasons: SeasonMark[] = [];
  for (const year of tables.years) {
    if (!regularSeasonSettled(tables, year)) continue;
    const t = tables.byYear.get(year)?.get(teamId);
    if (!t || totalGames(t) === 0) continue;
    seasons.push({
      year,
      wins: t.wins,
      losses: t.losses,
      ties: t.ties,
      winPct: winPctOf(t.wins, t.losses, t.ties),
      pointsFor: Math.round(t.pointsFor * 100) / 100,
    });
  }

  const byRecord = [...seasons].sort((a, b) => b.winPct - a.winPct || b.pointsFor - a.pointsFor);
  const byPoints = [...seasons].sort((a, b) => b.pointsFor - a.pointsFor);

  return {
    highestScore: pick(log, g => g.teamScore),
    lowestScore: pick(log, g => -g.teamScore),
    biggestWin: pick(wins, g => g.margin),
    worstLoss: pick(losses, g => -g.margin),
    longestWinStreak: streakMark(h, log, 'W'),
    longestLoseStreak: streakMark(h, log, 'L'),
    bestSeasonByRecord: byRecord[0] ?? null,
    worstSeasonByRecord: byRecord[byRecord.length - 1] ?? null,
    bestSeasonByPoints: byPoints[0] ?? null,
  };
}
