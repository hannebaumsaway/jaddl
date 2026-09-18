/**
 * An article's prose, rendered from parsed markdown blocks.
 *
 * Shared by the admin preview and by anything else that has markdown rather
 * than a Contentful rich-text document. The published page renders the rich
 * text directly, but both paths produce the same elements — a game heading
 * becomes a `GameMarker` either way.
 */

import React from 'react';
import type { ArticleBlock } from '@/lib/articles/markdown';
import { GameMarker } from './widgets';
import { InlineMarkdown } from './inline-markdown';
import s from './article.module.css';

export interface ArticleBodyProps {
  blocks: ArticleBlock[];
  /** Tag for a game, looked up from the week's slate by the caller. */
  tagFor?: (a: number, b: number) => string | null;
}

export function ArticleBody({ blocks, tagFor }: ArticleBodyProps) {
  // The first paragraph carries the lede's size. Counted, not indexed, because
  // an article can open with something other than prose.
  let paragraphsSeen = 0;

  return (
    <>
      {blocks.map((block, i) => {
        switch (block.kind) {
          case 'game': {
            const aWon = block.scoreA >= block.scoreB;
            return (
              <GameMarker
                key={i}
                winnerName={aWon ? block.nameA : block.nameB}
                winnerScore={aWon ? block.scoreA : block.scoreB}
                loserName={aWon ? block.nameB : block.nameA}
                loserScore={aWon ? block.scoreB : block.scoreA}
                isTie={block.scoreA === block.scoreB}
                tag={tagFor?.(block.scoreA, block.scoreB) ?? null}
              />
            );
          }
          case 'heading':
            return block.level === 2
              ? <h2 key={i}><InlineMarkdown text={block.text} /></h2>
              : <h3 key={i}><InlineMarkdown text={block.text} /></h3>;
          case 'rule':
            return <hr key={i} className={s.draftRule} />;
          case 'paragraph': {
            paragraphsSeen += 1;
            return (
              <p key={i} className={paragraphsSeen === 1 ? s.lede : undefined}>
                <InlineMarkdown text={block.text} />
              </p>
            );
          }
        }
      })}
    </>
  );
}
