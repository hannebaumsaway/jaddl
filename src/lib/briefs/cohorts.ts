/**
 * Cohort and precedent statistics: "has this ever happened before?"
 *
 * This is the archive-mining the column runs on — the eighth team ever to start
 * 0-5, the two of eighteen 3-5 teams that reached the postseason, the worst
 * game in league history. Those facts are not visible in a week's data and
 * cannot be estimated; they come from replaying every season.
 *
 * A note on comparability: the league ran 14 teams before 2008 and 12 after,
 * and 13-week regular seasons through 2020 against 14 since. Cohorts are drawn
 * across all of it, matching how the column has always used them. Where a
 * cohort is thin, the count is reported so a writer can judge it.
 */

import {
  type LeagueHistoryData,
  type HistoryGame,
  recordsForSeason,
} from './history';

/* ------------------------------------------------------------ playoff sets */

/**
 * Teams that appeared in a playoff game, by year.
 *
 * This is the correct playoff-appearance source: `playoff_seeds` holds only
 * 2025, and seeds computed for a finished season are a projection anyway.
 */
export function playoffTeamsByYear(h: LeagueHistoryData): Map<number, Set<number>> {
  const out = new Map<number, Set<number>>();
  for (const g of h.games) {
    if (!g.playoffs) continue;
    if (!out.has(g.year)) out.set(g.year, new Set());
    out.get(g.year)!.add(g.home_team_id);
    out.get(g.year)!.add(g.away_team_id);
  }
  return out;
}

/** Seasons that actually recorded regular-season games through a given week. */
function seasonsReaching(h: LeagueHistoryData, week: number): number[] {
  const byYear = new Map<number, number>();
  for (const g of h.games) {
    if (g.playoffs || g.home_score === null) continue;
    byYear.set(g.year, Math.max(byYear.get(g.year) ?? 0, g.week));
  }
  return [...byYear.entries()].filter(([, max]) => max >= week).map(([y]) => y);
}

/* -------------------------------------------------------- record cohorts */

export interface CohortPrecedent {
  teamId: number;
  year: number;
  finalRecord: string;
  madePlayoffs: boolean;
  wonTitle: boolean;
}

export interface RecordCohort {
  /** The situation, e.g. "3-5 after week 8". */
  record: string;
  throughWeek: number;
  /** Every team-season in league history that matched, including this one. */
  count: number;
  madePlayoffs: number;
  wonTitle: number;
  /** Seasons excluded because they never reached this week. */
  seasonsConsidered: number;
  /** A few named precedents, most recent first. */
  precedents: CohortPrecedent[];
}

/**
 * How many teams have ever held this exact record at this point in a season,
 * and what became of them.
 *
 * Only seasons that reached the week are considered, so an in-progress season
 * does not deflate the denominator.
 */
export function recordCohort(
  h: LeagueHistoryData,
  year: number,
  week: number,
  wins: number,
  losses: number,
  ties: number,
  championships: Map<number, number[]>
): RecordCohort {
  const playoffs = playoffTeamsByYear(h);
  const years = seasonsReaching(h, week);
  const target = `${wins}-${losses}-${ties}`;

  const matches: CohortPrecedent[] = [];
  for (const y of years) {
    const atWeek = recordsForSeason(h.games, y, week);
    const atEnd = recordsForSeason(h.games, y, Number.MAX_SAFE_INTEGER);
    for (const [teamId, r] of atWeek) {
      if (`${r.w}-${r.l}-${r.t}` !== target) continue;
      const fin = atEnd.get(teamId);
      matches.push({
        teamId,
        year: y,
        finalRecord: fin ? `${fin.w}-${fin.l}-${fin.t}` : '?',
        madePlayoffs: playoffs.get(y)?.has(teamId) ?? false,
        wonTitle: (championships.get(teamId) ?? []).includes(y),
      });
    }
  }

  matches.sort((a, b) => b.year - a.year);
  return {
    record: target.replace(/-0$/, ''),
    throughWeek: week,
    count: matches.length,
    madePlayoffs: matches.filter(m => m.madePlayoffs).length,
    wonTitle: matches.filter(m => m.wonTitle).length,
    seasonsConsidered: years.length,
    precedents: matches.slice(0, 5),
  };
}

/* --------------------------------------------------------- start ladders */

export interface StartLadder {
  kind: 'winless' | 'unbeaten';
  /** Length of the run to open the season, e.g. 5 for an 0-5 start. */
  length: number;
  /** How many team-seasons ever reached each successive length. */
  ladder: { length: number; count: number }[];
  longest: { length: number; teamId: number; year: number } | null;
}

/**
 * The "six teams have started 0-6; four have started 0-7; only one has started
 * 0-8" construction. Returns null unless the team's season actually opened with
 * an unbroken run, which is what makes the comparison meaningful.
 */
