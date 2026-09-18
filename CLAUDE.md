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

pnpm dossier --team "Hauloll"                       # everything known about one franchise
pnpm dossier --team 10 --json                       # same, machine-readable
pnpm dossier --verify                               # invariant checks across every team

pnpm article --file /tmp/week2.md                    # dry run
pnpm article --file /tmp/week2.md --create           # create a Contentful draft
pnpm article --file ... --create --publish           # and make it live
pnpm article --file ... --update <entryId>           # revise an existing one
pnpm article --read <entryId>                        # back out as markdown
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
- `src/lib/teams/` — per-team statistics; see **Team dossiers** below.
- `src/lib/contentful/api.ts` — article/team/trophy fetching plus the "Processed*" mappers.
- `src/lib/sleeper/` — Sleeper API client (`api.ts`), roster-ID→team-ID map (`mapping.ts`), `players.ts` (the `nfl_players` cache), and `import-service.ts` which fetches a week's matchups, inserts games, and awards the weekly high-score trophy. The league id comes from `SLEEPER_LEAGUE_ID` and **changes every season** — Sleeper issues a new league each year, chained through `previous_league_id`, which is how briefs reach past seasons.

### Schema naming gotchas

The DB column names differ from `supabase-setup.md` (that file is aspirational/original; the live schema drifted). `src/types/database.ts` documents the real fields:

