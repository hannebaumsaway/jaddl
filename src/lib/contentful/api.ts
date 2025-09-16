import { Asset, Entry } from 'contentful';
import { getContentfulClient } from './client';
import { 
  NewsArticleFields, 
  TeamProfileFields, 
  LeagueAnnouncementFields, 
  HistoricalMomentFields,
  TrophyFields,
  JaddlArticleFields,
  ProcessedNewsArticle,
  ProcessedTeamProfile,
  ProcessedLeagueAnnouncement,
  ProcessedHistoricalMoment,
  ProcessedTrophy,
  ProcessedJaddlArticle,
  ContentfulResponse,
} from '@/types/contentful';

// Helper function to process Contentful assets
function processAsset(asset: Asset | undefined) {
  if (!asset?.fields?.file?.url) return undefined;
  
  return {
    url: `https:${asset.fields.file.url}`,
    alt: (asset.fields.title || asset.fields.description || '') as string,
    width: (asset.fields.file.details as any)?.image?.width,
    height: (asset.fields.file.details as any)?.image?.height,
  };
}

// Helper function to process multiple assets
function processAssets(assets: Asset[] | undefined) {
  if (!assets) return [];
  return assets.map(asset => processAsset(asset)).filter(Boolean) as NonNullable<ReturnType<typeof processAsset>>[];
}

// News Articles
export async function getNewsArticles(
  limit = 10,
  skip = 0,
  preview = false
): Promise<ProcessedNewsArticle[]> {
  try {
    const client = getContentfulClient(preview);
    const response = await client.getEntries({
      content_type: 'newsArticle',
      limit,
      skip,
      order: '-fields.publishedDate' as any,
      include: 2,
    });

    return response.items.map(processNewsArticle);
  } catch (error) {
    console.error('Error fetching news articles:', error);
    return [];
  }
}

export async function getNewsArticleBySlug(
  slug: string,
  preview = false
): Promise<ProcessedNewsArticle | null> {
  try {
    const client = getContentfulClient(preview);
    const response = await client.getEntries({
      content_type: 'newsArticle',
      'fields.slug': slug,
      limit: 1,
      include: 2,
    });

    if (response.items.length === 0) return null;
    return processNewsArticle(response.items[0]);
  } catch (error) {
    console.error(`Error fetching news article with slug ${slug}:`, error);
    return null;
  }
}

export async function getFeaturedNewsArticles(
  limit = 5,
  preview = false
): Promise<ProcessedNewsArticle[]> {
  try {
    const client = getContentfulClient(preview);
    const response = await client.getEntries({
      content_type: 'newsArticle',
      'fields.isSticky': true,
      limit,
      order: '-fields.publishedDate' as any,
      include: 2,
    });

    return response.items.map(processNewsArticle);
  } catch (error) {
    console.error('Error fetching featured news articles:', error);
    return [];
  }
}

function processNewsArticle(entry: any): ProcessedNewsArticle {
  const { fields } = entry;
  
  return {
    id: entry.sys.id,
    title: fields.title,
    slug: fields.slug,
    summary: fields.summary,
    content: fields.content,
    featuredImage: processAsset(fields.featureImage), // Note: using featureImage field
    author: fields.author,
    publishedDate: new Date(fields.publishedDate),
    tags: fields.tags || [],
    featuredTeam: fields.featuredTeam ? {
      id: fields.featuredTeam.sys.id,
      name: fields.featuredTeam.fields.teamName,
      shortName: fields.featuredTeam.fields.shortName,
    } : undefined,
    isSticky: fields.isSticky || false,
    category: fields.category,
  };
}

// Team Profiles
export async function getTeamProfiles(preview = false): Promise<ProcessedTeamProfile[]> {
  try {
    const client = getContentfulClient(preview);
    const response = await client.getEntries({
      content_type: 'jaddlTeam',
      order: 'fields.teamName' as any,
      include: 1,
    });

    return response.items.map(processTeamProfile);
  } catch (error) {
    console.error('Error fetching team profiles:', error);
    return [];
  }
}

export async function getTeamProfileById(
  id: string,
  preview = false
): Promise<ProcessedTeamProfile | null> {
  try {
    const client = getContentfulClient(preview);
    const entry = await client.getEntry(id, { include: 1 });
    return processTeamProfile(entry);
  } catch (error) {
    console.error(`Error fetching team profile with id ${id}:`, error);
    return null;
  }
}

