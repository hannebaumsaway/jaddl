/**
 * Career and season-by-season records.
 *
 * Everything here derives W-L-T through `countsTowardRecord`, so a franchise's
 * career record agrees with the standings page for every season. The versions
 * currently on the team page do not: `getAllTimeTeamRecords` counts playoff
 * games and 2025's Week 14 play-in toward the career W-L.
 */

import type { LeagueHistoryData } from '../briefs/history';
import { getPlayoffRoundLabel } from '../supabase/api';
import {
  type SeasonTables,
  type SeasonTotals,
  rankSeason,
  totalGames,
  winPctOf,
} from './tables';
import { type TeamGame, regularSeasonGames } from './game-log';
import { type EraAdjusted, eraRanks, leagueScoringLevels, seasonIndexes } from './era';

export interface CareerRecord {
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  games: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  pointsPerGame: number;
  pointsAgainstPerGame: number;
  playoff: {
    wins: number;
    losses: number;
    ties: number;
    games: number;
    winPct: number;
    byRound: { round: number; label: string; wins: number; losses: number }[];
  };
  seasons: number;
}

export type PlayoffOutcome = 'won-title' | 'lost-final' | 'eliminated';

export interface SeasonLine {
  year: number;
  groupName: string | null;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  /**
   * 1-based place in the season's table. For a season still being played this
   * is the CURRENT standing, not a final finish — check `inProgress`.
   */
  finish: number | null;
  /** True while the regular season is still being played. */
  inProgress: boolean;
  /** Regular-season weeks recorded so far, of the scheduled total. */
  weeksPlayed: number;
  scheduledWeeks: number;
  teamsInLeague: number;
  groupFinish: number | null;
  groupSize: number | null;
  madePlayoffs: boolean;
  playoffResult: {
    deepestRound: number;
    label: string;
    outcome: PlayoffOutcome;
  } | null;
  /** Streak the team ended the regular season on, e.g. "W3". */
  streak: string | null;
  /**
   * Points scored as a percentage of the league's scoring level THAT season.
   * 100 is par. Plot this rather than raw points-for: raw points mostly draw
   * the league-wide scoring step change, not the team.
   */
  scoringIndex: number | null;
  /** Points conceded on the same scale; above 100 is a harder-scoring slate. */
  concededIndex: number | null;
}

export interface LeagueRank {
  rank: number;
  of: number;
}

/**
 * Career rank among all franchises.
 *
 * CAVEAT for the scoring ranks: these compare raw career averages across
 * franchises that played in different eras, and league scoring has roughly
 * doubled — the 2007 field averaged around 78 points a game, recent seasons
 * around 125. A franchise that joined in 2017 therefore ranks near the top on
 * points per game regardless of how good it was. Present these alongside the
 * team's span, or normalise by season, before drawing a conclusion from them.
 * The win-percentage rank is not affected.
 */
export interface LeagueRanks {
  /** 1 = best career win percentage among all franchises. */
  winPct: LeagueRank;
  /** 1 = highest career points per game. Era-sensitive; see above. */
  pointsPerGame: LeagueRank;
  /** 1 = MOST points conceded per game. Era-sensitive; see above. */
  pointsAgainstPerGame: LeagueRank;
  /** Era-adjusted scoring — use these for any quality claim. */
  scoringIndex: EraAdjusted;
  concededIndex: EraAdjusted;
}

/** The group (division/quad) key a team sat in that season, if any. */
function groupKeyFor(h: LeagueHistoryData, year: number, teamId: number): string | null {
  const season = h.leagueSeasons.find(s => s.year === year);
  if (!season || season.structure_type === 'single_league') return null;
  const ts = h.teamSeasons.find(x => x.year === year && x.team_id === teamId);
  if (!ts) return null;
  if (season.structure_type === 'quads' && ts.quad_id != null) return `q${ts.quad_id}`;
  if (season.structure_type === 'divisions' && ts.division_id != null) return `d${ts.division_id}`;
  return null;
}

