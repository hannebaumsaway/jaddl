import React, { Suspense } from 'react';
import { Metadata } from 'next';
import { getJaddlArticles } from '@/lib/contentful/api';
import { NewsPageClient } from './news-page-client';

export const metadata: Metadata = {
  title: 'JADDL News',
  description: 'Browse the complete archive of JADDL fantasy football articles, recaps, and analysis from every season.',
};

export default async function NewsPage() {
  // Fetch all JADDL articles
  const articles = await getJaddlArticles(1000); // Get a large number to show all articles

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewsPageClient articles={articles} />
    </Suspense>
  );
}
