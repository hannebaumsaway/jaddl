import { ProcessedTeamProfile } from '@/types/contentful';
import { Team, TeamBio, TeamRecord } from '@/types/database';

/**
 * Utility functions for mapping between Contentful teams and Supabase teams
 * Contentful: Contains static team info (name, logo, yearEstablished, etc.)
 * Supabase: Contains dynamic team data (records, scores, standings, etc.)
 * 
 * The link is: Contentful.teamId === Supabase.teams.team_id. There is no
 * `teams.id` column; matching on one silently produced `undefined` for every
 * team here, which is why owner names read "Unknown Owner" everywhere.
 */

export interface EnrichedTeam extends ProcessedTeamProfile {
  // Add Supabase data to Contentful team
  supabaseData?: Team;
  currentRecord?: TeamRecord;
  ownerName?: string; // From Supabase team_bios
  active?: boolean; // From Contentful — `teams` has no active column
}

/**
 * Merge Contentful team data with Supabase team data
 */
export function enrichTeamsWithSupabaseData(
  contentfulTeams: ProcessedTeamProfile[],
  supabaseTeams: Team[],
  teamRecords?: TeamRecord[],
  teamBios?: TeamBio[]
): EnrichedTeam[] {
  return contentfulTeams.map(contentfulTeam => {
    const supabaseTeam = supabaseTeams.find(
      team => team.team_id === contentfulTeam.teamId
    );

    const currentRecord = teamRecords?.find(
      record => record.team_id === contentfulTeam.teamId
    );

    // Owners live in team_bios, not teams. Pass bios in to populate this.
    const bio = teamBios?.find(b => b.team_id === contentfulTeam.teamId);

    return {
      ...contentfulTeam,
      supabaseData: supabaseTeam,
      currentRecord,
      ownerName: bio?.owner,
      active: contentfulTeam.active ?? true,
    };
  });
}

/**
 * Get team display data prioritizing Contentful over Supabase
 */
export function getTeamDisplayData(team: EnrichedTeam) {
  return {
    id: team.id, // Contentful ID for routing
    teamId: team.teamId, // Supabase ID for data queries
    name: team.teamName || team.supabaseData?.team_name || 'Unknown Team',
    shortName: team.shortName || 'TBD',
    logo: team.logo || undefined, // Contentful logo takes priority
    ownerName: team.ownerName || 'Unknown Owner',
    yearEstablished: team.yearEstablished,
    active: team.active ?? true,
    // Current season stats from Supabase
    record: team.currentRecord ? {
      wins: team.currentRecord.wins,
      losses: team.currentRecord.losses,
      ties: team.currentRecord.ties,
      winPercentage: team.currentRecord.win_percentage,
    } : undefined,
    points: team.currentRecord ? {
      pointsFor: team.currentRecord.points_for,
      pointsAgainst: team.currentRecord.points_against,
      differential: team.currentRecord.point_differential,
    } : undefined,
  };
}

/**
 * Find team by Supabase ID from enriched teams array
 */
export function findTeamBySupabaseId(
  teams: EnrichedTeam[], 
  supabaseId: number
): EnrichedTeam | undefined {
  return teams.find(team => team.teamId === supabaseId);
}

/**
 * Find team by Contentful ID from enriched teams array
 */
export function findTeamByContentfulId(
  teams: EnrichedTeam[], 
  contentfulId: string
): EnrichedTeam | undefined {
  return teams.find(team => team.id === contentfulId);
}

/**
 * Sort teams by current standings (wins, then point differential)
 */
export function sortTeamsByStandings(teams: EnrichedTeam[]): EnrichedTeam[] {
  return [...teams].sort((a, b) => {
    const aRecord = a.currentRecord;
    const bRecord = b.currentRecord;
    
    if (!aRecord && !bRecord) return 0;
    if (!aRecord) return 1;
    if (!bRecord) return -1;
    
    // Sort by wins descending
    if (aRecord.wins !== bRecord.wins) {
      return bRecord.wins - aRecord.wins;
    }
    
    // If wins are equal, sort by point differential descending
    return bRecord.point_differential - aRecord.point_differential;
  });
}

/**
 * Get teams missing Contentful data (in Supabase but not in Contentful)
 */
export function findMissingContentfulTeams(
  contentfulTeams: ProcessedTeamProfile[],
  supabaseTeams: Team[]
): Team[] {
  const contentfulTeamIds = contentfulTeams.map(team => team.teamId);
  return supabaseTeams.filter(team => !contentfulTeamIds.includes(team.team_id));
}

/**
 * Get teams missing Supabase data (in Contentful but not in Supabase)
 */
export function findMissingSupabaseTeams(
  contentfulTeams: ProcessedTeamProfile[],
  supabaseTeams: Team[]
): ProcessedTeamProfile[] {
  const supabaseTeamIds = supabaseTeams.map(team => team.team_id);
  return contentfulTeams.filter(team => !supabaseTeamIds.includes(team.teamId));
}
