-- Create playoff_seeds table to store official playoff seedings and pod assignments
-- This table stores the official playoff structure after Week 14 is complete

CREATE TABLE playoff_seeds (
  id SERIAL PRIMARY KEY,
  season_year INTEGER NOT NULL,
  team_id INTEGER NOT NULL REFERENCES teams(team_id),
  seed INTEGER NOT NULL CHECK (seed >= 1 AND seed <= 8),
  is_division_winner BOOLEAN NOT NULL DEFAULT false,
  is_wildcard BOOLEAN NOT NULL DEFAULT false,
  pod VARCHAR(1) CHECK (pod IN ('A', 'B') OR pod IS NULL), -- NULL for byes (seeds 1-2)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(season_year, team_id),
  UNIQUE(season_year, seed)
);

-- Create index for efficient lookups
CREATE INDEX idx_playoff_seeds_season_year ON playoff_seeds(season_year);
CREATE INDEX idx_playoff_seeds_season_pod ON playoff_seeds(season_year, pod);

-- Add comment
COMMENT ON TABLE playoff_seeds IS 'Stores official playoff seedings and pod assignments. For 2025, seeds 1-2 have pod=NULL (byes), seeds 3,5,8 are pod=A, seeds 4,6,7 are pod=B';


