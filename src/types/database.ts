// Supabase Database Schema Types
//
// IMPORTANT: `teams.team_id` maps to Contentful `jaddlTeam.teamId`. That join is
// what links dynamic league data (Supabase) to static team info (Contentful).
// There is no `teams.id` column — see `src/lib/utils/team-mapping.ts`.
//
// The interfaces below marked "verified" were checked column-by-column against
// the live database. `database.types.ts` is stale and disagrees with several of
// them; this file wins.

/**
 * verified: `teams` really does hold only these two columns. Short name, logo
 * and active status come from Contentful; the owner comes from `team_bios`.
 */
export interface Team {
  team_id: number; // Maps to Contentful jaddlTeam.teamId
  team_name: string;
}

export interface Game {
  id: number;
  year: number; // Actual DB field is 'year' not 'season_year'
  week: number;
  home_team_id: number;
  away_team_id: number;
  home_score: number | null;
  away_score: number | null;
  playoffs?: boolean; // Actual DB field is 'playoffs' not 'is_playoff'
  game_date?: string | null;
  created_at?: string;
  updated_at?: string;
  // Relations
  home_team?: Team;
  away_team?: Team;
}

export interface TeamSeason {
  id: number;
  team_id: number;
  year: number; // Actual DB field is 'year' not 'season_year'
  division_id?: number;
  quad_id?: number;
  active?: boolean; // May not exist
  created_at?: string;
  updated_at?: string;
  // Relations
  team?: Team;
  division?: Division;
  quad?: Quad;
}

export interface LeagueSeason {
  id?: number;
  year: number; // Actual DB field is 'year' not 'season_year'
  team_count: number;
  division_count?: number;
  quad_count?: number;
  playoff_teams?: number;
  is_current?: boolean;
  structure_type?: string; // Added based on DB data
  notes?: string; // Added based on DB data
  created_at?: string;
  updated_at?: string;
}

export interface Division {
  division_id: number;
  division_name: string;
}

export interface Quad {
  quad_id: number;
  quad_name: string;
}

/**
 * verified. Descriptions and images live on the Contentful `jaddlTrophy` entry
 * with a matching `trophyId`, not here.
 *
 * Two ids are load-bearing across the app: 1 is the championship
 * ("Court-Ordered Limousine") and 6 is the weekly high score ("Briefly Badass").
 */
export interface Trophy {
  trophy_id: number;
  trophy_name: string;
}

/** The championship trophy. A team's title years are its trophy_case rows here. */
export const CHAMPIONSHIP_TROPHY_ID = 1;
/**
 * "Surrendered Keys" — awarded to the team that LOSES the final.
 *
 * Paired with the championship trophy this gives a finals record over the full
 * trophy era, which the game log cannot: `games` starts in 2007 and misses the
 * 2003-2006 finals entirely. `pnpm dossier --verify` asserts it against the
 * game-derived runner-up, 19/19.
 *
 * ONE-SIDED COVERAGE, and it matters. Champions are recorded from 2003, but
 * the first Surrendered Keys row is 2007 — the four pre-2007 finals record a
 * winner and no loser. So finals WINS are complete from 2003 while finals
 * LOSSES are only known from 2007, and nothing may claim a team "has never
 * lost a final" over a span the league never wrote down.
 */
export const RUNNER_UP_TROPHY_ID = 2;
/** Weekly high score. Awarded by the Sleeper import; `amount` counts the weeks. */
export const WEEKLY_HIGH_SCORE_TROPHY_ID = 6;

/**
 * verified. Note `amount` is a COUNTER, not a row-per-award: the weekly
 * high-score trophy increments it rather than inserting a row per week, so
 * "how many times has this team won it" is SUM(amount), not COUNT(*).
 *
 * This table runs from 2003, four seasons earlier than `games`. It is therefore
 * the authoritative source for championships — anything derived from the game
 * log necessarily misses 2003-2006.
 */
export interface TrophyCase {
  team_id: number;
  trophy_id: number;
  year: number;
  amount: number;
  // Relations
  trophy?: Trophy;
  team?: Team;
}

/**
 * verified. Rivalries are permanent, not per-season, and each carries its own
 * trophy. There are six, each with exactly two teams.
 */
