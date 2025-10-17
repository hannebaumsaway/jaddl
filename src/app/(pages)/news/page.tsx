import React, { Suspense } from 'react';
import { Metadata } from 'next';
import { getJaddlArticles } from '@/lib/contentful/api';
import { NewsPageClient } from './news-page-client';

export async function generateMetadata(): Promise<Metadata> {
  // Get the latest articles to show in metadata
  const articles = await getJaddlArticles(3);
  
  const latestArticles = articles.map(article => {
    const weekType = article.isPlayoff ? 
      (article.week === 13 ? 'Quarterfinals' : 
       article.week === 14 ? 'Semifinals' : 
       article.week === 15 ? 'Championship' : 
       `Playoff Week ${article.week}`) : 
      `Week ${article.week}`;
    return `${article.year} ${weekType}: ${article.title}`;
  }).join(', ');

  const description = `Latest articles: ${latestArticles}. Browse the complete archive of JADDL fantasy football articles, recaps, and analysis from every season.`;

  return {
    title: 'JADDL News',
    description,
    openGraph: {
      title: 'JADDL News & Articles',
      description,
      siteName: 'JADDL Fantasy Football League',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: 'JADDL News & Articles',
      description,
    },
  };
};

// Webhook-based revalidation - no need for time-based ISR
// export const revalidate = 60;

export default async function NewsPage() {
  // Fetch all JADDL articles
  const articles = await getJaddlArticles(1000); // Get a large number to show all articles

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewsPageClient articles={articles} />
    </Suspense>
  );
}
