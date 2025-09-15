'use client';

import React from 'react';
import { useIntersectionObserver } from '@/hooks/use-intersection-observer';
import { ArticleCard } from './article-card';
import { ProcessedJaddlArticle } from '@/types/contentful';

interface LazyArticleCardProps {
  article: ProcessedJaddlArticle;
  className?: string;
}

export function LazyArticleCard({ article, className }: LazyArticleCardProps) {
  const { ref, shouldRender, isIntersecting } = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: '-50px', // Only load when 50px into the viewport
    freezeOnceVisible: true, // Once loaded, keep it loaded
  });

  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className={className}>
      {shouldRender ? (
        <ArticleCard article={article} />
      ) : (
        // Placeholder with same dimensions as the actual card
        <div className="bg-card border border-border rounded-lg shadow-sm animate-pulse">
          <div className="h-48 bg-muted rounded-t-lg flex items-center justify-center">
            <span className="text-muted-foreground text-sm">Loading...</span>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-5 w-16 bg-muted rounded"></div>
              <div className="h-4 w-24 bg-muted rounded"></div>
            </div>
            <div className="space-y-2">
              <div className="h-6 bg-muted rounded w-3/4"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="h-5 w-12 bg-muted rounded"></div>
              <div className="h-5 w-16 bg-muted rounded"></div>
              <div className="h-5 w-14 bg-muted rounded"></div>
            </div>
            <div className="flex justify-end">
              <div className="h-8 w-20 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
