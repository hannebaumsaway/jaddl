/**
 * The week's slate, as the article rail shows it.
 *
 * An article knows its own year and week; everything the rail renders is
 * derivable from that. Nothing here is authored, so a recap cannot disagree
 * with the scoreboard next to it — a real risk when the prose is written days
 * after the import and the scores are corrected in between.
 *
 * Reuses the scores page's own loaders rather than querying `games` inline,
 * for the reason given in CLAUDE.md: every surface goes through
 * `getScoreboardGames`.
 */

import { getTeamProfiles } from '@/lib/contentful/api';
import { getScoreboardGames } from '@/lib/supabase/scores';
import {
  enhanceGamesWithTeamProfiles,
  summarizeGames,
  type EnhancedGame,
} from '@/lib/utils/scores';

export interface SlateSide {
  teamId: number;
  name: string;
  shortName: string;
  score: number;
}

export interface SlateGame {
  winner: SlateSide;
  loser: SlateSide;
  margin: number;
  isTie: boolean;
  /** At most one per game: WEEK HIGH, BIGGEST MARGIN, CLOSEST. */
  tag: string | null;
}

export interface WeekSlate {
  year: number;
  week: number;
  isPlayoff: boolean;
  games: SlateGame[];
  high: number;
  low: number;
  avg: number;
}

function toSides(game: EnhancedGame): { winner: SlateSide; loser: SlateSide; isTie: boolean } {
  // A score of 0 is legal, so these are `?? 0` only after the null filter.
  const home = game.home_score ?? 0;
  const away = game.away_score ?? 0;
  const homeSide: SlateSide = {
    teamId: game.home_team_id,
    name: game.homeTeam.name,
    shortName: game.homeTeam.shortName,
    score: home,
  };
  const awaySide: SlateSide = {
    teamId: game.away_team_id,
    name: game.awayTeam.name,
    shortName: game.awayTeam.shortName,
    score: away,
  };
  const homeWon = home >= away;
  return {
    winner: homeWon ? homeSide : awaySide,
    loser: homeWon ? awaySide : homeSide,
    isTie: home === away,
  };
}

/**
 * Every completed game of one week, ordered by winning score.
 *
 * Returns null when the week has no finished games — an article published
 * before its week is imported should render without a rail rather than with an
 * empty one.
 */
export async function loadWeekSlate(
  year: number,
  week: number,
  isPlayoff: boolean
): Promise<WeekSlate | null> {
  if (!year || !week) return null;

  const [rows, profiles] = await Promise.all([
    getScoreboardGames({ mode: 'week', year, week, isPlayoffs: isPlayoff }),
    getTeamProfiles(),
  ]);

  const enhanced = enhanceGamesWithTeamProfiles(rows, profiles);
  const { completedGames, avgScore, highScore, narrowestMargin, biggestMargin } =
    summarizeGames(enhanced);

  if (completedGames.length === 0) return null;

  const games: SlateGame[] = completedGames
    .map(game => {
      const { winner, loser, isTie } = toSides(game);
      return { winner, loser, margin: winner.score - loser.score, isTie, tag: null as string | null };
    })
    .sort((a, b) => b.winner.score - a.winner.score);

  // One tag per game, most notable first, so a game that is both the high
  // score and the biggest blowout is labelled once.
  const tag = (match: (g: SlateGame) => boolean, label: string) => {
    const hit = games.find(g => !g.tag && match(g));
    if (hit) hit.tag = label;
  };
  tag(g => g.winner.score === highScore, 'WEEK HIGH');
  if (biggestMargin && biggestMargin.margin > 0) {
    tag(g => g.margin === biggestMargin.margin, 'BIGGEST MARGIN');
  }
  if (narrowestMargin && narrowestMargin.margin > 0) {
    tag(g => g.margin === narrowestMargin.margin, 'CLOSEST');
  }

  const scores = completedGames.flatMap(g => [g.home_score ?? 0, g.away_score ?? 0]);

  return {
    year,
    week,
    isPlayoff,
    games,
    high: highScore,
    low: Math.min(...scores),
    avg: avgScore,
  };
}
