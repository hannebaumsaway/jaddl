/**
 * The article page frame: context bar, inverted hero, and the two-column
 * grid that puts the week's scores beside the prose.
 *
 * Takes the body as children so the same shell serves a published Contentful
 * article and a local markdown draft — the draft preview exists precisely so a
 * piece can be read in its final form before it is published.
 */

import React from 'react';
import Link from 'next/link';
import type { WeekSlate } from '@/lib/articles/slate';
import { WeekSlateRail } from './week-slate';
import s from './article.module.css';

export interface ArticleShellProps {
  title: string;
  subtitle?: string;
  /** e.g. "WEEK 1 ROUNDUP". */
  kicker: string;
  /** Short facts under the headline: byline, date, read time. */
  byline: string[];
  /** Right-hand side of the context bar, e.g. "WK 01 / 2026 / REGULAR SEASON". */
  contextLabel: string;
  slate: WeekSlate | null;
  children: React.ReactNode;
  footerRight?: React.ReactNode;
}

export function ArticleShell({
  title, subtitle, kicker, byline, contextLabel, slate, children, footerRight,
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
          <div className={s.kicker}>
            <div className={s.kickerDot} />
            <span className={s.mono}>{kicker}</span>
          </div>
          <h1 className={s.title}>{title}</h1>
          {subtitle && <p className={s.subtitle}>{subtitle}</p>}
          {byline.length > 0 && (
            <div className={s.byline}>
              {byline.map(b => <span className={s.mono} key={b}>{b}</span>)}
            </div>
          )}
        </div>
      </header>

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
