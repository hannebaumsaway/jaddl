'use client';

import React from 'react';
import { Calendar, Tag, ArrowLeft, ZoomIn } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { documentToReactComponents, Options } from '@contentful/rich-text-react-renderer';
import { Lightbox, useLightbox } from '@/components/ui/lightbox';
import { ProcessedJaddlArticle } from '@/types/contentful';
import Link from 'next/link';

interface ArticleDetailClientProps {
  article: ProcessedJaddlArticle;
}

export function ArticleDetailClient({ article }: ArticleDetailClientProps) {
  const { isOpen, imageUrl, imageAlt, title, openLightbox, closeLightbox } = useLightbox();

  // Rich text rendering options
  const richTextOptions: Options = {
    renderNode: {
      'heading-1': (node, children) => (
        <h1 className="text-3xl font-bold text-foreground mt-8 mb-4 first:mt-0">
          {children}
        </h1>
      ),
      'heading-2': (node, children) => (
        <h2 className="text-2xl font-bold text-foreground mt-6 mb-3 first:mt-0">
          {children}
        </h2>
      ),
      'heading-3': (node, children) => (
        <h3 className="text-xl font-semibold text-foreground mt-5 mb-2 first:mt-0">
          {children}
        </h3>
      ),
      'paragraph': (node, children) => (
        <p className="text-lg text-foreground leading-relaxed mb-4 font-serif">
          {children}
        </p>
      ),
      'unordered-list': (node, children) => (
        <ul className="list-disc list-inside text-foreground mb-4 space-y-1 font-serif">
          {children}
        </ul>
      ),
      'ordered-list': (node, children) => (
        <ol className="list-decimal list-inside text-foreground mb-4 space-y-1 font-serif">
          {children}
        </ol>
      ),
      'list-item': (node, children) => (
        <li className="text-lg text-foreground leading-relaxed font-serif">
          {children}
        </li>
      ),
    },
    renderMark: {
      'bold': (text) => <strong className="font-semibold">{text}</strong>,
      'italic': (text) => <em className="italic">{text}</em>,
      'underline': (text) => <u className="underline">{text}</u>,
    },
  };

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

  const handleImageClick = () => {
    if (article.featuredImage) {
      openLightbox(
        article.featuredImage.url,
        article.featuredImage.alt || article.title,
        article.title
      );
    }
  };

  return (
    <>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Back Button */}
        <div className="mb-6">
          <Link href="/news">
            <Button variant="ghost" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to News
            </Button>
          </Link>
        </div>

        {/* Article Header */}
        <header className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Badge 
              variant="secondary" 
              className={`text-xs font-normal font-mono ${getWeekTypeColor(article.week)}`}
            >
              {getWeekTypeLabel(article.week)}
            </Badge>
            <div className="flex items-center text-sm text-muted-foreground font-mono font-normal">
              <Calendar className="h-4 w-4 mr-1" />
              {formatDate(article.year, article.week)}
            </div>
          </div>

          <h1 className="text-4xl font-bold text-foreground mb-4 leading-tight">
            {article.title}
          </h1>

          {article.subtitle && (
            <p className="text-xl text-muted-foreground leading-relaxed">
              {article.subtitle}
            </p>
          )}

          {/* Tags */}
          {article.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-6">
            {article.tags.map((tag) => (
              <Link key={tag} href={`/news?tag=${encodeURIComponent(tag)}`}>
                <Badge
                  variant="outline"
                  className="text-sm flex items-center gap-1 font-mono font-normal hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
                >
                  <Tag className="h-3 w-3" />
                  {tag}
                </Badge>
              </Link>
            ))}
            </div>
          )}
        </header>

        <Separator className="mb-8" />

        {/* Featured Image */}
        {article.featuredImage && (
          <div className="mb-8">
            <div className="relative h-80 md:h-[500px] w-full overflow-hidden rounded-lg group cursor-pointer" onClick={handleImageClick}>
              <Image
                src={article.featuredImage.url}
                alt={article.featuredImage.alt || article.title}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                priority
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
              />
              
              {/* Hover overlay with zoom icon */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/90 rounded-full p-3">
                  <ZoomIn className="h-6 w-6 text-gray-800" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Article Content */}
        <article className="max-w-none">
          {article.content && documentToReactComponents(article.content, richTextOptions)}
        </article>

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground font-mono font-normal">
              Published in {article.year} • Week {article.week === 0 ? 'Preseason/Draft' : article.week}
            </div>
            <Link href="/news">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to News
              </Button>
            </Link>
          </div>
        </footer>
      </div>

      {/* Lightbox Modal */}
      <Lightbox
        isOpen={isOpen}
        onClose={closeLightbox}
        imageUrl={imageUrl}
        imageAlt={imageAlt}
        title={title}
      />
    </>
  );
}
