/**
 * Mapping from Sleeper roster_id to Supabase team_id
 * This maps the Sleeper roster IDs to your internal team IDs
 */
export const ROSTER_ID_TO_TEAM_ID: Record<number, number> = {
  // Add your roster_id to team_id mappings here
  // Example:
  // 1: 1,  // Sleeper roster_id 1 -> Supabase team_id 1
  // 2: 2,  // Sleeper roster_id 2 -> Supabase team_id 2
  // etc...
  1: 1,
  2: 10,
  3: 8,
  4: 12,
  5: 17,
  6: 4,
  7: 3,
  8: 11,
  9: 5,
  10: 6,
  11: 2,
  12: 7,
};

/**
 * Get the Supabase team_id for a given Sleeper roster_id
 */
export function getTeamIdFromRosterId(rosterId: number): number | null {
  return ROSTER_ID_TO_TEAM_ID[rosterId] || null;
}

/**
 * Get all mapped roster IDs
 */
export function getAllMappedRosterIds(): number[] {
  return Object.keys(ROSTER_ID_TO_TEAM_ID).map(Number);
}

/**
 * Validate that all roster IDs in the mapping are valid
 */
export function validateRosterMapping(): { valid: boolean; missing: number[] } {
  const mappedRosterIds = getAllMappedRosterIds();
  const expectedRosterIds = Array.from({ length: 12 }, (_, i) => i + 1); // Assuming 12 teams
  
  const missing = expectedRosterIds.filter(id => !mappedRosterIds.includes(id));
  
  return {
    valid: missing.length === 0,
    missing
  };
}
