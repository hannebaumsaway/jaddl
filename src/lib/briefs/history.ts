/**
 * Cross-season context for game briefs.
 *
 * The facts that make a recap land are usually not visible in the week itself:
 * that a win clinched a division, that it was a franchise's seventh, that a
 * score was the season's second-highest. None of that is stored — the league
 * keeps games, not standings — so it is computed here from the full game log.
 *
 * Everything in this module reads all seasons at once and is therefore
 * comparatively expensive; buildGameBrief calls it once per brief.
 */

import { supabase } from '../supabase/client';
import { getSeasonConfig, countsTowardRecord } from '../supabase/api';

export interface HistoryGame {
  id: number;
  year: number;
  week: number;
  playoffs: boolean;
  home_team_id: number;
  away_team_id: number;
  home_score: number | null;
  away_score: number | null;
}

interface TeamSeason {
  year: number;
  team_id: number;
  division_id: number | null;
  quad_id: number | null;
}

interface LeagueSeason {
  year: number;
  structure_type: 'single_league' | 'divisions' | 'quads';
}

export interface LeagueHistoryData {
  games: HistoryGame[];
  teamSeasons: TeamSeason[];
  leagueSeasons: LeagueSeason[];
  groupNames: Map<string, string>;
}

/** One query per table; every downstream computation reuses these. */
export async function loadLeagueHistory(): Promise<LeagueHistoryData> {
  const [games, teamSeasons, leagueSeasons, divisions, quads] = await Promise.all([
    supabase.from('games').select('id, year, week, playoffs, home_team_id, away_team_id, home_score, away_score'),
    supabase.from('team_seasons').select('year, team_id, division_id, quad_id'),
    supabase.from('league_seasons').select('year, structure_type'),
    supabase.from('divisions').select('division_id, division_name'),
    supabase.from('quads').select('quad_id, quad_name'),
  ]);

  const groupNames = new Map<string, string>();
  for (const d of ((divisions.data || []) as any[])) groupNames.set(`d${d.division_id}`, d.division_name);
  for (const q of ((quads.data || []) as any[])) groupNames.set(`q${q.quad_id}`, q.quad_name);

  return {
    games: (games.data || []) as unknown as HistoryGame[],
    teamSeasons: (teamSeasons.data || []) as unknown as TeamSeason[],
    leagueSeasons: (leagueSeasons.data || []) as unknown as LeagueSeason[],
    groupNames,
  };
}

/* --------------------------------------------------------------- records */

interface Rec { w: number; l: number; t: number; pf: number }

/**
 * Season records for every team, counting only games through `throughWeek`.
 * Uses countsTowardRecord so a season like 2025 — whose Week 14 play-in scored
 * points but no W-L — is handled the same way the standings page handles it.
 */
function recordsForSeason(
  games: HistoryGame[],
  year: number,
  throughWeek: number
): Map<number, Rec> {
  const config = getSeasonConfig(year);
  const recs = new Map<number, Rec>();
  const touch = (id: number) => {
    if (!recs.has(id)) recs.set(id, { w: 0, l: 0, t: 0, pf: 0 });
    return recs.get(id)!;
  };

  for (const g of games) {
    if (g.year !== year) continue;
    if (!countsTowardRecord(g as any, config)) continue;
    if (g.week > throughWeek) continue;
    if (g.home_score === null || g.away_score === null) continue;

    const h = touch(g.home_team_id);
    const a = touch(g.away_team_id);
    h.pf += g.home_score;
    a.pf += g.away_score;
    if (g.home_score > g.away_score) { h.w++; a.l++; }
    else if (g.home_score < g.away_score) { a.w++; h.l++; }
    else { h.t++; a.t++; }
  }
  return recs;
}

const winPct = (r: Rec) => {
  const n = r.w + r.l + r.t;
  return n > 0 ? (r.w + r.t * 0.5) / n : 0;
};

/** The group key a team belongs to that season, or null in a flat league. */
function groupKeyFor(ts: TeamSeason | undefined, structure: string): string | null {
  if (!ts) return null;
  if (structure === 'quads' && ts.quad_id != null) return `q${ts.quad_id}`;
  if (structure === 'divisions' && ts.division_id != null) return `d${ts.division_id}`;
  return null;
}

/* ------------------------------------------------------------ group wins */

export interface GroupTitle {
  year: number;
  groupName: string;
}

/**
 * Every division/quad title a team has won, by computing final standings for
 * each season. Group winner is best overall record, then points for — the
 * order calculateStandings documents. Seasons with no group structure are
 * skipped, as are seasons with no games recorded.
 */
export function computeGroupTitles(h: LeagueHistoryData): Map<number, GroupTitle[]> {
  const out = new Map<number, GroupTitle[]>();

  for (const season of h.leagueSeasons) {
    if (season.structure_type === 'single_league') continue;
    const recs = recordsForSeason(h.games, season.year, Number.MAX_SAFE_INTEGER);
    if (recs.size === 0) continue;

    const groups = new Map<string, number[]>();
    for (const ts of h.teamSeasons) {
      if (ts.year !== season.year) continue;
      const key = groupKeyFor(ts, season.structure_type);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(ts.team_id);
    }

    for (const [key, teamIds] of groups) {
      const ranked = teamIds
        .filter(id => recs.has(id))
        .sort((a, b) => {
          const ra = recs.get(a)!, rb = recs.get(b)!;
          return winPct(rb) - winPct(ra) || rb.pf - ra.pf;
        });
      const winner = ranked[0];
      if (winner === undefined) continue;
      if (!out.has(winner)) out.set(winner, []);
      out.get(winner)!.push({ year: season.year, groupName: h.groupNames.get(key) ?? key });
    }
  }

  for (const list of out.values()) list.sort((a, b) => a.year - b.year);
  return out;
}

