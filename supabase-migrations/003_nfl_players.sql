-- 003_nfl_players.sql
--
-- Local cache of Sleeper's NFL player database, so Sleeper player_ids in
-- matchups can be resolved to real players without a hand-maintained map.
-- Replaces the manual nfl.json workflow.
--
-- Populated by `pnpm sync-players`, which reads
-- https://api.sleeper.app/v1/players/nfl. That endpoint returns ~14 MB / 12k
-- players and Sleeper asks that it be called at most once per day, which is
-- the whole reason this table exists.
--
-- Scope: fantasy-relevant players only (QB/RB/WR/TE/K/DEF, roughly 4.4k rows),
-- but INCLUDING retired and inactive ones. Filtering to active players would
-- make historical articles unresolvable — a 2011 game needs 2011 rosters.
--
-- Rows are upserted and never deleted, for the same reason.

BEGIN;

CREATE TABLE nfl_players (
  -- Sleeper's id. Numeric for people ("4034"), the NFL abbreviation for team
  -- defenses ("SEA"), so this is text rather than an integer.
  player_id         TEXT PRIMARY KEY,

  -- Sleeper leaves full_name NULL on team defenses; the sync fills it from
  -- first_name + last_name ("Seattle Seahawks") so this is always usable.
  full_name         TEXT NOT NULL,
  first_name        TEXT,
  last_name         TEXT,

  position          TEXT,
  fantasy_positions TEXT[],

  -- Current NFL team abbreviation. NULL for free agents and retired players.
  -- Named nfl_team to avoid confusion with the league's own `teams` table.
  nfl_team          TEXT,

  jersey_number     INTEGER,
  college           TEXT,
  years_exp         INTEGER,

  -- Sleeper's own status string ("Active", "Inactive", "Injured Reserve", ...)
  status            TEXT,
  active            BOOLEAN NOT NULL DEFAULT false,
  injury_status     TEXT,

  -- When this row was last refreshed from Sleeper.
  synced_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Resolving a batch of ids from a matchup is the hot path.
CREATE INDEX idx_nfl_players_position ON nfl_players (position);
CREATE INDEX idx_nfl_players_nfl_team ON nfl_players (nfl_team);

-- Case-insensitive name lookup, for turning a name in an article back into a
-- player (tagging) rather than the other way round.
CREATE INDEX idx_nfl_players_lower_name ON nfl_players (lower(full_name));

COMMENT ON TABLE nfl_players IS
  'Cache of Sleeper''s NFL player database. Refreshed by `pnpm sync-players` (at most daily, per Sleeper''s guidance). Includes retired players so historical matchups stay resolvable; rows are upserted, never deleted.';

COMMIT;

-- Verification after the first sync: expect ~4,400 rows, ~3,300 active,
-- and 32 team defenses with a usable name.
--
-- SELECT COUNT(*) AS total,
--        COUNT(*) FILTER (WHERE active) AS active,
--        COUNT(*) FILTER (WHERE position = 'DEF') AS defenses
-- FROM nfl_players;
--
-- SELECT player_id, full_name, nfl_team FROM nfl_players WHERE position = 'DEF' LIMIT 3;
