# Drafts

Pre-publication working copies of JADDL articles.

**Contentful is the published source of truth.** Once a piece is live on the
site it is a `jaddlArticle` entry; the file here is the draft it came from, kept
for history. If the two ever disagree, Contentful is right.

Nothing in this directory is served. It deliberately is **not** under `public/`,
which Next.js exposes at the site root — an unfinished draft at
`www.jaddl.com/articles/…` is not a thing anyone wants.

## Naming

```
YYYY-wkNN-slug.md       2026-wk01-nobody-got-screwed.md
YYYY-poN-slug.md        2026-po3-slug.md        (playoff round, not NFL week)
```

Zero-padded week so `wk01` sorts ahead of `wk10`.

## Frontmatter

```yaml
---
year: 2026
week: 1
playoff: false
title: Nobody got screwed
subtitle: A rare and frankly disappointing week for grievances
status: draft        # draft | published
---
```

`week` is the JADDL week. For a playoff piece set `playoff: true` and use the
round (1 = quarterfinal, 2 = semifinal, 3 = championship), matching how games
are stored — see CLAUDE.md.

The fields mirror the `jaddlArticle` content type, so this doubles as the
handoff format if the brief → draft → Contentful step ever gets built.

## Writing one

```bash
pnpm brief --year 2026 --week 1 --team "Longshanks" --prompt
```

That emits `ARTICLE_VOICE.md` followed by the game brief. The brief supplies
league facts; it carries no real-world NFL context, so anything about what
actually happened on the field has to be checked against a box score. See the
Article pipeline section of CLAUDE.md.
