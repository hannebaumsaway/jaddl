/**
 * Prestige — a 1-to-5-star standing for a franchise, weighted toward what it
 * has done lately.
 *
 * The problem this solves is that every other career figure on a team page
 * treats 2008 and 2024 as equal. A franchise that won three titles a decade ago
 * and has missed the playoffs ever since reads as elite on a career W-L, and
 * that is not what anyone in the league would say about them.
 *
 * Two ideas:
 *
 *   1. Each SEASON earns prestige points, from what happened in it.
 *   2. Seasons are then averaged with a RECENCY WEIGHT, so old seasons fade.
 *
 * Because it is an average rather than a sum, a long history neither helps nor
 * hurts by itself — only the quality of the recent part of it does.
 *
 * EVERY INPUT IS DERIVED FROM THE GAME LOG. Nothing here reads `trophy_case`:
 * champions are the winner of each season's final playoff round, group winners
 * are recomputed from final standings, points titles from season points totals,
 * weekly highs from each week's scores. That is deliberate — the trophy table
 * is incomplete and partly ambiguous (the Briefly Badass is missing 2022-2024,
 * and Jared's Goblet has no settled meaning), and the game log is complete from
 * 2007 and internally consistent.
 *
 * ONE EXCEPTION, and it is a narrow one. `games` begins in 2007, so the four
 * championships of 2003-2006 are underivable — there is no game log to read
 * them from. For those seasons only, prestige falls back to `trophy_case`,
 * which is the sole record of them and is not in doubt: the two sources agree
 * on all nineteen champions from 2007 to 2025, every one of which resolves to a
 * single final-round game. Dropping them instead would have told Mighty Boom it
 * has three titles when the league knows it has four.
 */

import type { SeasonLine } from './records';
import type { Honors } from './honors';
import type { SeasonTables } from './tables';

/* ------------------------------------------------------------- the decay */

/**
 * How far back the weighting looks, in seasons. Results older than this sit at
 * the floor.
 *
 * Set a little wider than the actual span of league history (2007-2025 = 18) so
 * the falloff stays smooth all the way to the oldest season. At exactly 18 there
 * was a hard step near the edge — 0.27 at sixteen seasons, 0.05 at eighteen —
 * and a 2007 result fell off a ledge rather than fading. Much beyond 22 the
 * curve flattens into a near-linear glide and stops decaying meaningfully.
 */
export const DECAY_SPAN = 22;
/**
 * Curvature. 1 would be a straight line; above 1 keeps recent seasons close to
 * full weight and puts the steep part of the falloff in the distant past.
 * At 2.2 the half-weight point sits around 13-14 seasons back.
 */
export const DECAY_EXPONENT = 2.2;
/**
 * Weight that the most distant history keeps. Deliberately not zero: four
 * titles in 2008-2012 should not read exactly the same as never having won.
 */
export const DECAY_FLOOR = 0.05;

/**
 * Neutral seasons added to the denominator, so a short history is pulled toward
 * the middle rather than swinging to an extreme on one year's evidence.
 *
 * Without this, a franchise that went 12-1 and won the title in its only season
 * rated higher than any actual dynasty. The decayed weights of a long-tenured
 * team sum to roughly 7.8 "effective seasons", so a prior of 2 costs an
 * established franchise about a fifth of its signal and a first-year one about
 * two thirds — which is the right shape for how much each has proved.
 */
export const PRIOR_SEASONS = 2;

/**
 * How much a season `age` years ago counts, from 1.0 (this season) down to the
 * floor at the edge of league history.
 *
 * The shape is deliberate: nearly flat across the recent past, so a good run
 * five or eight years ago still counts for most of its value, then falling away
 * increasingly steeply the further back it goes. Longevity matters; recency
 * matters more, but not overwhelmingly.
 *
 * An earlier version used a logistic centred six seasons back. That decayed too
 * fast — a title from ten years ago kept only 22% of its weight, so a franchise
 * with two recent titles and no other history outranked one with four titles
 * and two decades of contention.
 */
export interface DecaySettings {
  span?: number;
  exponent?: number;
  floor?: number;
}

export function recencyWeight(age: number, decay: DecaySettings = {}): number {
  const span = decay.span ?? DECAY_SPAN;
  const exponent = decay.exponent ?? DECAY_EXPONENT;
  const floor = decay.floor ?? DECAY_FLOOR;
  if (age <= 0) return 1;
  const t = Math.min(age / span, 1);
  return floor + (1 - floor) * (1 - Math.pow(t, exponent));
}

/* ------------------------------------------------- what a season is worth */

