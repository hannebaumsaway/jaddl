'use client';

import { useState, useCallback, useMemo } from 'react';
import { ProcessedJaddlArticle } from '@/types/contentful';
import { FilterState } from '@/components/news/article-filters';

interface UseArticleSearchProps {
  articles: ProcessedJaddlArticle[];
}

export function useArticleSearch({ articles }: UseArticleSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>({
    year: undefined,
    week: undefined,
    isPlayoff: undefined,
    tags: []
  });

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

  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      year: undefined,
      week: undefined,
      isPlayoff: undefined,
      tags: []
    });
  }, []);

  const clearAll = useCallback(() => {
    clearSearch();
    clearFilters();
  }, [clearSearch, clearFilters]);

  return {
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    filteredArticles,
    availableYears,
    availableTags,
    clearSearch,
    clearFilters,
    clearAll,
    hasActiveSearch: searchQuery.trim().length > 0,
    hasActiveFilters: 
      filters.year !== undefined || 
      filters.week !== undefined || 
      filters.isPlayoff !== undefined || 
      filters.tags.length > 0,
    totalResults: filteredArticles.length
  };
}
