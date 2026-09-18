/**
 * `**bold**`, `*italic*` and `` `code` `` inside a paragraph of draft markdown.
 *
 * Returns React nodes rather than HTML, so nothing from a draft file is ever
 * handed to dangerouslySetInnerHTML. The tokenizer is shared with the
 * Contentful converter so the preview and the published article agree.
 */

import React from 'react';
import { parseInline } from '@/lib/articles/markdown';

export function InlineMarkdown({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((token, i) => {
        if (token.marks.includes('bold')) {
          return <strong key={i} className="font-semibold">{token.text}</strong>;
        }
        if (token.marks.includes('italic')) return <em key={i}>{token.text}</em>;
        if (token.marks.includes('code')) return <code key={i}>{token.text}</code>;
        return <React.Fragment key={i}>{token.text}</React.Fragment>;
      })}
    </>
  );
}