/** Points per accomplishment, ordered by how much the league would care. */
export const PRESTIGE_WEIGHTS = {
  championship: 100,
  lostFinal: 40,
  groupTitle: 30,
  pointsTitle: 22,
  /** Per point of scoring index above 100, clamped by `scoringCap`. */
  scoringPerIndexPoint: 2.5,
  scoringCap: 30,
  playoffBerth: 10,
  playoffWin: 10,
  /** Per point of win percentage above .500, clamped by `winRateCap`. */
  winRatePerPoint: 60,
  winRateCap: 30,
  weeklyHighScore: 3,
} as const;

export interface PrestigeSeason {
  year: number;
  age: number;
  /** Recency weight, scaled down for a season still being played. */
  weight: number;
  /** Fraction of the regular season played. 1 for every finished season. */
  played: number;
  /** Raw prestige points earned that season. */
  score: number;
  /** Score x weight, i.e. what it actually contributed. */
  contribution: number;
  breakdown: Record<string, number>;
}

export interface Prestige {
  /** 1.0-5.0, to the nearest half star. */
  stars: number;
  /** The recency-weighted average season score behind the stars. */
  rating: number;
  /** Decayed seasons of evidence, before the prior. Under ~4 is a thin record. */
  effectiveSeasons: number;
  /** Plain-language tier for the star count. */
  label: string;
  seasons: PrestigeSeason[];
  /** The seasons doing most of the work, most influential first. */
  drivers: { year: number; contribution: number; note: string }[];
}

const clamp = (v: number, cap: number) => Math.max(-cap, Math.min(cap, v));

/**
 * Star thresholds on the weighted rating.
 *
 * Absolute rather than percentile: a franchise's stars should move when it
 * plays better, not only when its rivals play worse — and a percentile scale
 * would force someone to be 1 star no matter how good the league got.
 *
 * The cut points are set from the distribution of all 230 team-seasons in
 * league history, each rated as of that season, so "4 stars" means roughly
 * "top fifth of anything this league has ever fielded". Mighty Boom's
 * 2013-2019 run is the all-time peak at 75.
 */
const STAR_THRESHOLDS: { min: number; stars: number; label: string }[] = [
  { min: 61, stars: 5.0, label: 'Elite' },              // ~top 5% all-time
  { min: 51, stars: 4.5, label: 'Perennial contender' },
  { min: 42, stars: 4.0, label: 'Contender' },
  { min: 29, stars: 3.5, label: 'Strong' },
  { min: 20, stars: 3.0, label: 'Middle of the pack' }, // straddles the median
  { min: 14, stars: 2.5, label: 'Fringe' },
  { min: 1, stars: 2.0, label: 'Rebuilding' },
  { min: -12, stars: 1.5, label: 'Struggling' },
  { min: -Infinity, stars: 1.0, label: 'Cellar' },      // ~bottom 5% all-time
];

// Cut-points are recalibrated whenever the decay curve changes: they are
// percentiles of the historical rating distribution (STAR_PERCENTILES), and a
// different curve produces a different distribution.


export function starsFor(
  rating: number,
  thresholds: { min: number; stars: number; label: string }[] = STAR_THRESHOLDS
): { stars: number; label: string } {
  const hit = thresholds.find(t => rating >= t.min)!;
  return { stars: hit.stars, label: hit.label };
}

/** The percentiles of league history each star level sits at. */
export const STAR_PERCENTILES = [
  { p: 0.95, stars: 5.0, label: 'Elite' },
  { p: 0.88, stars: 4.5, label: 'Perennial contender' },
  { p: 0.78, stars: 4.0, label: 'Contender' },
  { p: 0.62, stars: 3.5, label: 'Strong' },
  { p: 0.42, stars: 3.0, label: 'Middle of the pack' },
  { p: 0.25, stars: 2.5, label: 'Fringe' },
  { p: 0.13, stars: 2.0, label: 'Rebuilding' },
  { p: 0.05, stars: 1.5, label: 'Struggling' },
  { p: 0, stars: 1.0, label: 'Cellar' },
] as const;

