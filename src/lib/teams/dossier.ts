/**
 * loadTeamDossier — everything the site knows about one franchise.
 *
 * This is the single entry point a team page should use. It runs one
 * `loadLeagueHistory()` (five queries covering every game ever played) plus a
 * handful of team-scoped lookups, then derives the rest in memory. The league
 * is ~1600 games, so the computation is trivial next to the round trips.
 *
 * The point of collecting it here is that the existing team page derives all of
 * this inline, and gets several of them wrong — career records that count
 * playoff games, a streak walk that sorts playoff rounds among September weeks.
 * Everything below goes through one set of filters, stated in game-log.ts.
 */

import {
  loadLeagueHistory,
  computeGroupTitles,
  type LeagueHistoryData,
  type GroupTitle,
} from '../briefs/history';
import {
  getTeams,
  getTeamBio,
  getFranchiseHistory,
  getDraftHistory,
  getTrophyCase,
} from '../supabase/api';
import { getTeamProfiles } from '../contentful/api';
import type { Draft, TrophyCase } from '@/types/database';

import { teamGameLog, regularSeasonGames, seasonsPlayed, type TeamGame } from './game-log';
import { buildSeasonTables, type SeasonTables } from './tables';
import { buildIdentity, type TeamIdentity } from './identity';
import {
  careerRecord,
  seasonLines,
  leagueRanks,
  type CareerRecord,
  type SeasonLine,
  type LeagueRanks,
} from './records';
import { luckProfile, type LuckProfile } from './luck';
import {
  opponentSplits,
  rivalryFor,
  type OpponentSummary,
  type RivalryLine,
} from './opponents';
import { superlatives, type Superlatives } from './superlatives';
import { buildHonors, computeGroupTitlesFromTables, type Honors } from './honors';
import { computePrestige, type Prestige } from './prestige';

export interface DraftProfile {
  /** Draft order is only recorded for these seasons. */
  era: { from: number; to: number };
  picks: { year: number; pick: number }[];
  averagePick: number;
  earliest: { year: number; pick: number } | null;
  latest: { year: number; pick: number } | null;
}

export interface TeamDossier {
  identity: TeamIdentity;
  career: CareerRecord;
  ranks: LeagueRanks;
  seasons: SeasonLine[];
  honors: Honors;
  luck: LuckProfile;
  opponents: OpponentSummary;
  rivalry: RivalryLine | null;
  superlatives: Superlatives;
  /** The last ten regular-season games, oldest first. */
  recentForm: TeamGame[];
  /** 1-5 stars, weighted toward recent seasons. See prestige.ts. */
  prestige: Prestige;
  draft: DraftProfile | null;
  /** Plain-language statement of which era each figure covers. */
  eraNote: string;
  /**
   * Where two sources of the same fact disagree. Always inspect a non-empty
   * one — it means a schema or semantics assumption has drifted.
   */
  crossChecks: {
    championshipDisagreements: number[];
    /** Group-title years where the briefs implementation picks a different winner. */
    groupTitleDisagreements: number[];
  };
}

function buildDraftProfile(rows: Draft[]): DraftProfile | null {
  const picks = rows
    .filter(r => r.year != null && r.pick != null)
    .map(r => ({ year: r.year, pick: r.pick }))
    .sort((a, b) => a.year - b.year);
  if (picks.length === 0) return null;

  const years = picks.map(p => p.year);
  const bySlot = [...picks].sort((a, b) => a.pick - b.pick || a.year - b.year);

  return {
    era: { from: Math.min(...years), to: Math.max(...years) },
    picks,
    averagePick: Math.round((picks.reduce((a, p) => a + p.pick, 0) / picks.length) * 100) / 100,
    earliest: bySlot[0] ?? null,
    latest: bySlot[bySlot.length - 1] ?? null,
  };
}

/** Years the two group-title implementations name a different winner. */
function compareGroupTitles(mine: GroupTitle[], theirs: GroupTitle[]): number[] {
  const a = new Set(mine.map(t => `${t.year}:${t.groupName}`));
  const b = new Set(theirs.map(t => `${t.year}:${t.groupName}`));
  const years = new Set<number>();
  for (const k of a) if (!b.has(k)) years.add(Number(k.split(':')[0]));
  for (const k of b) if (!a.has(k)) years.add(Number(k.split(':')[0]));
  return [...years].sort((x, y) => x - y);
}

