/**
 * The markdown an article is written in, parsed.
 *
 * Articles are drafted as markdown in conversation and live in Contentful from
 * the moment they exist — there is no local copy, because two copies drift. So
 * this module is the one parse between the prose as written and the rich text
 * Contentful stores, and `from-rich-text.ts` is its inverse.
 *
 * Block structure is deliberately small: paragraphs, `##`/`###` headings, a
 * horizontal rule, and inline bold/italic/code. That is the whole vocabulary
 * the column has ever used.
 */

export type InlineMark = 'bold' | 'italic' | 'code';

export interface InlineToken {
  text: string;
  marks: InlineMark[];
}

const TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;

/**
 * Splits a paragraph into runs of text and their marks. Nesting is not
 * supported and is not used — drafts bold a phrase or italicise a word, never
 * both at once.
 */
export function parseInline(text: string): InlineToken[] {
  return text
    .split(TOKEN)
    .filter(part => part !== '')
    .map(part => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return { text: part.slice(2, -2), marks: ['bold' as const] };
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return { text: part.slice(1, -1), marks: ['italic' as const] };
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return { text: part.slice(1, -1), marks: ['code' as const] };
      }
      // A newline inside a paragraph is a soft wrap in markdown, not a break.
      return { text: part.replace(/\s*\n\s*/g, ' '), marks: [] };
    });
}

/* ------------------------------------------------------------ block level */

export type ArticleBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'game'; nameA: string; scoreA: number; nameB: string; scoreB: number }
  | { kind: 'heading'; level: 2 | 3; text: string }
  | { kind: 'rule' };

/**
 * `## Team A 174.9 | Team B 103.95` — the roundup heading the column has used
 * since 2008. It is recognised here and rendered as a `GameMarker`, but stored
 * in Contentful as an ordinary heading, so an article edited by hand in the
 * editor still produces its markers.
 */
export const GAME_HEADING =
  /^(.+?)\s+(-?\d+(?:\.\d+)?)\s*\|\s*(.+?)\s+(-?\d+(?:\.\d+)?)\s*$/;

export function parseArticleMarkdown(body: string): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];

  for (const chunk of body.split(/\r?\n\s*\r?\n/)) {
    const text = chunk.trim();
    if (!text) continue;

    if (/^(---|\*\*\*|___)$/.test(text)) {
      blocks.push({ kind: 'rule' });
      continue;
    }

    const heading = /^(#{2,3})\s+([\s\S]*)$/.exec(text);
    if (heading) {
      const inner = heading[2].trim();
      const game = GAME_HEADING.exec(inner);
      if (game) {
        blocks.push({
          kind: 'game',
          nameA: game[1],
          scoreA: Number(game[2]),
          nameB: game[3],
          scoreB: Number(game[4]),
        });
      } else {
        blocks.push({ kind: 'heading', level: heading[1].length === 2 ? 2 : 3, text: inner });
      }
      continue;
    }

    blocks.push({ kind: 'paragraph', text });
  }

  return blocks;
}

/* -------------------------------------------------------------- metadata */

export interface ArticleFrontmatter {
  year: number;
  week: number;
  playoff: boolean;
  title: string;
  subtitle?: string;
  tags: string[];
}

export interface ParsedArticle extends ArticleFrontmatter {
  body: string;
  wordCount: number;
}

/**
 * Frontmatter is how a drafted article carries its own metadata from the
 * conversation to Contentful. The schema is fixed and the file is machine
 * written, so a YAML dependency would buy nothing.
 */
export function parseArticleSource(input: string): ParsedArticle {
  const raw = input.replace(/^\s+/, '');
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  const data: Record<string, string> = {};

  if (match) {
    for (const line of match[1].split(/\r?\n/)) {
      const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line.trim());
      if (kv) data[kv[1]] = kv[2].replace(/^["\']|["\']$/g, '').trim();
    }
  }

  const body = (match ? raw.slice(match[0].length) : raw).trim();

  return {
    year: Number(data.year) || 0,
    week: Number(data.week) || 0,
    playoff: data.playoff === 'true',
    title: data.title || '',
    subtitle: data.subtitle || undefined,
    tags: (data.tags || '').split(',').map(t => t.trim()).filter(Boolean),
    body,
    wordCount: body.split(/\s+/).filter(Boolean).length,
  };
}
