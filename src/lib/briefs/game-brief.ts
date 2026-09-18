/**
 * Game briefs: everything known about one matchup, assembled as structured
 * facts for article generation.
 *
 * The point of this module is the split it enforces. Facts are gathered here,
 * deterministically, from Supabase and Sleeper. Prose is written elsewhere.
 * A generator that has to look up a player id, or guess whether a result was
 * unusual, will invent things; one handed a brief will not.
 *
 * The brief is anchored on the SUPABASE game row, which is authoritative for
 * scores and exists for every season since 2007. Sleeper lineups are attached
 * opportunistically — Sleeper only goes back to 2023, so older briefs carry
 * history and scoring but no player detail.
 */

import { supabase } from '../supabase/client';
import { getPlayers, type NflPlayer } from '../sleeper/players';
import {
  loadNflWeek, findPlayer, statLine, gameLine, playerNotes, defenseNotes,
  type NflWeek,
} from '../nfl/espn';
import { getPlayoffRoundLabel, getSeasonConfig, countsTowardRecord, type SeasonConfig } from '../supabase/api';
import {
  loadLeagueHistory,
  computeGroupTitles,
  computeChampionships,
  computeClinch,
  scoreContext,
  type ClinchResult,
  type GroupTitle,
} from './history';
import {
  recordCohort,
  startLadder,
  gameExtremes,
  streakRarity,
  type RecordCohort,
  type StartLadder,
  type GameExtremes,
  type StreakRarity,
} from './cohorts';

/* ------------------------------------------------------------------ types */

export interface BriefTeamSide {
  teamId: number;
  name: string;
  shortName: string | null;
  score: number;
  /** Record in this season BEFORE this game, regular season only. */
  recordBefore: string;
  /** Record in this season INCLUDING this game. */
  recordAfter: string;
  /** Result streak this game produced, e.g. "W3". */
  streakAfter: string;
}

export interface BriefPlayerLine {
  name: string;
  position: string | null;
  nflTeam: string | null;
  points: number;
  /**
   * What actually happened on the field. Null when the NFL week could not be
   * loaded or the player did not match a box score — never guessed.
   */
  real: { statLine: string | null; game: string; notes: string[] } | null;
  /** This player's mean starter score across the season, or null if unknown. */
  seasonAverage: number | null;
  /** points / seasonAverage; >1 is an overperformance. Null when no average. */
  vsAverage: number | null;
}

export interface BriefLineup {
  teamId: number;
  starters: BriefPlayerLine[];
  /** Total points scored by players left on the bench. */
  benchPoints: number;
  /** Highest-scoring benched player, if any. */
  topBenched: BriefPlayerLine | null;
}

export interface BriefAngle {
  kind: string;
  /** A plain statement of fact. Never phrasing to reuse verbatim. */
  text: string;
}

export interface GameBrief {
  meta: {
    year: number;
    week: number;
    isPlayoff: boolean;
    label: string;
    lineupsAvailable: boolean;
    generatedAt: string;
  };
  result: {
    winner: BriefTeamSide;
    loser: BriefTeamSide;
    margin: number;
    isTie: boolean;
    /**
     * Sleeper's two-decimal scores, when a lineup matched. Supabase rounds to
     * one decimal, so these are the figures past articles actually quoted.
     */
    exactScores: { winner: number; loser: number } | null;
  };
  series: {
    /** All-time record BEFORE this game, from the winner's perspective. */
    beforeWinnerWins: number;
    beforeLoserWins: number;
    ties: number;
    afterWinnerWins: number;
    afterLoserWins: number;
    meetings: number;
    rivalryName: string | null;
    rivalryTrophy: string | null;
  };
  week: {
    highScore: number;
    lowScore: number;
    averageScore: number;
    gamesPlayed: number;
    /** How the loser's score ranked among all scores that week (1 = highest). */
    loserScoreRankInWeek: number;
    /** How this game's margin ranked (1 = biggest blowout of the week). */
    marginRankInWeek: number;
  };
  lineups: { winner: BriefLineup; loser: BriefLineup } | null;
  /** True when real NFL box scores were attached to the lineups. */
  nflContextAvailable: boolean;
  /** Sleeper display names, when a lineup matched. Articles name owners. */
  owners: { winner: string | null; loser: string | null };
  history: {
    winnerGroupTitles: GroupTitle[];
    loserGroupTitles: GroupTitle[];
    winnerChampionships: number[];
    loserChampionships: number[];
    /** Where the winning score sits in the season, and all-time if notable. */
    winnerScoreRankInSeason: number;
    winnerScoreRankAllTime: number | null;
    loserScoreRankInSeason: number;
  };
  /** Set when this result mathematically secured a division/quad title. */
  clinch: ClinchResult | null;
  /** "Has this ever happened before" — precedent drawn from every season. */
  cohorts: {
    winnerRecord: RecordCohort;
    loserRecord: RecordCohort;
    winnerStart: StartLadder | null;
    loserStart: StartLadder | null;
    game: GameExtremes;
    winnerStreak: StreakRarity | null;
    loserStreak: StreakRarity | null;
  };
  angles: BriefAngle[];
}

/* ------------------------------------------------------------- supabase */