export function startLadder(
  h: LeagueHistoryData,
  year: number,
  week: number,
  teamId: number
): StartLadder | null {
  /** The unbroken run a team opened a season with, within `games`. */
  const openingRun = (
    games: HistoryGame[],
    y: number,
    id: number
  ): { kind: 'winless' | 'unbeaten'; length: number } | null => {
    const mine = games
      .filter(g => g.year === y && !g.playoffs && g.home_score !== null && g.away_score !== null)
      .filter(g => g.home_team_id === id || g.away_team_id === id)
      .sort((a, b) => a.week - b.week);
    if (mine.length === 0) return null;

    let kind: 'winless' | 'unbeaten' | null = null;
    let length = 0;
    for (const g of mine) {
      const isHome = g.home_team_id === id;
      const me = isHome ? g.home_score! : g.away_score!;
      const opp = isHome ? g.away_score! : g.home_score!;
      if (me === opp) break; // a tie ends the run either way
      const thisKind = me > opp ? 'unbeaten' : 'winless';
      if (kind === null) kind = thisKind;
      else if (kind !== thisKind) break;
      length++;
    }
    return kind && length > 0 ? { kind, length } : null;
  };

  // The run as it stood at `week`, not as the season eventually finished.
  const throughWeek = h.games.filter(g => g.year !== year || g.week <= week);
  const mine = openingRun(throughWeek, year, teamId);
  // Two-game starts are not remarkable; the construction needs a real streak.
  if (!mine || mine.length < 3) return null;

  const runs: { length: number; teamId: number; year: number }[] = [];
  for (const key of new Set(h.teamSeasons.map(ts => `${ts.year}:${ts.team_id}`))) {
    const [y, id] = key.split(':').map(Number);
    const r = openingRun(h.games, y, id);
    if (r && r.kind === mine.kind) runs.push({ length: r.length, teamId: id, year: y });
  }

  const maxLen = Math.max(mine.length, ...runs.map(r => r.length));
  const ladder: { length: number; count: number }[] = [];
  for (let n = mine.length; n <= maxLen; n++) {
    ladder.push({ length: n, count: runs.filter(r => r.length >= n).length });
  }

  const longest = runs.reduce<typeof runs[0] | null>(
    (best, r) => (!best || r.length > best.length ? r : best), null);

  return { kind: mine.kind, length: mine.length, ladder, longest };
}

/* ------------------------------------------------------- game extremes */

export interface GameExtremes {
  /** Both scores added together, and where that ranks all-time. */
  combined: number;
  combinedRankHigh: number;
  combinedRankLow: number;
  totalGames: number;
  marginRankHigh: number;
  marginRankLow: number;
  /** The lowest-scoring game in league history, for reference. */
  worstEver: { year: number; week: number; home: number; away: number; combined: number } | null;
}

export function gameExtremes(
  h: LeagueHistoryData,
  winnerScore: number,
  loserScore: number
): GameExtremes {
  const played = h.games.filter(g => g.home_score !== null && g.away_score !== null);
  const combos = played.map(g => ({
    g,
    combined: g.home_score! + g.away_score!,
    margin: Math.abs(g.home_score! - g.away_score!),
  }));

  const combined = winnerScore + loserScore;
  const margin = winnerScore - loserScore;
  const near = (v: number, x: number) => Math.abs(v - x) < 0.06;

  const byCombinedDesc = [...combos].sort((a, b) => b.combined - a.combined);
  const byMarginDesc = [...combos].sort((a, b) => b.margin - a.margin);
  const worst = byCombinedDesc[byCombinedDesc.length - 1];

  const rank = (list: typeof combos, key: 'combined' | 'margin', v: number) =>
    list.findIndex(c => near(c[key], v)) + 1;

  return {
    combined: Math.round(combined * 100) / 100,
    combinedRankHigh: rank(byCombinedDesc, 'combined', combined),
    combinedRankLow: combos.length - rank(byCombinedDesc, 'combined', combined) + 1,
    totalGames: combos.length,
    marginRankHigh: rank(byMarginDesc, 'margin', margin),
    marginRankLow: combos.length - rank(byMarginDesc, 'margin', margin) + 1,
    worstEver: worst
      ? {
          year: worst.g.year,
          week: worst.g.week,
          home: worst.g.home_score!,
          away: worst.g.away_score!,
          combined: Math.round(worst.combined * 100) / 100,
        }
      : null,
  };
}

/* ------------------------------------------------------ streak rarity */

export interface StreakRarity {
  kind: 'W' | 'L';
  length: number;
  /** How many times a run of at least this length has occurred, all-time. */
  occurrences: number;
  longestEver: { length: number; teamId: number; year: number } | null;
}

/**
 * How unusual an active run is. Streaks are measured within a season, in
 * regular-season games only — playoff `week` holds a round and would otherwise
 * interleave with early-season weeks.
 */
export function streakRarity(
  h: LeagueHistoryData,
  kind: 'W' | 'L',
  length: number
): StreakRarity {
  const runs: { length: number; teamId: number; year: number }[] = [];
  const teamYears = new Set(h.teamSeasons.map(ts => `${ts.year}:${ts.team_id}`));

  for (const key of teamYears) {
    const [y, id] = key.split(':').map(Number);
    const games = h.games
      .filter(g => g.year === y && !g.playoffs && g.home_score !== null && g.away_score !== null)
      .filter(g => g.home_team_id === id || g.away_team_id === id)
      .sort((a, b) => a.week - b.week);

    let cur = 0;
    for (const g of games) {
      const isHome = g.home_team_id === id;
      const me = isHome ? g.home_score! : g.away_score!;
      const opp = isHome ? g.away_score! : g.home_score!;
      const r = me > opp ? 'W' : me < opp ? 'L' : 'T';
      if (r === kind) {
        cur++;
        if (cur >= length) runs.push({ length: cur, teamId: id, year: y });
      } else {
        cur = 0;
      }
    }
  }

  // One entry per team-season at its longest, so a 6-game run is not counted
  // four times for reaching 3, 4, 5 and 6.
  const best = new Map<string, { length: number; teamId: number; year: number }>();
  for (const r of runs) {
    const k = `${r.year}:${r.teamId}`;
    if (!best.has(k) || best.get(k)!.length < r.length) best.set(k, r);
  }
  const all = [...best.values()];
  const longest = all.reduce<typeof all[0] | null>(
    (b, r) => (!b || r.length > b.length ? r : b), null);

  return { kind, length, occurrences: all.length, longestEver: longest };
}
