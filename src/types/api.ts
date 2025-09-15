// API Response Types and Interfaces

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  success: boolean;
  message?: string;
  error?: string;
}

// Future Sleeper API Integration Types
export interface SleeperUser {
  avatar: string | null;
  display_name: string;
  user_id: string;
  username: string;
}

export interface SleeperLeague {
  avatar: string | null;
  draft_id: string;
  league_id: string;
  name: string;
  previous_league_id: string | null;
  roster_positions: string[];
  scoring_settings: Record<string, number>;
  season: string;
  season_type: string;
  settings: {
    max_keepers: number;
    draft_rounds: number;
    trade_deadline: number;
    playoff_week_start: number;
    num_teams: number;
    type: number;
    pick_trading: number;
    disable_trades: number;
    taxi_years: number;
    taxi_slots: number;
    bench_lock: number;
  };
  status: string;
  total_rosters: number;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string;
  user_id: string;
  league_id: string;
  players: string[];
  starters: string[];
  settings: {
    wins: number;
    waiver_position: number;
    waiver_budget_used: number;
    total_moves: number;
    ties: number;
    losses: number;
    fpts: number;
    fpts_decimal: number;
    fpts_against: number;
    fpts_against_decimal: number;
  };
  metadata: Record<string, any>;
}

export interface SleeperMatchup {
  roster_id: number;
  matchup_id: number;
  points: number;
  players: string[];
  starters: string[];
  players_points: Record<string, number>;
  custom_points: number | null;
}

// Filter and Sort Types
export interface TeamFilter {
  active?: boolean;
  seasonYear?: number;
  divisionId?: number;
  quadId?: number;
}

export interface GameFilter {
  seasonYear?: number;
  week?: number;
  teamId?: number;
  isPlayoff?: boolean;
  completed?: boolean;
}

export interface ArticleFilter {
  category?: string;
  tags?: string[];
  featuredTeamId?: number;
  publishedAfter?: Date;
  publishedBefore?: Date;
}

export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

// Search Types
export interface SearchParams {
  query?: string;
  filters?: Record<string, any>;
  sort?: SortOptions;
  page?: number;
  limit?: number;
}

export interface SearchResult<T> {
  items: T[];
  query: string;
  totalResults: number;
  searchTime: number;
  suggestions?: string[];
}

// Error Types
export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

// Cache Types
export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[];
  revalidate?: boolean;
}

// Webhook Types (for future Contentful/Supabase webhooks)
export interface WebhookPayload {
  type: string;
  data: any;
  timestamp: string;
  source: 'contentful' | 'supabase' | 'sleeper';
}

// Analytics Types (for future implementation)
export interface PageView {
  page: string;
  timestamp: Date;
  userId?: string;
  sessionId: string;
  referrer?: string;
  userAgent: string;
}

export interface UserAction {
  action: string;
  page: string;
  element?: string;
  timestamp: Date;
  userId?: string;
  sessionId: string;
  metadata?: Record<string, any>;
}