/**
 * Championship years per team: the winner of the highest playoff round in each
 * season. Playoff games store `week` as the round, so the final is simply the
 * largest round that season.
 */
export function computeChampionships(h: LeagueHistoryData): Map<number, number[]> {
  const byYear = new Map<number, HistoryGame[]>();
  for (const g of h.games) {
    if (!g.playoffs || g.home_score === null || g.away_score === null) continue;
    if (!byYear.has(g.year)) byYear.set(g.year, []);
    byYear.get(g.year)!.push(g);
  }

  const out = new Map<number, number[]>();
  for (const [year, games] of byYear) {
    const finalRound = Math.max(...games.map(g => g.week));
    const finals = games.filter(g => g.week === finalRound);
    // A round with several games is not a final; skip rather than guess.
    if (finals.length !== 1) continue;
    const f = finals[0];
    const champ = f.home_score! > f.away_score! ? f.home_team_id : f.away_team_id;
    if (!out.has(champ)) out.set(champ, []);
    out.get(champ)!.push(year);
  }
  for (const list of out.values()) list.sort((a, b) => a - b);
  return out;
}

/* ---------------------------------------------------------------- clinch */

export interface ClinchResult {
  teamId: number;
  groupName: string;
  /** Which title this is for the franchise, counting this one. */
  titleNumber: number;
}

/**
 * Whether a team's group title was mathematically secured by the end of
 * `week`, and had not already been secured the week before — so the claim is
 * "this win clinched it", not "they were already champions".
 *
 * Deliberately conservative: a team is treated as clinched only when its
 * current wins exceed every rival's best possible finish. Tiebreakers can
 * clinch earlier, so this may miss a clinch, which is the right way to be
 * wrong — a false clinch in a published article is much worse than a missed one.
 */
export function computeClinch(
  h: LeagueHistoryData,
  year: number,
  week: number,
  teamIds: number[],
  titles: Map<number, GroupTitle[]>
): ClinchResult | null {
  const season = h.leagueSeasons.find(s => s.year === year);
  if (!season || season.structure_type === 'single_league') return null;

  const config = getSeasonConfig(year);
  const countsThisSeason = (g: HistoryGame) =>
    g.year === year && countsTowardRecord(g as any, config);

  const clinchedBy = (throughWeek: number, teamId: number): string | null => {
    const ts = h.teamSeasons.find(x => x.year === year && x.team_id === teamId);
    const key = groupKeyFor(ts, season.structure_type);
    if (!key) return null;

    const rivals = h.teamSeasons
      .filter(x => x.year === year && x.team_id !== teamId &&
                   groupKeyFor(x, season.structure_type) === key)
      .map(x => x.team_id);

    const recs = recordsForSeason(h.games, year, throughWeek);
    const mine = recs.get(teamId);
    if (!mine) return null;

    for (const rivalId of rivals) {
      const r = recs.get(rivalId) ?? { w: 0, l: 0, t: 0, pf: 0 };
      const remaining = h.games.filter(
        g => countsThisSeason(g) && g.week > throughWeek &&
             (g.home_team_id === rivalId || g.away_team_id === rivalId)
      ).length;
      if (mine.w <= r.w + remaining) return null;
    }
    return h.groupNames.get(key) ?? key;
  };

  for (const teamId of teamIds) {
    const now = clinchedBy(week, teamId);
    if (!now) continue;
    // Already clinched before this game? Then this win did not do it.
    if (clinchedBy(week - 1, teamId)) continue;

    const all = titles.get(teamId) ?? [];
    const index = all.findIndex(t => t.year === year);
    return {
      teamId,
      groupName: now,
      titleNumber: index >= 0 ? index + 1 : all.length + 1,
    };
  }
  return null;
}

/* ----------------------------------------------------------- score ranks */

export interface ScoreContext {
  /** 1 = highest single-team score of that season. */
  rankInSeason: number;
  seasonScores: number;
  /** 1 = highest single-team score in league history. Null beyond the top 25. */
  rankAllTime: number | null;
}

export function scoreContext(h: LeagueHistoryData, year: number, score: number): ScoreContext {
  const allScores: number[] = [];
  const seasonScores: number[] = [];
  for (const g of h.games) {
    if (g.home_score === null || g.away_score === null) continue;
    allScores.push(g.home_score, g.away_score);
    if (g.year === year) seasonScores.push(g.home_score, g.away_score);
  }
  allScores.sort((a, b) => b - a);
  seasonScores.sort((a, b) => b - a);

  const near = (list: number[]) => list.findIndex(v => Math.abs(v - score) < 0.06) + 1;
  const allRank = near(allScores);

  return {
    rankInSeason: near(seasonScores),
    seasonScores: seasonScores.length,
    rankAllTime: allRank > 0 && allRank <= 25 ? allRank : null,
  };
}
