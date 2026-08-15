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




