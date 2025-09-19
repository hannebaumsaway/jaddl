'use client';

import React from 'react';
import { Calendar, Tag, ArrowLeft, ZoomIn, Quote } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { documentToReactComponents, Options } from '@contentful/rich-text-react-renderer';
import { BLOCKS, INLINES } from '@contentful/rich-text-types';
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
      [BLOCKS.HEADING_1]: (node, children) => (
        <h1 className="text-3xl font-bold text-foreground mt-8 mb-4 first:mt-0">
          {children}
        </h1>
      ),
      [BLOCKS.HEADING_2]: (node, children) => (
        <h2 className="text-2xl font-bold text-foreground mt-6 mb-3 first:mt-0">
          {children}
        </h2>
      ),
      [BLOCKS.HEADING_3]: (node, children) => (
        <h3 className="text-xl font-semibold text-foreground mt-5 mb-2 first:mt-0">
          {children}
        </h3>
      ),
      [BLOCKS.PARAGRAPH]: (node, children) => (
        <p className="text-lg text-foreground leading-relaxed mb-4 font-serif">
          {children}
        </p>
      ),
      [BLOCKS.UL_LIST]: (node, children) => (
        <ul className="list-disc list-inside text-foreground mb-4 space-y-1 font-serif">
          {children}
        </ul>
      ),
      [BLOCKS.OL_LIST]: (node, children) => (
        <ol className="list-decimal list-inside text-foreground mb-4 space-y-1 font-serif">
          {children}
        </ol>
      ),
      [BLOCKS.LIST_ITEM]: (node, children) => (
        <li className="text-lg text-foreground leading-relaxed font-serif">
          {children}
        </li>
      ),
      [BLOCKS.QUOTE]: (node, children) => (
        <blockquote className="flex items-start gap-3 my-8 pl-4">
          <Quote className="h-4 w-4 text-muted-foreground mt-3 flex-shrink-0 rotate-180" />
          <div 
            className="leading-relaxed [&_p]:!text-[1.7rem] [&_p]:!font-['IBM_Plex_Sans'] [&_p]:!text-muted-foreground [&_p]:!mb-0 [&_p]:!font-sans"
            style={{
              fontFamily: 'IBM Plex Sans, sans-serif',
              fontSize: '1.7rem',
              color: 'var(--muted-foreground)',
            }}
          >
            {children}
          </div>
        </blockquote>
      ),
      [BLOCKS.EMBEDDED_ASSET]: (node) => {
        const asset = node.data.target;
        if (!asset?.fields?.file?.url) return null;
        
        const imageUrl = `https:${asset.fields.file.url}`;
        const alt = asset.fields.title || asset.fields.description || '';
        
        return (
          <div className="my-8">
            <div 
              className="relative w-full max-w-2xl mx-auto cursor-pointer group"
              onClick={() => openLightbox(imageUrl, alt, asset.fields.title)}
            >
              <div className="relative h-64 md:h-96 w-full overflow-hidden rounded-lg">
                <Image
                  src={imageUrl}
                  alt={alt}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 60vw"
                />
                
                {/* Hover overlay with zoom icon */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/90 rounded-full p-3">
                    <ZoomIn className="h-6 w-6 text-gray-800" />
                  </div>
                </div>
              </div>
              
              {/* Image caption */}
              {asset.fields.title && (
                <p className="text-sm text-muted-foreground mt-2 text-center font-serif">
                  {asset.fields.title}
                </p>
              )}
            </div>
          </div>
        );
      },
      [INLINES.ASSET_HYPERLINK]: (node) => {
        const asset = node.data.target;
        if (!asset?.fields?.file?.url) return null;
        
        const imageUrl = `https:${asset.fields.file.url}`;
        const alt = asset.fields.title || asset.fields.description || '';
        
        return (
          <span 
            className="inline-block cursor-pointer"
            onClick={() => openLightbox(imageUrl, alt, asset.fields.title)}
          >
            <Image
              src={imageUrl}
              alt={alt}
              width={200}
              height={150}
              className="inline-block rounded border hover:opacity-80 transition-opacity"
            />
          </span>
        );
      },
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

        {/* Tags */}
        {article.tags.length > 0 && (
          <div className="mt-8 pt-6 border-t">
            <div className="flex flex-wrap gap-2">
              {article.tags.map((tag) => (
                <Link key={tag} href={`/news?tag=${encodeURIComponent(tag)}`}>
                  <Badge
                    variant="outline"
                    className="text-sm flex items-center gap-1 font-mono font-normal hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer [text-transform:lowercase!important]"
                  >
                    <Tag className="h-3 w-3" />
                    {tag}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        )}

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
