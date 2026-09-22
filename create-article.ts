/**
 * Create, update or read back a Contentful `jaddlArticle`.
 *
 *   pnpm article --file /tmp/week2.md                     # dry run
 *   pnpm article --file /tmp/week2.md --create            # Contentful draft
 *   pnpm article --file /tmp/week2.md --create --publish  # and make it live
 *   pnpm article --read <entryId> --out /tmp/week1.md     # back out as markdown
 *   pnpm article --file /tmp/week2.md --update <entryId>  # revise in place
 *
 * **Articles live in Contentful, not in this repo.** There is no `drafts/`
 * directory: two copies of a piece drift, and did — a title edited in the
 * Contentful editor left the local file wrong within minutes. The markdown a
 * piece is written in is a transport format, so `--file` takes a path anywhere
 * (a scratch file is the point), and `--read` gets it back.
 *
 * Writing is opt-in at every step: dry by default, `--create` writes a draft,
 * `--publish` makes it public.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from 'contentful-management';
import { parseArticleSource, parseArticleMarkdown } from './src/lib/articles/markdown';
import { checkVoice, checkHeadline, formatVoiceFindings } from './src/lib/articles/voice-check';
import { markdownBlocksToRichText } from './src/lib/articles/rich-text';
import { richTextToMarkdown, toArticleSource } from './src/lib/articles/from-rich-text';

const LOCALE = 'en-US';
const CONTENT_TYPE = 'jaddlArticle';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`${name} is not set. Add it to .env.local.`);
    process.exit(1);
  }
  return v;
}

async function environment() {
  const space = await createClient({ accessToken: requireEnv('CONTENTFUL_MANAGEMENT_TOKEN') })
    .getSpace(requireEnv('NEXT_PUBLIC_CONTENTFUL_SPACE_ID'));
  return { space, env: await space.getEnvironment('master') };
}

/**
 * This space also holds a portfolio site, and a personal access token reaches
 * every content type in it. Nothing here touches an entry that is not an
 * article.
 */
function assertArticle(entry: any) {
  if (entry.sys.contentType.sys.id !== CONTENT_TYPE) {
    throw new Error(`${entry.sys.id} is a ${entry.sys.contentType.sys.id}, not a ${CONTENT_TYPE}`);
  }
}

async function readBack(entryId: string, out: string | undefined) {
  const { env } = await environment();
  const entry = await env.getEntry(entryId);
  assertArticle(entry);
  const f = entry.fields;
  const body = richTextToMarkdown(f.content?.[LOCALE]);
  const source = toArticleSource(
      {
        year: f.year?.[LOCALE] ?? 0,
        week: f.week?.[LOCALE] ?? 0,
        playoff: !!f.playoffs?.[LOCALE],
        title: f.title?.[LOCALE] ?? '',
        subtitle: f.subtitle?.[LOCALE],
        tags: f.tags?.[LOCALE] ?? [],
      },
      body
    );

  // Written to a file rather than stdout when asked: a shell redirect would
  // also capture the package manager's banner, and the result no longer parses
  // as frontmatter.
  if (out) {
    writeFileSync(out, source);
    console.log(`${entry.sys.id} -> ${out} (${source.length} chars, ${entry.isPublished() ? 'published' : 'draft'})`);
  } else {
    process.stdout.write(source);
  }
}

