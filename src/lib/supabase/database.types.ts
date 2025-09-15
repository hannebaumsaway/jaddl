// Auto-generated types for Supabase database schema
// This file should be regenerated when the database schema changes

export interface Database {
  public: {
    Tables: {
      teams: {
        Row: {
          id: number;
          name: string;
          short_name: string;
          logo: string | null;
          owner_name: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          short_name: string;
          logo?: string | null;
          owner_name: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          short_name?: string;
          logo?: string | null;
          owner_name?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      games: {
        Row: {
          id: number;
          season_year: number;
          week: number;
          home_team_id: number;
          away_team_id: number;
          home_score: number | null;
          away_score: number | null;
          is_playoff: boolean;
          game_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          season_year: number;
          week: number;
          home_team_id: number;
          away_team_id: number;
          home_score?: number | null;
          away_score?: number | null;
          is_playoff?: boolean;
          game_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          season_year?: number;
          week?: number;
          home_team_id?: number;
          away_team_id?: number;
          home_score?: number | null;
          away_score?: number | null;
          is_playoff?: boolean;
          game_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      team_seasons: {
        Row: {
          id: number;
          team_id: number;
          season_year: number;
          division_id: number | null;
          quad_id: number | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          team_id: number;
          season_year: number;
          division_id?: number | null;
          quad_id?: number | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          team_id?: number;
          season_year?: number;
          division_id?: number | null;
          quad_id?: number | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      league_seasons: {
        Row: {
          id: number;
          season_year: number;
          team_count: number;
          division_count: number | null;
          quad_count: number | null;
          playoff_teams: number;
          is_current: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          season_year: number;
          team_count: number;
          division_count?: number | null;
          quad_count?: number | null;
          playoff_teams: number;
          is_current?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          season_year?: number;
          team_count?: number;
          division_count?: number | null;
          quad_count?: number | null;
          playoff_teams?: number;
          is_current?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      divisions: {
        Row: {
          id: number;
          name: string;
          season_year: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          season_year: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          season_year?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      quads: {
        Row: {
          id: number;
          name: string;
          season_year: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          season_year: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          season_year?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      trophies: {
        Row: {
          id: number;
          name: string;
          description: string | null;
          emoji: string | null;
          category: 'championship' | 'playoff' | 'regular_season' | 'weekly' | 'special';
          is_recurring: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          description?: string | null;
          emoji?: string | null;
          category: 'championship' | 'playoff' | 'regular_season' | 'weekly' | 'special';
          is_recurring?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          description?: string | null;
          emoji?: string | null;
          category?: 'championship' | 'playoff' | 'regular_season' | 'weekly' | 'special';
          is_recurring?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      trophy_case: {
        Row: {
          id: number;
          trophy_id: number;
          team_id: number;
          year: number;
          points_for: number | null;
          points_against: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          trophy_id: number;
          team_id: number;
          year: number;
          points_for?: number | null;
          points_against?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          trophy_id?: number;
          team_id?: number;
          year?: number;
          points_for?: number | null;
          points_against?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      rivalries: {
        Row: {
          id: number;
          name: string;
          description: string | null;
          season_year: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          description?: string | null;
          season_year: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          description?: string | null;
          season_year?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      rivals: {
        Row: {
          id: number;
          rivalry_id: number;
          team_id: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          rivalry_id: number;
          team_id: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          rivalry_id?: number;
          team_id?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      team_bios: {
        Row: {
          id: number;
          team_id: number;
          season_year: number;
          owner_bio: string | null;
          team_story: string | null;
          favorite_players: string[] | null;
          draft_strategy: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          team_id: number;
          season_year: number;
          owner_bio?: string | null;
          team_story?: string | null;
          favorite_players?: string[] | null;
          draft_strategy?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          team_id?: number;
          season_year?: number;
          owner_bio?: string | null;
          team_story?: string | null;
          favorite_players?: string[] | null;
          draft_strategy?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      franchise_history: {
        Row: {
          id: number;
          team_id: number;
          old_name: string;
          new_name: string;
          change_date: string;
          reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          team_id: number;
          old_name: string;
          new_name: string;
          change_date: string;
          reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          team_id?: number;
          old_name?: string;
          new_name?: string;
          change_date?: string;
          reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      drafts: {
        Row: {
          id: number;
          season_year: number;
          round: number;
          pick: number;
          team_id: number;
          player_name: string;
          position: string;
          nfl_team: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          season_year: number;
          round: number;
          pick: number;
          team_id: number;
          player_name: string;
          position: string;
          nfl_team?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          season_year?: number;
          round?: number;
          pick?: number;
          team_id?: number;
          player_name?: string;
          position?: string;
          nfl_team?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      articles: {
        Row: {
          id: number;
          contentful_id: string;
          title: string;
          slug: string;
          summary: string | null;
          featured_team_id: number | null;
          tags: string[] | null;
          published_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          contentful_id: string;
          title: string;
          slug: string;
          summary?: string | null;
          featured_team_id?: number | null;
          tags?: string[] | null;
          published_at: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          contentful_id?: string;
          title?: string;
          slug?: string;
          summary?: string | null;
          featured_team_id?: number | null;
          tags?: string[] | null;
          published_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      trophy_category: 'championship' | 'playoff' | 'regular_season' | 'weekly' | 'special';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
