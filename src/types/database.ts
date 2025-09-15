// Supabase Database Schema Types
// 
// IMPORTANT: Team.id maps to Contentful jaddlTeam.teamId
// This links dynamic sports data (Supabase) with static team info (Contentful)

export interface Team {
  team_id: number; // Maps to Contentful jaddlTeam.teamId (actual DB field)
  team_name: string; // Actual DB field
  short_name?: string; // May not exist in all records
  logo?: string;
  owner_name?: string; // May not exist in all records
  active?: boolean; // May not exist in all records
  created_at?: string;
  updated_at?: string;
}

export interface Game {
  id: number;
  year: number; // Actual DB field is 'year' not 'season_year'
  week: number;
  home_team_id: number;
  away_team_id: number;
  home_score: number | null;
  away_score: number | null;
  playoffs?: boolean; // Actual DB field is 'playoffs' not 'is_playoff'
  game_date?: string | null;
  created_at?: string;
  updated_at?: string;
  // Relations
  home_team?: Team;
  away_team?: Team;
}

export interface TeamSeason {
  id: number;
  team_id: number;
  year: number; // Actual DB field is 'year' not 'season_year'
  division_id?: number;
  quad_id?: number;
  active?: boolean; // May not exist
  created_at?: string;
  updated_at?: string;
  // Relations
  team?: Team;
  division?: Division;
  quad?: Quad;
}

export interface LeagueSeason {
  id?: number;
  year: number; // Actual DB field is 'year' not 'season_year'
  team_count: number;
  division_count?: number;
  quad_count?: number;
  playoff_teams?: number;
  is_current?: boolean;
  structure_type?: string; // Added based on DB data
  notes?: string; // Added based on DB data
  created_at?: string;
  updated_at?: string;
}

export interface Division {
  division_id: number;
  division_name: string;
}

export interface Quad {
  quad_id: number;
  quad_name: string;
}

export interface Trophy {
  id: number;
  name: string;
  description?: string;
  emoji?: string;
  category: 'championship' | 'playoff' | 'regular_season' | 'weekly' | 'special';
  is_recurring: boolean;
  created_at: string;
  updated_at: string;
}

export interface TrophyCase {
  id: number;
  trophy_id: number;
  team_id: number;
  year: number;
  points_for?: number;
  points_against?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Relations
  trophy?: Trophy;
  team?: Team;
}

export interface Rivalry {
  id: number;
  name: string;
  description?: string;
  season_year: number;
  created_at: string;
  updated_at: string;
}

export interface Rival {
  id: number;
  rivalry_id: number;
  team_id: number;
  created_at: string;
  updated_at: string;
  // Relations
  rivalry?: Rivalry;
  team?: Team;
}

export interface TeamBio {
  id: number;
  team_id: number;
  season_year: number;
  owner_bio?: string;
  team_story?: string;
  favorite_players?: string[];
  draft_strategy?: string;
  created_at: string;
  updated_at: string;
  // Relations
  team?: Team;
}

export interface FranchiseHistory {
  id: number;
  team_id: number;
  old_name: string;
  new_name: string;
  change_date: string;
  reason?: string;
  created_at: string;
  updated_at: string;
  // Relations
  team?: Team;
}

export interface Draft {
  id: number;
  season_year: number;
  round: number;
  pick: number;
  team_id: number;
  player_name: string;
  position: string;
  nfl_team?: string;
  created_at: string;
  updated_at: string;
  // Relations
  team?: Team;
}

export interface Article {
  id: number;
  contentful_id: string;
  title: string;
  slug: string;
  summary?: string;
  featured_team_id?: number;
  tags?: string[];
  published_at: string;
  created_at: string;
  updated_at: string;
  // Relations
  featured_team?: Team;
}

// Derived/Computed Types
export interface TeamRecord {
  team_id: number;
  team: Team;
  year?: number; // Optional for backward compatibility
  wins: number;
  losses: number;
  ties: number;
  points_for: number;
  points_against: number;
  point_differential: number;
  win_percentage: number;
  division_wins?: number;
  division_losses?: number;
  division_ties?: number;
  quad_wins?: number;
  quad_losses?: number;
  quad_ties?: number;
}

export interface Standings {
  season_year: number;
  overall: TeamRecord[];
  divisions?: {
    [divisionName: string]: TeamRecord[];
  };
  quads?: {
    [quadName: string]: TeamRecord[];
  };
}

export interface WeeklyMatchup {
  game: Game;
  home_team: Team;
  away_team: Team;
  is_completed: boolean;
  winner?: Team;
  margin_of_victory?: number;
}

export interface SeasonSummary {
  season_year: number;
  league_season: LeagueSeason;
  champion?: Team;
  playoff_teams: Team[];
  regular_season_leader?: Team;
  high_scorer?: {
    team: Team;
    points: number;
    week: number;
  };
  trophy_winners: TrophyCase[];
}
