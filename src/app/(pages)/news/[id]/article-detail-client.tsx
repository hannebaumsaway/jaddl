'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { documentToReactComponents, Options } from '@contentful/rich-text-react-renderer';
import { BLOCKS, INLINES } from '@contentful/rich-text-types';

import { Lightbox, useLightbox } from '@/components/ui/lightbox';
import { ArticleShell } from '@/components/article/article-shell';
import { GameMarker, PullQuote } from '@/components/article/widgets';
import type { WeekSlate } from '@/lib/articles/slate';
import { ProcessedJaddlArticle } from '@/types/contentful';
import s from '@/components/article/article.module.css';

interface ArticleDetailClientProps {
  article: ProcessedJaddlArticle;
  slate: WeekSlate | null;
  /** Estimated reading time in minutes, computed on the server. */
  readMinutes: number;
}

/**
 * `## Team A 174.9 | Team B 103.95` — the roundup heading the column has used
 * since 2008. Parsing it means the score line in the prose is the same object
 * as the score line in the rail, tagged and formatted identically, rather than
 * whatever the writer typed that day.
 */
const GAME_HEADING = /^(.+?)\s+(-?\d+(?:\.\d+)?)\s*\|\s*(.+?)\s+(-?\d+(?:\.\d+)?)\s*$/;

function headingText(node: any): string {
  return (node.content || [])
    .map((c: any) => (typeof c.value === 'string' ? c.value : ''))
    .join('')
    .trim();
}

export function ArticleDetailClient({ article, slate, readMinutes }: ArticleDetailClientProps) {
  const { isOpen, imageUrl, imageAlt, title, openLightbox, closeLightbox } = useLightbox();

  /** The rail already decided which game is the week high / closest / blowout. */
  const tagFor = (a: number, b: number): string | null => {
    if (!slate) return null;
    const hi = Math.max(a, b);
    const lo = Math.min(a, b);
    const hit = slate.games.find(
      g => Math.abs(g.winner.score - hi) < 0.05 && Math.abs(g.loser.score - lo) < 0.05
    );
    return hit?.tag ?? null;
  };

  // The first paragraph carries the lede's larger size; everything after it is
  // body copy. Counted rather than indexed, because an article may open with an
  // embedded asset.
  let paragraphsSeen = 0;

  const richTextOptions: Options = {
    renderNode: {
      [BLOCKS.HEADING_1]: (_node, children) => <h2>{children}</h2>,

      [BLOCKS.HEADING_2]: (node, children) => {
        const match = GAME_HEADING.exec(headingText(node));
        if (match) {
          const [, nameA, scoreA, nameB, scoreB] = match;
          const a = Number(scoreA);
          const b = Number(scoreB);
          const aWon = a >= b;
          return (
            <GameMarker
              winnerName={aWon ? nameA : nameB}
              winnerScore={aWon ? a : b}
              loserName={aWon ? nameB : nameA}
              loserScore={aWon ? b : a}
              isTie={a === b}
              tag={tagFor(a, b)}
            />
          );
        }
        return <h2>{children}</h2>;
      },

      [BLOCKS.HEADING_3]: (_node, children) => <h3>{children}</h3>,

      [BLOCKS.PARAGRAPH]: (_node, children) => {
        paragraphsSeen += 1;
        return <p className={paragraphsSeen === 1 ? s.lede : undefined}>{children}</p>;
      },

      [BLOCKS.QUOTE]: (_node, children) => <PullQuote>{children}</PullQuote>,

      [BLOCKS.EMBEDDED_ASSET]: (node) => {
        const asset = node.data.target;
        if (!asset?.fields?.file?.url) return null;
        const url = `https:${asset.fields.file.url}`;
        const alt = asset.fields.title || asset.fields.description || '';
        return (
          <figure className={s.figure}>
            <div
              className="relative w-full aspect-[3/2] cursor-zoom-in overflow-hidden"
              onClick={() => openLightbox(url, alt, asset.fields.title)}
            >
              <Image src={url} alt={alt} fill className="object-cover" sizes="(max-width: 900px) 100vw, 660px" />
            </div>
            {asset.fields.title && (
              <figcaption className={`${s.mono} ${s.figureCaption}`}>{asset.fields.title}</figcaption>
            )}
          </figure>
        );
      },

      [INLINES.ASSET_HYPERLINK]: (node) => {
        const asset = node.data.target;
        if (!asset?.fields?.file?.url) return null;
        const url = `https:${asset.fields.file.url}`;
        const alt = asset.fields.title || asset.fields.description || '';
        return (
          <span className="inline-block cursor-zoom-in" onClick={() => openLightbox(url, alt, asset.fields.title)}>
            <Image src={url} alt={alt} width={200} height={150} className="inline-block border" />
          </span>
        );
      },
    },
    renderMark: {
      bold: text => <strong className="font-semibold">{text}</strong>,
      italic: text => <em className="italic">{text}</em>,
      underline: text => <u className="underline">{text}</u>,
    },
  };

  const weekLabel = article.week === 0
    ? 'PRESEASON'
    : article.isPlayoff
    ? `ROUND ${article.week}`
    : `WK ${String(article.week).padStart(2, '0')}`;

  const kicker = article.week === 0
    ? 'PRESEASON'
    : article.isPlayoff
    ? `PLAYOFF ROUND ${article.week} RECAP`
    : `WEEK ${article.week} ROUNDUP`;

  const byline = [
    'THE COMMISH',
    `${article.year} SEASON`,
    `${readMinutes} MIN`,
    ...(slate ? [`${slate.games.length} GAMES`] : []),
  ];

  return (
    <>
      <ArticleShell
        title={article.title}
        subtitle={article.subtitle}
        kicker={kicker}
        byline={byline}
        contextLabel={`${weekLabel}  /  ${article.year}  /  ${article.isPlayoff ? 'POSTSEASON' : 'REGULAR SEASON'}`}
        slate={slate}
      >
        {article.featuredImage && (
          <figure className={s.figure} style={{ marginTop: 0 }}>
            <div
              className="relative w-full aspect-[3/2] cursor-zoom-in overflow-hidden"
              onClick={() =>
                openLightbox(article.featuredImage!.url, article.featuredImage!.alt || article.title, article.title)
              }
            >
              <Image
                src={article.featuredImage.url}
                alt={article.featuredImage.alt || article.title}
                fill
                priority
                className="object-cover"
                sizes="(max-width: 900px) 100vw, 660px"
              />
            </div>
          </figure>
        )}

        {article.content && documentToReactComponents(article.content, richTextOptions)}

        {article.tags.length > 0 && (
          <div className={s.tags}>
            {article.tags.map(tag => (
              <Link key={tag} href={`/news?tag=${encodeURIComponent(tag)}`} className={`${s.mono} ${s.tag}`}>
                {tag.toLowerCase()}
              </Link>
            ))}
          </div>
        )}
      </ArticleShell>

      <Lightbox
        isOpen={isOpen}
        onClose={closeLightbox}
        imageUrl={imageUrl}
        imageAlt={imageAlt}
        title={title}
      />
    </>
  );
}
