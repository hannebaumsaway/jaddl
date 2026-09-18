/**
 * Article markdown -> Contentful rich text.
 *
 * Works from `parseArticleMarkdown`'s blocks rather than the markdown string,
 * so the preview and the stored entry are built from the same parse.
 * `from-rich-text.ts` is the inverse, and the pair is what lets an article live
 * only in Contentful and still be revised here.
 *
 * The existing HTML->rich-text code in `migrate-to-contentful.js` is not reused:
 * it was written for the 2008-2021 archive, handles headings and paragraphs
 * only, and drops every mark. This is the forward path; that one stays where it
 * is as a record of the migration.
 */

import {
  BLOCKS,
  MARKS,
  type Document,
  type Text,
  type TopLevelBlock,
  type Paragraph,
  type Heading2,
  type Heading3,
  type Hr,
} from '@contentful/rich-text-types';
import { parseInline, type ArticleBlock } from './markdown';

const MARK_TYPE = {
  bold: MARKS.BOLD,
  italic: MARKS.ITALIC,
  code: MARKS.CODE,
} as const;

function textNodes(source: string): Text[] {
  return parseInline(source).map(token => ({
    nodeType: 'text',
    value: token.text,
    marks: token.marks.map(m => ({ type: MARK_TYPE[m] })),
    data: {},
  }));
}

function block<T extends Paragraph | Heading2 | Heading3>(
  nodeType: T['nodeType'],
  source: string
): T {
  return { nodeType, data: {}, content: textNodes(source) } as T;
}

/**
 * A game block round-trips to the heading it came from.
 *
 * `## Longshanks 174.9 | Jesus 103.95` is the column's own convention and the
 * article renderer parses it back into a `GameMarker`. Storing it as a heading
 * rather than as structured data keeps Contentful's editor usable — the entry
 * reads as an article, not as a tree of widgets — and means an article edited
 * by hand in Contentful still renders its markers.
 */
function gameHeading(b: Extract<ArticleBlock, { kind: 'game' }>): string {
  const n = (v: number) => (Math.round(v * 100) % 10 === 0 ? v.toFixed(1) : v.toFixed(2));
  return `${b.nameA} ${n(b.scoreA)} | ${b.nameB} ${n(b.scoreB)}`;
}

export function markdownBlocksToRichText(blocks: ArticleBlock[]): Document {
  const content: TopLevelBlock[] = blocks.map((b): TopLevelBlock => {
    switch (b.kind) {
      case 'game':
        return block<Heading2>(BLOCKS.HEADING_2, gameHeading(b));
      case 'heading':
        return b.level === 2
          ? block<Heading2>(BLOCKS.HEADING_2, b.text)
          : block<Heading3>(BLOCKS.HEADING_3, b.text);
      case 'rule':
        return { nodeType: BLOCKS.HR, data: {}, content: [] } as Hr;
      case 'paragraph':
        return block<Paragraph>(BLOCKS.PARAGRAPH, b.text);
    }
  });

  return { nodeType: BLOCKS.DOCUMENT, data: {}, content };
}