export interface Rivalry {
  rivalry_id: number;
  rivalry_name: string;
  trophy_id: number;
}

/** verified. Join table; two rows per rivalry. */
export interface Rival {
  team_id: number;
  rivalry_id: number;
  // Relations
  rivalry?: Rivalry;
  team?: Team;
}

/**
 * verified. One row per team, NOT per season — there is no `season_year` column.
 *
 * `owner`, `location` and `first_year` are populated for every active team;
 * `bio` is currently empty everywhere. `first_year` predates the game log (some
 * are 2003-2006), so it is a franchise fact, not a statistical one.
 */
export interface TeamBio {
  team_id: number;
  owner: string;
  location?: string;
  bio?: string | null;
  first_year?: number;
  // Relations
  team?: Team;
}

/**
 * verified. This is a NAME LINEAGE, not a change log — there are no dates and no
 * before/after pair. `franchise_order` runs 0..n over a franchise's former
 * names, e.g. team 3: Bad Newz Kennels -> Leavenworth Law Dogs -> The Return of
 * Ron Mexico.
 *
 * Some rows repeat the team's current name, so consumers must dedupe against
 * `teams.team_name` before presenting these as *former* names.
 */
export interface FranchiseHistory {
  team_id: number;
  franchise_order: number;
  franchise_name: string;
  // Relations
  team?: Team;
}

/**
 * verified. Draft ORDER only — which slot a team held in a year. There are no
 * players, rounds or positions recorded, and the table stops after 2020.
 */
export interface Draft {
  year: number;
  pick: number;
  team_id: number;
  // Relations
  team?: Team;
}

/**
 * verified. A legacy index of the pre-Contentful article archive, keyed by
 * `page_id` strings like "2008_1_1". It carries no titles, slugs or bodies —
 * Contentful `jaddlArticle` is the real article source and supersedes this.
 * Kept as a type only because the table still exists.
 */
export interface Article {
  entry_id: number;
  page_id: string;
  team_id: number;
  feature: boolean;
}

// Derived/Computed Types
export interface TeamRecord {
  team_id: number;
  team: Team;
  year?: number; // Optional for backward compatibility
  wins: number;
  losses: number;
  ties: number;
  points_for: number;
  points_against: number;
  point_differential: number;
  win_percentage: number;
  division_wins?: number;
  division_losses?: number;
  division_ties?: number;
  quad_wins?: number;
  quad_losses?: number;
  quad_ties?: number;
  streak?: string; // Current streak (e.g., "W3", "L2")
}

export interface Standings {
  season_year: number;
  overall: TeamRecord[];
  divisions?: {
    [divisionName: string]: TeamRecord[];
  };
  quads?: {
    [quadName: string]: TeamRecord[];
  };
}

// Playoff seed result from calculation (includes team and record data)
export interface PlayoffSeedResult {
  seed: number;
  team_id: number;
  team: Team;
  teamRecord: TeamRecord;
  isDivisionWinner: boolean;
  isWildcard: boolean;
}

// Playoff seed database row
export interface PlayoffSeedRow {
  id?: number;
  season_year: number;
  team_id: number;
  seed: number;
  is_division_winner: boolean;
  is_wildcard: boolean;
  pod: 'A' | 'B' | null;
  created_at?: string;
  updated_at?: string;
  // Relations
  team?: Team;
}

export interface PlayoffPods {
  podA: {
    seed: number;
    team_id: number;
    team: Team;
  }[];
  podB: {
    seed: number;
    team_id: number;
    team: Team;
  }[];
  byes: {
    seed: number;
    team_id: number;
    team: Team;
  }[];
}

export interface WeeklyMatchup {
  game: Game;
  home_team: Team;
  away_team: Team;
  is_completed: boolean;
  winner?: Team;
  margin_of_victory?: number;
}

export interface SeasonSummary {
  season_year: number;
  league_season: LeagueSeason;
  champion?: Team;
  playoff_teams: Team[];
  regular_season_leader?: Team;
  high_scorer?: {
    team: Team;
    points: number;
    week: number;
  };
  trophy_winners: TrophyCase[];
}