interface GameRow {
  id: number;
  year: number;
  week: number;
  playoffs: boolean;
  home_team_id: number;
  away_team_id: number;
  home_score: number | null;
  away_score: number | null;
}

/** `teams` carries only these two columns; short names come from Contentful. */
interface TeamRow {
  team_id: number;
  team_name: string;
}

async function fetchSeasonGames(year: number): Promise<GameRow[]> {
  const { data, error } = await supabase.from('games').select('*').eq('year', year);
  if (error) throw new Error(`games query failed: ${error.message}`);
  return (data || []) as unknown as GameRow[];
}

async function fetchTeams(): Promise<Map<number, TeamRow>> {
  const { data, error } = await supabase.from('teams').select('*');
  if (error) throw new Error(`teams query failed: ${error.message}`);
  return new Map(((data || []) as unknown as TeamRow[]).map(t => [t.team_id, t]));
}

/** Named rivalry shared by exactly these two teams, with its trophy. */
async function fetchRivalry(
  teamA: number,
  teamB: number
): Promise<{ name: string; trophy: string | null } | null> {
  const { data: rivals } = await (supabase.from('rivals') as any)
    .select('team_id, rivalry_id')
    .in('team_id', [teamA, teamB]);

  const byRivalry = new Map<number, Set<number>>();
  for (const r of (rivals || []) as { team_id: number; rivalry_id: number }[]) {
    if (!byRivalry.has(r.rivalry_id)) byRivalry.set(r.rivalry_id, new Set());
    byRivalry.get(r.rivalry_id)!.add(r.team_id);
  }
  const shared = [...byRivalry.entries()].find(([, ids]) => ids.has(teamA) && ids.has(teamB));
  if (!shared) return null;

  const { data: rivalry } = await (supabase.from('rivalries') as any)
    .select('rivalry_name, trophy_id')
    .eq('rivalry_id', shared[0])
    .maybeSingle();
  if (!rivalry) return null;

  let trophy: string | null = null;
  if (rivalry.trophy_id) {
    const { data: t } = await (supabase.from('trophies') as any)
      .select('trophy_name')
      .eq('trophy_id', rivalry.trophy_id)
      .maybeSingle();
    trophy = t?.trophy_name ?? null;
  }
  return { name: rivalry.rivalry_name, trophy };
}

/* --------------------------------------------------------------- sleeper */

const SLEEPER = 'https://api.sleeper.app/v1';

/** Walk `previous_league_id` back from the current league to find a season. */
export async function findLeagueIdForSeason(
  season: number,
  startLeagueId: string
): Promise<string | null> {
  let id: string | null = startLeagueId;
  for (let hops = 0; hops < 20 && id; hops++) {
    const res: Response = await fetch(`${SLEEPER}/league/${id}`);
    if (!res.ok) return null;
    const league = (await res.json()) as { season?: string; previous_league_id?: string | null };
    if (Number(league.season) === season) return id;
    id = league.previous_league_id || null;
  }
  return null;
}

interface SleeperMatchupRaw {
  roster_id: number;
  matchup_id: number;
  points: number;
  starters: string[];
  starters_points: number[];
  players: string[];
  players_points: Record<string, number>;
}

/* ---------------------------------------------------------------- helpers */

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Record through a given week. Games are filtered by `countsTowardRecord`, the
 * same predicate calculateStandings uses — a season like 2025, whose Week 14
 * play-in scored points but no W-L, must be excluded here too or the brief
 * disagrees with the standings page.
 */
function recordThrough(
  games: GameRow[],
  teamId: number,
  upToWeek: number,
  inclusive: boolean,
  config: SeasonConfig
): { w: number; l: number; t: number } {
  let w = 0, l = 0, t = 0;
  for (const g of games) {
    if (!countsTowardRecord(g as any, config)) continue;
    if (inclusive ? g.week > upToWeek : g.week >= upToWeek) continue;
    if (g.home_score === null || g.away_score === null) continue;
    const isHome = g.home_team_id === teamId;
    const isAway = g.away_team_id === teamId;
    if (!isHome && !isAway) continue;
    const mine = isHome ? g.home_score : g.away_score;
    const theirs = isHome ? g.away_score : g.home_score;
    if (mine > theirs) w++;
    else if (mine < theirs) l++;
    else t++;
  }
  return { w, l, t };
}

function streakThrough(
  games: GameRow[],
  teamId: number,
  upToWeek: number,
  config: SeasonConfig
): string {
  const mine = games
    .filter(g => countsTowardRecord(g as any, config) && g.week <= upToWeek &&
                 g.home_score !== null && g.away_score !== null)
    .filter(g => g.home_team_id === teamId || g.away_team_id === teamId)
    .sort((a, b) => a.week - b.week);

  let type: string | null = null;
  let count = 0;
  for (let i = mine.length - 1; i >= 0; i--) {
    const g = mine[i];
    const isHome = g.home_team_id === teamId;
    const me = isHome ? g.home_score! : g.away_score!;
    const opp = isHome ? g.away_score! : g.home_score!;
    const r = me > opp ? 'W' : me < opp ? 'L' : 'T';
    if (type === null) { type = r; count = 1; }
    else if (type === r) count++;
    else break;
  }
  return type ? `${type}${count}` : '-';
}

/* ------------------------------------------------------------------ main */