export async function loadTeamDossier(teamId: number): Promise<TeamDossier | null> {
  const [history, teams, bio, franchiseNames, trophyCase, drafts, profiles] =
    await Promise.all([
      loadLeagueHistory(),
      getTeams(),
      getTeamBio(teamId),
      getFranchiseHistory(teamId),
      getTrophyCase(undefined, teamId),
      getDraftHistory(undefined, teamId),
      getTeamProfiles().catch(() => []),
    ]);

  const team = teams.find(t => t.team_id === teamId) ?? null;
  const profile = profiles.find(p => p.teamId === teamId) ?? null;
  // A franchise with neither a Supabase row nor a Contentful entry is not a team.
  if (!team && !profile) return null;

  return assembleDossier({
    teamId,
    history,
    teamNames: new Map(teams.map(t => [t.team_id, t.team_name])),
    team,
    profile,
    bio,
    franchiseNames,
    trophyCase,
    drafts,
    rivalry: null,
    resolveRivalry: true,
  });
}

/**
 * The pure half of the dossier, split out so the CLI and any batch consumer can
 * build several teams from one `loadLeagueHistory()` instead of one each.
 */
export async function assembleDossier(params: {
  teamId: number;
  history: LeagueHistoryData;
  teamNames: Map<number, string>;
  team: Parameters<typeof buildIdentity>[0]['team'];
  profile: Parameters<typeof buildIdentity>[0]['profile'];
  bio: Parameters<typeof buildIdentity>[0]['bio'];
  franchiseNames: Parameters<typeof buildIdentity>[0]['franchiseNames'];
  trophyCase: TrophyCase[];
  drafts: Draft[];
  rivalry: RivalryLine | null;
  resolveRivalry: boolean;
  tables?: SeasonTables;
  briefsGroupTitles?: Map<number, GroupTitle[]>;
}): Promise<TeamDossier> {
  const { teamId, history, teamNames, trophyCase, drafts } = params;

  const tables = params.tables ?? buildSeasonTables(history);
  const log: TeamGame[] = teamGameLog(history, teamId);
  const seasons = seasonsPlayed(log);

  const latestLeagueSeason = tables.years.length > 0 ? tables.years[tables.years.length - 1] : null;

  const identity = buildIdentity({
    teamId,
    team: params.team,
    bio: params.bio,
    franchiseNames: params.franchiseNames,
    profile: params.profile,
    seasons,
    completedSeasons: seasons.filter(
      y => tables.progress.get(y)?.regularSeasonComplete ?? true
    ),
    latestLeagueSeason,
  });

  const groupTitleMap = computeGroupTitlesFromTables(history, tables);
  const groupTitles = groupTitleMap.get(teamId) ?? [];

  const briefsTitles = params.briefsGroupTitles ?? computeGroupTitles(history);
  const groupTitleDisagreements = compareGroupTitles(
    groupTitles,
    briefsTitles.get(teamId) ?? []
  );

  const honors = buildHonors(history, tables, teamId, trophyCase, groupTitles);
  const opponents = opponentSplits(log, teamNames);
  const rivalry = params.resolveRivalry
    ? await rivalryFor(teamId, opponents.splits)
    : params.rivalry;

  const seasonLineList = seasonLines(history, tables, log, teamId);

  const prestige = computePrestige({
    seasons: seasonLineList,
    honors,
    tables,
    teamId,
    latestSeason: latestLeagueSeason ?? new Date().getFullYear(),
  });

  const draft = buildDraftProfile(drafts);

  // The franchise's own first season, not the league's — a team that joined in
  // 2017 should not be told its records begin in 2007.
  const firstGameYear = identity.firstSeasonWithGames;
  const firstTrophyYear = trophyCase.length > 0 ? Math.min(...trophyCase.map(t => t.year)) : null;
  const eraNote = [
    firstGameYear ? `Game records begin in ${firstGameYear}.` : 'No games recorded.',
    // Only worth saying when this franchise actually has trophies the game log
    // cannot account for.
    firstTrophyYear !== null && firstGameYear !== null && firstTrophyYear < firstGameYear
      ? `Trophies date to ${firstTrophyYear}, so titles here predate the game log.`
      : null,
    draft ? `Draft order is recorded for ${draft.era.from}-${draft.era.to} only.` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    identity,
    career: careerRecord(tables, log, teamId),
    ranks: leagueRanks(tables, teamId),
    seasons: seasonLineList,
    honors,
    luck: luckProfile(history, tables, teamId),
    opponents,
    rivalry,
    superlatives: superlatives(history, tables, log, teamId, teamNames),
    recentForm: regularSeasonGames(log).slice(-10),
    prestige,
    draft,
    eraNote,
    crossChecks: {
      championshipDisagreements: honors.championshipDisagreements,
      groupTitleDisagreements,
    },
  };
}
