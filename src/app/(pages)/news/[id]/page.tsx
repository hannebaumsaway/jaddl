import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getJaddlArticleById, getJaddlArticleBySlug } from '@/lib/contentful/api';
import { ArticleDetailClient } from './article-detail-client';

interface ArticlePageProps {
  params: {
    id: string;
  };
}

async function getArticle(identifier: string) {
  // First try to get by slug (new format)
  let article = await getJaddlArticleBySlug(identifier);
  
  // If not found, try to get by ID (legacy format)
  if (!article) {
    article = await getJaddlArticleById(identifier);
  }
  
  return article;
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const article = await getArticle(params.id);
  
  if (!article) {
    return {
      title: 'Article Not Found',
    };
  }

  // Build a rich description
  const weekType = article.isPlayoff ? 
    (article.week === 13 ? 'Quarterfinals' : 
     article.week === 14 ? 'Semifinals' : 
     article.week === 15 ? 'Championship' : 
     `Playoff Week ${article.week}`) : 
    `Week ${article.week}`;

  const description = article.subtitle || 
    `${article.year} Season ${weekType} recap` + 
    (article.featuredTeams?.length > 0 ? 
      ` featuring ${article.featuredTeams.map(t => t.teamName).join(' and ')}` : 
      '');

  return {
    title: `${article.title} - JADDL News`,
    description,
    openGraph: {
      title: article.title,
      description,
      siteName: 'JADDL Fantasy Football League',
      type: 'article',
      images: article.featuredImage ? [
        {
          url: article.featuredImage.url,
          width: article.featuredImage.width,
          height: article.featuredImage.height,
          alt: article.featuredImage.alt || article.title,
        }
      ] : undefined,
      publishedTime: new Date(article.year, 0, 1).toISOString(), // Use Jan 1st of the article year
      modifiedTime: new Date(article.year, 0, 1).toISOString(),
      tags: article.tags,
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description,
      images: article.featuredImage ? [article.featuredImage.url] : undefined,
    },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const article = await getArticle(params.id);

  if (!article) {
    notFound();
  }

  return <ArticleDetailClient article={article} />;
}
