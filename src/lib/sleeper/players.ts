/**
 * Sleeper player database: sync and lookup.
 *
 * Sleeper matchups reference players only by id. Resolving those ids used to
 * be a manual step — download the players file, hand-filter it to the week's
 * players, paste the result in. This module removes that: `syncPlayers()`
 * caches the whole fantasy-relevant set into `nfl_players`, and `getPlayers()`
 * resolves a batch of ids from it.
 */

import { supabase } from '../supabase/client';

const SLEEPER_PLAYERS_URL = 'https://api.sleeper.app/v1/players/nfl';

/** Positions the league actually rosters. Verified against 2025 rosters: no IDP. */
const FANTASY_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']);

export interface NflPlayer {
  player_id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  fantasy_positions: string[] | null;
  nfl_team: string | null;
  jersey_number: number | null;
  college: string | null;
  years_exp: number | null;
  status: string | null;
  active: boolean;
  injury_status: string | null;
}

/** Raw shape from Sleeper. Only the fields we keep are typed. */
interface SleeperPlayerRaw {
  player_id?: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  position?: string | null;
  fantasy_positions?: string[] | null;
  team?: string | null;
  number?: number | null;
  college?: string | null;
  years_exp?: number | null;
  status?: string | null;
  active?: boolean | null;
  injury_status?: string | null;
}

function isFantasyRelevant(p: SleeperPlayerRaw): boolean {
  if (p.position && FANTASY_POSITIONS.has(p.position)) return true;
  return (p.fantasy_positions || []).some(pos => FANTASY_POSITIONS.has(pos));
}

/**
 * Sleeper leaves `full_name` null on team defenses, where the name lives in
 * first_name/last_name ("Seattle" / "Seahawks"). Without this, every DEF in a
 * lineup resolves to undefined — which is exactly the kind of hole that ends
 * up in a published article.
 */
function resolveName(p: SleeperPlayerRaw): string | null {
  if (p.full_name) return p.full_name;
  const joined = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
  return joined || null;
}

export function normalizePlayer(p: SleeperPlayerRaw): NflPlayer | null {
  const playerId = p.player_id;
  const fullName = resolveName(p);
  // No id or no name means nothing downstream can use it, and a row with a
  // blank name is worse than an absent one — it renders as an empty gap.
  if (!playerId || !fullName) return null;

  return {
    player_id: playerId,
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
  };
}

export interface SyncResult {
  fetched: number;
  relevant: number;
  upserted: number;
  skipped: number;
}

/**
 * Refresh the local player cache from Sleeper.
 *
 * Sleeper asks that this endpoint be called at most once per day — it is ~14 MB.
 * Rows are upserted rather than replaced so players who retire stay resolvable
 * for historical articles.
 */
export async function syncPlayers(
  onProgress?: (msg: string) => void
): Promise<SyncResult> {
  const log = onProgress ?? (() => {});

  log('Fetching Sleeper player database (~14 MB)...');
  const response = await fetch(SLEEPER_PLAYERS_URL);
  if (!response.ok) {
    throw new Error(`Sleeper players request failed: HTTP ${response.status}`);
  }

  const raw = (await response.json()) as Record<string, SleeperPlayerRaw>;
  const fetched = Object.keys(raw).length;
  log(`Fetched ${fetched.toLocaleString()} players.`);

  const relevant = Object.values(raw).filter(isFantasyRelevant);
  const rows: NflPlayer[] = [];
  let skipped = 0;
  for (const p of relevant) {
    const row = normalizePlayer(p);
    if (row) rows.push(row);
    else skipped++;
  }
  log(`${rows.length.toLocaleString()} fantasy-relevant players to upsert (${skipped} skipped for missing id/name).`);

  // Chunked: a single upsert of ~4.4k rows exceeds what PostgREST will accept
  // comfortably, and a partial failure is easier to locate in a smaller batch.
  const CHUNK = 500;
  let upserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    // Cast: nfl_players is not in the generated database.types.ts, which the
    // repo treats as only partially accurate (see CLAUDE.md). Without this the
    // typed client narrows the row type to `never`.
    const { error } = await (supabase.from('nfl_players') as any)
      .upsert(chunk.map(r => ({ ...r, synced_at: new Date().toISOString() })), {
        onConflict: 'player_id',
      });
    if (error) {
      throw new Error(
        `Upsert failed at rows ${i}-${i + chunk.length}: ${error.message}`
      );
    }
    upserted += chunk.length;
    log(`  upserted ${upserted.toLocaleString()} / ${rows.length.toLocaleString()}`);
  }

  return { fetched, relevant: relevant.length, upserted, skipped };
}

/**
 * Resolve a batch of Sleeper player ids. Returns a Map so callers can look up
 * a lineup in order without repeated scans; ids with no cached row are simply
 * absent, and callers should handle that rather than assume a hit.
 */
export async function getPlayers(playerIds: string[]): Promise<Map<string, NflPlayer>> {
  const unique = Array.from(new Set(playerIds.filter(Boolean)));
  if (unique.length === 0) return new Map();

  const found = new Map<string, NflPlayer>();

  // `.in()` on a very long list makes an unwieldy URL; chunk it.
  const CHUNK = 200;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const { data, error } = await (supabase.from('nfl_players') as any)
      .select('*')
      .in('player_id', unique.slice(i, i + CHUNK));

    if (error) {
      console.error('Error resolving players:', error.message);
      continue;
    }
    for (const row of (data || []) as NflPlayer[]) {
      found.set(row.player_id, row);
    }
  }

  return found;
}

/** How stale the cache is, for the sync script and any admin surface. */
export async function getPlayerCacheStatus(): Promise<{
  count: number;
  lastSyncedAt: string | null;
}> {
  const { count } = await (supabase.from('nfl_players') as any)
    .select('*', { count: 'exact', head: true });

  const { data } = await (supabase.from('nfl_players') as any)
    .select('synced_at')
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    count: count ?? 0,
    lastSyncedAt: (data as { synced_at: string } | null)?.synced_at ?? null,
  };
}
