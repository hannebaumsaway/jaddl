/**
 * Read an unpublished article the way it will look once it is live.
 *
 * Contentful holds the only copy of an article, including while it is still a
 * draft, so this reads through the **preview** API — which returns unpublished
 * entries — and renders it with the real article shell and rail.
 *
 * It sits under /admin deliberately: `src/proxy.ts` already gates that path, so
 * unpublished copy is behind the admin session rather than merely unguessable,
 * and it works from a deployed URL rather than only on localhost.
 */

import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getContentfulClient } from '@/lib/contentful/client';
import { richTextToMarkdown } from '@/lib/articles/from-rich-text';
import { parseArticleMarkdown } from '@/lib/articles/markdown';
import { loadWeekSlate } from '@/lib/articles/slate';
import { ArticleShell } from '@/components/article/article-shell';
import { ArticleBody } from '@/components/article/article-body';
import s from '@/components/article/article.module.css';

export const metadata: Metadata = { robots: 'noindex, nofollow' };
export const dynamic = 'force-dynamic';

export default async function ArticlePreviewPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;

  let entry: any;
  try {
    entry = await getContentfulClient(true).getEntry(id);
  } catch {
    notFound();
  }
  if (entry?.sys?.contentType?.sys?.id !== 'jaddlArticle') notFound();

  const f = entry.fields;
  const year = Number(f.year) || 0;
  const week = Number(f.week) || 0;
  const isPlayoff = !!f.playoffs;

  // Round-tripping the stored rich text through markdown means the preview
  // renders exactly what Contentful holds, including anything typed into the
  // editor by hand, rather than a second interpretation of it.
  const blocks = parseArticleMarkdown(richTextToMarkdown(f.content));
  const slate = await loadWeekSlate(year, week, isPlayoff);

  const words = blocks
    .filter(b => b.kind === 'paragraph')
    .reduce((n, b: any) => n + b.text.split(/\s+/).filter(Boolean).length, 0);

  const tagFor = (a: number, b: number): string | null => {
    if (!slate) return null;
    const hi = Math.max(a, b);
    const lo = Math.min(a, b);
    return (
      slate.games.find(
        g => Math.abs(g.winner.score - hi) < 0.05 && Math.abs(g.loser.score - lo) < 0.05
      )?.tag ?? null
    );
  };

  const published = !!entry.sys.publishedVersion;
  const weekLabel = isPlayoff ? `ROUND ${week}` : `WK ${String(week).padStart(2, '0')}`;

  return (
    <ArticleShell
      title={String(f.title ?? '(untitled)')}
      subtitle={f.subtitle ? String(f.subtitle) : undefined}
      kicker={isPlayoff ? `PLAYOFF ROUND ${week} RECAP` : `WEEK ${week} ROUNDUP`}
      byline={[
        'THE COMMISH',
        `${year} SEASON`,
        `${Math.max(1, Math.round(words / 230))} MIN`,
        `${words} WORDS`,
        published ? 'PUBLISHED' : 'UNPUBLISHED',
      ]}
      contextLabel={`PREVIEW  /  ${weekLabel}  /  ${year}`}
      slate={slate}
      footerRight={
        <Link
          href={`https://app.contentful.com/spaces/${process.env.NEXT_PUBLIC_CONTENTFUL_SPACE_ID}/entries/${id}` as never}
          className={s.mono}
        >
          EDIT IN CONTENTFUL &rarr;
        </Link>
      }
    >
      <ArticleBody blocks={blocks} tagFor={tagFor} />
    </ArticleShell>
  );
}