function groupMembers(h: LeagueHistoryData, year: number, key: string): number[] {
  const season = h.leagueSeasons.find(s => s.year === year);
  if (!season) return [];
  return h.teamSeasons
    .filter(ts => ts.year === year)
    .filter(ts => {
      if (season.structure_type === 'quads') return `q${ts.quad_id}` === key;
      if (season.structure_type === 'divisions') return `d${ts.division_id}` === key;
      return false;
    })
    .map(ts => ts.team_id);
}

/** The run a team ended its regular season on. Null if they played no games. */
export function endOfSeasonStreak(log: TeamGame[], year: number): string | null {
  const games = regularSeasonGames(log, year)
    .filter(g => g.countsTowardRecord)
    .sort((a, b) => a.week - b.week);
  if (games.length === 0) return null;

  const last = games[games.length - 1].result;
  let n = 0;
  for (let i = games.length - 1; i >= 0; i--) {
    if (games[i].result !== last) break;
    n++;
  }
  return `${last}${n}`;
}

export function careerRecord(tables: SeasonTables, log: TeamGame[], teamId: number): CareerRecord {
  const mine: SeasonTotals[] = [];
  for (const year of tables.years) {
    const t = tables.byYear.get(year)?.get(teamId);
    if (t && (totalGames(t) > 0 || t.playoffWins + t.playoffLosses + t.playoffTies > 0)) {
      mine.push(t);
    }
  }

  const sum = (pick: (t: SeasonTotals) => number) => mine.reduce((a, t) => a + pick(t), 0);
  const wins = sum(t => t.wins);
  const losses = sum(t => t.losses);
  const ties = sum(t => t.ties);
  const games = wins + losses + ties;
  const pointsFor = round2(sum(t => t.pointsFor));
  const pointsAgainst = round2(sum(t => t.pointsAgainst));

  const playoffWins = sum(t => t.playoffWins);
  const playoffLosses = sum(t => t.playoffLosses);
  const playoffTies = sum(t => t.playoffTies);

  const byRound = new Map<number, { wins: number; losses: number }>();
  for (const g of log) {
    if (!g.playoffs) continue;
    if (!byRound.has(g.week)) byRound.set(g.week, { wins: 0, losses: 0 });
    const r = byRound.get(g.week)!;
    if (g.result === 'W') r.wins++;
    else if (g.result === 'L') r.losses++;
  }

  // Points-per-game divides by games whose POINTS counted, which is not the
  // same as games that counted toward the record — 2025's Week 14 is in one and
  // not the other, and using the record count overstates 2025 rates by 14/13.
  const scoredGames = sum(t => t.pointsGames);

  return {
    wins, losses, ties, games,
    winPct: winPctOf(wins, losses, ties),
    pointsFor, pointsAgainst,
    pointDiff: round2(pointsFor - pointsAgainst),
    pointsPerGame: scoredGames > 0 ? round2(pointsFor / scoredGames) : 0,
    pointsAgainstPerGame: scoredGames > 0 ? round2(pointsAgainst / scoredGames) : 0,
    playoff: {
      wins: playoffWins,
      losses: playoffLosses,
      ties: playoffTies,
      games: playoffWins + playoffLosses + playoffTies,
      winPct: winPctOf(playoffWins, playoffLosses, playoffTies),
      byRound: [...byRound.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([round, r]) => ({ round, label: getPlayoffRoundLabel(round), ...r })),
    },
    // Completed seasons only — see TeamIdentity.seasonsPlayed.
    seasons: mine.filter(
      t => totalGames(t) > 0 && (tables.progress.get(t.year)?.regularSeasonComplete ?? true)
    ).length,
  };
}

