/**
 * Pure derivations for the scores page. No I/O — these take rows and return
 * numbers, so they can be reused by any surface (week view, team page, a
 * future dashboard) without dragging a query along.
 */

import type { Game } from '@/types/database';

export interface GameTeamDisplay {
  name: string;
  shortName: string;
  logo: string;
  isContentfulLogo: boolean;
}

export type EnhancedGame = Game & {
  homeTeam: GameTeamDisplay;
  awayTeam: GameTeamDisplay;
};

/** Minimal shape this module needs from a Contentful team profile. */
interface TeamProfileLike {
  teamId: number;
  teamName?: string;
  shortName?: string;
  logo?: { url?: string } | null;
}

const FALLBACK_LOGO = '🏈';

function displayFor(profile: TeamProfileLike | undefined): GameTeamDisplay {
  return {
    name: profile?.teamName || 'Unknown Team',
    shortName: profile?.shortName || 'UNK',
    logo: profile?.logo?.url || FALLBACK_LOGO,
    isContentfulLogo: !!profile?.logo,
  };
}

/**
 * Attach display names and logos from Contentful to Supabase game rows.
 * Contentful wins for display fields, matching the canonical merge described
 * in `team-mapping.ts`.
 */
export function enhanceGamesWithTeamProfiles<T extends TeamProfileLike>(
  games: Game[],
  profiles: T[]
): EnhancedGame[] {
  const byId = new Map<number, T>(profiles.map(p => [p.teamId, p]));
  return games.map(game => ({
    ...game,
    homeTeam: displayFor(byId.get(game.home_team_id)),
    awayTeam: displayFor(byId.get(game.away_team_id)),
  }));
}

export type GameWithMargin = EnhancedGame & {
  margin: number;
  winner: GameTeamDisplay;
  loser: GameTeamDisplay;
};

export interface WeekSummary {
  completedGames: EnhancedGame[];
  avgScore: number;
  medianScore: number;
  highScore: number;
  narrowestMargin: GameWithMargin | null;
  biggestMargin: GameWithMargin | null;
}

function median(sortedAscending: number[]): number {
  if (sortedAscending.length === 0) return 0;
  const mid = Math.floor(sortedAscending.length / 2);
  return sortedAscending.length % 2 === 0
    ? (sortedAscending[mid - 1] + sortedAscending[mid]) / 2
    : sortedAscending[mid];
}

/**
 * Scoring and margin summary for a set of games. Only games with both scores
 * recorded contribute — an in-progress week reports on what has finished.
 *
 * A tie yields margin 0; `winner` is then arbitrary between the two, so callers
 * should not present narrowestMargin as a "won by" when margin is 0.
 */
export function summarizeGames(games: EnhancedGame[]): WeekSummary {
  const completedGames = games.filter(
    g => g.home_score !== null && g.away_score !== null
  );

  const allScores = completedGames.flatMap(g => [g.home_score ?? 0, g.away_score ?? 0]);
  const sorted = [...allScores].sort((a, b) => a - b);

  const withMargins: GameWithMargin[] = completedGames.map(game => {
    const home = game.home_score ?? 0;
    const away = game.away_score ?? 0;
    const homeWon = home > away;
    return {
      ...game,
      margin: Math.abs(home - away),
      winner: homeWon ? game.homeTeam : game.awayTeam,
      loser: homeWon ? game.awayTeam : game.homeTeam,
    };
  });

  return {
    completedGames,
    avgScore: allScores.length ? allScores.reduce((s, v) => s + v, 0) / allScores.length : 0,
    medianScore: median(sorted),
    highScore: allScores.length ? Math.max(...allScores) : 0,
    narrowestMargin: withMargins.length
      ? withMargins.reduce((min, g) => (g.margin < min.margin ? g : min))
      : null,
    biggestMargin: withMargins.length
      ? withMargins.reduce((max, g) => (g.margin > max.margin ? g : max))
      : null,
  };
}