export function computePrestige(params: {
  seasons: SeasonLine[];
  honors: Honors;
  tables: SeasonTables;
  teamId: number;
  /** The newest season anywhere in the league that has games — age 0. */
  latestSeason: number;
  /** Override the decay curve. Used for tuning; defaults to the constants. */
  decay?: DecaySettings;
  /** Override the star cut-points, e.g. when recalibrating for a new curve. */
  thresholds?: { min: number; stars: number; label: string }[];
}): Prestige {
  const { seasons, honors, tables, teamId, latestSeason, decay } = params;
  const W = PRESTIGE_WEIGHTS;

  const highsByYear = new Map(honors.weeklyHighScoresByYear.map(t => [t.year, t.count]));

  // Champions from the game log wherever the game log reaches, plus the stored
  // trophy for the seasons that predate it. `firstLoggedSeason` is the boundary;
  // nothing inside the logged era is ever taken from the trophy table.
  const firstLoggedSeason = tables.years[0] ?? Infinity;
  const preLogTitles = honors.championships.filter(y => y < firstLoggedSeason);
  const championships = new Set([...honors.championshipsFromGames, ...preLogTitles]);
  const groupTitleYears = new Set(honors.groupTitles.map(t => t.year));
  const pointsTitleYears = new Set(honors.pointsTitles);

  const rows: PrestigeSeason[] = [];

  for (const s of seasons) {
    const b: Record<string, number> = {};
    const totals = tables.byYear.get(s.year)?.get(teamId);

    if (championships.has(s.year)) b.championship = W.championship;
    else if (s.playoffResult?.outcome === 'lost-final') b.lostFinal = W.lostFinal;

    if (groupTitleYears.has(s.year)) b.groupTitle = W.groupTitle;
    if (pointsTitleYears.has(s.year)) b.pointsTitle = W.pointsTitle;

    if (s.scoringIndex !== null) {
      const v = clamp((s.scoringIndex - 100) * W.scoringPerIndexPoint, W.scoringCap);
      if (v !== 0) b.scoring = round1(v);
    }

    if (s.madePlayoffs) b.playoffBerth = W.playoffBerth;
    const playoffWins = totals?.playoffWins ?? 0;
    if (playoffWins > 0) b.playoffWins = playoffWins * W.playoffWin;

    const wr = clamp((s.winPct - 0.5) * W.winRatePerPoint, W.winRateCap);
    if (wr !== 0) b.winRate = round1(wr);

    const highs = highsByYear.get(s.year) ?? 0;
    if (highs > 0) b.weeklyHighs = highs * W.weeklyHighScore;

    rows.push(makeRow(s.year, latestSeason, b, decay, tables.progress.get(s.year)?.fraction ?? 1));
  }

  // Pre-2007 titles have no season row of their own, so they get one. They sit
  // at the decay floor, so this is a small credit, not a rewriting of history.
  const covered = new Set(seasons.map(s => s.year));
  for (const year of preLogTitles) {
    if (covered.has(year)) continue;
    rows.push(makeRow(year, latestSeason, { championship: W.championship }, decay));
  }

  rows.sort((a, b) => a.year - b.year);

  // The prior contributes weight but no score, so it drags toward zero.
  const totalWeight = rows.reduce((a, r) => a + r.weight, 0) + PRIOR_SEASONS;
  const rating = totalWeight > 0
    ? round1(rows.reduce((a, r) => a + r.contribution, 0) / totalWeight)
    : 0;

  const { stars, label } = starsFor(rating, params.thresholds);

  const drivers = [...rows]
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3)
    .map(r => ({
      year: r.year,
      contribution: round1(r.contribution),
      note: describe(r.breakdown),
    }));

  return {
    stars, rating, label, seasons: rows, drivers,
    effectiveSeasons: round1(rows.reduce((a, r) => a + r.weight, 0)),
  };
}

/**
 * `played` scales the recency weight by how much of the season has happened.
 *
 * The current season sits at recency weight 1.0 by design, which is right for a
 * finished one and badly wrong for a partial one: a single week-1 win moved a
 * franchise's rating more than four points. Scaling by completion makes week 1
 * count a fourteenth of a season, which is what it is.
 */
function makeRow(
  year: number,
  latestSeason: number,
  b: Record<string, number>,
  decay?: DecaySettings,
  played = 1
): PrestigeSeason {
  const age = latestSeason - year;
  const weight = recencyWeight(age, decay) * played;
  const score = round1(Object.values(b).reduce((a, v) => a + v, 0));
  return {
    year, age,
    weight: round3(weight),
    played: round3(played),
    score,
    contribution: round1(score * weight),
    breakdown: b,
  };
}

/** A short human summary of what a season's points came from. */
function describe(b: Record<string, number>): string {
  const parts: string[] = [];
  if (b.championship) parts.push('champion');
  if (b.lostFinal) parts.push('lost final');
  if (b.groupTitle) parts.push('group title');
  if (b.pointsTitle) parts.push('points title');
  if (b.playoffWins) parts.push(`${b.playoffWins / PRESTIGE_WEIGHTS.playoffWin} playoff wins`);
  else if (b.playoffBerth) parts.push('made playoffs');
  return parts.length ? parts.join(', ') : 'regular season only';
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round3 = (n: number) => Math.round(n * 1000) / 1000;