export interface BuildBriefParams {
  year: number;
  week: number;
  /** One of the two teams. The opponent is inferred from the schedule. */
  teamId: number;
  isPlayoff?: boolean;
  /** Current Sleeper league id, used to walk back to the requested season. */
  sleeperLeagueId?: string;
}

export async function buildGameBrief(params: BuildBriefParams): Promise<GameBrief> {
  const { year, week, teamId, isPlayoff = false } = params;

  const seasonConfig = getSeasonConfig(year);
  const [seasonGames, teams] = await Promise.all([fetchSeasonGames(year), fetchTeams()]);

  const game = seasonGames.find(
    g =>
      g.week === week &&
      !!g.playoffs === isPlayoff &&
      (g.home_team_id === teamId || g.away_team_id === teamId)
  );
  if (!game) {
    // The most likely cause in-season is simply that the week has not been
    // imported yet — the brief reads Supabase, not Sleeper, for the result.
    const weeksPresent = [...new Set(
      seasonGames.filter(g => !!g.playoffs === isPlayoff).map(g => g.week)
    )].sort((a, b) => a - b);
    const hint = weeksPresent.length
      ? `${year} has ${isPlayoff ? 'rounds' : 'weeks'} ${weeksPresent.join(', ')} recorded.` +
        (!isPlayoff && week > Math.max(...weeksPresent)
          ? ` Week ${week} looks un-imported — run the score import first.`
          : '')
      : `No ${year} games are recorded at all — import the season first.`;
    throw new Error(
      `No ${isPlayoff ? 'playoff' : 'regular-season'} game for team ${teamId} in ${year} week ${week}. ${hint}`
    );
  }
  if (game.home_score === null || game.away_score === null) {
    throw new Error(`Game ${game.id} has no recorded score`);
  }

  const homeWon = game.home_score > game.away_score;
  const isTie = game.home_score === game.away_score;
  const winnerId = homeWon ? game.home_team_id : game.away_team_id;
  const loserId = homeWon ? game.away_team_id : game.home_team_id;
  const winnerScore = homeWon ? game.home_score : game.away_score;
  const loserScore = homeWon ? game.away_score : game.home_score;

  // For a playoff game, `week` holds the ROUND (1-3). Comparing that against
  // regular-season week numbers would count only weeks 1-3 — which reported
  // the 2025 champion as 1-1 with a two-game losing streak. Playoff briefs
  // therefore carry the FULL regular-season record, which playoffs never change.
  const cutoff = isPlayoff ? Number.MAX_SAFE_INTEGER : week;

  const side = (id: number, score: number): BriefTeamSide => {
    const t = teams.get(id);
    const before = recordThrough(seasonGames, id, cutoff, isPlayoff ? true : false, seasonConfig);
    const after = recordThrough(seasonGames, id, cutoff, true, seasonConfig);
    return {
      teamId: id,
      name: t?.team_name ?? `Team ${id}`,
      shortName: null,
      score,
      recordBefore: `${before.w}-${before.l}-${before.t}`,
      recordAfter: `${after.w}-${after.l}-${after.t}`,
      streakAfter: streakThrough(seasonGames, id, cutoff, seasonConfig),
    };
  };

  const winner = side(winnerId, winnerScore);
  const loser = side(loserId, loserScore);
  const margin = round1(Math.abs(winnerScore - loserScore));

  /* ---- all-time series, across every season, regular season and playoffs -- */
  const { data: allMeetings } = await supabase
    .from('games')
    .select('year, week, playoffs, home_team_id, away_team_id, home_score, away_score')
    .or(
      `and(home_team_id.eq.${winnerId},away_team_id.eq.${loserId}),` +
      `and(home_team_id.eq.${loserId},away_team_id.eq.${winnerId})`
    );

  let bw = 0, bl = 0, ties = 0;
  for (const m of ((allMeetings || []) as unknown as GameRow[])) {
    if (m.home_score === null || m.away_score === null) continue;
    // Everything strictly before this game, by (year, then week).
    const isEarlier = m.year < year || (m.year === year && m.week < week);
    if (!isEarlier) continue;
    const winnerIsHome = m.home_team_id === winnerId;
    const wS = winnerIsHome ? m.home_score : m.away_score;
    const lS = winnerIsHome ? m.away_score : m.home_score;
    if (wS > lS) bw++;
    else if (wS < lS) bl++;
    else ties++;
  }

  const rivalry = await fetchRivalry(winnerId, loserId);

  /* ------------------------------------------------- the rest of the week */
  const weekGames = seasonGames.filter(
    g => g.week === week && !!g.playoffs === isPlayoff && g.home_score !== null && g.away_score !== null
  );
  const weekScores = weekGames.flatMap(g => [g.home_score!, g.away_score!]).sort((a, b) => b - a);
  const weekMargins = weekGames
    .map(g => Math.abs(g.home_score! - g.away_score!))
    .sort((a, b) => b - a);

  /* ---------------------------------------------------- sleeper lineups */
  let lineups: GameBrief['lineups'] = null;
  let sleeperScores: { winner: number; loser: number } | null = null;
  let owners: { winner: string | null; loser: string | null } = { winner: null, loser: null };

  // Owner first names live in team_bios ("Ryan", "Ian"). Sleeper only exposes
  // usernames ("badnewsbensons"), which is not how the articles refer to people.
  try {
    const { data: bios } = await (supabase.from('team_bios') as any)
      .select('team_id, owner')
      .in('team_id', [winnerId, loserId]);
    const byTeam = new Map<number, string>(
      ((bios || []) as { team_id: number; owner: string | null }[])
        .filter(b => b.owner)
        .map(b => [b.team_id, b.owner as string])
    );
    owners = { winner: byTeam.get(winnerId) ?? null, loser: byTeam.get(loserId) ?? null };
  } catch {
    // Owner names are a nicety; never fail the brief for them.
  }
  const leagueId = params.sleeperLeagueId;
  if (leagueId && !isPlayoff) {
    try {
      const seasonLeagueId = await findLeagueIdForSeason(year, leagueId);
      if (seasonLeagueId) {
        const matchups = (await fetch(
          `${SLEEPER}/league/${seasonLeagueId}/matchups/${week}`
        ).then(r => r.json())) as SleeperMatchupRaw[];

        // Attach by score rather than a hand-written roster map, so a
        // mismatch yields "no lineup" instead of a silently wrong one.
        //
        // Supabase stores scores rounded to one decimal (167.5) while Sleeper
        // keeps two (167.45), so this matches within a tolerance — and
        // matches the PAIR inside a single Sleeper matchup_id rather than each
        // score independently, which is far harder to satisfy by coincidence.
        const TOL = 0.06;
        const byMatchup = new Map<number, SleeperMatchupRaw[]>();
        for (const m of matchups) {
          if (!byMatchup.has(m.matchup_id)) byMatchup.set(m.matchup_id, []);
          byMatchup.get(m.matchup_id)!.push(m);
        }
        const pairs = [...byMatchup.values()].filter(pair => {
          if (pair.length !== 2) return false;
          const [x, y] = pair;
          return (
            (Math.abs(x.points - winnerScore) <= TOL && Math.abs(y.points - loserScore) <= TOL) ||
            (Math.abs(y.points - winnerScore) <= TOL && Math.abs(x.points - loserScore) <= TOL)
          );
        });

        if (pairs.length === 1) {
          const [x, y] = pairs[0];
          const wM = [Math.abs(x.points - winnerScore) <= TOL ? x : y];
          const lM = [wM[0] === x ? y : x];
          const seasonAverages = await computeSeasonAverages(seasonLeagueId, week, week);

          // JADDL week N is NFL week N. A failure here must not fail the brief:
          // league facts are the point, real-world colour is enrichment.
          let nflWeek: NflWeek | null = null;
          if (!isPlayoff) {
            try { nflWeek = await loadNflWeek(year, week); }
            catch { nflWeek = null; }
          }
          const ids = [...new Set([...wM[0].starters, ...lM[0].starters,
                                   ...wM[0].players, ...lM[0].players])];
          const players = await getPlayers(ids);
          lineups = {
            winner: toLineup(winnerId, wM[0], players, seasonAverages, nflWeek),
            loser: toLineup(loserId, lM[0], players, seasonAverages, nflWeek),
          };
          // Sleeper carries two decimals where Supabase rounds to one; the
          // finer figure is what actually got published in past articles.
          sleeperScores = { winner: wM[0].points, loser: lM[0].points };

          // Articles refer to owners by name ("Ian", "Lannie"), which lives in
          // Sleeper's users endpoint rather than in the league database.
          try {
            const [rosters, users] = await Promise.all([
              fetch(`${SLEEPER}/league/${seasonLeagueId}/rosters`).then(r => r.json()),
              fetch(`${SLEEPER}/league/${seasonLeagueId}/users`).then(r => r.json()),
            ]);
            const userById = new Map<string, any>((users as any[]).map(u => [u.user_id, u]));
            const ownerFor = (rosterId: number): string | null => {
              const roster = (rosters as any[]).find(r => r.roster_id === rosterId);
              const u = roster ? userById.get(roster.owner_id) : null;
              return u?.display_name ?? null;
            };
            owners = {
              winner: owners.winner ?? ownerFor(wM[0].roster_id),
              loser: owners.loser ?? ownerFor(lM[0].roster_id),
            };
          } catch {
            // Owner names are a nicety; never fail the brief for them.
          }
        }
      }
    } catch {
      // Lineups are enrichment; a Sleeper outage should not fail the brief.
      lineups = null;
    }
  }

  /* -------------------------------------------------- cross-season context */
  const history = await loadLeagueHistory();
  const groupTitles = computeGroupTitles(history);
  const championships = computeChampionships(history);
  const clinch = computeClinch(history, year, week, [winnerId, loserId], groupTitles);
  const winnerScoreCtx = scoreContext(history, year, winnerScore);
  const loserScoreCtx = scoreContext(history, year, loserScore);

  const historyBlock = {
    winnerGroupTitles: groupTitles.get(winnerId) ?? [],
    loserGroupTitles: groupTitles.get(loserId) ?? [],
    winnerChampionships: championships.get(winnerId) ?? [],
    loserChampionships: championships.get(loserId) ?? [],
    winnerScoreRankInSeason: winnerScoreCtx.rankInSeason,
    winnerScoreRankAllTime: winnerScoreCtx.rankAllTime,
    loserScoreRankInSeason: loserScoreCtx.rankInSeason,
  };

  /* ----------------------------------------- cohorts: precedent and rarity */
  const parseRec = (r: string) => r.split('-').map(Number);
  const [ww, wl, wt] = parseRec(winner.recordAfter);
  const [lw, ll, lt] = parseRec(loser.recordAfter);
  const streakOf = (s: string): StreakRarity | null => {
    const m = /^([WL])(\d+)$/.exec(s);
    return m && Number(m[2]) >= 3
      ? streakRarity(history, m[1] as 'W' | 'L', Number(m[2]))
      : null;
  };

  const cohorts = {
    winnerRecord: recordCohort(history, year, week, ww, wl, wt, championships),
    loserRecord: recordCohort(history, year, week, lw, ll, lt, championships),
    winnerStart: startLadder(history, year, week, winnerId),
    loserStart: startLadder(history, year, week, loserId),
    game: gameExtremes(history, winnerScore, loserScore),
    winnerStreak: streakOf(winner.streakAfter),
    loserStreak: streakOf(loser.streakAfter),
  };

  /* ------------------------------------------------------------- angles */
  const angles = deriveAngles({
    winner, loser, margin, isTie,
    beforeWinnerWins: bw, beforeLoserWins: bl,
    rivalry, weekScores, weekMargins, lineups,
    clinch, history: historyBlock, cohorts, year, week,
    teamNameById: id => teams.get(id)?.team_name ?? `Team ${id}`,
  });

  return {
    meta: {
      year,
      week,
      isPlayoff,
      label: isPlayoff ? getPlayoffRoundLabel(week) : `Week ${week}`,
      lineupsAvailable: lineups !== null,
      generatedAt: new Date().toISOString(),
    },
    result: { winner, loser, margin, isTie, exactScores: sleeperScores },
    series: {
      beforeWinnerWins: bw,
      beforeLoserWins: bl,
      ties,
      afterWinnerWins: bw + (isTie ? 0 : 1),
      afterLoserWins: bl,
      meetings: bw + bl + ties + 1,
      rivalryName: rivalry?.name ?? null,
      rivalryTrophy: rivalry?.trophy ?? null,
    },
    week: {
      highScore: weekScores[0] ?? 0,
      lowScore: weekScores[weekScores.length - 1] ?? 0,
      averageScore: weekScores.length
        ? round1(weekScores.reduce((s, v) => s + v, 0) / weekScores.length)
        : 0,
      gamesPlayed: weekGames.length,
      loserScoreRankInWeek: weekScores.indexOf(loserScore) + 1,
      marginRankInWeek: weekMargins.findIndex(m => Math.abs(m - margin) < 0.005) + 1,
    },
    lineups,
    nflContextAvailable: !!lineups &&
      [...lineups.winner.starters, ...lineups.loser.starters].some(p => p.real !== null),
    owners,
    history: historyBlock,
    clinch,
    cohorts,
    angles,
  };
}

