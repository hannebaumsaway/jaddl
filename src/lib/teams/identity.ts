/**
 * Who the franchise is, as opposed to how it has played.
 *
 * This is assembled from three places because no single one has it: the name
 * from Supabase `teams`, the owner/location/first year from `team_bios`, the
 * short name and logo from Contentful `jaddlTeam`, and the former names from
 * `franchise_history`.
 *
 * All of it is optional. The four defunct franchises have neither a bio nor a
 * Contentful entry, and they still have real records.
 */

import type { ProcessedTeamProfile } from '@/types/contentful';
import type { Team, TeamBio, FranchiseHistory } from '@/types/database';

export interface TeamIdentity {
  teamId: number;
  currentName: string;
  /** Former names, oldest first, deduped against the current one. */
  formerNames: string[];
  shortName: string | null;
  logo: { url: string; alt: string; width?: number; height?: number } | null;
  owner: string | null;
  location: string | null;
  /**
   * The franchise's first year per team_bios. Some are 2003-2006 and so predate
   * the game log entirely — this is a franchise fact, not a statistical one.
   */
  firstYear: number | null;
  /** Contentful's founding year, which may disagree with `firstYear`. */
  yearEstablished: number | null;
  isActive: boolean;
  isDefunct: boolean;
  /**
   * COMPLETED seasons only. This is the denominator for every rate on the
   * page — "seven berths in nineteen seasons" must not count a season that is
   * one week old and could still produce a berth.
   */
  seasonsPlayed: number;
  /** The season currently being played, if one is. Never counted above. */
  liveSeason: number | null;
  firstSeasonWithGames: number | null;
  lastSeasonWithGames: number | null;
}

/** Loose comparison so "The Lanniesters" does not read as a former "Lanniesters". */
const normalize = (s: string) =>
  s.toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]/g, '');

export function buildIdentity(params: {
  teamId: number;
  team: Team | null;
  bio: TeamBio | null;
  franchiseNames: FranchiseHistory[];
  profile: ProcessedTeamProfile | null;
  seasons: number[];
  /** Of `seasons`, the ones whose regular season has finished. */
  completedSeasons: number[];
  /** The newest season anywhere in the league that has games. */
  latestLeagueSeason: number | null;
}): TeamIdentity {
  const { teamId, team, bio, franchiseNames, profile, seasons, completedSeasons, latestLeagueSeason } = params;

  const currentName = profile?.teamName || team?.team_name || `Team ${teamId}`;
  const currentKey = normalize(currentName);
  const supabaseKey = team?.team_name ? normalize(team.team_name) : null;

  const formerNames: string[] = [];
  for (const row of [...franchiseNames].sort((a, b) => a.franchise_order - b.franchise_order)) {
    const name = row.franchise_name;
    if (!name) continue;
    const key = normalize(name);
    if (key === currentKey || key === supabaseKey) continue;
    if (formerNames.some(n => normalize(n) === key)) continue;
    formerNames.push(name);
  }

  const firstSeasonWithGames = seasons.length > 0 ? seasons[0] : null;
  const lastSeasonWithGames = seasons.length > 0 ? seasons[seasons.length - 1] : null;

  // Contentful is the authority on active status; `teams` has no such column.
  // Where there is no Contentful entry at all, fall back to "did they play in
  // the league's most recent season".
  const playedMostRecent =
    latestLeagueSeason !== null && lastSeasonWithGames === latestLeagueSeason;
  const isActive = profile ? (profile.active ?? true) : playedMostRecent;

  return {
    teamId,
    currentName,
    formerNames,
    shortName: profile?.shortName ?? null,
    logo: profile?.logo ?? null,
    owner: bio?.owner ?? null,
    location: bio?.location ?? null,
    firstYear: bio?.first_year ?? null,
    yearEstablished: profile?.yearEstablished ?? null,
    isActive,
    isDefunct: !isActive,
    seasonsPlayed: completedSeasons.length,
    liveSeason: seasons.find(y => !completedSeasons.includes(y)) ?? null,
    firstSeasonWithGames,
    lastSeasonWithGames,
  };
}
