/**
 * Per-team statistics.
 *
 * `loadTeamDossier(teamId)` is the entry point; everything else is exported so
 * a caller that already holds a `LeagueHistoryData` can reuse the pieces.
 */

export { loadTeamDossier, assembleDossier } from './dossier';
export type { TeamDossier, DraftProfile } from './dossier';

export { teamGameLog, regularSeasonGames, weeklyScoreBuckets, seasonsPlayed, countsTowardPoints } from './game-log';
export type { TeamGame } from './game-log';

export { buildSeasonTables, rankSeason, winPctOf, totalGames } from './tables';
export type { SeasonTables, SeasonTotals } from './tables';

export { leagueScoringLevels, seasonIndexes, eraTotalsForAll, eraRanks } from './era';
export type { EraAdjusted, EraTotals, EraRanks, LeagueScoringLevel } from './era';

export { buildIdentity } from './identity';
export type { TeamIdentity } from './identity';

export { careerRecord, seasonLines, leagueRanks, careerTotalsForAll, endOfSeasonStreak } from './records';
export type { CareerRecord, SeasonLine, LeagueRanks, PlayoffOutcome } from './records';

export { luckProfile, CLOSE_GAME_MARGIN, BLOWOUT_MARGIN } from './luck';
export type { LuckProfile, SeasonLuck, AllPlayRecord } from './luck';

export { opponentSplits, rivalryFor, MIN_MEETINGS_FOR_SPLIT } from './opponents';
export type { OpponentSplit, OpponentSummary, RivalryLine } from './opponents';

export { superlatives } from './superlatives';
export type { Superlatives, GameMark, StreakMark, SeasonMark } from './superlatives';

export {
  computePrestige, recencyWeight, starsFor,
  PRESTIGE_WEIGHTS, DECAY_SPAN, DECAY_EXPONENT, DECAY_FLOOR, STAR_PERCENTILES,
} from './prestige';
export type { Prestige, PrestigeSeason, DecaySettings } from './prestige';

export { deriveObservations } from './observations';
export type { Observation } from './observations';

export { buildHonors, computeGroupTitlesFromTables, weeklyHighScores } from './honors';
export type { Honors, TrophyWin } from './honors';
