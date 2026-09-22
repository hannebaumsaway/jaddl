/**
 * The article page frame: context bar, inverted hero, full-bleed cover, and
 * the two-column grid that puts the week's scores beside the prose.
 *
 * The context bar carries the week, the year and whether it is the postseason,
 * so the hero is the headline and the subtitle and nothing else — a byline
 * under it would only restate the line already at the top of the page.
 *
 * Takes the body as children so the same shell serves a published Contentful
 * article and a local markdown draft — the draft preview exists precisely so a
 * piece can be read in its final form before it is published.
 */

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { WeekSlate } from '@/lib/articles/slate';
import { CoverPan } from './cover-pan';
import { WeekSlateRail } from './week-slate';
import s from './article.module.css';

export interface ArticleShellProps {
  title: string;
  subtitle?: string;
  /** Right-hand side of the context bar, e.g. "WK 01 / 2026 / REGULAR SEASON". */
  contextLabel: string;
  /**
   * Full-bleed image under the hero. It pans from its top anchor to its bottom
   * anchor as it scrolls out of the viewport — see `.cover` in the stylesheet.
   */
  cover?: { url: string; alt: string } | null;
  slate: WeekSlate | null;
  children: React.ReactNode;
  footerRight?: React.ReactNode;
}

export function ArticleShell({
  title, subtitle, contextLabel, cover, slate, children, footerRight,
}: ArticleShellProps) {
  return (
    <div className={s.page}>
      <div className={s.contextBar}>
        <div className={s.wrap}>
          <Link href="/news" className={`${s.mono} ${s.contextBack}`}>&larr; NEWS</Link>
          <span className={`${s.mono} ${s.contextWeek}`}>{contextLabel}</span>
        </div>
      </div>

      <header className={s.hero}>
        <div className={s.wrap}>
          <h1 className={s.title}>{title}</h1>
          {subtitle && <p className={s.subtitle}>{subtitle}</p>}
        </div>
      </header>

      {cover && (
        <CoverPan className={s.cover}>
          <Image
            src={cover.url}
            alt={cover.alt}
            fill
            priority
            sizes="100vw"
            className={s.coverImg}
          />
        </CoverPan>
      )}

      <div className={s.layout}>
        {/* The article comes first in the DOM at every width; `grid-template-areas`
            moves the rail above it on phones and beside it on desktop. Keeping
            the prose first means a screen reader reaches the lede before the
            scoreboard either way. */}
        <article className={s.body}>{children}</article>
        <aside className={s.rail} aria-label="This week's scores">
          {slate && <WeekSlateRail slate={slate} />}
        </aside>
      </div>

      <div className={s.articleFoot}>
        <div className={s.wrap}>
          <span className={s.mono}>JADDL &middot; EST. 2003</span>
          {footerRight ?? <Link href="/news" className={s.mono}>ALL ARTICLES &rarr;</Link>}
        </div>
      </div>
    </div>
  );
}
