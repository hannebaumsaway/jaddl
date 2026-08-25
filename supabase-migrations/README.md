# Supabase Migrations

This directory contains SQL migration files for database schema changes.

## Migration Files

### 001_playoff_seeds.sql

Creates the `playoff_seeds` table to store official playoff seedings and pod assignments.

**When to run:** After Week 14 is complete for the 2025 season (or any season using pod structure).

**What it does:**
- Creates `playoff_seeds` table with seed, team, and pod assignments
- For 2025: Seeds 1-2 have `pod=NULL` (byes), Pod A = seeds 3,5,8, Pod B = seeds 4,6,7
- Stores whether each team is a division winner or wildcard

**Usage:**
1. Run the SQL in your Supabase SQL Editor
2. After Week 14 completes, call `savePlayoffSeeds(year)` from the API to populate the table
3. The pod structure can then be queried from the database

### 002_2026_season.sql

Sets up the 2026 season: back to 2 divisions (East/West) after the 2019-2025 quad era.

**When to run:** Before importing Week 1 of 2026.

**What it does:**
- Adds the `league_seasons` row for 2026 with `structure_type = 'divisions'`
- Adds 12 `team_seasons` rows split 6/6 across the existing East (1) and West (2) division rows, with `quad_id` NULL
- Assignments mirror the Sleeper league's own division settings

**Note:** adding the `league_seasons` row makes 2026 the current season for the home page immediately, so that page reads empty until Week 1 games are imported.





### 003_nfl_players.sql

Creates the `nfl_players` table: a local cache of Sleeper's NFL player database,
so player ids in matchups resolve to real players without a hand-maintained map.

**When to run:** once, before the first `pnpm sync-players`.

**What it does:**
- Creates `nfl_players` keyed by Sleeper's `player_id` (text — team defenses use
  the NFL abbreviation, e.g. `SEA`, not a number)
- Indexes position, NFL team, and lower(full_name)

**Usage:**
1. Run the SQL in your Supabase SQL Editor
2. `pnpm sync-players` to populate it (`--force` to bypass the once-daily guard)

**Notes:**
- Scope is fantasy-relevant positions only (QB/RB/WR/TE/K/DEF), but includes
  retired and inactive players — historical articles need players who are no
  longer active, so filtering on `active` would break them.
- Rows are upserted and never deleted, for the same reason.
- Sleeper asks that `/v1/players/nfl` be called at most once per day. That is
  the reason this table exists; `sync-players` enforces a 20-hour minimum.

### 004_row_level_security.sql

Enables row-level security on every table and adds public read-only policies.

**When to run:** only *after* `SUPABASE_SERVICE_ROLE_KEY` is set in `.env.local`
and in Vercel (Production **and** Preview). Running it first breaks score
import, playoff seeding and `pnpm sync-players` until the key exists.

**What it does:**
- `ENABLE ROW LEVEL SECURITY` on all 14 tables
- One `FOR SELECT USING (true)` policy each — the site is public and reads with
  the anon key
- Deliberately **no** write policies; absent a policy, RLS denies the action

**Why:** `NEXT_PUBLIC_SUPABASE_ANON_KEY` is compiled into the JavaScript every
visitor downloads. With no RLS, anyone could extract it and write to `games`
directly, bypassing the admin auth in `src/proxy.ts` entirely. Verified
2026-08-25: an anon-key `UPDATE` on `games` returned no permission error.

**After running:** writes go through `getAdminClient()` in
`src/lib/supabase/admin.ts`, which uses the service-role key. The service role
bypasses RLS by design, so no write policies are needed. That client throws if
it is ever reached from the browser.
