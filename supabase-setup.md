# Supabase Setup Guide

## Creating a New Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Choose your organization
4. Fill in project details:
   - **Name**: JADDL Fantasy Football
   - **Database Password**: Choose a strong password
   - **Region**: Choose closest to your users
5. Click "Create new project"

## Database Schema Setup

Once your project is created, you'll need to set up the database schema. Go to the SQL Editor in your Supabase dashboard and run this SQL:

```sql
-- Create teams table
CREATE TABLE teams (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  short_name VARCHAR(10) NOT NULL,
  logo TEXT,
  owner_name VARCHAR(255) NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create league_seasons table
CREATE TABLE league_seasons (
  id SERIAL PRIMARY KEY,
  season_year INTEGER NOT NULL,
  team_count INTEGER NOT NULL,
  division_count INTEGER,
  quad_count INTEGER,
  playoff_teams INTEGER NOT NULL,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create divisions table
CREATE TABLE divisions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  season_year INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create quads table
CREATE TABLE quads (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  season_year INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create team_seasons table
CREATE TABLE team_seasons (
  id SERIAL PRIMARY KEY,
  team_id INTEGER REFERENCES teams(id),
  season_year INTEGER NOT NULL,
  division_id INTEGER REFERENCES divisions(id),
  quad_id INTEGER REFERENCES quads(id),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create games table
CREATE TABLE games (
  id SERIAL PRIMARY KEY,
  season_year INTEGER NOT NULL,
  week INTEGER NOT NULL,
  home_team_id INTEGER REFERENCES teams(id),
  away_team_id INTEGER REFERENCES teams(id),
  home_score DECIMAL(5,1),
  away_score DECIMAL(5,1),
  is_playoff BOOLEAN DEFAULT false,
  game_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create trophy categories enum
CREATE TYPE trophy_category AS ENUM ('championship', 'playoff', 'regular_season', 'weekly', 'special');

-- Create trophies table
CREATE TABLE trophies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  emoji VARCHAR(10),
  category trophy_category NOT NULL,
  is_recurring BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create trophy_case table
CREATE TABLE trophy_case (
  id SERIAL PRIMARY KEY,
  trophy_id INTEGER REFERENCES trophies(id),
  team_id INTEGER REFERENCES teams(id),
  season_year INTEGER NOT NULL,
  week INTEGER,
  points_for DECIMAL(5,1),
  points_against DECIMAL(5,1),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create rivalries table
CREATE TABLE rivalries (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  season_year INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create rivals table
CREATE TABLE rivals (
  id SERIAL PRIMARY KEY,
  rivalry_id INTEGER REFERENCES rivalries(id),
  team_id INTEGER REFERENCES teams(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create team_bios table
CREATE TABLE team_bios (
  id SERIAL PRIMARY KEY,
  team_id INTEGER REFERENCES teams(id),
  season_year INTEGER NOT NULL,
  owner_bio TEXT,
  team_story TEXT,
  favorite_players TEXT[],
  draft_strategy TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create franchise_history table
CREATE TABLE franchise_history (
  id SERIAL PRIMARY KEY,
  team_id INTEGER REFERENCES teams(id),
  old_name VARCHAR(255) NOT NULL,
  new_name VARCHAR(255) NOT NULL,
  change_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create drafts table
CREATE TABLE drafts (
  id SERIAL PRIMARY KEY,
  season_year INTEGER NOT NULL,
  round INTEGER NOT NULL,
  pick INTEGER NOT NULL,
  team_id INTEGER REFERENCES teams(id),
  player_name VARCHAR(255) NOT NULL,
  position VARCHAR(10) NOT NULL,
  nfl_team VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create articles table (links to Contentful)
CREATE TABLE articles (
  id SERIAL PRIMARY KEY,
  contentful_id VARCHAR(255) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  summary TEXT,
  featured_team_id INTEGER REFERENCES teams(id),
  tags TEXT[],
  published_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_games_season_week ON games(season_year, week);
CREATE INDEX idx_team_seasons_year ON team_seasons(season_year);
CREATE INDEX idx_trophy_case_season ON trophy_case(season_year);
CREATE INDEX idx_articles_published ON articles(published_at DESC);

-- Add some sample data
INSERT INTO teams (name, short_name, owner_name, logo) VALUES
('Victory Lane', 'VIC', 'Drew R.', '🏁'),
('Final Four', 'FF4', 'Quinn U.', '4️⃣'),
('Thunder Cats', 'THU', 'Alex J.', '⚡'),
('Dream Team', 'DRM', 'Blake T.', '💭'),
('Playoff Push', 'PPU', 'Casey M.', '🚀'),
('Gridiron Gurus', 'GRG', 'Taylor N.', '🧠'),
('Fantasy Force', 'FFC', 'Riley P.', '⚡'),
('Elite Squad', 'ELI', 'Morgan K.', '🏆'),
('Power Plays', 'PWR', 'Avery S.', '⚡'),
('Championship Chase', 'CHA', 'Sam Q.', '🏃'),
('Dynasty Kings', 'DYN', 'Jordan L.', '👑'),
('Bench Warmers', 'BWR', 'Reese V.', '🪑');

-- Add current season
INSERT INTO league_seasons (season_year, team_count, playoff_teams, is_current) 
VALUES (2024, 12, 6, true);
```

## Getting API Credentials

After creating your project:
1. Go to **Settings** → **API**
2. Copy the **Project URL** and **Project API keys** → **anon public**
3. These are your `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
