/**
 * Sleeper API integration for fetching league data
 * Based on: https://docs.sleeper.com/#introduction
 */

const SLEEPER_BASE_URL = 'https://api.sleeper.app/v1';
const LEAGUE_ID = '1257480060521152513';

export interface SleeperMatchup {
  starters: string[];
  roster_id: number;
  players: string[];
  matchup_id: number;
  points: number;
  custom_points?: number;
}

export interface SleeperLeague {
  total_rosters: number;
  status: string;
  sport: string;
  season: string;
  season_type: string;
  league_id: string;
  name: string;
}

export interface SleeperUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar: string;
  metadata?: {
    team_name?: string;
  };
  is_owner: boolean;
}

/**
 * Fetch league information
 */
export async function getLeagueInfo(): Promise<SleeperLeague | null> {
  try {
    const response = await fetch(`${SLEEPER_BASE_URL}/league/${LEAGUE_ID}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching league info:', error);
    return null;
  }
}

/**
 * Fetch all users in the league
 */
export async function getLeagueUsers(): Promise<SleeperUser[]> {
  try {
    const response = await fetch(`${SLEEPER_BASE_URL}/league/${LEAGUE_ID}/users`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching league users:', error);
    return [];
  }
}

/**
 * Fetch matchups for a specific week
 */
export async function getMatchups(week: number): Promise<SleeperMatchup[]> {
  try {
    const response = await fetch(`${SLEEPER_BASE_URL}/league/${LEAGUE_ID}/matchups/${week}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching matchups for week ${week}:`, error);
    return [];
  }
}

/**
 * Get NFL state to determine current season and week
 */
export async function getNFLState(): Promise<any> {
  try {
    const response = await fetch(`${SLEEPER_BASE_URL}/state/nfl`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching NFL state:', error);
    return null;
  }
}

/**
 * Process matchups into game pairs
 * Sleeper returns individual roster scores, we need to pair them into games
 */
export function processMatchupsIntoGames(matchups: SleeperMatchup[]): Array<{
  matchup_id: number;
  away_roster_id: number;
  home_roster_id: number;
  away_score: number;
  home_score: number;
}> {
  const games: Array<{
    matchup_id: number;
    away_roster_id: number;
    home_roster_id: number;
    away_score: number;
    home_score: number;
  }> = [];

  // Group matchups by matchup_id
  const matchupGroups = matchups.reduce((groups, matchup) => {
    if (!groups[matchup.matchup_id]) {
      groups[matchup.matchup_id] = [];
    }
    groups[matchup.matchup_id].push(matchup);
    return groups;
  }, {} as Record<number, SleeperMatchup[]>);

  // Process each matchup group into a game
  Object.entries(matchupGroups).forEach(([matchupId, matchupPair]) => {
    if (matchupPair.length === 2) {
      const [away, home] = matchupPair;
      games.push({
        matchup_id: parseInt(matchupId),
        away_roster_id: away.roster_id,
        home_roster_id: home.roster_id,
        away_score: away.points,
        home_score: home.points,
      });
    }
  });

  return games;
}
