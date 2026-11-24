/**
 * Restore the hundredths Sleeper scores lost to the one-decimal score column.
 *
 *   pnpm backfill-scores                 # dry run, every Sleeper season
 *   pnpm backfill-scores --year 2026     # dry run, one season
 *   pnpm backfill-scores --apply         # write
 *
 * games.home_score / away_score were DECIMAL(5,1) until migration 006, so every
 * score imported from Sleeper (2022 on) was rounded on insert, and two 0.05-point
 * wins were stored as ties. Run 006 first: against the old column these writes
 * are rounded again, and the script stops at the first write that comes back
 * rounded rather than carrying on.
 *
 * A row is only rewritten when its stored score is exactly Sleeper's score
 * rounded to one decimal, i.e. when the difference is the rounding and nothing
 * else. A stored score that disagrees by more than that was either corrected by
 * hand or predates a Sleeper stat correction; either way it is a judgment call,
 * so it is reported and left alone.
 *
 * Regular season only. Playoff games are stored as rounds and entered
 * separately (see getSeasonConfig), so there is no reliable Sleeper week to read
 * them back from.
 */

// Env comes from node's --env-file flag in the package script: ESM evaluates
// imports before any module body, and client.ts throws at import without keys.
import { supabase } from './src/lib/supabase/client';
import { getAdminClient } from './src/lib/supabase/admin';
import { ROSTER_ID_TO_TEAM_ID } from './src/lib/sleeper/mapping';

const SLEEPER = 'https://api.sleeper.app/v1';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

interface GameRow {
  id: number;
  year: number;
  week: number;
  home_team_id: number;
  away_team_id: number;
  home_score: number | null;
  away_score: number | null;
}

interface Matchup {
  roster_id: number;
  matchup_id: number | null;
  points: number;
}

