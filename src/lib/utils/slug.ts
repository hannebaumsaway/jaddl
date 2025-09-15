/**
 * Generate a URL-friendly slug from a string
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .trim()
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Generate a unique slug for an article using title, year, and week
 */
export function generateArticleSlug(title: string, year: number, week: number): string {
  const titleSlug = generateSlug(title);
  const weekLabel = week === 0 ? 'preseason' : `week-${week}`;
  return `${year}-${weekLabel}-${titleSlug}`;
}

/**
 * Parse an article slug to extract year, week, and title
 */
export function parseArticleSlug(slug: string): { year: number; week: number; titleSlug: string } | null {
  const parts = slug.split('-');
  if (parts.length < 3) return null;

  const year = parseInt(parts[0]);
  if (isNaN(year)) return null;

  let week: number;
  let titleSlug: string;

  if (parts[1] === 'preseason') {
    week = 0;
    titleSlug = parts.slice(2).join('-');
  } else if (parts[1] === 'week') {
    week = parseInt(parts[2]);
    if (isNaN(week)) return null;
    titleSlug = parts.slice(3).join('-');
  } else {
    return null;
  }

  return { year, week, titleSlug };
}