/* ------------------------------------------------------------- lineups */

function toLineup(
  teamId: number,
  m: SleeperMatchupRaw,
  players: Map<string, NflPlayer>,
  averages: Map<string, number>,
  nflWeek: NflWeek | null
): BriefLineup {
  const line = (id: string, points: number): BriefPlayerLine => {
    const p = players.get(id);
    const avg = averages.get(id) ?? null;

    // Real-world context, attached only on a confident match. A team defense
    // has no box-score line of its own, so it is described from what the
    // opposing offense managed.
    let real: BriefPlayerLine['real'] = null;
    if (nflWeek && p?.nfl_team) {
      if (p.position === 'DEF') {
        const g = nflWeek.games.find(x => x.teams.some(t => t.abbr === p.nfl_team || t.abbr === 'WSH'));
        const notes = defenseNotes(nflWeek, p.nfl_team);
        if (notes.length) real = { statLine: null, game: g ? gameLine(g) : '', notes };
      } else {
        const hit = findPlayer(nflWeek, p.full_name, p.nfl_team);
        if (hit) real = { statLine: statLine(hit), game: gameLine(hit.game), notes: playerNotes(hit) };
      }
    }

    return {
      name: p?.full_name ?? `(unresolved ${id})`,
      position: p?.position ?? null,
      nflTeam: p?.nfl_team ?? null,
      points: round1(points),
      real,
      seasonAverage: avg === null ? null : round1(avg),
      vsAverage: avg && avg > 0 ? Math.round((points / avg) * 100) / 100 : null,
    };
  };

  const starters = m.starters.map((id, i) => line(id, m.starters_points[i] ?? 0));
  const starterSet = new Set(m.starters);
  const bench = (m.players || [])
    .filter(id => !starterSet.has(id))
    .map(id => line(id, m.players_points?.[id] ?? 0))
    .sort((a, b) => b.points - a.points);

  return {
    teamId,
    starters: [...starters].sort((a, b) => b.points - a.points),
    benchPoints: round1(bench.reduce((s, p) => s + p.points, 0)),
    topBenched: bench[0] ?? null,
  };
}

