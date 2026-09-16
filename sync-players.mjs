/**
 * Refresh the local Sleeper player cache.
 *
 *   pnpm sync-players
 *
 * Reads https://api.sleeper.app/v1/players/nfl (~14 MB) and upserts the
 * fantasy-relevant players into the `nfl_players` table. Sleeper asks that the
 * endpoint be called at most once per day; this script refuses to run more
 * often than that unless you pass --force.
 *
 * Run `supabase-migrations/003_nfl_players.sql` first.
 *
 * This is a plain .mjs script rather than TypeScript so it matches the other
 * root-level scripts, which load .env.local via dotenv and talk to Supabase
 * directly.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SLEEPER_PLAYERS_URL = 'https://api.sleeper.app/v1/players/nfl';
const FANTASY_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']);
const MIN_HOURS_BETWEEN_SYNCS = 20;

const force = process.argv.includes('--force');

// Writes need the service-role key: row-level security (migration 004) lets the
// anon key read and nothing else. This script is the CLI twin of
// syncPlayers() in src/lib/sleeper/players.ts, which goes through
// getAdminClient() for the same reason.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local.');
  console.error('Row-level security blocks writes from the anon key; see env.example.');
  process.exit(1);
}
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const isFantasyRelevant = p =>
  (p.position && FANTASY_POSITIONS.has(p.position)) ||
  (p.fantasy_positions || []).some(pos => FANTASY_POSITIONS.has(pos));

/** Team defenses carry no full_name — Sleeper splits them across first/last. */
const resolveName = p =>
  p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || null;

async function main() {
  // Guard against hammering an endpoint Sleeper asks us to call daily at most.
  const { data: last, error: statusError } = await supabase
    .from('nfl_players')
    .select('synced_at')
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (statusError && statusError.code === '42P01') {
    console.error('Table nfl_players does not exist.');
    console.error('Run supabase-migrations/003_nfl_players.sql in the Supabase SQL Editor first.');
    process.exit(1);
  }

  if (last?.synced_at && !force) {
    const hours = (Date.now() - new Date(last.synced_at).getTime()) / 36e5;
    if (hours < MIN_HOURS_BETWEEN_SYNCS) {
      console.log(`Last sync was ${hours.toFixed(1)}h ago (minimum ${MIN_HOURS_BETWEEN_SYNCS}h).`);
      console.log('Nothing to do. Pass --force to sync anyway.');
      return;
    }
  }

  console.log('Fetching Sleeper player database (~14 MB)...');
  const started = Date.now();
  const response = await fetch(SLEEPER_PLAYERS_URL);
  if (!response.ok) throw new Error(`Sleeper request failed: HTTP ${response.status}`);
  const raw = await response.json();
  console.log(`  ${Object.keys(raw).length.toLocaleString()} players in ${((Date.now() - started) / 1000).toFixed(1)}s`);

  const rows = [];
  let skipped = 0;
  for (const p of Object.values(raw)) {
    if (!isFantasyRelevant(p)) continue;
    const fullName = resolveName(p);
    if (!p.player_id || !fullName) { skipped++; continue; }
    rows.push({
      player_id: p.player_id,
      full_name: fullName,
      first_name: p.first_name ?? null,
      last_name: p.last_name ?? null,
      position: p.position ?? null,
      fantasy_positions: p.fantasy_positions ?? null,
      nfl_team: p.team ?? null,
      jersey_number: p.number ?? null,
      college: p.college ?? null,
      years_exp: p.years_exp ?? null,
      status: p.status ?? null,
      active: !!p.active,
      injury_status: p.injury_status ?? null,
      synced_at: new Date().toISOString(),
    });
  }
  console.log(`  ${rows.length.toLocaleString()} fantasy-relevant (${skipped} skipped for missing id/name)`);

  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from('nfl_players')
      .upsert(chunk, { onConflict: 'player_id' });
    if (error) throw new Error(`Upsert failed at ${i}-${i + chunk.length}: ${error.message}`);
    process.stdout.write(`\r  upserted ${Math.min(i + CHUNK, rows.length).toLocaleString()} / ${rows.length.toLocaleString()}`);
  }
  process.stdout.write('\n');

  const { count } = await supabase.from('nfl_players').select('*', { count: 'exact', head: true });
  const { count: activeCount } = await supabase
    .from('nfl_players').select('*', { count: 'exact', head: true }).eq('active', true);
  const { count: defCount } = await supabase
    .from('nfl_players').select('*', { count: 'exact', head: true }).eq('position', 'DEF');

  console.log(`\nDone. ${count?.toLocaleString()} rows cached (${activeCount?.toLocaleString()} active, ${defCount} team defenses).`);
}

main().catch(err => {
  console.error('\nSync failed:', err.message);
  process.exit(1);
});
