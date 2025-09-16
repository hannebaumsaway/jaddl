import { Asset, Entry } from 'contentful';

// Contentful Content Type Interfaces

export interface ContentfulImage {
  fields: {
    title: string;
    description?: string;
    file: {
      url: string;
      details: {
        size: number;
        image?: {
          width: number;
          height: number;
        };
      };
      fileName: string;
      contentType: string;
    };
  };
}

export interface NewsArticleFields {
  title: string;
  slug: string;
  summary: string;
  content: any; // Rich text content
  featuredImage?: Asset;
  author?: string;
  publishedDate: string;
  tags?: string[];
  featuredTeam?: any;
  isSticky?: boolean;
  category: 'news' | 'analysis' | 'preview' | 'recap' | 'announcement';
}

export interface TeamProfileFields {
  teamId: number;
  teamName: string;
  shortName: string;
  logo?: Asset;
  yearEstablished?: number;
  active?: boolean;
}

export interface LeagueAnnouncementFields {
  title: string;
  message: any; // Rich text content
  type: 'general' | 'rules' | 'schedule' | 'playoff' | 'draft';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  publishedDate: string;
  expirationDate?: string;
  targetAudience?: string[];
  attachments?: Asset[];
}

export interface HistoricalMomentFields {
  title: string;
  description: any; // Rich text
  season: number;
  week?: number;
  date: string;
  involvedTeams?: any[];
  photos?: Asset[];
  videos?: Asset[];
  category: 'championship' | 'upset' | 'record' | 'milestone' | 'funny' | 'drama';
  significance: 'league' | 'team' | 'individual';
}

export interface TrophyFields {
  trophyId: number;
  trophyName: string;
  trophyDescription: any; // Rich text
  trophyImage?: Asset;
}

export interface JaddlArticleFields {
  title: string;
  subtitle?: string;
  content: any; // Rich text content
  year: number;
  week: number;
  tags?: string[];
  featureImage?: Asset; // Note: field name is "featureImage" not "featuredImage"
}

export interface RuleBookFields {
  title: string;
  version: string;
  content: any; // Rich text content
  lastUpdated: string;
  sections?: {
    title: string;
    content: any;
    order: number;
  }[];
  attachments?: Asset[];
  effectiveDate: string;
}

export interface DraftGuideFields {
  title: string;
  season: number;
  content: any; // Rich text content
  publishedDate: string;
  sections?: {
    title: string;
    content: any;
    order: number;
  }[];
  playerRankings?: Asset; // CSV or PDF attachment
  cheatSheets?: Asset[];
  draftDate?: string;
  draftTime?: string;
  draftLocation?: string;
}

// Processed Contentful Types (after fetching and processing)
export interface ProcessedNewsArticle {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: any;
  featuredImage?: {
    url: string;
    alt: string;
    width?: number;
    height?: number;
  };
  author?: string;
  publishedDate: Date;
  tags: string[];
  featuredTeam?: {
    id: string;
    name: string;
    shortName: string;
  };
  isSticky: boolean;
  category: NewsArticleFields['category'];
}

export interface ProcessedTeamProfile {
  id: string;
  teamId: number;
  teamName: string;
  shortName: string;
  logo?: {
    url: string;
    alt: string;
    width?: number;
    height?: number;
  };
  yearEstablished?: number;
  active?: boolean;
}

export interface ProcessedLeagueAnnouncement {
  id: string;
  title: string;
  message: any;
  type: LeagueAnnouncementFields['type'];
  priority: LeagueAnnouncementFields['priority'];
  publishedDate: Date;
  expirationDate?: Date;
  targetAudience: string[];
  attachments: {
    url: string;
    title: string;
    size: number;
    type: string;
  }[];
}

export interface ProcessedHistoricalMoment {
  id: string;
  title: string;
  description: any;
  season: number;
  week?: number;
  date: Date;
  involvedTeams: {
    id: string;
    name: string;
    shortName: string;
  }[];
  photos: {
    url: string;
    alt: string;
    width?: number;
    height?: number;
  }[];
  videos: {
    url: string;
    title: string;
    size: number;
  }[];
  category: HistoricalMomentFields['category'];
  significance: HistoricalMomentFields['significance'];
}

export interface ProcessedTrophy {
  id: string;
  trophyId: number;
  trophyName: string;
  trophyDescription: any;
  trophyImage?: {
    url: string;
    alt: string;
    width?: number;
    height?: number;
  };
}

export interface ProcessedJaddlArticle {
  id: string;
  title: string;
  subtitle?: string;
  content: any;
  year: number;
  week: number;
  tags: string[];
  isPlayoff: boolean;
  featuredImage?: {
    url: string;
    alt: string;
    width?: number;
    height?: number;
  };
  featuredTeams?: {
    id: string;
    teamId: number;
    teamName: string;
    shortName: string;
    logo?: {
      url: string;
      alt: string;
      width?: number;
      height?: number;
    };
  }[];
}

// API Response Types
export interface ContentfulResponse<T> {
  items: any[];
  total: number;
  skip: number;
  limit: number;
}

export interface ContentfulError {
  message: string;
  details?: any;
}
