'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProcessedJaddlArticle } from '@/types/contentful';
import { FilterState } from '@/components/news/article-filters';

interface UseArticleSearchProps {
  articles: ProcessedJaddlArticle[];
}

export function useArticleSearch({ articles }: UseArticleSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Initialize state from URL params
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '');
  const [filters, setFilters] = useState<FilterState>(() => {
    const year = searchParams.get('year');
    const week = searchParams.get('week');
    const isPlayoff = searchParams.get('playoff');
    const tags = searchParams.get('tags');
    const teams = searchParams.get('teams');
    
    return {
      year: year ? parseInt(year) : undefined,
      week: week ? parseInt(week) : undefined,
      isPlayoff: isPlayoff ? isPlayoff === 'true' : undefined,
      tags: tags ? tags.split(',') : [],
      featuredTeams: teams ? teams.split(',').map(id => parseInt(id)) : []
    };
  });

  // Update URL when filters or search query change
  const updateURL = useCallback((newSearchQuery: string, newFilters: FilterState) => {
    const params = new URLSearchParams();
    
    if (newSearchQuery.trim()) {
      params.set('q', newSearchQuery.trim());
    }
    
    if (newFilters.year !== undefined) {
      params.set('year', newFilters.year.toString());
    }
    
    if (newFilters.week !== undefined) {
      params.set('week', newFilters.week.toString());
    }
    
    if (newFilters.isPlayoff !== undefined) {
      params.set('playoff', newFilters.isPlayoff.toString());
    }
    
    if (newFilters.tags.length > 0) {
      params.set('tags', newFilters.tags.join(','));
    }
    
    if (newFilters.featuredTeams.length > 0) {
      params.set('teams', newFilters.featuredTeams.join(','));
    }
    
    const newURL = params.toString() ? `?${params.toString()}` : '';
    router.replace(newURL as any, { scroll: false });
  }, [router]);

  // Extract text content from Rich Text for search
  const extractTextFromRichText = useCallback((content: any): string => {
    if (!content?.content) return '';
    
    let text = '';
    const extractText = (node: any) => {
      if (node.nodeType === 'text') {
        text += node.value + ' ';
      } else if (node.content) {
        node.content.forEach(extractText);
      }
    };
    
    content.content.forEach(extractText);
    return text.toLowerCase();
  }, []);

  // Filter and search articles
  const filteredArticles = useMemo(() => {
    let filtered = articles;

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(article => {
        const titleMatch = article.title.toLowerCase().includes(query);
        const subtitleMatch = article.subtitle?.toLowerCase().includes(query) || false;
        const contentMatch = extractTextFromRichText(article.content).includes(query);
        const tagMatch = article.tags.some(tag => tag.toLowerCase().includes(query));
        
        return titleMatch || subtitleMatch || contentMatch || tagMatch;
      });
    }

    // Apply filters
    if (filters.year !== undefined) {
      filtered = filtered.filter(article => article.year === filters.year);
    }

    if (filters.week !== undefined) {
      filtered = filtered.filter(article => article.week === filters.week);
    }

    if (filters.isPlayoff !== undefined) {
      filtered = filtered.filter(article => article.isPlayoff === filters.isPlayoff);
    }

    if (filters.tags.length > 0) {
      filtered = filtered.filter(article => 
        filters.tags.some(tag => article.tags.includes(tag))
      );
    }

    if (filters.featuredTeams.length > 0) {
      filtered = filtered.filter(article => 
        article.featuredTeams?.some(team => 
          filters.featuredTeams.includes(team.teamId)
        )
      );
    }

    return filtered;
  }, [articles, searchQuery, filters, extractTextFromRichText]);

  // Get available years and tags from articles
  const availableYears = useMemo(() => {
    const years = articles.map(article => article.year);
    return Array.from(new Set(years)).sort((a, b) => b - a);
  }, [articles]);

  const availableTags = useMemo(() => {
    const tags = articles.flatMap(article => article.tags);
    return Array.from(new Set(tags)).sort();
  }, [articles]);

  const availableTeams = useMemo(() => {
    const teams = articles.flatMap(article => article.featuredTeams || []);
    // Remove duplicates based on teamId
    const uniqueTeams = teams.filter((team, index, self) => 
      index === self.findIndex(t => t.teamId === team.teamId)
    );
    return uniqueTeams.sort((a, b) => a.teamName.localeCompare(b.teamName));
  }, [articles]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    updateURL('', filters);
  }, [filters, updateURL]);

  const clearFilters = useCallback(() => {
    const newFilters = {
      year: undefined,
      week: undefined,
      isPlayoff: undefined,
      tags: [],
      featuredTeams: []
    };
    setFilters(newFilters);
    updateURL(searchQuery, newFilters);
  }, [searchQuery, updateURL]);

  const clearAll = useCallback(() => {
    const newFilters = {
      year: undefined,
      week: undefined,
      isPlayoff: undefined,
      tags: [],
      featuredTeams: []
    };
    setSearchQuery('');
    setFilters(newFilters);
    updateURL('', newFilters);
  }, [updateURL]);

  // Sync URL changes back to state (for browser back/forward)
  useEffect(() => {
    const newSearchQuery = searchParams.get('q') || '';
    const newFilters: FilterState = {
      year: searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined,
      week: searchParams.get('week') ? parseInt(searchParams.get('week')!) : undefined,
      isPlayoff: searchParams.get('playoff') ? searchParams.get('playoff') === 'true' : undefined,
      tags: searchParams.get('tags') ? searchParams.get('tags')!.split(',') : [],
      featuredTeams: searchParams.get('teams') ? searchParams.get('teams')!.split(',').map(id => parseInt(id)) : []
    };
    
    setSearchQuery(newSearchQuery);
    setFilters(newFilters);
  }, [searchParams]);

  // Wrapper functions that update both state and URL
  const setSearchQueryWithURL = useCallback((query: string) => {
    setSearchQuery(query);
    updateURL(query, filters);
  }, [filters, updateURL]);

  const setFiltersWithURL = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
    updateURL(searchQuery, newFilters);
  }, [searchQuery, updateURL]);

  return {
    searchQuery,
    setSearchQuery: setSearchQueryWithURL,
    filters,
    setFilters: setFiltersWithURL,
    filteredArticles,
    availableYears,
    availableTags,
    availableTeams,
    clearSearch,
    clearFilters,
    clearAll,
    hasActiveSearch: searchQuery.trim().length > 0,
    hasActiveFilters: 
      filters.year !== undefined || 
      filters.week !== undefined || 
      filters.isPlayoff !== undefined || 
      filters.tags.length > 0 ||
      filters.featuredTeams.length > 0,
    totalResults: filteredArticles.length
  };
}
