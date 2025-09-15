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

  return {
    title: `${article.title} - JADDL News`,
    description: article.subtitle || `JADDL article from ${article.year} Week ${article.week}`,
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const article = await getArticle(params.id);

  if (!article) {
    notFound();
  }

  return <ArticleDetailClient article={article} />;
}
