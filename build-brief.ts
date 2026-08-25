/**
 * Print a game brief for article generation.
 *
 *   pnpm brief --year 2025 --week 8 --team 10
 *   pnpm brief --year 2025 --week 8 --team "Hauloll"
 *   pnpm brief --year 2025 --week 8 --team 10 --json
 *
 * Team accepts a numeric team_id or a case-insensitive substring of the team
 * name. Add --playoff for a playoff round (week is the ROUND, 1-3).
 *
 * Run via tsx so this shares one implementation with the app rather than
 * reimplementing the joins in a standalone script.
 */

// Env is loaded by node's --env-file flag in the `brief` script, not dotenv:
// ESM evaluates every import before any module body runs, and
// src/lib/supabase/client.ts throws at import time when its keys are absent.
import { buildGameBrief, type GameBrief } from './src/lib/briefs/game-brief';
import { supabase } from './src/lib/supabase/client';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function resolveTeam(input: string): Promise<number> {
  if (/^\d+$/.test(input)) return Number(input);
  // `teams` holds only team_id and team_name — short names live in Contentful.
  const { data, error } = await supabase.from('teams').select('team_id, team_name');
  if (error) throw new Error(`teams query failed: ${error.message}`);
  const rows = (data || []) as unknown as { team_id: number; team_name: string }[];
  const needle = input.toLowerCase();
  const hits = rows.filter(t => t.team_name?.toLowerCase().includes(needle));
  if (hits.length === 0) throw new Error(`No team matches "${input}"`);
  if (hits.length > 1) {
    throw new Error(
      `"${input}" matches ${hits.length} teams: ${hits.map(h => `${h.team_name} (${h.team_id})`).join(', ')}`
    );
  }
  return hits[0].team_id;
}

function render(b: GameBrief): string {
  const L: string[] = [];
  const rule = (s: string) => L.push('', `── ${s} ${'─'.repeat(Math.max(0, 58 - s.length))}`);
  const pct = (v: number | null) => (v === null ? '   —  ' : `${v.toFixed(2)}x`.padStart(6));

  // Prefer Sleeper's two-decimal figures when present; Supabase rounds to one.
  const wScore = b.result.exactScores?.winner ?? b.result.winner.score;
  const lScore = b.result.exactScores?.loser ?? b.result.loser.score;
  const exactMargin = Math.round((wScore - lScore) * 100) / 100;

  L.push(`${b.meta.year} ${b.meta.label}${b.meta.isPlayoff ? ' (playoff)' : ''}`);
  L.push(`${b.result.winner.name}  ${wScore}`);
  L.push(`${b.result.loser.name}  ${lScore}`);
  L.push(`margin ${exactMargin}${b.result.isTie ? '  (TIE)' : ''}`);
  if (b.result.exactScores) {
    L.push(`(Supabase rounds these to ${b.result.winner.score} / ${b.result.loser.score})`);
  }

  rule('RECORDS');
  for (const s of [b.result.winner, b.result.loser]) {
    L.push(`  ${s.name.padEnd(26)} ${s.recordBefore} → ${s.recordAfter}   streak ${s.streakAfter}`);
  }

  rule('SERIES');
  if (b.series.rivalryName) {
    L.push(`  ${b.series.rivalryName}${b.series.rivalryTrophy ? ` — plays for the ${b.series.rivalryTrophy}` : ''}`);
  }
  L.push(`  before: ${b.result.winner.name} ${b.series.beforeWinnerWins}-${b.series.beforeLoserWins}` +
         (b.series.ties ? ` (${b.series.ties} ties)` : ''));
  L.push(`  after : ${b.result.winner.name} ${b.series.afterWinnerWins}-${b.series.afterLoserWins}   (${b.series.meetings} meetings all-time)`);

  rule('THE WEEK');
  L.push(`  high ${b.week.highScore}   low ${b.week.lowScore}   avg ${b.week.averageScore}   (${b.week.gamesPlayed} games)`);
  L.push(`  loser's score ranked ${b.week.loserScoreRankInWeek} of ${b.week.gamesPlayed * 2} that week`);
  L.push(`  margin ranked ${b.week.marginRankInWeek} of ${b.week.gamesPlayed} (1 = biggest)`);

  if (b.lineups) {
    for (const [label, lu] of [['WINNER', b.lineups.winner], ['LOSER', b.lineups.loser]] as const) {
      const side = label === 'WINNER' ? b.result.winner : b.result.loser;
      rule(`${label} LINEUP — ${side.name}`);
      for (const p of lu.starters) {
        L.push(`  ${String(p.points).padStart(6)}  ${pct(p.vsAverage)}  ${p.name} (${p.position ?? '?'}, ${p.nflTeam ?? 'FA'})`);
      }
      L.push(`  bench: ${lu.benchPoints}` + (lu.topBenched ? `   best benched: ${lu.topBenched.name} ${lu.topBenched.points}` : ''));
    }
  } else {
    rule('LINEUPS');
    L.push('  unavailable — Sleeper only covers 2023 onward, and lineups are');
    L.push('  attached only when both scores match a Sleeper matchup exactly.');
  }

  if (b.owners.winner || b.owners.loser) {
    rule('OWNERS');
    L.push(`  ${b.result.winner.name}: ${b.owners.winner ?? '?'}   ${b.result.loser.name}: ${b.owners.loser ?? '?'}`);
  }

  rule('BEYOND THIS WEEK');
  const t = (list: { year: number; groupName: string }[]) =>
    list.length ? list.map(x => `${x.year} ${x.groupName}`).join(', ') : 'none';
  L.push(`  ${b.result.winner.name} group titles: ${t(b.history.winnerGroupTitles)}`);
  L.push(`  ${b.result.loser.name} group titles: ${t(b.history.loserGroupTitles)}`);
  L.push(`  championships — ${b.result.winner.name}: ${b.history.winnerChampionships.join(', ') || 'none'}` +
         `   ${b.result.loser.name}: ${b.history.loserChampionships.join(', ') || 'none'}`);
  L.push(`  winning score ranks ${b.history.winnerScoreRankInSeason} in ${b.meta.year}` +
         (b.history.winnerScoreRankAllTime ? `, ${b.history.winnerScoreRankAllTime} all-time` : ''));
  if (b.clinch) L.push(`  CLINCH: ${b.clinch.groupName}, title #${b.clinch.titleNumber}`);

  rule(`ANGLES (${b.angles.length})`);
  if (b.angles.length === 0) L.push('  none computed');
  for (const a of b.angles) L.push(`  [${a.kind}] ${a.text}`);

  return L.join('\n');
}

async function main() {
  const year = Number(arg('year'));
  const week = Number(arg('week'));
  const team = arg('team');
  if (!year || !week || !team) {
    console.error('Usage: pnpm brief --year 2025 --week 8 --team 10|"Hauloll" [--playoff] [--json]');
    process.exit(1);
  }

  const teamId = await resolveTeam(team);
  const brief = await buildGameBrief({
    year,
    week,
    teamId,
    isPlayoff: flag('playoff'),
    sleeperLeagueId: process.env.SLEEPER_LEAGUE_ID,
  });

  console.log(flag('json') ? JSON.stringify(brief, null, 2) : render(brief));
}

main().catch(e => {
  console.error('Failed:', e.message);
  process.exit(1);
});
