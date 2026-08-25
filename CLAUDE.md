# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

JADDL is a fantasy football league site: Next.js 16 App Router (Turbopack) + React 19 + TypeScript, with **Supabase** for league data (games, teams, standings, trophies) and **Contentful** for editorial content (articles, team profiles, logos). Deployed on Vercel. Package manager is **pnpm**.

## Commands

```bash
pnpm dev          # dev server on :3000
pnpm build        # production build
pnpm lint         # eslint . (flat config; `next lint` was removed in Next 16)
pnpm type-check   # tsc --noEmit

pnpm sync-players                                   # refresh the Sleeper player cache
pnpm brief --year 2025 --week 8 --team "Hauloll"    # game brief for article writing
pnpm brief ... --json                               # same, machine-readable
pnpm brief ... --prompt                             # voice guide + brief, paste-ready
```

There is no test framework. "Tests" are standalone Node scripts at the repo root that load `.env.local` via `dotenv` and talk to Supabase/Contentful directly:

```bash
node test-playoff-export.js          # sanity-check that the DB has playoff-relevant data
node export-playoff-data.js 2025 4   # CLI version of the playoff export (year, optional week)
node test-parsing.js                 # exercises the HTML→markdown parsing in migrate-to-contentful.js
pnpm migrate                         # one-off: migrate legacy HTML articles into Contentful
pnpm add-tags                        # one-off: backfill tags on Contentful articles
```

`TESTING_PLAYOFF_EXPORT.md` documents the manual verification flow for the playoff export (CLI, `/api/export-playoff-data`, and the admin UI).

Environment variables live in `.env.local` (see `env.example`). Both `src/lib/supabase/client.ts` and `src/lib/contentful/client.ts` **throw at import time** if their keys are missing, so any page importing them fails hard without a configured env.

## Architecture

### Two data sources, joined by team ID

- **Supabase** owns dynamic data: `games`, `teams`, `team_seasons`, `league_seasons`, `divisions`, `quads`, `trophies`/`trophy_case`, `rivalries`/`rivals`, `drafts`, `playoff_seeds`.
- **Contentful** owns static/editorial data: content types `jaddlArticle`, `jaddlTeam`, `jaddlTrophy`, `newsArticle`, `leagueAnnouncement`, `historicalMoment`.
- The join key is `Contentful jaddlTeam.teamId === Supabase teams.team_id`. `src/lib/utils/team-mapping.ts` (`enrichTeamsWithSupabaseData`, `getTeamDisplayData`) is the canonical merge; Contentful wins for display fields (name, logo), Supabase wins for records and points.

### Data layer

All queries live in `src/lib/`; pages are server components that call these and pass plain data down.

- `src/lib/supabase/api.ts` — the big one (~1300 lines): teams, games, standings, playoff seeds/pods, trophies, drafts, survivor.
- `src/lib/supabase/history.ts` — all-time records, champions, streaks (`getLeagueHistory`).
- `src/lib/supabase/games.ts` — writes: `insertGames`, `awardTrophy`, `checkGamesExist`.
- `src/lib/supabase/scores.ts` — `getMostRecentWeek()`, `getSeasonWeekOptions(year)` and `getScoreboardGames(query)`. The scores page used to build its own `supabase.from('games')` query inline; it now goes through here like every other page. `getMostRecentWeek` orders by (year, playoffs, week) because playoff `week` is a round — a plain week sort ranks the championship below regular-season week 14.
- `src/lib/utils/scores.ts` — pure derivations: `enhanceGamesWithTeamProfiles` (Contentful display data onto game rows) and `summarizeGames` (avg/median/high score, narrowest and biggest margin). No I/O, so any surface can reuse them.
- `src/lib/contentful/api.ts` — article/team/trophy fetching plus the "Processed*" mappers.
- `src/lib/sleeper/` — Sleeper API client (`api.ts`), roster-ID→team-ID map (`mapping.ts`), `players.ts` (the `nfl_players` cache), and `import-service.ts` which fetches a week's matchups, inserts games, and awards the weekly high-score trophy. The league id comes from `SLEEPER_LEAGUE_ID` and **changes every season** — Sleeper issues a new league each year, chained through `previous_league_id`, which is how briefs reach past seasons.

