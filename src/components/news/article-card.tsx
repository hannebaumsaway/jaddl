'use client';

import React from 'react';
import { Calendar, Tag, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProcessedJaddlArticle } from '@/types/contentful';
import { cn } from '@/lib/utils';
import { generateArticleSlug } from '@/lib/utils/slug';

interface ArticleCardProps {
  article: ProcessedJaddlArticle;
  className?: string;
}

export function ArticleCard({ article, className }: ArticleCardProps) {
  const formatDate = (year: number, week: number) => {
    if (week === 0) {
      return `${year} - Preseason/Draft`;
    }
    return `${year} - Week ${week}`;
  };

  const getWeekTypeColor = (week: number) => {
    if (week === 0) return 'bg-blue-100 text-blue-800';
    if (week >= 13) return 'bg-purple-100 text-purple-800';
    return 'bg-green-100 text-green-800';
  };

  const getWeekTypeLabel = (week: number) => {
    if (week === 0) return 'PRESEASON';
    if (week >= 13) return 'PLAYOFF';
    return 'REGULAR';
  };

  const articleSlug = generateArticleSlug(article.title, article.year, article.week);

  return (
    <Card className={cn("hover:shadow-lg transition-all duration-200 group overflow-hidden cursor-pointer h-full flex flex-col", className)}>
      <Link href={`/news/${articleSlug}`} className="block h-full flex flex-col">
        {/* Thumbnail Image */}
        {article.featuredImage && (
          <div className="relative h-48 w-full overflow-hidden">
            <Image
              src={article.featuredImage.url}
              alt={article.featuredImage.alt || article.title}
              fill
              className="object-cover transition-transform duration-200 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
            {/* Overlay gradient for better text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          </div>
        )}
        
        <CardHeader className={cn("pb-3", article.featuredImage && "pt-4")}>
          <div className="flex items-center justify-between mb-2">
            <Badge 
              variant="secondary" 
              className={cn("text-xs font-normal font-mono", getWeekTypeColor(article.week))}
            >
              {getWeekTypeLabel(article.week)}
            </Badge>
            <div className="flex items-center text-sm text-muted-foreground font-mono font-normal">
              <Calendar className="h-4 w-4 mr-1" />
              {formatDate(article.year, article.week)}
            </div>
          </div>
          
          <CardTitle className="text-xl leading-tight group-hover:text-primary transition-colors">
            {article.title}
          </CardTitle>
          
          {article.subtitle && (
            <p className="text-sm text-muted-foreground mt-1">
              {article.subtitle}
            </p>
          )}
        </CardHeader>
        
        <CardContent className="pt-0 flex-1 flex flex-col justify-end">
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-1">
              {article.tags.slice(0, 3).map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="text-xs flex items-center gap-1 font-mono font-normal hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.location.href = `/news?tag=${encodeURIComponent(tag)}`;
                  }}
                >
                  <Tag className="h-3 w-3" />
                  {tag}
                </Badge>
              ))}
              {article.tags.length > 3 && (
                <Badge variant="outline" className="text-xs font-mono font-normal">
                  +{article.tags.length - 3} more
                </Badge>
              )}
            </div>
            
            <Button 
              variant="ghost" 
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              Read More 
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