function processTeamProfile(entry: any): ProcessedTeamProfile {
  const { fields } = entry;
  
  return {
    id: entry.sys.id,
    teamId: fields.teamId,
    teamName: fields.teamName,
    shortName: fields.shortName,
    logo: processAsset(fields.logo),
    yearEstablished: fields.yearEstablished,
    active: fields.active ?? true, // Default to true if not specified
  };
}

// League Announcements
export async function getLeagueAnnouncements(
  limit = 10,
  preview = false
): Promise<ProcessedLeagueAnnouncement[]> {
  try {
    const client = getContentfulClient(preview);
    const currentDate = new Date().toISOString();
    
    const response = await client.getEntries({
      content_type: 'leagueAnnouncement',
      limit,
      order: '-fields.priority,-fields.publishedDate' as any,
      'fields.publishedDate[lte]': currentDate,
      'fields.expirationDate[gte]': currentDate,
      include: 1,
    });

    return response.items.map(processLeagueAnnouncement);
  } catch (error) {
    console.error('Error fetching league announcements:', error);
    return [];
  }
}

function processLeagueAnnouncement(entry: any): ProcessedLeagueAnnouncement {
  const { fields } = entry;
  
  return {
    id: entry.sys.id,
    title: fields.title,
    message: fields.message,
    type: fields.type,
    priority: fields.priority,
    publishedDate: new Date(fields.publishedDate),
    expirationDate: fields.expirationDate ? new Date(fields.expirationDate) : undefined,
    targetAudience: fields.targetAudience || [],
    attachments: fields.attachments?.map((asset: any) => ({
      url: `https:${asset.fields.file.url}`,
      title: asset.fields.title,
      size: asset.fields.file.details.size,
      type: asset.fields.file.contentType,
    })) || [],
  };
}

// Historical Moments
export async function getHistoricalMoments(
  season?: number,
  limit = 20,
  preview = false
): Promise<ProcessedHistoricalMoment[]> {
  try {
    const client = getContentfulClient(preview);
    const query: any = {
      content_type: 'historicalMoment',
      limit,
      order: '-fields.date' as any,
      include: 2,
    };

    if (season) {
      query['fields.season'] = season;
    }

    const response = await client.getEntries(query);
    return response.items.map(processHistoricalMoment);
  } catch (error) {
    console.error('Error fetching historical moments:', error);
    return [];
  }
}

function processHistoricalMoment(entry: any): ProcessedHistoricalMoment {
  const { fields } = entry;
  
  return {
    id: entry.sys.id,
    title: fields.title,
    description: fields.description,
    season: fields.season,
    week: fields.week,
    date: new Date(fields.date),
    involvedTeams: fields.involvedTeams?.map((team: any) => ({
      id: team.sys.id,
      name: team.fields.teamName,
      shortName: team.fields.shortName,
    })) || [],
    photos: processAssets(fields.photos),
    videos: fields.videos?.map((video: any) => ({
      url: `https:${video.fields.file.url}`,
      title: video.fields.title,
      size: video.fields.file.details.size,
    })) || [],
    category: fields.category,
    significance: fields.significance,
  };
}

// Trophies
export async function getTrophies(preview = false): Promise<ProcessedTrophy[]> {
  try {
    const client = getContentfulClient(preview);
    const response = await client.getEntries({
      content_type: 'jaddlTrophy',
      order: 'fields.trophyName' as any,
      include: 2, // Increase include level to ensure assets are loaded
    });

    return response.items.map(processTrophy);
  } catch (error) {
    console.error('Error fetching trophies:', error);
    return [];
  }
}

export async function getTrophyById(
  id: string,
  preview = false
): Promise<ProcessedTrophy | null> {
  try {
    const client = getContentfulClient(preview);
    const entry = await client.getEntry(id, { include: 1 });
    return processTrophy(entry);
  } catch (error) {
    console.error(`Error fetching trophy with id ${id}:`, error);
    return null;
  }
}

function processTrophy(entry: any): ProcessedTrophy {
  const { fields } = entry;
  
  return {
    id: entry.sys.id,
    trophyId: fields.trophyId,
    trophyName: fields.trophyName,
    trophyDescription: fields.trophyDescription,
    trophyImage: processAsset(fields.trophyImage),
  };
}

