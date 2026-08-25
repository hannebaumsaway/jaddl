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
- `src/lib/supabase/scores.ts` — `getMostRecentWeek()`, used to default the scores/standings pages to the latest week.
- `src/lib/contentful/api.ts` — article/team/trophy fetching plus the "Processed*" mappers.
- `src/lib/sleeper/` — Sleeper API client (`api.ts`), roster-ID→team-ID map (`mapping.ts`), and `import-service.ts` which fetches a week's matchups, inserts games, and awards the weekly high-score trophy.

### Schema naming gotchas

The DB column names differ from `supabase-setup.md` (that file is aspirational/original; the live schema drifted). `src/types/database.ts` documents the real fields:

- `teams.team_id` is the primary key, **not** `id`.
- `games.year` (not `season_year`) and `games.playoffs` (not `is_playoff`).
- `team_seasons.year`, `league_seasons.year`.
- `divisions.division_id`/`division_name`, `quads.quad_id`/`quad_name`.
- `playoff_seeds` *does* use `season_year` (it's the newest table).

Because `database.types.ts` is only partially accurate, `api.ts` casts queries to `any` in several places — that's deliberate, not sloppiness to "clean up."

### League structure is per-season and data-driven

`league_seasons.structure_type` is one of `single_league` | `divisions` | `quads`. `calculateStandings(year)` reads it to decide whether to group by divisions or quads, and `team_seasons.division_id`/`quad_id` assign teams for that year. Standings tiebreakers, in order: overall win %, then division/quad win %, then points for.

### Season format config

`getSeasonConfig(year)` in `api.ts` is the single source of truth for per-season format — playoff field size, whether pods are used, how wildcards are ranked, and regular-season length. **Add new season rules there rather than branching on the year at the call site.**

- **2025** was a one-off: an 8-team field, four quad winners at seeds 1–4, wildcards ranked purely on points, and Week 14 as a play-in (points counted, W-L did not), pushing playoffs to NFL week 15.
- **2026 onward**: 6-team field, group winners take the top seeds with byes, four wildcards by record.

`calculatePlayoffSeeds` derives the bracket generically from however many division/quad groups the season has — group winners take the top seeds, wildcards fill the rest. Seeding tiebreakers are overall record → head-to-head → division/quad record → points for. Head-to-head only orders a pair, so ties among three or more teams fall back to a mini round-robin win pct among just those teams (`resolveTie`), since pairwise h2h can be circular.

Note the standings *display* still sorts by record → division/quad record → points, without head-to-head. That's deliberate for now; the h2h chain applies to playoff seeding only.

Two year-specific branches remain in `scores/page.tsx` for 2025 display only; they no-op for other seasons.

`playoff_seeds` is written once per season via `savePlayoffSeeds(year)` after the regular season ends.

**Completed seasons are guarded.** `hasRecordedPlayoffs(year)` checks for `playoffs = true` games; when any exist, `calculatePlayoffSeeds` and `savePlayoffSeeds` both refuse by default. Seeds computed for a finished season are a *projection from current data*, not history — verified: the computed field diverges from the field that actually played in 2014 and 2018, under either wildcard rule. The stored 2025 rows likewise predate later score corrections, so re-seeding would reorder its wildcards.

Override deliberately and only for planning: `calculatePlayoffSeeds(year, { allowCompletedSeason: true })` for read-only projections, `savePlayoffSeeds(year, { force: true })` to actually overwrite stored seeds. **Historical playoff results live in `games`, never in `playoff_seeds`.**

### Playoff games are stored as rounds, not weeks

Every season since 2007 records playoff games with `playoffs = true` and `week` as the **round** (1 = quarterfinal, 2 = semifinal, 3 = championship) — not the NFL week. A season therefore has regular-season weeks 1–14 *and* playoff weeks 1–3. `importWeekScores` only writes regular-season games and refuses weeks past `regularSeasonWeeks`; playoff results are entered separately.

Consequence to watch: `calculateStandings` sorts all of a season's games by `week` ascending when computing streaks, which interleaves playoff rounds with early regular-season weeks. Streak values are unreliable for seasons with playoff games.

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

### Database migrations

SQL lives in `supabase-migrations/` and is applied **manually in the Supabase SQL Editor** — there is no migration runner. Add a numbered file and document it in `supabase-migrations/README.md`.

## Conventions

- Path alias `@/*` → `src/*`; `typedRoutes` is on, so `Link` hrefs must be real routes.
- UI is shadcn/ui (`src/components/ui/`, "default" style, neutral base, CSS variables) + Tailwind + `lucide-react` icons. Use `cn()` from `src/lib/utils`.
- Fonts are Geist / Geist Mono; use Geist Mono for stats and numbers.
- Accent color is `#1E64FF`; the design deliberately avoids yellow/orange and colored emoji in UI chrome. Dark mode via `next-themes` (see `ThemeAwareLogo`/`ThemeAwareWordmark`).
- Data functions swallow errors through `handleSupabaseError` and return empty arrays/nulls rather than throwing, so pages render degraded instead of crashing — follow that pattern for new queries.
- Remote images are restricted to `images.ctfassets.net` / `assets.ctfassets.net` in `next.config.js`; add hosts there before using `next/image` with a new source.
