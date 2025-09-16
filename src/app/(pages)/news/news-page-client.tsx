'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, FileText, Calendar, Filter } from 'lucide-react';
import { ProcessedJaddlArticle } from '@/types/contentful';
import { useArticleSearch } from '@/hooks/use-article-search';
import { SearchBar } from '@/components/news/search-bar';
import { ArticleFilters } from '@/components/news/article-filters';
import { ArticleCard } from '@/components/news/article-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface NewsPageClientProps {
  articles: ProcessedJaddlArticle[];
}

export function NewsPageClient({ articles }: NewsPageClientProps) {
  const searchParams = useSearchParams();
  const {
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    filteredArticles,
    availableYears,
    availableTags,
    availableTeams,
    clearAll,
    hasActiveSearch,
    hasActiveFilters,
    totalResults
  } = useArticleSearch({ articles });

  const [showFilters, setShowFilters] = useState(false);

  // Handle tag filter from URL query parameter
  useEffect(() => {
    const tagParam = searchParams.get('tag');
    if (tagParam) {
      const decodedTag = decodeURIComponent(tagParam);
      setFilters(prev => ({
        ...prev,
        tags: [decodedTag]
      }));
      setShowFilters(true); // Show filters when a tag is selected
    }
  }, [searchParams, setFilters]);


  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-4">JADDL News Archive</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Browse the complete archive of JADDL fantasy football articles, recaps, and analysis from every season.
        </p>
      </div>

      {/* Search and Filter Bar */}
      <div className="mb-8 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search articles by title, content, or tags..."
            />
          </div>
          <Button
            variant={showFilters ? "default" : "outline"}
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
            {(hasActiveSearch || hasActiveFilters) && (
              <Badge variant="secondary" className="ml-1">
                {totalResults}
              </Badge>
            )}
          </Button>
        </div>

        {/* Active Search/Filters Summary */}
        {(hasActiveSearch || hasActiveFilters) && (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              Showing {totalResults} of {articles.length} articles
              {hasActiveSearch && (
                <span className="text-foreground font-medium">
                  for "{searchQuery}"
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="text-muted-foreground hover:text-foreground"
            >
              Clear all
            </Button>
          </div>
        )}

        {/* Filters */}
        {showFilters && (
          <ArticleFilters
            filters={filters}
            onFiltersChange={setFilters}
            availableYears={availableYears}
            availableTags={availableTags}
            availableTeams={availableTeams}
            isExpanded={showFilters}
          />
        )}
      </div>

      <Separator className="mb-8" />

      {/* Results */}
      {filteredArticles.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No articles found</h3>
          <p className="text-muted-foreground mb-4">
            {hasActiveSearch || hasActiveFilters
              ? 'Try adjusting your search or filters to find more articles.'
              : 'No articles are available at the moment.'}
          </p>
          {(hasActiveSearch || hasActiveFilters) && (
            <Button variant="outline" onClick={clearAll}>
              Clear search and filters
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Results Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-foreground">
              {hasActiveSearch || hasActiveFilters ? 'Search Results' : 'All Articles'}
            </h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {filteredArticles.length} article{filteredArticles.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Articles Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredArticles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
