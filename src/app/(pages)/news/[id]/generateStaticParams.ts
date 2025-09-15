import { getJaddlArticles } from '@/lib/contentful/api';
import { generateArticleSlug } from '@/lib/utils/slug';

export async function generateStaticParams() {
  try {
    const articles = await getJaddlArticles(1000); // Get all articles
    
    return articles.map((article) => ({
      id: generateArticleSlug(article.title, article.year, article.week),
    }));
  } catch (error) {
    console.error('Error generating static params for news articles:', error);
    return [];
  }
}
