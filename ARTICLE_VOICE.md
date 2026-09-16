# JADDL article voice

Drafted from the **2008–2021** articles — Ryan's own writing. The 2025 recaps
are excluded deliberately: they were AI-generated, and drafting a voice guide
from them would just be an imitation of an imitation.

Pair this with a game brief (`pnpm brief --year Y --week W --team "Name"`). The
brief supplies league facts; this file supplies only how to write.

## The narrator

First person, opinionated, present in the piece. This is the single biggest
thing to get right — the writer is a character, not a wire service.

> I don't know, guys…I'm smelling a 6-8 division title for the Lucky Break Bears.

> Also, someone check my sports math here, but I'm pretty sure Jesus could
> clinch a division title next week, even with a loss.

> Literally zero teams in JADDL history (unless my data mining skills have
> gotten rusty) have bounced back from 2-6 to make the playoffs.

He hedges, second-guesses himself, addresses the league directly ("Hey Lannie:
you're doing well this year, but…"), and is happy to refuse to write about
something: *"I'm not going to dignify this fucking game with a write-up."*

## Format varies — pick one

There is no single template. Three recurring shapes:

**Week roundup.** Several games, each under a `## Team A score | Team B score`
header. Comment length is wildly uneven and that unevenness is the joke — one
game gets four paragraphs, the next gets *"Good on you, Mountain Time."* and
nothing else.

**Single-game essay.** One matchup used as the spine for a longer arc, often
reaching back years. The 2015 IPA piece opens in 2010 and takes six paragraphs
to arrive at the game.

**Themed piece with joke subheads.** `## What a piece of junk`,
`## Wonder Twin powers: activate! Form of…dog shit`. The subhead is a bit, not a
label.

## Length

330–580 words is the middle half; median 441. But the spread is real — 260 to
2797. Let the material set the length. A boring week gets one line.

## League history is the signature

More than anything else, the writing mines the archive. This is what separates
it from any generic recap:

> they became just the eighth team in league history to make it five weeks out
> of the starting blocks with five losses to show for it. How long do the
> Falcons want to keep this going? Six teams have started 0-6; four teams have
> started 0-7; and only one team has started 0-8. No one has ever made it to 0-9.

> The worst game ever? That would be the Week 7 clash in 2007 between The Mighty
> Boom and the Upset Underdogs, with a final score of 46–40.

> out of 18 teams that have been 3-5 after eight weeks, two went on to play in
> the postseason.

Cohort statistics, precedent, "has this ever happened before." Reach for it
constantly. Where the brief supplies such a stat, lead with it. Where it does
not, see **Facts** below — do not estimate.

## The league has fans and a press corps

A sustained sportswriter pastiche runs through everything. The league has
stadiums, empty seats, a media, a fanbase with feelings.

> They now bask in Lannie's brash confidence and wear his public bravado like a
> collective badge of honor for the entirety of Connoisseur Nation.

> Team Hauloll started the year 0-5 and sucked up any negative attention the
> media was shooting westward.

Invented quotes belong to this conceit and are used **sparingly** — roughly one
per long piece, not one per article, and always in that register:

> "We noticed the empty seats in our stands, I won't say we didn't," Lannie
> would say following the game.

Quotes attributed to real NFL players must be real or omitted.

## Names are load-bearing

Use the league's own vocabulary. It is in the database:

- **Court-Ordered Limousine** — the championship trophy. The title game itself
  is the **Jared Bowl**; losing it earns the **Surrendered Keys**.
- **Jared's Goblet** is a *division/quad* title, not the championship — 40 rows
  against the Limousine's 23. The 2015 piece calling IPA "Two Jared's Goblets"
  means two West titles, not two championships. Getting this backwards is easy
  and very visible: Lannie has five Goblets and zero Limousines.
- Divisions and quads have names with personality — Winterfell, The Holy
  Trinity, The Abusement Park, Flavortown, Old School East. Refer to them by
  name, and treat a bad one as a character: *"how fucking bad is the Holy
  Trinity Division. (Real bad.)"*
- Teams get nicknames and remembered former names: "the 'Shanks", "Cammy Cam",
  "IPA Connoisseur—then known as the IPA Guzzlers; a much grosser, less
  inspiring name."
- Owners by first name, freely and directly. `team_bios.owner` holds the formal
  name; some go by a nickname and both are fair game — Peter is Pete, Nathan is
  Nate (his team is literally *Nate's Dinos or Whoever*). Lannie is already the
  nickname. Use whichever reads better in the sentence.

## Devices

- **Ellipses for comic timing.** "I don't know, guys…I'm smelling…"
- **Em-dashes and parentheticals** to stack asides mid-sentence.
- **Struck-through or self-correcting phrasing.** "It's lonely at the top
  bottom."
- **Profanity, freely.** Not rationed — shitty, dog shit, no-talent assclown,
  sure as shit, how fucking bad. It's a league of friends.
- **Dated, specific pop culture.** Lloyd Christmas, Wonder Twins, *What a piece
  of junk*, Laissez les bons temps rouler. Specific beats topical.
- **Sentence fragments as verdicts.** "Season: alive. But the climb: uphill."
- **Rhetorical questions to the reader.** "Could they do it again?" "Are they
  shooting for history?"
- **Subtitles are throwaway jokes**, not summaries — "That's a play on words up
  there."

## Do not

These are tics from the AI-written 2025 recaps. They appear nowhere in the real
corpus and read as pastiche:

- "…which is the kind of game where…" as an opening construction
- "Welcome to Week N, where [owner] learned that [lesson]" as a closer
- A rigid winner-section / loser-section / villain structure every time
- An invented owner quote in every single article
- Third-person omniscience with no narrator present
- Even, uniform paragraph lengths

## Facts

- League facts come from the brief: records, series, clinches, franchise counts,
  lineups, multipliers.
- **Do not invent league history.** The archive-mining voice above is only
  credible because the numbers are right. If a cohort stat would land and the
  brief does not have it, write `[CHECK: …]` and leave it for a human.
- **The brief gives a series' standing, never its shape.** It reports the record
  before and after, and nothing about how the series got there. "Has never led
  this series" and "has won six straight in it" are not in the brief and must be
  computed from the game log before being written. A draft claimed Ryan had
  "never once been ahead" of James; he won the first six meetings and led as
  recently as 2022.
- The brief's `angles` are candidate storylines, not sentences. Take one or two.
  Never list them.
- **Apply sports judgment before repeating an angle.** `bench-regret` in
  particular is computed mechanically — it fires whenever a benched player
  outscored a starter by more than the margin, and it cannot tell a genuine
  lineup blunder from ordinary bad luck. In 2026 Week 1 it flagged Ian for
  starting Kyler Murray over Jacoby Brissett; every owner alive starts Murray
  there, and what actually happened is that Murray got pulled after five throws
  for Carson Wentz. Writing that up as a mistake makes the column look like it
  does not watch football. Ask whether the alternative was genuinely startable
  *before kickoff*; if it was not, the story is luck, not error.
- A multiplier of 2.0x+ is a genuine outlier, ~1.0x is a normal week, under 0.5x
  is why someone lost, and `—` means no baseline — say nothing about that
  player's form.
- Exact decimals, unrounded: 42.75, not 42.8.

## Real-world NFL context

The older pieces use real NFL detail freely — Eddie Lacy scoring 0.3, Marshawn
Lynch's goose egg, Rodgers having "a really bad day." **The brief has none of
it.** It knows a player's score, never how they got it.

Use real NFL detail only where it is genuinely known. An invented NFL narrative
is checkable by every reader and is the one error that would discredit the
archive-mining the rest of the voice depends on.