/**
 * Baseline weekly score for each player, used to judge whether a performance
 * was unusual.
 *
 * Two exclusions, both of which materially change the number:
 *
 * 1. The week being measured is left out. Otherwise a huge game inflates its
 *    own baseline and understates itself — Jonathan Taylor's 39.4 in 2025 week
 *    8 reads 1.43x against a baseline containing it, and 1.52x without.
 * 2. Weeks where a player was benched and scored exactly zero are dropped.
 *    Those are byes, inactives and injuries, not performances; they were 14.7%
 *    of all samples in the first half of 2025 and dragged every average down.
 *    A zero from a player who was STARTED is kept — that is a real result.
 */
async function computeSeasonAverages(
  leagueId: string,
  throughWeek: number,
  excludeWeek: number
): Promise<Map<string, number>> {
  const totals = new Map<string, { sum: number; n: number }>();
  const weeks = Array.from({ length: throughWeek }, (_, i) => i + 1).filter(w => w !== excludeWeek);

  const results = await Promise.all(
    weeks.map(w =>
      fetch(`${SLEEPER}/league/${leagueId}/matchups/${w}`)
        .then(r => (r.ok ? r.json() : []))
        .catch(() => [])
    )
  );

  for (const week of results as SleeperMatchupRaw[][]) {
    for (const m of week || []) {
      const started = new Set(m.starters || []);
      for (const [pid, pts] of Object.entries(m.players_points || {})) {
        if (typeof pts !== 'number') continue;
        if (pts === 0 && !started.has(pid)) continue; // bye / inactive
        const cur = totals.get(pid) ?? { sum: 0, n: 0 };
        cur.sum += pts;
        cur.n += 1;
        totals.set(pid, cur);
      }
    }
  }

  const avg = new Map<string, number>();
  for (const [pid, { sum, n }] of totals) if (n > 0) avg.set(pid, sum / n);
  return avg;
}