export function seasonLines(
  h: LeagueHistoryData,
  tables: SeasonTables,
  log: TeamGame[],
  teamId: number
): SeasonLine[] {
  const out: SeasonLine[] = [];
  const levels = leagueScoringLevels(tables);

  for (const year of tables.years) {
    const table = tables.byYear.get(year)!;
    const mine = table.get(teamId);
    if (!mine || totalGames(mine) === 0) continue;

    const order = rankSeason(table);
    const finish = order.indexOf(teamId);

    const key = groupKeyFor(h, year, teamId);
    let groupFinish: number | null = null;
    let groupSize: number | null = null;
    if (key) {
      const members = groupMembers(h, year, key);
      const ranked = order.filter(id => members.includes(id));
      groupSize = ranked.length;
      const idx = ranked.indexOf(teamId);
      groupFinish = idx >= 0 ? idx + 1 : null;
    }

    const progress = tables.progress.get(year);
    const idx = seasonIndexes(mine, levels.get(year));
    const deepest = tables.deepestRound.get(`${year}:${teamId}`) ?? null;
    const shape = tables.playoffShape.get(year);
    let playoffResult: SeasonLine['playoffResult'] = null;
    if (deepest !== null) {
      const outcome: PlayoffOutcome =
        shape?.championId === teamId
          ? 'won-title'
          : shape?.runnerUpId === teamId
            ? 'lost-final'
            : 'eliminated';
      playoffResult = { deepestRound: deepest, label: getPlayoffRoundLabel(deepest), outcome };
    }

    out.push({
      year,
      groupName: key ? (h.groupNames.get(key) ?? key) : null,
      wins: mine.wins,
      losses: mine.losses,
      ties: mine.ties,
      winPct: winPctOf(mine.wins, mine.losses, mine.ties),
      pointsFor: round2(mine.pointsFor),
      pointsAgainst: round2(mine.pointsAgainst),
      pointDiff: round2(mine.pointsFor - mine.pointsAgainst),
      finish: finish >= 0 ? finish + 1 : null,
      teamsInLeague: order.length,
      groupFinish,
      groupSize,
      madePlayoffs: deepest !== null,
      playoffResult,
      streak: endOfSeasonStreak(log, year),
      scoringIndex: idx?.scoring ?? null,
      concededIndex: idx?.conceded ?? null,
      inProgress: !(progress?.regularSeasonComplete ?? true),
      weeksPlayed: progress?.regularWeeksPlayed ?? 0,
      scheduledWeeks: progress?.scheduledWeeks ?? 0,
    });
  }

  return out;
}

/** Career totals for every franchise, used for league-wide ranking. */
export function careerTotalsForAll(tables: SeasonTables) {
  const out = new Map<number, {
    wins: number; losses: number; ties: number;
    pf: number; pa: number; games: number; scoredGames: number;
  }>();
  for (const year of tables.years) {
    for (const t of tables.byYear.get(year)!.values()) {
      if (!out.has(t.teamId)) {
        out.set(t.teamId, { wins: 0, losses: 0, ties: 0, pf: 0, pa: 0, games: 0, scoredGames: 0 });
      }
      const c = out.get(t.teamId)!;
      c.wins += t.wins;
      c.losses += t.losses;
      c.ties += t.ties;
      c.pf += t.pointsFor;
      c.pa += t.pointsAgainst;
      c.games += totalGames(t);
      c.scoredGames += t.pointsGames;
    }
  }
  return out;
}

export function leagueRanks(tables: SeasonTables, teamId: number): LeagueRanks {
  const totals = [...careerTotalsForAll(tables).entries()].filter(([, c]) => c.games > 0);
  const of = totals.length;

  const rankBy = (score: (c: (typeof totals)[0][1]) => number): LeagueRank => {
    const ordered = [...totals].sort((a, b) => score(b[1]) - score(a[1]));
    const idx = ordered.findIndex(([id]) => id === teamId);
    return { rank: idx >= 0 ? idx + 1 : of, of };
  };

  const era = eraRanks(tables, teamId);

  return {
    winPct: rankBy(c => winPctOf(c.wins, c.losses, c.ties)),
    pointsPerGame: rankBy(c => (c.scoredGames > 0 ? c.pf / c.scoredGames : 0)),
    pointsAgainstPerGame: rankBy(c => (c.scoredGames > 0 ? c.pa / c.scoredGames : 0)),
    scoringIndex: era.scoring,
    concededIndex: era.conceded,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