// JADDL Articles
export async function getJaddlArticles(
  limit = 20,
  skip = 0,
  year?: number,
  week?: number,
  tags?: string[],
  searchQuery?: string,
  isPlayoff?: boolean,
  preview = false
): Promise<ProcessedJaddlArticle[]> {
  try {
    const client = getContentfulClient(preview);
    const query: any = {
      content_type: 'jaddlArticle',
      limit,
      skip,
      order: '-fields.year,-fields.week' as any,
      include: 2, // Include referenced content (featuredTeams)
    };

    // Add filters
    if (year !== undefined) {
      query['fields.year'] = year;
    }
    if (week !== undefined) {
      query['fields.week'] = week;
    }
    if (isPlayoff !== undefined) {
      query['fields.week[gte]'] = isPlayoff ? 13 : 0;
      query['fields.week[lte]'] = isPlayoff ? 20 : 12;
    }
    if (tags && tags.length > 0) {
      query['fields.tags[in]'] = tags.join(',');
    }
    if (searchQuery) {
      query['query'] = searchQuery;
    }

    const response = await client.getEntries(query);
    return response.items.map(processJaddlArticle);
  } catch (error) {
    console.error('Error fetching JADDL articles:', error);
    return [];
  }
}

export async function getJaddlArticleById(
  id: string,
  preview = false
): Promise<ProcessedJaddlArticle | null> {
  try {
    const client = getContentfulClient(preview);
    const entry = await client.getEntry(id, { include: 1 });
    return processJaddlArticle(entry);
  } catch (error) {
    console.error(`Error fetching JADDL article with id ${id}:`, error);
    return null;
  }
}

export async function getJaddlArticleBySlug(
  slug: string,
  preview = false
): Promise<ProcessedJaddlArticle | null> {
  try {
    const { parseArticleSlug } = await import('@/lib/utils/slug');
    const parsed = parseArticleSlug(slug);
    
    if (!parsed) {
      return null;
    }

    const { year, week, titleSlug } = parsed;
    
    const client = getContentfulClient(preview);
    const entries = await client.getEntries({
      content_type: 'jaddlArticle',
      'fields.year': year,
      'fields.week': week,
      include: 1,
    });

    // Find the article that matches the title slug
    for (const entry of entries.items) {
      const article = processJaddlArticle(entry);
      const { generateSlug } = await import('@/lib/utils/slug');
      if (generateSlug(article.title) === titleSlug) {
        return article;
      }
    }

    return null;
  } catch (error) {
    console.error(`Error fetching JADDL article with slug ${slug}:`, error);
    return null;
  }
}

export async function getJaddlArticleYears(preview = false): Promise<number[]> {
  try {
    const client = getContentfulClient(preview);
    const response = await client.getEntries({
      content_type: 'jaddlArticle',
      select: 'fields.year' as any,
      limit: 1000,
    });

    const years = response.items
      .map((item: any) => item.fields.year)
      .filter((year: any, index: number, arr: any[]) => arr.indexOf(year) === index)
      .sort((a: any, b: any) => b - a);

    return years;
  } catch (error) {
    console.error('Error fetching JADDL article years:', error);
    return [];
  }
}

export async function getJaddlArticleTags(preview = false): Promise<string[]> {
  try {
    const client = getContentfulClient(preview);
    const response = await client.getEntries({
      content_type: 'jaddlArticle',
      select: 'fields.tags' as any,
      limit: 1000,
    });

    const allTags = response.items
      .flatMap((item: any) => item.fields.tags || [])
      .filter((tag: any, index: number, arr: any[]) => arr.indexOf(tag) === index)
      .sort();

    return allTags;
  } catch (error) {
    console.error('Error fetching JADDL article tags:', error);
    return [];
  }
}

function processJaddlArticle(entry: any): ProcessedJaddlArticle {
  const { fields } = entry;
  
  return {
    id: entry.sys.id,
    title: fields.title,
    subtitle: fields.subtitle,
    content: fields.content,
    year: fields.year,
    week: fields.week,
    tags: fields.tags || [],
    isPlayoff: fields.week >= 13, // Week 13+ is considered playoff
    featuredImage: processAsset(fields.featureImage), // Note: using featureImage field
    featuredTeams: fields.featuredTeams?.map((team: any) => ({
      id: team.sys.id,
      teamId: team.fields.teamId,
      teamName: team.fields.teamName,
      shortName: team.fields.shortName,
      logo: processAsset(team.fields.logo),
    })) || [],
  };
}

// ISR Revalidation helper
export async function revalidateContentfulContent(tag: string) {
  try {
    const response = await fetch(`/api/revalidate?tag=${tag}`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      throw new Error('Failed to revalidate content');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error revalidating content:', error);
    throw error;
  }
}