async function main() {
  const readId = arg('read');
  if (readId) return readBack(readId, arg('out'));

  const file = arg('file');
  if (!file) {
    console.error(
      'Usage:\n' +
      '  pnpm article --file <path.md> [--create] [--publish] [--force]\n' +
      '  pnpm article --file <path.md> --update <entryId>\n' +
      '  pnpm article --read <entryId> [--out <path.md>]'
    );
    process.exit(1);
  }

  const source = parseArticleSource(readFileSync(file, 'utf8'));
  if (!source.title || !source.year || !source.week) {
    console.error('Frontmatter needs at least title, year and week.');
    process.exit(1);
  }

  const blocks = parseArticleMarkdown(source.body);
  const document = markdownBlocksToRichText(blocks);

  const fields: Record<string, unknown> = {
    title: { [LOCALE]: source.title },
    year: { [LOCALE]: source.year },
    week: { [LOCALE]: source.week },
    playoffs: { [LOCALE]: source.playoff },
    content: { [LOCALE]: document },
  };
  if (source.subtitle) fields.subtitle = { [LOCALE]: source.subtitle };
  if (source.tags.length) fields.tags = { [LOCALE]: source.tags };

  const counts = blocks.reduce<Record<string, number>>((acc, b) => {
    acc[b.kind] = (acc[b.kind] ?? 0) + 1;
    return acc;
  }, {});

  console.log(file);
  console.log(`  title      ${source.title}`);
  console.log(`  subtitle   ${source.subtitle ?? '(none)'}`);
  console.log(`  year/week  ${source.year} / ${source.week}${source.playoff ? ' (playoff round)' : ''}`);
  console.log(`  tags       ${source.tags.join(', ') || '(none)'}`);
  console.log(`  words      ${source.wordCount}`);
  console.log(`  blocks     ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}`);
  console.log('');
  console.log('  not set here, add in Contentful: featureImage, featuredTeams');

  // Advisory, never fatal: these rules are blunt enough to be wrong sometimes,
  // and a draft is worth more read than blocked. See voice-check.ts.
  const voice = [
    ...checkHeadline(source.title, 'title'),
    ...(source.subtitle ? checkHeadline(source.subtitle, 'subtitle') : []),
    ...checkVoice(source.body, source.week),
  ];
  if (voice.length) {
    const errs = voice.filter(f => f.severity === 'error').length;
    console.log('');
    console.log(`  voice check — ${errs} to fix, ${voice.length - errs} to look at`);
    console.log(formatVoiceFindings(voice));
  } else {
    console.log('');
    console.log('  voice check — clean');
  }

  const { space, env } = await environment();

  const updateId = arg('update');
  if (updateId) {
    let entry = await env.getEntry(updateId);
    assertArticle(entry);
    const wasPublished = entry.isPublished();
    for (const [k, v] of Object.entries(fields)) entry.fields[k] = v as any;
    entry = await entry.update();
    console.log('');
    console.log(`  Updated ${entry.sys.id}`);
    if (wasPublished && !flag('publish')) {
      console.log('  This article is PUBLISHED; the live version is unchanged until you publish.');
    }
    if (flag('publish')) {
      await entry.publish();
      console.log('  Published — live on the site.');
    }
    console.log(`  https://app.contentful.com/spaces/${space.sys.id}/entries/${entry.sys.id}`);
    return;
  }

  const existing = await env.getEntries({
    content_type: CONTENT_TYPE,
    'fields.year': source.year,
    'fields.week': source.week,
  });

  if (existing.total > 0) {
    console.log('');
    console.log(`  ${existing.total} existing article(s) for ${source.year} week ${source.week}:`);
    for (const e of existing.items) {
      console.log(`    ${e.sys.id}  [${e.isPublished() ? 'published' : 'draft'}]  ${e.fields.title?.[LOCALE]}`);
    }
    if (!flag('force')) {
      console.log('');
      console.log('  Refusing to create a duplicate. Use --update <entryId>, or --force.');
      return;
    }
  }

  if (!flag('create')) {
    console.log('');
    console.log('  Dry run. Nothing was written. Add --create to make the entry.');
    return;
  }

  const entry = await env.createEntry(CONTENT_TYPE, { fields: fields as any });
  console.log('');
  console.log(`  Created ${entry.sys.id} (draft, not published)`);
  console.log(`  https://app.contentful.com/spaces/${space.sys.id}/entries/${entry.sys.id}`);
  console.log(`  Preview: http://localhost:3000/admin/preview/${entry.sys.id}`);

  if (flag('publish')) {
    await entry.publish();
    console.log('  Published — live on the site.');
  }
}

main().catch(e => {
  console.error('Failed:', e.message?.split('\n')[0] ?? e);
  process.exit(1);
});
