/**
 * Head-to-head splits and the named rivalry.
 *
 * A note on what counts. The all-time series against an opponent INCLUDES
 * playoff meetings — that is what "they lead the series 12-9" means, and it is
 * how `buildGameBrief` reports it. A franchise's career W-L excludes playoffs.
 * Both are correct for their own question, so both are exposed here rather than
 * quietly picking one: `wins/losses/ties` is the full series, `regular` is the
 * regular-season-only split.
 */

import { supabase, handleSupabaseError } from '../supabase/client';
import type { TeamGame } from './game-log';

export interface OpponentSplit {
  opponentId: number;
  opponentName: string;
  /** Full series, playoffs included. */
  wins: number;
  losses: number;
  ties: number;
  meetings: number;
  winPct: number;
  regular: { wins: number; losses: number; ties: number };
  playoff: { wins: number; losses: number; ties: number };
  pointsFor: number;
  pointsAgainst: number;
  lastMeeting: {
    year: number;
    label: string;
    teamScore: number;
    opponentScore: number;
    result: 'W' | 'L' | 'T';
  } | null;
  /** Current run within this series, e.g. "W3". */
  currentStreak: string | null;
}

export interface OpponentSummary {
  splits: OpponentSplit[];
  /** Best and worst by win percentage among opponents met at least `minMeetings` times. */
  best: OpponentSplit | null;
  worst: OpponentSplit | null;
  mostPlayed: OpponentSplit | null;
  minMeetings: number;
}

/** Opponents met fewer times than this are too small a sample to call a split. */
export const MIN_MEETINGS_FOR_SPLIT = 5;

export function opponentSplits(
  log: TeamGame[],
  teamNames: Map<number, string>
): OpponentSummary {
  const byOpponent = new Map<number, TeamGame[]>();
  for (const g of log) {
    if (!byOpponent.has(g.opponentId)) byOpponent.set(g.opponentId, []);
    byOpponent.get(g.opponentId)!.push(g);
  }

  const splits: OpponentSplit[] = [];
  for (const [opponentId, games] of byOpponent) {
    const count = (pred: (g: TeamGame) => boolean, r: 'W' | 'L' | 'T') =>
      games.filter(g => pred(g) && g.result === r).length;

    const all = () => true;
    const reg = (g: TeamGame) => !g.playoffs;
    const post = (g: TeamGame) => g.playoffs;

    const wins = count(all, 'W');
    const losses = count(all, 'L');
    const ties = count(all, 'T');
    const meetings = games.length;

    // Games are already ordered oldest first, regular season before playoffs.
    const last = games[games.length - 1];
    let streak = 0;
    for (let i = games.length - 1; i >= 0; i--) {
      if (games[i].result !== last.result) break;
      streak++;
    }

    splits.push({
      opponentId,
      opponentName: teamNames.get(opponentId) ?? `Team ${opponentId}`,
      wins, losses, ties, meetings,
      winPct: meetings > 0 ? (wins + ties * 0.5) / meetings : 0,
      regular: { wins: count(reg, 'W'), losses: count(reg, 'L'), ties: count(reg, 'T') },
      playoff: { wins: count(post, 'W'), losses: count(post, 'L'), ties: count(post, 'T') },
      pointsFor: round2(games.reduce((a, g) => a + g.teamScore, 0)),
      pointsAgainst: round2(games.reduce((a, g) => a + g.opponentScore, 0)),
      lastMeeting: last
        ? {
            year: last.year,
            label: last.label,
            teamScore: last.teamScore,
            opponentScore: last.opponentScore,
            result: last.result,
          }
        : null,
      currentStreak: last ? `${last.result}${streak}` : null,
    });
  }

  splits.sort((a, b) => b.meetings - a.meetings || a.opponentName.localeCompare(b.opponentName));

  const qualified = splits.filter(s => s.meetings >= MIN_MEETINGS_FOR_SPLIT);
  const byWinPct = [...qualified].sort((a, b) => b.winPct - a.winPct || b.meetings - a.meetings);

  return {
    splits,
    best: byWinPct[0] ?? null,
    worst: byWinPct[byWinPct.length - 1] ?? null,
    mostPlayed: splits[0] ?? null,
    minMeetings: MIN_MEETINGS_FOR_SPLIT,
  };
}

export interface RivalryLine {
  rivalryId: number;
  rivalryName: string;
  trophyId: number | null;
  trophyName: string | null;
  opponentId: number;
  opponentName: string;
  /** The all-time series within the rivalry, playoffs included. */
  record: { wins: number; losses: number; ties: number };
  meetings: number;
}

/**
 * The franchise's named rivalry. Every active team has exactly one, and each
 * rivalry carries its own trophy.
 */
export async function rivalryFor(
  teamId: number,
  splits: OpponentSplit[]
): Promise<RivalryLine | null> {
  try {
    const { data: mine, error } = await supabase
      .from('rivals')
      .select('rivalry_id')
      .eq('team_id', teamId);

    if (error) handleSupabaseError(error, 'rivalryFor');
    const rows = (mine || []) as unknown as { rivalry_id: number }[];
    if (rows.length === 0) return null;

    const rivalryId = rows[0].rivalry_id;

    const [{ data: rivalry }, { data: others }] = await Promise.all([
      supabase
        .from('rivalries')
        .select('rivalry_id, rivalry_name, trophy_id, trophy:trophy_id(trophy_id, trophy_name)')
        .eq('rivalry_id', rivalryId)
        .single(),
      supabase.from('rivals').select('team_id').eq('rivalry_id', rivalryId),
    ]);

    const opponentId = ((others || []) as unknown as { team_id: number }[])
      .map(r => r.team_id)
      .find(id => id !== teamId);
    if (opponentId === undefined || !rivalry) return null;

    const r = rivalry as any;
    const split = splits.find(s => s.opponentId === opponentId);

    return {
      rivalryId,
      rivalryName: r.rivalry_name,
      trophyId: r.trophy_id ?? null,
      trophyName: r.trophy?.trophy_name ?? null,
      opponentId,
      opponentName: split?.opponentName ?? `Team ${opponentId}`,
      record: {
        wins: split?.wins ?? 0,
        losses: split?.losses ?? 0,
        ties: split?.ties ?? 0,
      },
      meetings: split?.meetings ?? 0,
    };
  } catch (error) {
    handleSupabaseError(error, 'rivalryFor');
    return null;
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;
