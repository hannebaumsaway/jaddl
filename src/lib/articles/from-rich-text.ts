/**
 * Contentful rich text -> the markdown an article was written in.
 *
 * The inverse of `rich-text.ts`, and the reason there is no local copy of an
 * article: revising one means pulling it back out of Contentful, changing it,
 * and pushing it again. Without this the round trip is one-way and the only way
 * to revise a published piece is by hand in the editor.
 *
 * Contentful is the source of truth, so this reads whatever is actually stored
 * — including anything typed directly into the editor — rather than assuming
 * the document came from `markdownBlocksToRichText`.
 */

import { BLOCKS, MARKS, type Document } from '@contentful/rich-text-types';
import type { ArticleFrontmatter } from './markdown';

/** Text with a mark, back to its delimiter. Order matters for nesting. */
const WRAP: Record<string, string> = {
  [MARKS.CODE]: '`',
  [MARKS.BOLD]: '**',
  [MARKS.ITALIC]: '*',
};

function inline(node: any): string {
  if (node.nodeType === 'text') {
    const value: string = node.value ?? '';
    if (!value) return '';
    // An all-whitespace run cannot carry a delimiter — `** **` is not emphasis.
    if (!value.trim()) return value;
    const marks: string[] = (node.marks ?? []).map((m: any) => m.type);
    const [lead, trail] = [/^\s*/.exec(value)![0], /\s*$/.exec(value)![0]];
    let out = value.trim();
    for (const mark of [MARKS.CODE, MARKS.BOLD, MARKS.ITALIC]) {
      if (marks.includes(mark)) out = `${WRAP[mark]}${out}${WRAP[mark]}`;
    }
    return `${lead}${out}${trail}`;
  }

  // Hyperlinks are not produced by the writing path, but an editor can add one.
  if (node.nodeType === 'hyperlink') {
    const text = (node.content ?? []).map(inline).join('');
    return `[${text}](${node.data?.uri ?? ''})`;
  }

  return (node.content ?? []).map(inline).join('');
}

/** The article body as markdown, blocks separated by a blank line. */
export function richTextToMarkdown(doc: Document | null | undefined): string {
  if (!doc?.content) return '';

  const blocks: string[] = [];
  for (const node of doc.content as any[]) {
    switch (node.nodeType) {
      case BLOCKS.HEADING_1:
      case BLOCKS.HEADING_2:
        blocks.push(`## ${inline(node).trim()}`);
        break;
      case BLOCKS.HEADING_3:
      case BLOCKS.HEADING_4:
      case BLOCKS.HEADING_5:
      case BLOCKS.HEADING_6:
        blocks.push(`### ${inline(node).trim()}`);
        break;
      case BLOCKS.HR:
        blocks.push('---');
        break;
      case BLOCKS.QUOTE:
        blocks.push(
          (node.content ?? [])
            .map((p: any) => `> ${inline(p).trim()}`)
            .join('\n')
        );
        break;
      case BLOCKS.UL_LIST:
      case BLOCKS.OL_LIST: {
        const ordered = node.nodeType === BLOCKS.OL_LIST;
        blocks.push(
          (node.content ?? [])
            .map((li: any, i: number) => `${ordered ? `${i + 1}.` : '-'} ${inline(li).trim()}`)
            .join('\n')
        );
        break;
      }
      case BLOCKS.PARAGRAPH: {
        const text = inline(node).trim();
        // Contentful keeps empty paragraphs the editor leaves behind; they are
        // not content and would parse back as nothing.
        if (text) blocks.push(text);
        break;
      }
      default:
        // Embedded assets and entries have no markdown form. Dropping them
        // silently would lose content on a round trip, so they are marked.
        blocks.push(`<!-- ${node.nodeType} not represented in markdown -->`);
    }
  }

  return blocks.join('\n\n');
}

/** Frontmatter plus body, in the exact form `parseArticleSource` reads back. */
export function toArticleSource(meta: ArticleFrontmatter, body: string): string {
  const lines = [
    '---',
    `year: ${meta.year}`,
    `week: ${meta.week}`,
    `playoff: ${meta.playoff}`,
    `title: ${meta.title}`,
    ...(meta.subtitle ? [`subtitle: ${meta.subtitle}`] : []),
    ...(meta.tags.length ? [`tags: ${meta.tags.join(', ')}`] : []),
    '---',
    '',
  ];
  return `${lines.join('\n')}${body}\n`;
}