- `teams.team_id` is the primary key, **not** `id`.
- `games.year` (not `season_year`) and `games.playoffs` (not `is_playoff`).
- `team_seasons.year`, `league_seasons.year`.
- `divisions.division_id`/`division_name`, `quads.quad_id`/`quad_name`.
- `playoff_seeds` *does* use `season_year` (it's the newest table).

Four accessors used to query columns that do not exist, so they errored and
returned `null`/`[]` for every call. They are fixed; the live shapes are:

- `teams` is **only** `team_id, team_name`. No short name, logo, owner or
  active flag — those live in Contentful (`jaddlTeam`) and `team_bios`.
- `team_bios` is `team_id, owner, location, bio, first_year`, **one row per
  team, not per season**. `first_year` can predate the game log.
- `franchise_history` is a **name lineage** — `team_id, franchise_order,
  franchise_name` — not an old/new change log. Rows may repeat the current
  name, so dedupe before calling them *former* names.
- `drafts` is draft **order** only (`year, pick, team_id`), and the years it
  covers are **not contiguous** — 2007-2020, then nothing until 2026. Read
  `DraftProfile.years` (the recorded seasons) or `eraLabel` ("2007-2020 and
  2026"); never a `{from, to}` span, which renders the hole as five seasons of
  data that do not exist.
- `trophies` is `trophy_id, trophy_name`; `trophy_case` is `team_id, trophy_id,
  year, amount`, where **`amount` is a counter**, so "how many weekly high
  scores" is `SUM(amount)`, not `COUNT(*)`.
- The legacy `articles` table is an index of the pre-Contentful archive keyed by
  `page_id` (`"2008_1_1"`). `getArticles` was deleted rather than repaired.

`trophy_case` runs from **2003**, four seasons before `games`. It is therefore
the authoritative championship source; anything derived from the game log
necessarily misses 2003-2006.

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

**The division/quad step is load-bearing — do not skip it.** Both
`computeGroupTitles` (briefs) and `rankSeason` (teams) originally went straight
from win % to points for, which named the wrong 2022 quad winner: Mighty Boom
and Tulsa both finished 6-8, Tulsa scored more, but Mighty Boom took the quad
3-1. The briefs version was feeding that wrong title into article briefs.

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

### Records vs points: two different filters

`countsTowardRecord(game, config)` answers "does this game affect W-L-T". It is
**not** the same question as "do this game's points count", and conflating them
is how the two existing implementations disagree:

- `calculateStandings` adds **playoff** points into `points_for`.
- `recordsForSeason` (briefs) drops 2025's Week 14 points along with its result,
  even though that play-in scored points precisely so they *would* count.

`countsTowardPoints(game)` in `src/lib/teams/game-log.ts` is the second
predicate: regular-season games only, play-in weeks included. Anything
computing a points total should say which of the two it means.

Also: a score of **0 is legal**. `getTeamRecords` and `getAllTimeTeamRecords`
test `if (!game.home_score)` and silently drop shutouts; new code must test
`=== null`.

### A season is not complete until it is complete

`SeasonProgress` on `SeasonTables` (`src/lib/teams/tables.ts`) records how many
regular-season weeks a year has actually played, and `regularSeasonSettled()` is
the predicate everything gates on. Use it the way `countsTowardRecord` is used —
**anything that reads a season as a finished unit must check it.**

One week into 2026 the site had already awarded two division titles and a points
title, rewritten nine franchises' best-or-worst season ever as a 1-0 or 0-1
record, inflated a prestige rating by four and a half points, and crowned a
one-week points total the lowest scoring season in league history.

Gated on completion: group titles (both `teams/honors.ts` and
`briefs/history.ts`), points titles, best/worst season in `superlatives`, the
`peak-wasted` observation, and `getSeasonRecords` in `supabase/history.ts`.

Two things deliberately **not** gated, because they are cumulative rather than
seasonal: career records and league ranks (those games really were played), and
`seasons[]` itself, which carries `inProgress`, `weeksPlayed` and
`scheduledWeeks` so the UI can label the live row instead of hiding it.

**`identity.seasonsPlayed` and `career.seasons` count COMPLETED seasons only**,
because they are the denominator for every rate on the page — "seven berths in
nineteen seasons" must not divide by a season one week old that could still
produce a berth. `identity.liveSeason` carries the in-progress year separately.
Note this means the season table has more rows than `seasonsPlayed`, which is
why its header states a span (`2007–2026`) rather than a count.

**Prestige scales rather than excludes.** A season's recency weight is
multiplied by the fraction of it played, so week 1 counts a fourteenth of a
season. Excluding the current season outright would make the metric stale all
year; weighting it lets it move as the season does.

`getSeasonRecords` previously excluded "the latest year", which was wrong in
both directions — it hid a finished season's records until the next one started,
and its guard only covered the W-L tally, leaving points totals to leak.

`pnpm dossier --verify` asserts none of this regresses.

### Team dossiers

`loadTeamDossier(teamId)` in `src/lib/teams/` is the single entry point for
per-team statistics — identity, career and season records, honors, luck,
head-to-head, superlatives and draft slots. It runs one `loadLeagueHistory()`
plus a few team-scoped lookups and derives the rest in memory.

It exists because `teams/[id]/page.tsx` derives all of this inline and gets
several wrong: its career record counts playoff games and the 2025 play-in, so
it disagrees with the standings page for the same team. **The page has not been
migrated yet** — that is the next piece of work.

Sourcing rules, each because the obvious source is wrong:

- **Championships** come from `trophy_case`, not the game log (2003 vs 2007).
  `computeChampionships` is kept as a cross-check, surfaced on
  `dossier.crossChecks`.
- **Group titles** are recomputed from final standings. The stored "Division
  Champ" trophy (id 18) has twelve rows, all 2019+.
- **Playoff appearances** come from `games`. `playoff_seeds` holds eight rows,
  all 2025.
- **Streaks** are within-season, matching `streakRarity` so the "only N teams
  have ever done this" figure is comparable. The /history page instead reports
  cross-season streaks; the two will disagree for a run that crossed a season.
- **Head-to-head** series include playoff meetings (that is what "leads the
  series" means); the career W-L does not. Both are exposed.

`pnpm dossier --verify` asserts the invariants — most usefully that league-wide
expected wins sum to games played, which catches any error in the week filter or
the tie split.

**Career scoring ranks are era-sensitive, so use the era-adjusted ones.**
League scoring sat near 92 points a game from 2009-2017, then stepped up — 101
in 2018, 122 in 2019, ~139 from 2020 on. That is a settings change, not drift,
so raw career points per game ranks franchises largely by *when* they played:
the franchise with the highest career PPG in league history joined in 2017 and
was below average for its own era (raw 1st of 17, adjusted 14th).

`src/lib/teams/era.ts` provides the fix, built like OPS+: `scoringIndex` is a
team's points as a percentage of the league's scoring level over the exact
seasons it played, where 100 is par. It is on `dossier.ranks` and per season on
`SeasonLine`. Z-scores and percentile-of-field were measured and rejected — the
season standard deviation swings from 6.6 to 13.9 on a twelve-team sample.

**Plot the season index, not raw points-for.** A raw points-by-season line
mostly draws the league-wide scoring step rather than the team.

### Observations ("did you know")

`deriveObservations(dossier)` in `src/lib/teams/observations.ts` feeds a
rotating card on the team page. These are **detectors, not written copy**: each
one interrogates the dossier, returns `null` when the answer is unremarkable,
and phrases itself from live numbers when it fires.

Written this way on purpose. Hand-writing twelve teams' worth of facts is wrong
by the following Sunday — the luck gap, streaks and ranks all move as weeks are
imported. The judgment lives in *which* patterns are worth noticing and how
they are worded; the numbers stay true.

**Three rules, all learned by breaking them.**

**1. Fire on something unusual, never on a slot that always exists.** Every
franchise has a worst opponent, a best season and a worst season. A detector
that reports the extreme of a list that is never empty produces the same
sentence on every page with the nouns swapped — which is exactly what happened:
`nemesis` fired for 9 of 17 franchises, `swing` for 8, and every team had an "X
owns them" card. A threshold must be measured against the team's own baseline
(`nemesis` now needs a gap against their own career win rate) or against a
league-wide rarity figure. A threshold on the *size* of the extreme does not
fix this: `massacre` was tried at 85 points (12/17), then at a 2x score ratio
(10/17), before the measured distribution showed it running smoothly from 1.6x
to 3.0x with no natural cut — because the most extreme game of a long career is
always extreme.

**2. Do not restate another team's card.** Head-to-head facts are symmetric.
"Odouls own them, 2-12" and "their favourite opponent is In Pursuit, 12-2" are
one series printed twice, and 2011's 156-59.8 was showing up as both Riley
County's biggest win and Red Hornets' worst loss. Where a fact has two sides,
only the side it is more remarkable for may fire — `favourite` therefore sets a
much higher bar than `nemesis`, and `massacre` fires only from the winner's.

**3. Never assert a league-wide superlative a detector cannot check.** The
dossier supports comparative claims only where it carries a rank (`ranks.*`,
`luck.pointsAgainstRank`) or a rarity figure (`streakRarity`'s `occurrences`
and `longestEver`). An early version claimed a team's worst head-to-head was
"the most lopsided series either franchise has with anyone" — `opponents.worst`
supports no such thing.

**The eight detectors that fire for several franchises carry ten phrasings
each**, chosen deterministically — 110 sentences across 11 variant sets. Two
rules govern them.

*Every variant in a set must be interchangeable*: same claim, same figures,
different shape. A variant that reaches for a flourish the dossier cannot
support is a rule-3 violation that only surfaces on the franchises it happens
to land on.

*The index is a SUM, not a hash of a seed* — `(teamId + leagueShift +
hash(detectorId)) % variants.length`. Hashing a team-plus-numbers seed is a
random draw into ten bins, and random draws collide: measured, it put 9 of 43
firings onto a phrasing another team already had, including two whose numbers
were close enough to read like a copy-paste bug. Summing keeps the terms
separable — `teamId` is unique so it spreads teams as a permutation rather than
a draw (3 collisions instead of 9), `leagueShift` is identical for every active
franchise in a render so it rotates the whole assignment as weeks are imported
rather than freezing the copy for a year, and `hash(detectorId)` stops a team
sitting on the same index down the whole card stack. **Never make this
random**: the page is server-rendered per request, so a random pick rewords the
card on refresh, or mid-read while it rotates. `leagueShift` reads the team's
latest season, which is uniform across active franchises but not for defunct
ones, so a defunct team draws from its own rotation.

**Selection is facet-first, not weight-first.** Every observation carries a
`facet` (luck, opponent, streak, honors, postseason, scoring, season-shape,
game, identity, draft, form) and at most one card per facet is taken before any
second card. Taking the top five by weight gave pages two head-to-head splits
and two streak facts while bespoke observations sat unused — and because the
high-weight detectors are the general ones, it gave every page the same five
shapes.

Seasonal detectors read `done(d)` (completed seasons only) and any "N seasons
since" count measures to `lastSettled(d)`, per **A season is not complete until
it is complete** above. `form-*` skips defunct franchises, for which "right
now" means 2007.

Active franchises fire 4-16 detectors each; the four defunct one-season teams
fire 1-5. If the active floor drops, add detectors rather than loosening the
thresholds on existing ones.

### Prestige

`computePrestige` in `src/lib/teams/prestige.ts` is a 1-5 star standing for a
franchise, on `dossier.prestige`. Every other career figure treats 2008 and 2024
as equal; this one does not.

Each season earns prestige points (championship 100, lost final 40, group title
30, points title 22, then scoring, playoff berth and wins, win rate, weekly
highs), all **derived from `games`, never from `trophy_case`**. Seasons are then
**averaged with a recency weight** that is ~1.0 for the current season, 0.98 at
four years, 0.95 at six, 0.83 at ten, 0.65 at fourteen and 0.39 at eighteen,
bottoming at a 0.05 floor at `DECAY_SPAN` (22 seasons). Nearly flat across the
recent past, falling away increasingly steeply the further back it goes.

`DECAY_SPAN` is set a little wider than the league's actual 18-season span so
the falloff stays smooth to the oldest season; at exactly 18 there was a hard
step near the edge and a 2007 result fell off a ledge rather than fading.
**Star cut-points must be recalibrated whenever the curve changes** — they are
percentiles (`STAR_PERCENTILES`) of the historical rating distribution, and a
different curve produces a different distribution.

An earlier version used a logistic centred six seasons back. It decayed far too
fast — a ten-year-old title kept 22% of its weight — so a franchise with two
recent titles and nine seasons of history outranked one with four titles and two
decades of contention. Longevity should matter; recency should matter more, but
not overwhelmingly. `DECAY_SPAN` and `DECAY_EXPONENT` are the dials.

Two things that are easy to get wrong and are already handled:

- It is an **average, not a sum**, so longevity neither helps nor hurts — only
  the quality of the recent part of the record does.
- A `PRIOR_SEASONS` shrinkage of 2 neutral seasons sits in the denominator.
  Without it a franchise that went 12-1 and won the title in its only season
  outrated every real dynasty.

**One narrow exception to "no trophies":** `games` begins in 2007, so the four
championships of 2003-2006 are underivable. For those seasons only, prestige
reads `trophy_case` — it is the sole record of them, and the two sources agree
on all nineteen champions from 2007-2025, each of which resolves to a single
final-round game. Nothing inside the logged era is ever taken from the trophy
table. Without this, Mighty Boom and Fightin' Longshanks would each show three
titles when the league knows they have four.

Star cut-points are **absolute**, set from the distribution of all 230
team-seasons in league history rated as of that season, so 4 stars means roughly
"top fifth of anything this league has fielded". The all-time peak is Mighty
Boom's 2013-2019 run at 75. Percentile-relative stars were rejected: a
franchise's rating should move when it plays better, not only when its rivals
play worse.

**Trophy meanings live in Contentful `jaddlTrophy.trophyDescription`**, keyed by
`trophyId` to `trophy_case.trophy_id`. Supabase stores only the name. What they
are: 1 Court-Ordered Limousine = champion; 2 Surrendered Keys = loses the final;
4 Virtual Vermeil = regular-season points leader; 5 Torn Hoodie = best draft,
voted; 6 Briefly Badass = weekly top scorer. Ids 8-13 are rivalry trophies with
one row each — current holder, not an annual award.

**A finals record needs both trophies, and the game log needs both too.**
`honors.finals` (`src/lib/teams/honors.ts`) unions Court-Ordered Limousine and
Surrendered Keys with the game-derived champion/runner-up. Use it rather than
`career.playoff.byRound`, which is game-log only and so reported Fightin'
Longshanks as 3-0 in finals against a trophy case holding four titles — 2005
predates every recorded game. Four franchises were understated this way, one
for each pre-2007 title.

**The two sides do not cover the same era.** Champions are recorded from 2003,
but the first Surrendered Keys row is 2007, so the four pre-2007 finals name a
winner and no loser. Finals *wins* are therefore complete and finals *losses*
are not: `finals.lossesKnownFrom` marks where that side becomes trustworthy and
`finals.lossesComplete` says whether a given franchise predates it. **Nothing
may claim a team "has never lost a final" when `lossesComplete` is false** —
the `finals-unbeaten` observation swaps to a phrasing that names the gap.

**Three trophies mark a group title, in different eras**, which is why none of
them alone looks like a coherent award:

- **7 Eastern Goblet** — East division champ, 2010-2018.
- **3 Jared's Goblet** — the West's counterpart over exactly those years (9/9).
  Before divisions existed it went to the best regular-season record (3/3,
  2007-2009), which is what "the original championship trophy" means. Not
  awarded 2019-2024, then used for all four quad winners in 2025 (4/4).
- **18 Division Champ** — the quad era, but only 2019, 2020 and 2022 were
  recorded.

`trophy_case` is independent human-recorded ground truth, so **`pnpm dossier
--verify` asserts the derivations against it**: Surrendered Keys against the
derived runner-up (19/19), Virtual Vermeil against the derived points title
(16/16), all three group trophies against the derived group titles (34/34), and
the pre-division Goblet against the best regular-season record (3/3). The group
check is what caught the missing tiebreak below.

**Prestige reads no trophies at all.** Every input is derived from the game log:
champions from the winner of each season's final playoff round, group winners
recomputed from final standings, points titles from season points totals, weekly
highs from each week's scores. The trophy table is incomplete — Briefly Badass
has no rows for 2022-2024 and totals 193 against 254 actual weekly highs — and
partly ambiguous, so the game log is the sounder source wherever it reaches.
`honors.championships` stays trophy-based for *display*; prestige uses
`championshipsFromGames` plus the pre-2007 trophy rows (see below).

**`pointsGames`, not `totalGames`, is the denominator for any scoring rate.**
They differ wherever `recordExcludesWeeks` applies: 2025's Week 14 contributed
points but no result, so dividing its points by its record games overstates
every 2025 scoring average by 14/13.

### Routing and rendering

- `src/app/(pages)/` — public site (home, news, scores, standings, teams, history, survivor). Mostly server components; the home page is `force-dynamic`, and `teams/page.tsx` plus the news client components are `'use client'`.
- `src/app/(admin)/admin/` — score import and playoff export dashboards, all client components, plus `admin/preview/[id]`, which renders an **unpublished** article through the real article shell. It reads via the Contentful *preview* API and lives under `/admin` so `proxy.ts` gates it — unpublished copy is behind the admin session rather than merely at an unguessable URL.
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

Row-level security is enabled on every table with no write policies
(`supabase-migrations/004_row_level_security.sql`, extended by `005`), so the
anon key can read and nothing else. Most tables carry a public SELECT policy;
the three legacy ones (`articles`, `quad_map`, `schedule`) carry none, so reads
are denied there too.

**RLS coverage is not a list to maintain by hand.** 004 enabled RLS on the 14
tables the app queries, but PostgREST exposes all 18, so the other four stayed
writable by the anon key and Supabase kept mailing `rls_disabled_in_public`
warnings. After adding any table, run the coverage query at the bottom of 005 —
`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT
rowsecurity` — which must return zero rows. This matters because `NEXT_PUBLIC_SUPABASE_ANON_KEY`
is compiled into the client bundle every visitor downloads — before RLS, that
key could write to `games` directly and bypass the admin auth entirely.

Do not reintroduce the old `SUPABASE_SERVICE_ROLE_KEY || NEXT_PUBLIC_..._ANON_KEY`
fallback that `games.ts` and the playoff-export route used to have. It made an
insecure configuration look like a working one.

### Database migrations

SQL lives in `supabase-migrations/` and is applied **manually in the Supabase SQL Editor** — there is no migration runner. Add a numbered file and document it in `supabase-migrations/README.md`.

## Article page

`src/components/article/` renders a recap. One shell, two callers: the
published Contentful article at `news/[id]` and the unpublished preview at
`admin/preview/[id]`.

- `article-shell.tsx` — context bar, inverted hero, and the grid that puts the
  week's scores in a right rail. The article is first in the DOM at every width;
  `grid-template-areas` moves the rail above it on phones.
- `week-slate.tsx` — the rail. **Its scores come from Supabase via
  `loadWeekSlate`, never from the prose**, so a recap cannot disagree with the
  scoreboard beside it after a score correction. It also decides which game is
  the week high / biggest margin / closest, and the in-flow game marker reuses
  that tag rather than recomputing it.
- `widgets.tsx` — `GameMarker`, `PlayerLine`, `SeriesArc`, `HonorsStrip`,
  `PullQuote`. Deliberately unequal in weight: the game marker is a rule across
  the column, the player line is an annotation hanging off it. Only `GameMarker`
  has a path to the page today; the rest wait on article generation (see
  **Article pipeline**).
- `article-body.tsx` — prose from parsed markdown blocks, used by the preview.
  The published page renders the rich text directly, but both produce the same
  elements.
- `article.module.css` — a CSS module, not utilities; colour comes from the
  site's own tokens so dark mode arrives through next-themes. The hero is dark
  in **both** themes, since inverting it would put a white slab on a dark page.

Two things worth knowing before changing any of it:

- **The mobile rail disclosure is a checkbox and a label, not `<details>`.**
  `<details>` measured open when it should have been closed, and engines hide
  its closed content by mechanisms that do not reliably yield to CSS. The
  replacement is one selector and no JavaScript.
- **`formatScore` in `src/lib/articles/format.ts`, not `toFixed(2)`.** `games`
  stores one decimal, so padding a stored 104.0 to "104.00" invents a digit.
  Sleeper does carry two (103.95), which is why an article's own numbers can be
  *more* precise than the rail beside them.

`## Team A 174.9 | Team B 103.95` — the roundup heading the column has used
since 2008 — is parsed into a `GameMarker` on both surfaces. A heading that
does not match renders as an ordinary `h2`, so single-game essays are unaffected.

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
- **Articles live in Contentful and nowhere else.** There is no `drafts/`
  directory; there was one, and two copies drifted within minutes — a title
  edited in the Contentful editor left the local file wrong. A piece is created
  as a Contentful *draft* from the moment it exists, read at
  `/admin/preview/[id]`, and published when Ryan says so. Markdown is a
  transport format between the conversation and the entry, not a stored copy, so
  `--file` takes a path anywhere (a scratch file is the point).
- `create-article.ts` (`pnpm article`) — markdown into a `jaddlArticle`, and back
  out again. **Dry by default**: `--create` writes an unpublished entry,
  `--publish` makes it live, `--update <id>` revises one, and it refuses to
  create a second article for a year/week that already has one without
  `--force`. `--read <id>` returns the entry as markdown with frontmatter — that
  is the revision path, and it is why `from-rich-text.ts` exists.
- `src/lib/articles/markdown.ts` → `rich-text.ts` → `from-rich-text.ts` — one
  parse in each direction, verified lossless on a real article: stored document
  → markdown → blocks → document is byte-identical after key normalisation, and
  the markdown is a fixed point. A game heading round-trips as a `heading-2`
  rather than as structured data, which keeps the entry editable as an article
  in Contentful and keeps markers working on one edited there by hand.
- `CONTENTFUL_MANAGEMENT_TOKEN` is a **personal access token**: it reaches every
  space and content type on the account, and this space also holds a portfolio
  site. Every query and write is scoped to `jaddlArticle` by convention, not by
  anything the token enforces — keep it that way.

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
- Real-world NFL context comes from `src/lib/nfl/espn.ts`, which reads ESPN's
  public box scores and attaches a stat line, game result and derived notes to
  every starter. Matching is normalized name + team — Sleeper and ESPN disagree
  only on Washington (WAS/WSH), and suffixes like "Sr." differ — which hit
  108/108 starters in 2026 Week 1. Uncached on purpose: a week is ~17 requests
  and an in-progress week wants fresh data.
  **The `qb-pulled` note is the load-bearing one.** Without it a quarterback
  benched after five throws is indistinguishable from one who played badly all
  day, and a recap blames an owner for a lineup nobody would have set
  differently. That exact mistake reached a draft before this existed.

## Conventions

- Path alias `@/*` → `src/*`; `typedRoutes` is on, so `Link` hrefs must be real routes.
- UI is shadcn/ui (`src/components/ui/`, "default" style, neutral base, CSS variables) + Tailwind + `lucide-react` icons. Use `cn()` from `src/lib/utils`.
- Fonts are Geist / Geist Mono; use Geist Mono for stats and numbers.
- Accent color is `#1E64FF`; the design deliberately avoids yellow/orange and colored emoji in UI chrome. Dark mode via `next-themes` (see `ThemeAwareLogo`/`ThemeAwareWordmark`).
- Data functions swallow errors through `handleSupabaseError` and return empty arrays/nulls rather than throwing, so pages render degraded instead of crashing — follow that pattern for new queries.
- Remote images are restricted to `images.ctfassets.net` / `assets.ctfassets.net` in `next.config.js`; add hosts there before using `next/image` with a new source.