/** Hundredths, as an integer, so comparisons are not at the mercy of floats. */
const cents = (v: number) => Math.round(v * 100);
/** Sleeper's score as DECIMAL(5,1) would have stored it (half away from zero). */
const asStored = (v: number) => Math.round(cents(v) / 10) * 10;
const fmt = (v: number) => (cents(v) / 100).toFixed(2);

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${SLEEPER}/${path}`);
  if (!res.ok) throw new Error(`Sleeper ${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** Every season Sleeper has for this league, newest first, via previous_league_id. */
async function leagueChain(): Promise<{ season: number; leagueId: string }[]> {
  const out: { season: number; leagueId: string }[] = [];
  let id: string | null = process.env.SLEEPER_LEAGUE_ID || null;
  if (!id) throw new Error('SLEEPER_LEAGUE_ID is not set');
  for (let hops = 0; hops < 20 && id && id !== '0'; hops++) {
    const league: { season: string; previous_league_id: string | null } = await getJson<{ season: string; previous_league_id: string | null }>(`league/${id}`);
    out.push({ season: Number(league.season), leagueId: id });
    id = league.previous_league_id;
  }
  return out;
}

interface Update {
  game: GameRow;
  home: number;
  away: number;
}

interface SeasonReport {
  season: number;
  matched: number;
  updates: Update[];
  skipped: string[];
  resultChanges: string[];
}

async function auditSeason(season: number, leagueId: string, names: Map<number, string>): Promise<SeasonReport> {
  const { data, error } = await (supabase.from('games') as any)
    .select('id, year, week, home_team_id, away_team_id, home_score, away_score')
    .eq('year', season)
    .eq('playoffs', false);
  if (error) throw new Error(`games ${season}: ${error.message}`);
  const rows = (data || []) as GameRow[];

  const report: SeasonReport = { season, matched: 0, updates: [], skipped: [], resultChanges: [] };
  const name = (id: number) => names.get(id) ?? `team ${id}`;
  const weeks = [...new Set(rows.map(r => r.week))].sort((a, b) => a - b);

  for (const week of weeks) {
    const matchups = await getJson<Matchup[]>(`league/${leagueId}/matchups/${week}`);
    const points = new Map<number, number>();
    for (const m of matchups) {
      const teamId = ROSTER_ID_TO_TEAM_ID[m.roster_id];
      if (teamId && m.matchup_id != null) points.set(teamId, m.points);
    }

    for (const game of rows.filter(r => r.week === week)) {
      const label = `${season} wk${week} ${name(game.home_team_id)} v ${name(game.away_team_id)}`;
      const home = points.get(game.home_team_id);
      const away = points.get(game.away_team_id);
      if (home === undefined || away === undefined) {
        report.skipped.push(`${label}: no Sleeper score for one side`);
        continue;
      }
      if (game.home_score === null || game.away_score === null) {
        report.skipped.push(`${label}: stored score is null`);
        continue;
      }
      report.matched++;

      const storedHome = cents(game.home_score);
      const storedAway = cents(game.away_score);
      if (storedHome === cents(home) && storedAway === cents(away)) continue; // already exact

      if (storedHome !== asStored(home) || storedAway !== asStored(away)) {
        report.skipped.push(
          `${label}: stored ${fmt(game.home_score)}-${fmt(game.away_score)}, ` +
          `Sleeper ${fmt(home)}-${fmt(away)} — not a rounding difference, left as is`
        );
        continue;
      }

      report.updates.push({ game, home, away });
      const before = Math.sign(storedHome - storedAway);
      const after = Math.sign(cents(home) - cents(away));
      if (before !== after) {
        const was = before === 0 ? 'tie' : before > 0 ? `${name(game.home_team_id)} win` : `${name(game.away_team_id)} win`;
        const now = after === 0 ? 'tie' : after > 0 ? `${name(game.home_team_id)} win` : `${name(game.away_team_id)} win`;
        report.resultChanges.push(`${label}: ${fmt(home)}-${fmt(away)}, ${was} → ${now}`);
      }
    }
  }
  return report;
}

async function apply(updates: Update[]): Promise<void> {
  const admin = getAdminClient();
  for (const { game, home, away } of updates) {
    const { data, error } = await admin
      .from('games')
      .update({ home_score: cents(home) / 100, away_score: cents(away) / 100 })
      .eq('id', game.id)
      .select('home_score, away_score')
      .single();
    if (error) throw new Error(`update game ${game.id}: ${error.message}`);
    const row = data as { home_score: number; away_score: number };
    if (cents(row.home_score) !== cents(home) || cents(row.away_score) !== cents(away)) {
      throw new Error(
        `game ${game.id} stored ${row.home_score}-${row.away_score} after writing ` +
        `${fmt(home)}-${fmt(away)}. The column is still rounding — run ` +
        `supabase-migrations/006_score_precision.sql first. Stopped; rows before ` +
        `this one were written, and re-running is safe.`
      );
    }
  }
}

async function main() {
  const onlyYear = arg('year') ? Number(arg('year')) : null;
  const write = flag('apply');

  const { data: teams } = await (supabase.from('teams') as any).select('team_id, team_name');
  const names = new Map<number, string>(
    ((teams || []) as { team_id: number; team_name: string }[]).map(t => [t.team_id, t.team_name])
  );

  const chain = (await leagueChain()).filter(l => onlyYear === null || l.season === onlyYear);
  if (chain.length === 0) throw new Error(`Sleeper has no league for ${onlyYear}`);

  const reports: SeasonReport[] = [];
  for (const { season, leagueId } of chain.reverse()) {
    const r = await auditSeason(season, leagueId, names);
    reports.push(r);
    console.log(`${season}: ${r.matched} games matched, ${r.updates.length} to update, ${r.skipped.length} skipped`);
    for (const s of r.skipped) console.log(`  skip    ${s}`);
    for (const c of r.resultChanges) console.log(`  RESULT  ${c}`);
  }

  const updates = reports.flatMap(r => r.updates);
  console.log(`\n${updates.length} games to update across ${reports.length} seasons.`);
  if (!write) {
    console.log('Dry run. Re-run with --apply after migration 006 to write.');
    return;
  }
  await apply(updates);
  console.log(`Wrote ${updates.length} games. Revalidate the site and run pnpm dossier --verify.`);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