/* -------------------------------------------------------------- angles */

interface AngleInput {
  winner: BriefTeamSide;
  loser: BriefTeamSide;
  margin: number;
  isTie: boolean;
  beforeWinnerWins: number;
  beforeLoserWins: number;
  rivalry: { name: string; trophy: string | null } | null;
  weekScores: number[];
  weekMargins: number[];
  lineups: GameBrief['lineups'];
  clinch: ClinchResult | null;
  history: GameBrief['history'];
  cohorts: GameBrief['cohorts'];
  year: number;
  week: number;
  teamNameById: (id: number) => string;
}

/**
 * Candidate storylines, derived rather than guessed.
 *
 * These are statements of fact for a writer to choose among — deliberately not
 * phrased for reuse, so nothing here reads as pre-written copy. Selecting which
 * facts matter is most of what makes sportswriting good, which is why this is
 * computed rather than left to the generator.
 */

/** 1 -> "first", 7 -> "seventh"; falls back to "12th" past twenty. */
function ordinal(n: number): string {
  const words = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh',
                 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth',
                 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth',
                 'nineteenth', 'twentieth'];
  if (n >= 1 && n < words.length) return words[n];
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function deriveAngles(i: AngleInput): BriefAngle[] {
  const a: BriefAngle[] = [];
  const { winner, loser, margin, beforeWinnerWins: bw, beforeLoserWins: bl } = i;

  if (i.rivalry) {
    // Some trophies are named after their rivalry ("The Velvet Rivalry" plays
    // for the "Velvet Rivalry"), which reads as a stutter if repeated.
    const norm = (x: string) => x.toLowerCase().replace(/^the\s+/, '').trim();
    const trophyAdds =
      i.rivalry.trophy && norm(i.rivalry.trophy) !== norm(i.rivalry.name);
    a.push({
      kind: 'rivalry-game',
      text: trophyAdds
        ? `This is ${i.rivalry.name}, played for the ${i.rivalry.trophy}.`
        : `This is ${i.rivalry.name}, a named rivalry with its own trophy.`,
    });
  }

  const after = { w: bw + (i.isTie ? 0 : 1), l: bl };
  if (bw < bl && after.w === after.l) {
    a.push({ kind: 'series-tied', text: `The win levels the all-time series at ${after.w}-${after.l}.` });
  } else if (bw === bl && after.w > after.l) {
    a.push({ kind: 'series-lead-taken', text: `The series was tied ${bw}-${bl}; ${winner.name} now leads ${after.w}-${after.l}.` });
  } else if (bw + bl >= 10) {
    // The winner of this game may still trail the all-time series; saying
    // "leads" regardless produced "Lanniesters leads the all-time series 14-18".
    const verb = after.w > after.l ? 'leads' : after.w < after.l ? 'trails' : 'is level in';
    const figures = after.w > after.l ? `${after.w}-${after.l}` : `${after.l}-${after.w}`;
    a.push({
      kind: 'series-standing',
      text: after.w === after.l
        ? `The all-time series is level at ${after.w}-${after.l} after ${after.w + after.l} meetings.`
        : `${winner.name} ${verb} the all-time series ${figures} after ${after.w + after.l} meetings.`,
    });
  }

  // With a single game — a playoff final — "highest score of the week" and
  // "largest margin" are trivially true of the only game played, and read as
  // padding. Season and all-time context below still applies.
  const weekIsMeaningful = i.weekMargins.length > 1;

  if (weekIsMeaningful && i.weekScores.length && Math.abs(winner.score - i.weekScores[0]) < 0.005) {
    a.push({ kind: 'week-high-score', text: `${winner.score} was the highest score of the week.` });
  }

  if (weekIsMeaningful && i.weekMargins.length && Math.abs(margin - i.weekMargins[0]) < 0.005) {
    a.push({ kind: 'week-biggest-margin', text: `The ${margin}-point margin was the week's largest.` });
  }
  if (weekIsMeaningful && Math.abs(margin - i.weekMargins[i.weekMargins.length - 1]) < 0.005) {
    a.push({ kind: 'week-narrowest-margin', text: `The ${margin}-point margin was the week's narrowest.` });
  }

  // Losing with a score that would have beaten most of the league is a story.
  const beatenBy = i.weekScores.filter(s => s < loser.score).length;
  if (i.weekScores.length >= 4 && beatenBy >= i.weekScores.length / 2) {
    a.push({
      kind: 'lost-with-strong-score',
      text: `${loser.name} lost despite outscoring ${beatenBy} of the ${i.weekScores.length - 1} other scores that week.`,
    });
  }

  const ws = winner.streakAfter;
  if (/^W([3-9]|\d{2})$/.test(ws)) {
    a.push({ kind: 'streak-extended', text: `${winner.name} has now won ${ws.slice(1)} straight.` });
  }
  const ls = loser.streakAfter;
  if (/^L([3-9]|\d{2})$/.test(ls)) {
    a.push({ kind: 'losing-streak', text: `${loser.name} has now lost ${ls.slice(1)} straight.` });
  }

  /* ---- context from beyond this week: the part a reader cannot eyeball ---- */

  if (i.clinch) {
    const who = i.teamNameById(i.clinch.teamId);
    a.push({
      kind: 'clinched-group',
      text: `This result clinched the ${i.clinch.groupName} for ${who} — their ${ordinal(i.clinch.titleNumber)} group title.`,
    });
  }

  const wTitles = i.history.winnerGroupTitles;
  const prior = wTitles.filter(t => t.year < i.year);
  if (!i.clinch && prior.length >= 3) {
    a.push({
      kind: 'franchise-group-titles',
      text: `${winner.name} has won ${prior.length} group titles (${prior.map(t => t.year).join(', ')}).`,
    });
  }
  for (const [side, champs] of [[winner, i.history.winnerChampionships], [loser, i.history.loserChampionships]] as const) {
    const before = champs.filter(y => y < i.year);
    if (before.length >= 2) {
      a.push({
        kind: 'franchise-championships',
        text: `${side.name} has ${before.length} championships (${before.join(', ')}).`,
      });
    }
  }

  // A big score is only interesting relative to the season, not the week.
  if (i.history.winnerScoreRankInSeason === 1) {
    a.push({ kind: 'season-high-score', text: `${winner.score} is the highest single-team score of the ${i.year} season.` });
  } else if (i.history.winnerScoreRankInSeason <= 3) {
    a.push({
      kind: 'season-top-score',
      text: `${winner.score} is the ${ordinal(i.history.winnerScoreRankInSeason)}-highest score of the ${i.year} season.`,
    });
  }
  if (i.history.winnerScoreRankAllTime) {
    a.push({
      kind: 'all-time-score',
      text: `${winner.score} is the ${ordinal(i.history.winnerScoreRankAllTime)}-highest single-team score in league history.`,
    });
  }
  if (i.history.loserScoreRankInSeason <= 5) {
    a.push({
      kind: 'losing-score-was-elite',
      text: `${loser.name} lost with the ${ordinal(i.history.loserScoreRankInSeason)}-highest score of the season.`,
    });
  }

  /* ---- precedent: the "has this ever happened" material ---- */

  for (const [side, cohort] of [[winner, i.cohorts.winnerRecord], [loser, i.cohorts.loserRecord]] as const) {
    // Only interesting once there is a season's worth of games behind it, and
    // only when the cohort is small enough to mean something.
    if (i.week < 4 || cohort.count === 0) continue;
    if (cohort.count <= 6) {
      const others = cohort.precedents.filter(p => !(p.year === i.year && p.teamId === side.teamId));
      a.push({
        kind: 'record-cohort-rare',
        text: `Only ${cohort.count} team${cohort.count === 1 ? ' has' : 's have'} been ${cohort.record} after week ${i.week} in league history` +
              (others.length
                ? `; the others: ${others.map(p => `${i.teamNameById(p.teamId)} ${p.year} (finished ${p.finalRecord}${p.wonTitle ? ', won it' : p.madePlayoffs ? ', made playoffs' : ''})`).join('; ')}.`
                : '.'),
      });
    } else if (cohort.madePlayoffs === 0) {
      a.push({
        kind: 'record-cohort-doom',
        text: `No team has ever made the postseason from ${cohort.record} after week ${i.week} — ${cohort.count} have tried.`,
      });
    } else if (cohort.madePlayoffs <= Math.max(2, cohort.count * 0.2)) {
      a.push({
        kind: 'record-cohort-longshot',
        text: `${cohort.madePlayoffs} of the ${cohort.count} teams ever ${cohort.record} after week ${i.week} went on to make the postseason.`,
      });
    }
  }

  for (const [side, ladder] of [[winner, i.cohorts.winnerStart], [loser, i.cohorts.loserStart]] as const) {
    if (!ladder) continue;
    const here = ladder.ladder.find(x => x.length === ladder.length);
    // A 3-0 start has 32 precedents — that is not a fact worth a paragraph.
    // Fire only when the company is small, or the record is in reach.
    const isRare = (here?.count ?? 99) <= 8;
    const nearRecord = !!ladder.longest && ladder.length >= ladder.longest.length - 1;
    if (!isRare && !nearRecord) continue;
    const verb = ladder.kind === 'winless' ? 'started 0-' : 'opened ';
    const rungs = ladder.ladder.slice(0, 4)
      .map(x => `${x.count} ${x.count === 1 ? 'team has' : 'teams have'} ${verb}${x.length}${ladder.kind === 'unbeaten' ? '-0' : ''}`)
      .join('; ');
    a.push({
      kind: ladder.kind === 'winless' ? 'winless-start' : 'unbeaten-start',
      text: `${side.name} is ${ladder.kind === 'winless' ? `0-${ladder.length}` : `${ladder.length}-0`} to open the season. ` +
            `${rungs}.` +
            (ladder.longest ? ` The record is ${ladder.longest.length}, by ${i.teamNameById(ladder.longest.teamId)} in ${ladder.longest.year}.` : '') +
            '',
    });
  }

  const ge = i.cohorts.game;
  // "first-lowest" is not English; rank 1 is simply "the lowest".
  const superlative = (rank: number, sup: string) =>
    rank === 1 ? `the ${sup}` : `the ${ordinal(rank)}-${sup}`;

  if (ge.combinedRankHigh <= 5) {
    a.push({
      kind: 'combined-score-extreme',
      text: `The ${ge.combined} points scored between them is ${superlative(ge.combinedRankHigh, 'highest')} of any game in league history (${ge.totalGames} games).`,
    });
  }
  if (ge.combinedRankLow <= 5) {
    // Citing "the worst remains ..." when this game IS the worst is circular.
    const isTheWorst = ge.combinedRankLow === 1;
    a.push({
      kind: 'combined-score-low',
      text: `The ${ge.combined} points scored between them is ${superlative(ge.combinedRankLow, 'lowest')} of any game ever` +
            (isTheWorst
              ? ` — the worst game in ${ge.totalGames} played.`
              : ge.worstEver
              ? `; the worst remains ${ge.worstEver.year} week ${ge.worstEver.week}, ${ge.worstEver.home}–${ge.worstEver.away}.`
              : '.'),
    });
  }
  if (ge.marginRankHigh <= 5) {
    a.push({
      kind: 'margin-extreme',
      text: `The ${margin}-point margin is ${superlative(ge.marginRankHigh, 'largest')} in league history.`,
    });
  }
  if (ge.marginRankLow <= 5) {
    a.push({
      kind: 'margin-narrow',
      text: `The ${margin}-point margin is ${superlative(ge.marginRankLow, 'narrowest')} in league history.`,
    });
  }

  for (const [side, sr] of [[winner, i.cohorts.winnerStreak], [loser, i.cohorts.loserStreak]] as const) {
    if (!sr) continue;
    if (sr.occurrences <= 8 || (sr.longestEver && sr.length >= sr.longestEver.length)) {
      a.push({
        kind: sr.kind === 'W' ? 'win-streak-rare' : 'lose-streak-rare',
        text: `${side.name}'s ${sr.length}-game ${sr.kind === 'W' ? 'winning' : 'losing'} run is one of only ${sr.occurrences} that long in league history` +
              (sr.longestEver ? `; the longest is ${sr.longestEver.length}, by ${i.teamNameById(sr.longestEver.teamId)} in ${sr.longestEver.year}.` : '.'),
      });
    }
  }

  // "Battle of the 30-bombs" — the pattern across both lineups, not one player.
  if (i.lineups) {
    const bombs = [...i.lineups.winner.starters, ...i.lineups.loser.starters].filter(p => p.points >= 30);
    if (bombs.length >= 3) {
      a.push({
        kind: 'multi-thirty',
        text: `${bombs.length} starters cleared 30 points in this game: ` +
              bombs.map(p => `${p.name} ${p.points}`).join(', ') + '.',
      });
    }
  }

  if (i.lineups) {
    for (const [role, lu] of [['winner', i.lineups.winner], ['loser', i.lineups.loser]] as const) {
      const team = role === 'winner' ? winner : loser;
      const top = lu.starters[0];
      if (top && top.vsAverage !== null && top.vsAverage >= 2 && top.points >= 20) {
        a.push({
          kind: 'player-explosion',
          text: `${top.name} scored ${top.points}, ${top.vsAverage}x their season average of ${top.seasonAverage}, for ${team.name}.`,
        });
      }
      const worst = lu.starters[lu.starters.length - 1];
      if (worst && worst.vsAverage !== null && worst.vsAverage <= 0.4) {
        a.push({
          kind: 'player-bust',
          text: `${team.name} started ${worst.name}, who returned ${worst.points} against a season average of ${worst.seasonAverage}.`,
        });
      }
      // Only interesting if the bench would actually have changed the result.
      if (lu.topBenched && worst && lu.topBenched.points - worst.points > margin) {
        a.push({
          kind: 'bench-regret',
          text: `${team.name} left ${lu.topBenched.name} (${lu.topBenched.points}) on the bench while starting ${worst.name} (${worst.points}) — a swap larger than the ${margin}-point margin.`,
        });
      }
    }
  }

  return a;
}