### Schema naming gotchas

The DB column names differ from `supabase-setup.md` (that file is aspirational/original; the live schema drifted). `src/types/database.ts` documents the real fields:

- `teams.team_id` is the primary key, **not** `id`.
- `games.year` (not `season_year`) and `games.playoffs` (not `is_playoff`).
- `team_seasons.year`, `league_seasons.year`.
- `divisions.division_id`/`division_name`, `quads.quad_id`/`quad_name`.
- `playoff_seeds` *does* use `season_year` (it's the newest table).

Because `database.types.ts` is only partially accurate, `api.ts` casts queries to `any` in several places — that's deliberate, not sloppiness to "clean up."

### Current season vs configured season

`getSeasonState()` in `api.ts` separates the newest row in `league_seasons`
(`configuredSeason`) from the newest season that actually has games
(`activeSeason`), with `hasStarted` telling them apart. `getCurrentSeason()`
returns `activeSeason`.

This matters because adding next year's `league_seasons` row used to flip the
whole site to it immediately — for the ~8 months between the championship and
Week 1 the standings page and the home page rendered empty tables. Use
`hasStarted` to drive offseason UI rather than assuming the newest configured
season is being played.

### League structure is per-season and data-driven

`league_seasons.structure_type` is one of `single_league` | `divisions` | `quads`. `calculateStandings(year)` reads it to decide whether to group by divisions or quads, and `team_seasons.division_id`/`quad_id` assign teams for that year. Standings tiebreakers, in order: overall win %, then division/quad win %, then points for.

### Season format config

`getSeasonConfig(year)` in `api.ts` is the single source of truth for per-season format — playoff field size, whether pods are used, how wildcards are ranked, regular-season length, and `recordExcludesWeeks` (regular-season weeks whose games score points but do not count toward W-L-T). **Add new season rules there rather than branching on the year at the call site.** 2025's Week 14 play-in was previously an inline `year === 2025` check inside `calculateStandings`; because the streak walk did not repeat that check, every 2025 streak was wrong — two of them pointed the wrong way. That is what the inline branching costs.

- **2025** was a one-off: an 8-team field, four quad winners at seeds 1–4, wildcards ranked purely on points, and Week 14 as a play-in (points counted, W-L did not), pushing playoffs to NFL week 15.
- **2026 onward**: 6-team field, group winners take the top seeds with byes, four wildcards by record.

`calculatePlayoffSeeds` derives the bracket generically from however many division/quad groups the season has — group winners take the top seeds, wildcards fill the rest. Seeding tiebreakers are overall record → head-to-head → division/quad record → points for. Head-to-head only orders a pair, so ties among three or more teams fall back to a mini round-robin win pct among just those teams (`resolveTie`), since pairwise h2h can be circular.

Note the standings *display* still sorts by record → division/quad record → points, without head-to-head. That's deliberate for now; the h2h chain applies to playoff seeding only.

Playoff round labels come from `getPlayoffRoundLabel(round)` / `getGameWeekLabel(game)` in `api.ts` — round 1 = Quarterfinals, 2 = Semifinals, 3 = Championship, year-independent. `scores/page.tsx` previously carried four copies of a variant that special-cased 2025 as weeks 15/16/17; since playoff `week` holds the round and never exceeds 3, those branches never matched and rendered "Playoff Week 2" in the heading while the week selector said "Semifinals" for the same game.

`playoff_seeds` is written once per season via `savePlayoffSeeds(year)` after the regular season ends.

**Completed seasons are guarded.** `hasRecordedPlayoffs(year)` checks for `playoffs = true` games; when any exist, `calculatePlayoffSeeds` and `savePlayoffSeeds` both refuse by default. Seeds computed for a finished season are a *projection from current data*, not history — verified: the computed field diverges from the field that actually played in 2014 and 2018, under either wildcard rule. The stored 2025 rows likewise predate later score corrections, so re-seeding would reorder its wildcards.

Override deliberately and only for planning: `calculatePlayoffSeeds(year, { allowCompletedSeason: true })` for read-only projections, `savePlayoffSeeds(year, { force: true })` to actually overwrite stored seeds. **Historical playoff results live in `games`, never in `playoff_seeds`.**

### Playoff games are stored as rounds, not weeks

Every season since 2007 records playoff games with `playoffs = true` and `week` as the **round** (1 = quarterfinal, 2 = semifinal, 3 = championship) — not the NFL week. A season therefore has regular-season weeks 1–14 *and* playoff weeks 1–3. `importWeekScores` only writes regular-season games and refuses weeks past `regularSeasonWeeks`; playoff results are entered separately.

This used to corrupt streaks: `calculateStandings` sorted *all* of a season's games by `week` when walking back for the current streak, so playoff rounds landed among early regular-season weeks. Both that and the Week-14 problem are fixed — everything that derives a record now filters through `countsTowardRecord(game, config)`, which drops playoff games and any week in `config.recordExcludesWeeks`. **Any new code computing a record, streak or tiebreak must use that predicate**, or the columns will silently disagree again.

### Routing and rendering

- `src/app/(pages)/` — public site (home, news, scores, standings, teams, history, survivor). Mostly server components; the home page is `force-dynamic`, and `teams/page.tsx` plus the news client components are `'use client'`.
- `src/app/(admin)/admin/` — score import and playoff export dashboards, all client components.
- `src/app/api/` — admin auth (`login`/`logout`/`verify`), `admin/import-scores`, `export-playoff-data`, `revalidate`, and the diagnostic `analyze-db` / `test-supabase` routes.
- `src/proxy.ts` gates the admin surface (see below). Next 16 renamed the `middleware` convention to `proxy`; it runs on the **Node** runtime, which is not configurable.
- `POST /api/revalidate?tag=…|path=…` handles ISR invalidation (Contentful webhook target). Authenticated with `REVALIDATE_SECRET` via the `x-revalidate-secret` header (preferred — query strings land in access logs) or a `secret` query param for existing webhook configs. Required on every call, compared with `safeEqual`, and fails closed when `REVALIDATE_SECRET` is unset.

### Admin auth

Sessions are **stateless and HMAC-signed** (`src/lib/auth/session.ts`). The cookie holds `base64url(payload).base64url(HMAC-SHA256)`; `verifySessionToken` recomputes the signature and checks `exp`, so only a token this server issued is accepted. Signed with `ADMIN_SESSION_SECRET`, falling back to `NEXTAUTH_SECRET` — if neither is set, session creation throws and verification fails closed, so a misconfigured deploy locks admin out rather than opening it up.

Written with Web Crypto (not `node:crypto`). This originally existed so the same module could run in Edge middleware and Node route handlers; since the Next 16 `proxy` convention is Node-only, that constraint no longer binds. The code is kept as-is — Web Crypto is global in Node 20+ and the auth flow is verified working — but new auth code is no longer forced away from `node:crypto`. `safeEqual` still lives separately in `src/lib/auth/secrets.ts`.

`src/proxy.ts` matches `/admin/*`, `/api/admin/*`, `/api/analyze-db/*`, and `/api/test-supabase/*` — browsers get redirected to `/admin/login`, API callers get a 401. `/admin/login`, `/api/admin/login`, and `/api/admin/logout` are exempt. `import-scores` also verifies the session itself, since it writes to the database and shouldn't depend on the matcher alone.

Credentials are `ADMIN_USERNAME`/`ADMIN_PASSWORD`, compared with a hash-then-`timingSafeEqual`.

Changing the signing secret invalidates all existing sessions.

### Database access and writes

Reads use the anon key via `src/lib/supabase/client.ts`. **Writes must use
`getAdminClient()` from `src/lib/supabase/admin.ts`**, which uses
`SUPABASE_SERVICE_ROLE_KEY` and throws if reached from the browser.

Row-level security is enabled on every table with public SELECT policies and no
write policies (`supabase-migrations/004_row_level_security.sql`), so the anon
key can read and nothing else. This matters because `NEXT_PUBLIC_SUPABASE_ANON_KEY`
is compiled into the client bundle every visitor downloads — before RLS, that
key could write to `games` directly and bypass the admin auth entirely.

Do not reintroduce the old `SUPABASE_SERVICE_ROLE_KEY || NEXT_PUBLIC_..._ANON_KEY`
fallback that `games.ts` and the playoff-export route used to have. It made an
insecure configuration look like a working one.

### Database migrations

SQL lives in `supabase-migrations/` and is applied **manually in the Supabase SQL Editor** — there is no migration runner. Add a numbered file and document it in `supabase-migrations/README.md`.

## Article pipeline

Weekly recaps are written from a generated **brief**, not from raw data. The
split is deliberate and load-bearing: **facts are gathered by code, prose is
written separately.** A writer who has to look up a player id or judge whether
a result was unusual will invent things; one handed a brief will not.

### The pieces

- `nfl_players` (migration 003) caches Sleeper's player database;
  `pnpm sync-players` refreshes it, at most every 20 hours per Sleeper's
  guidance. This replaced a manual step where Sleeper player ids were mapped to
  real players by hand each week. Includes retired players — historical
  matchups must stay resolvable — and rows are upserted, never deleted.
- `src/lib/briefs/game-brief.ts` — `buildGameBrief()`. Records, streaks,
  all-time series, named rivalry and its trophy, week context, full lineups with
  each starter scored against their own baseline, owner names from `team_bios`,
  and computed candidate **angles**.
- `src/lib/briefs/history.ts` — cross-season context: division/quad titles
  (recomputed, nothing stores a winner flag), championships, clinch detection,
  score ranks.
- `src/lib/briefs/cohorts.ts` — precedent: "how many teams have ever been in
  this situation and what happened to them". This is the signature of the
  column's voice.
- `ARTICLE_VOICE.md` — how to write. Kept out of the brief on purpose: the brief
  is evidence, and baking instructions into it would fix one tone for every
  consumer.

### Decisions that are still standing

- **Do not build automatic generation yet.** Ryan decided (2026-08-25) to use
  the brief manually for several weeks first, to learn what it is missing before
  anything is built on its shape. Brief → draft → Contentful stays unbuilt until
  he says the brief is right.
- **`ARTICLE_VOICE.md` is drafted from 2008–2021 only.** The 2025 articles were
  AI-generated; drafting from them produced an imitation of an imitation, and
  the two voices have almost nothing in common. Its "Do not" section lists the
  AI tics explicitly because they are what a model reaches for by default.
- **Voice direction is Ryan's.** He is a designer by trade and sets direction;
  document what he does rather than proposing alternatives.

### Two real limits

- A brief reads the **result** from Supabase, so a week must be imported before
  a brief works. In-season the order is import scores → build brief → write.
- The brief has **no real-world NFL context**. It knows a player scored 42.75,
  never how. That texture carries a lot of the published writing, and an
  invented NFL narrative is checkable by every reader — so it is left out rather
  than guessed.

## Conventions

- Path alias `@/*` → `src/*`; `typedRoutes` is on, so `Link` hrefs must be real routes.
- UI is shadcn/ui (`src/components/ui/`, "default" style, neutral base, CSS variables) + Tailwind + `lucide-react` icons. Use `cn()` from `src/lib/utils`.
- Fonts are Geist / Geist Mono; use Geist Mono for stats and numbers.
- Accent color is `#1E64FF`; the design deliberately avoids yellow/orange and colored emoji in UI chrome. Dark mode via `next-themes` (see `ThemeAwareLogo`/`ThemeAwareWordmark`).
- Data functions swallow errors through `handleSupabaseError` and return empty arrays/nulls rather than throwing, so pages render degraded instead of crashing — follow that pattern for new queries.
- Remote images are restricted to `images.ctfassets.net` / `assets.ctfassets.net` in `next.config.js`; add hosts there before using `next/image` with a new source.
