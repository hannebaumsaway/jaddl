/**
 * "Did you know" — the things worth noticing about a franchise that the tables
 * and charts state but never quite say out loud.
 *
 * These are detectors, not written copy. Each one asks a question of the
 * dossier, returns nothing when the answer is unremarkable, and phrases itself
 * from live numbers when it fires. That matters because the alternative —
 * writing twelve paragraphs by hand — is wrong by the following Sunday: the
 * luck gap, the streaks and the ranks all move as weeks are imported.
 *
 * TWO RULES, both learned the hard way.
 *
 * 1. A detector must fire on something UNUSUAL, never on a slot that always
 *    exists. Every franchise has a worst opponent, a best season and a worst
 *    season; reporting the extreme of a list that is never empty produces the
 *    same sentence on twelve pages with the nouns swapped. The earlier version
 *    of this file did exactly that — `nemesis` fired for 9 of 17 franchises and
 *    `swing` for 8, which is how every team ended up with an "X owns them"
 *    card. A threshold must be measured against the team's own baseline or
 *    against a league-wide rarity figure, not against the existence of a row.
 *
 * 2. A detector must not restate another team's card. Head-to-head facts are
 *    symmetric: "Odouls own them, 2-12" on one page and "their favourite
 *    opponent is In Pursuit, 12-2" on another are one series printed twice.
 *    Where a fact has two sides, only the side it is more remarkable for fires
 *    (see `dominatedSide`).
 *
 * `facet` is what the observation is ABOUT. Selection takes at most one card
 * per facet before it takes a second of anything, so a page cannot lead with
 * two head-to-head splits or two streak facts. `weight` orders within that.
 */

import type { TeamDossier } from './dossier';
import type { SeasonLine } from './records';

/** What an observation is about. At most one of each is shown before repeats. */
export type Facet =
  | 'luck'
  | 'opponent'
  | 'streak'
  | 'honors'
  | 'postseason'
  | 'scoring'
  | 'season-shape'
  | 'game'
  | 'identity'
  | 'draft'
  | 'form';

export interface Observation {
  id: string;
  text: string;
  weight: number;
  facet: Facet;
}

const rec = (w: number, l: number, t = 0) => `${w}-${l}${t ? `-${t}` : ''}`;
const pct = (v: number) => v.toFixed(3).replace(/^0/, '');
const n1 = (v: number) => v.toFixed(1);
const ord = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const share = (v: number) => `${Math.round(v * 100)}%`;

/**
 * FNV-1a. Any stable string hash would do; this one is short and has no deps.
 */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Choose one phrasing, deterministically.
 *
 * NOT random. `/teams/[id]` is server-rendered on every request, so a random
 * pick would reword the card when someone refreshes — or mid-read, since the
 * card also rotates on a timer.
 *
 * The index is a SUM of three terms rather than a hash of them, and that is
 * the whole trick. Hashing a team-plus-numbers seed is a random draw into ten
 * bins, and random draws collide: measured across the eight varied detectors
 * it put 9 of 43 firings onto a phrasing another franchise was already using,
 * including two teams whose numbers were close enough that the duplicate read
 * like a copy-paste bug. Summing keeps the terms separable:
 *
 *  - `teamId` is unique, so it spreads franchises across the variants as a
 *    permutation rather than a draw — the same measurement gives 3 collisions
 *    instead of 9, and only between ids that differ by exactly the variant
 *    count.
 *  - `leagueShift` is identical for every active franchise in a render (every
 *    team has played the same number of weeks), so adding it rotates the whole
 *    assignment without disturbing the spread. This is the re-roll: the copy
 *    moves as the season is imported instead of being frozen for a year.
 *  - `hash(id)` offsets each detector, so a franchise does not sit on the same
 *    index down the whole card stack.
 *
 * Every variant in a set must be interchangeable — same claim, same figures,
 * different shape. A variant that adds a flourish the dossier cannot support
 * is a rule-3 violation that only surfaces for the teams it happens to land
 * on, which is the worst way to find one.
 */
const leagueShift = (d: TeamDossier): number => {
  const latest = d.seasons[d.seasons.length - 1];
  return latest ? hash(`${latest.year}:${latest.weeksPlayed}`) : 0;
};

const pick = (variants: string[], d: TeamDossier, id: string): string =>
  variants[(d.identity.teamId + leagueShift(d) + hash(id)) % variants.length];
const list = (xs: (string | number)[]) =>
  xs.length <= 1
    ? String(xs[0] ?? '')
    : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

/** Seasons that have actually finished. Nothing seasonal may read a live one. */
const done = (d: TeamDossier): SeasonLine[] => d.seasons.filter(s => !s.inProgress);

/**
 * The most recent COMPLETED season, which is what any "N seasons since" count
 * has to measure against. Measuring to `seasons[last]` counts a season that is
 * one week old as having come and gone.
 */
const lastSettled = (d: TeamDossier): number | null => {
  const s = done(d);
  return s.length > 0 ? s[s.length - 1].year : null;
};

/**
 * Whether this franchise is the side of a head-to-head split that the series is
 * worth mentioning on.
 *
 * A one-sided series is a fact about the loser. Printing it on both pages is
 * the single biggest source of duplication across the site, so the dominant
 * side stays quiet unless the domination is extreme enough to be a fact about
 * them too (`favourite`, which sets a much higher bar).
 */
const lopsidedness = (winPct: number, careerWinPct: number) => winPct - careerWinPct;

type Detector = (d: TeamDossier) => Observation | null;

const detectors: Detector[] = [
  /* ---------------------------------------------------------------- luck -- */

  /* The schedule giveth and taketh away. Anchored to a specific season so two
     franchises with similar gaps do not get the same sentence. */
  d => {
    const gap = d.luck.luckDelta;
    if (Math.abs(gap) < 4) return null;
    const unlucky = gap < 0;
    const seasons = d.luck.bySeason.filter(s => Math.sign(s.luckDelta) === Math.sign(gap));
    const worst = seasons.length
      ? seasons.reduce((a, s) => (Math.abs(s.luckDelta) > Math.abs(a.luckDelta) ? s : a))
      : null;
    const anchor =
      worst && Math.abs(worst.luckDelta) >= 2
        ? ` ${worst.year} was the worst of it: ${n1(worst.expectedWins)} wins earned, ${worst.actualWins} collected.`
        : '';
    const all = pct(d.luck.allPlay.winPct);
    const got = pct(d.career.winPct);
    const g = n1(Math.abs(gap));
    return {
      id: 'luck-gap',
      facet: 'luck',
      // Deliberately mid-table, not marquee. At 94-110 this outranked every
      // other detector and led 7 of 17 pages, which put a luck sentence first
      // even on franchises whose headline is a title or a record streak. It
      // still climbs with the size of the gap, so an extreme one competes.
      weight: Math.round(72 + Math.min(Math.abs(gap), 12)),
      text: unlucky
        ? pick([
            `They have scored like a ${all} team and finished ${got} — ${g} wins the schedule took off them.${anchor}`,
            `The scoring says ${all}. The standings say ${got}. Between the two sit ${g} wins that the draw decided rather than the roster.${anchor}`,
            `Played against the whole league each week they would be ${all}. The fixtures left them ${got}, ${g} wins light.${anchor}`,
            `${g} wins is what the schedule has cost them: ${all} scoring, ${got} record.${anchor}`,
            `Their record runs the wrong way from their scoring — ${all} against the field, ${got} against the teams they drew.${anchor}`,
            `Week to week they outscore ${share(d.luck.allPlay.winPct)} of the league. The record that came back is ${got}, ${g} wins short.${anchor}`,
            `There is a ${g}-win hole between what they have scored and what they have won: ${all} against the field, ${got} on the ledger.${anchor}`,
            `Put their scores against the whole league each week and they are a ${all} team. The schedule made them ${got}.${anchor}`,
            `${all} scoring, ${got} record. The ${g} wins in between went to whoever they happened to be drawn against.${anchor}`,
            `The ledger undersells them by ${g} wins. Against the field they score like ${all}; against their actual opponents they are ${got}.${anchor}`,
          ], d, 'luck-gap')
        : pick([
            `Their record flatters them. Played against the whole league each week they would be ${all}; the draw handed them ${g} wins more than the scoring earned.${anchor}`,
            `The standings are kinder than the scoring. ${all} against the field, ${got} in the book — ${g} wins of schedule.${anchor}`,
            `${g} wins of their record belong to the fixture list. Their scoring is a ${all} team's; the ledger reads ${got}.${anchor}`,
            `They have been drawn well. Scoring like ${all} and finishing ${got} is ${g} wins of daylight in their favour.${anchor}`,
            `Against the whole league each week they are a ${all} team. Against the teams actually in front of them, ${got} — ${g} wins to the good.${anchor}`,
            `The ledger says ${got}. The scoring says ${all}. The ${g}-win difference is who they played, not how they played.${anchor}`,
            `Take the schedule away and the record shrinks by ${g} wins: ${all}, not ${got}.${anchor}`,
            `${got} is a flattering number. Their scores beat ${share(d.luck.allPlay.winPct)} of the league week to week, which is ${g} wins fewer than they banked.${anchor}`,
            `Their scoring has been that of a ${all} team and they have ${got} to show for it — ${g} wins the draw gave them.${anchor}`,
            `More of that record is schedule than roster: ${g} wins separate their ${all} scoring from their ${got} finish.${anchor}`,
          ], d, 'luck-gap'),
    };
  },

  /* One season where the scoring and the standings came apart completely. */
  d => {
    if (d.luck.bySeason.length < 3) return null;
    const s = d.luck.bySeason.reduce((a, x) =>
      Math.abs(x.luckDelta) > Math.abs(a.luckDelta) ? x : a
    );
    if (Math.abs(s.luckDelta) < 3.2) return null;
    const line = done(d).find(x => x.year === s.year);
    if (!line) return null;
    const r = rec(line.wins, line.losses, line.ties);
    const sh = share(s.allPlay.winPct);
    const place = `${ord(line.finish ?? 0)} of ${line.teamsInLeague}`;
    const exp = n1(s.expectedWins);
    return {
      id: 'season-luck',
      facet: 'luck',
      weight: Math.round(81 + Math.min(Math.abs(s.luckDelta) * 2, 12)),
      text:
        s.luckDelta < 0
          ? pick([
              `${s.year} was daylight robbery: they outscored ${sh} of the league week to week and still finished ${r}, ${place}.`,
              `In ${s.year} their scoring was worth ${exp} wins. They got ${s.actualWins}, finished ${r}, and watched the bracket from home.`,
              `${s.year} is the season to be angry about. ${sh} of the league outscored week to week, ${r} to show for it.`,
              `They beat ${sh} of the league on any given week in ${s.year}. The table still put them ${place} at ${r}.`,
              `Nothing about ${s.year} adds up: ${exp} wins earned on the scoring, ${s.actualWins} actually collected, ${place} at the end of it.`,
              `${s.year} looks like a bad season and was not one. Their scores beat ${sh} of the league; their record came back ${r}.`,
              `The ${s.year} record reads ${r}. The scoring behind it was worth ${exp} wins.`,
              `Week after week in ${s.year} they outscored ${sh} of the league, and finished ${place} anyway at ${r}.`,
              `${s.year} cost them roughly ${n1(Math.abs(s.luckDelta))} wins they had scored for: ${exp} earned, ${s.actualWins} banked, ${r} on the page.`,
              `Their ${s.year} season was ${r}. Measured against the whole league each week instead of the one team drawn, it was worth ${exp} wins.`,
            ], d, 'season-luck')
          : pick([
              `${s.year} was a heist — a ${r} record built on scoring that beat only ${sh} of the league each week.`,
              `They went ${r} in ${s.year} while outscoring just ${sh} of the league. The schedule did the heavy lifting.`,
              `${s.year} is the one to be quiet about: ${r}, off scoring worth ${exp} wins.`,
              `A ${r} season in ${s.year}, and the scoring behind it beat only ${sh} of the league week to week.`,
              `${s.year} flattered them badly. ${exp} wins earned on scoring, ${s.actualWins} collected, ${place} at the finish.`,
              `The ${s.year} record says ${r}. The scoring says they beat ${sh} of the league.`,
              `In ${s.year} they banked ${s.actualWins} wins on scoring worth ${exp}. Nobody asks how, afterwards.`,
              `Their ${s.year} campaign finished ${r} and ${place}, on scores that beat ${sh} of the league.`,
              `${s.year} handed them roughly ${n1(s.luckDelta)} wins the scoring never earned — ${r}, off ${exp} wins' worth of points.`,
              `Scoring that beat ${sh} of the league returned a ${r} season in ${s.year}. The draw was very kind.`,
            ], d, 'season-luck'),
    };
  },

  /* Close games are a coin flip they keep losing. */
  d => {
    const c = d.luck.closeGames;
    const n = c.wins + c.losses;
    if (n < 25) return null;
    const share = c.wins / n;
    if (share > 0.4 && share < 0.6) return null;
    return {
      id: 'close-games',
      facet: 'luck',
      weight: 66,
      text: share <= 0.4
        ? `Tight games do not go their way. In the ${n} decided by ${c.margin} points or fewer they are ${rec(c.wins, c.losses, c.ties)}.`
        : `They win the ones that come down to the wire — ${rec(c.wins, c.losses, c.ties)} in games decided by ${c.margin} points or fewer.`,
    };
  },

  /* Beaten up, or doing the beating up. */
  d => {
    const b = d.luck.blowouts;
    const n = b.wins + b.losses;
    if (n < 14) return null;
    const share = b.wins / n;
    if (share > 0.33 && share < 0.67) return null;
    return {
      id: 'blowouts',
      facet: 'luck',
      weight: 63,
      text: share <= 0.33
        ? `When a game gets away it is usually theirs to lose: ${rec(b.wins, b.losses)} in the ${n} decided by more than ${b.margin}.`
        : `Their wins tend to be routs — ${rec(b.wins, b.losses)} in games decided by more than ${b.margin} points.`,
    };
  },

  /* ------------------------------------------------------------ opponent -- */

  /*
   * The team they cannot beat.
   *
   * Three guards, all needed. A long sample, because a 4-9 split is noise. A
   * gap against THEIR OWN career rate, because a .400 franchise losing a series
   * is not news — it is Tuesday. And a hard floor, so it only ever fires on the
   * dominated side and the same series cannot also appear as someone's
   * `favourite`.
   */
  d => {
    const worst = d.opponents.worst;
    if (!worst || worst.meetings < 14) return null;
    if (worst.winPct > 0.33) return null;
    const gap = lopsidedness(worst.winPct, d.career.winPct);
    if (gap > -0.16) return null;
    const series = rec(worst.wins, worst.losses, worst.ties);
    const mine = pct(d.career.winPct);
    return {
      id: 'nemesis',
      facet: 'opponent',
      weight: Math.round(74 + Math.min(Math.abs(gap) * 40, 14)),
      text: pick([
        `${worst.opponentName} have their number and have had it for ${plural(worst.meetings, 'meeting')}: ${series}, against a franchise that wins ${mine} of everything else.`,
        `Against the rest of the league they win ${mine}. Against ${worst.opponentName} they are ${series} across ${plural(worst.meetings, 'meeting')}.`,
        `${plural(worst.meetings, 'meeting')} with ${worst.opponentName}, ${worst.wins} of them won. Everyone else they beat at a ${mine} clip.`,
        `Something about ${worst.opponentName} undoes them: ${series} head to head, ${mine} against the rest of the league.`,
        `They are a ${mine} team until ${worst.opponentName} are on the other side of it, at which point they are ${series}.`,
        `${worst.opponentName} are the fixture they would erase — ${series} over ${plural(worst.meetings, 'meeting')}, against ${mine} everywhere else.`,
        `${plural(worst.meetings, 'time')} they have played ${worst.opponentName} and ${plural(worst.losses, 'time')} they have lost. Their record against everyone else is ${mine}.`,
        `The ${mine} franchise does not show up against ${worst.opponentName}: ${series}, across ${plural(worst.meetings, 'meeting')}.`,
        `${worst.opponentName} have beaten them ${worst.losses} times in ${plural(worst.meetings, 'meeting')}. Nobody else has managed anything like it — they win ${mine} of the rest.`,
        `A ${mine} record against the league, ${series} against ${worst.opponentName}. The gap is not close to being noise over ${plural(worst.meetings, 'meeting')}.`,
      ], d, 'nemesis'),
    };
  },

  /*
   * The one they always beat. A deliberately higher bar than `nemesis` — a
   * series has to be near-total before it says more about the winner than the
   * loser, and anything short of that is already being told on the other page.
   */
  d => {
    const best = d.opponents.best;
    if (!best || best.meetings < 14) return null;
    if (best.winPct < 0.72) return null;
    if (lopsidedness(best.winPct, d.career.winPct) < 0.2) return null;
    return {
      id: 'favourite',
      facet: 'opponent',
      weight: 72,
      text: `${plural(best.meetings, 'meeting')} with ${best.opponentName} and it has never really been a series: ${rec(best.wins, best.losses, best.ties)}.`,
    };
  },

  /* A rivalry decided by nothing. Named rivalries are one per franchise, so
     these are bespoke by construction. */
  d => {
    const r = d.rivalry;
    if (!r || r.meetings < 12) return null;
    if (Math.abs(r.record.wins - r.record.losses) > 1) return null;
    const series = rec(r.record.wins, r.record.losses, r.record.ties);
    const ahead = r.record.wins > r.record.losses;
    return {
      id: 'rivalry-knife-edge',
      facet: 'opponent',
      weight: 84,
      text: pick([
        `${r.rivalryName} could not be closer: ${series} against ${r.opponentName} across ${plural(r.meetings, 'meeting')}. One more result flips it.`,
        `${plural(r.meetings, 'meeting')} of ${r.rivalryName} and ${r.opponentName} have separated them by a single game: ${series}.`,
        `Nothing has been settled in ${r.rivalryName}. ${series} against ${r.opponentName} over ${plural(r.meetings, 'meeting')}, and the next one decides who is ${ahead ? 'still ' : ''}ahead.`,
        `${r.rivalryName} sits at ${series} after ${plural(r.meetings, 'meeting')} with ${r.opponentName} — the closest thing this league has to a stalemate.`,
        `${plural(r.meetings, 'edition')} of ${r.rivalryName}, and the series with ${r.opponentName} still reads ${series}.`,
        `They and ${r.opponentName} have played ${r.meetings} times in ${r.rivalryName} and are level to within a game: ${series}.`,
        `${series} in ${r.rivalryName}. ${plural(r.meetings, 'meeting')} with ${r.opponentName} have produced almost exactly nothing between them.`,
        `Whoever wins the next ${r.rivalryName} takes the series. It stands at ${series} against ${r.opponentName} after ${plural(r.meetings, 'meeting')}.`,
        `${r.opponentName} and ${r.rivalryName} have been the constant: ${plural(r.meetings, 'meeting')}, ${series}, no separation at all.`,
        `The whole history of ${r.rivalryName} comes to ${series} against ${r.opponentName} — one game either way across ${plural(r.meetings, 'meeting')}.`,
      ], d, 'rivalry-knife'),
    };
  },

  /* Who currently holds the rivalry trophy, and for how long. */
  d => {
    const r = d.rivalry;
    if (!r) return null;
    const split = d.opponents.splits.find(s => s.opponentId === r.opponentId);
    const streak = split?.currentStreak;
    if (!streak) return null;
    const kind = streak[0] as 'W' | 'L' | 'T';
    const runLength = Number(streak.slice(1));
    if (kind === 'T' || runLength < 4) return null;
    const holder = r.trophyName ? `${r.trophyName} has` : 'The trophy has';
    return {
      id: 'rivalry-run',
      facet: 'opponent',
      weight: 82,
      text: kind === 'W'
        ? `${holder} not moved in a while: ${runLength} straight over ${r.opponentName} in ${r.rivalryName}, the last in ${split!.lastMeeting?.year}.`
        : `${r.rivalryName} has gone one way lately — ${runLength} straight to ${r.opponentName}, most recently in ${split!.lastMeeting?.year}.`,
    };
  },

  /* A rivalry that is not much of one. */
  d => {
    const r = d.rivalry;
    if (!r || r.meetings < 12) return null;
    const winPct = (r.record.wins + r.record.ties * 0.5) / r.meetings;
    if (winPct > 0.3 && winPct < 0.7) return null;
    return {
      id: 'rivalry-lopsided',
      facet: 'opponent',
      weight: 76,
      text: winPct >= 0.7
        ? `${r.rivalryName} is billed as a rivalry. The record says otherwise: ${rec(r.record.wins, r.record.losses, r.record.ties)} their way over ${plural(r.meetings, 'meeting')} with ${r.opponentName}.`
        : `${plural(r.meetings, 'edition')} of ${r.rivalryName} and they have won ${r.record.wins} of them. ${r.opponentName} have made it a formality.`,
    };
  },

  /* -------------------------------------------------------------- streak -- */

  d => {
    const s = d.superlatives.longestLoseStreak;
    if (!s || s.occurrences !== 1 || s.longestEver?.teamId !== d.identity.teamId) return null;
    return {
      id: 'worst-streak-ever',
      facet: 'streak',
      weight: 95,
      text: `The ${s.length}-game slide in ${s.year} is not just their worst run — it is the longest losing streak any franchise has put together in league history.`,
    };
  },
  d => {
    const s = d.superlatives.longestWinStreak;
    if (!s || s.occurrences !== 1 || s.longestEver?.teamId !== d.identity.teamId) return null;
    return {
      id: 'best-streak-ever',
      facet: 'streak',
      weight: 95,
      text: `Nobody has ever strung together more than their ${s.length} straight wins in ${s.year}.`,
    };
  },

  /* Rare, and the rarity figure has to carry it. Twelve prior occurrences is
     not rare; six is. */
  d => {
    const s = d.superlatives.longestWinStreak;
    if (!s || s.length < 7 || s.occurrences > 6) return null;
    if (s.longestEver?.teamId === d.identity.teamId && s.occurrences === 1) return null;
    return {
      id: 'streak-rarity',
      facet: 'streak',
      weight: 70,
      text: `The ${s.length} straight they won in ${s.year} has been managed only ${plural(s.occurrences, 'other time', 'other times')} by anyone, in ${plural(d.identity.seasonsPlayed, 'season')} of this league.`,
    };
  },

  /* Both extremes in the same career. */
  d => {
    const w = d.superlatives.longestWinStreak, l = d.superlatives.longestLoseStreak;
    if (!w || !l || w.length < 6 || l.length < 6) return null;
    if (Math.abs(w.year - l.year) > 4) return null;
    const window = plural(Math.abs(w.year - l.year) + 1, 'season');
    return {
      id: 'streak-whiplash',
      facet: 'streak',
      weight: 77,
      text: pick([
        `They have run off ${w.length} in a row and lost ${l.length} in a row inside the same ${window} — ${w.length} straight in ${w.year}, ${l.length} straight in ${l.year}.`,
        `${w.length} straight wins in ${w.year}. ${l.length} straight losses in ${l.year}. Same franchise, ${window} apart.`,
        `Inside ${window} they were unbeatable and unwatchable: ${w.length} in a row won in ${w.year}, ${l.length} in a row lost in ${l.year}.`,
        `Their longest winning run (${w.length}, ${w.year}) and their longest losing run (${l.length}, ${l.year}) sit ${window} from each other.`,
        `${w.year} produced ${w.length} consecutive wins. ${l.year} produced ${l.length} consecutive losses. Nothing much changed in between.`,
        `A ${w.length}-game winning streak and a ${l.length}-game losing streak, both inside ${window} — ${w.year} and ${l.year}.`,
        `They can do either at length: ${w.length} straight in ${w.year}, ${l.length} straight the other way in ${l.year}.`,
        `${window} contains both their best run (${w.length} wins, ${w.year}) and their worst (${l.length} losses, ${l.year}).`,
        `Won ${w.length} on the bounce in ${w.year}, lost ${l.length} on the bounce in ${l.year}. Whatever the franchise does, it does in blocks.`,
        `The ${w.length}-game run in ${w.year} and the ${l.length}-game slide in ${l.year} are ${window} apart.`,
      ], d, 'whiplash'),
    };
  },

  /* -------------------------------------------------------------- honors -- */

  d => {
    const titles = d.honors.championships.length;
    if (titles < 2 || d.career.winPct >= 0.49) return null;
    if (d.ranks.winPct.rank <= d.ranks.winPct.of / 2) return null;
    return {
      id: 'titles-losing-record',
      facet: 'honors',
      weight: 88,
      text: `${plural(titles, 'championship')}, and a losing record to go with them. They are ${rec(d.career.wins, d.career.losses, d.career.ties)} all time, ${ord(d.ranks.winPct.rank)} of ${d.ranks.winPct.of} on win percentage.`,
    };
  },

  /* A title won from a season nobody would have picked. */
  d => {
    const wins = done(d).filter(s => s.playoffResult?.outcome === 'won-title');
    const modest = wins.filter(s => s.winPct <= 0.6).sort((a, b) => a.winPct - b.winPct)[0];
    if (!modest) return null;
    return {
      id: 'title-from-nowhere',
      facet: 'honors',
      weight: 87,
      text: `Their ${modest.year} title came out of a ${rec(modest.wins, modest.losses, modest.ties)} regular season — ${ord(modest.finish ?? 0)} of ${modest.teamsInLeague} going into the bracket.`,
    };
  },

  d => {
    const years = [...d.honors.championships].sort((a, b) => a - b);
    if (years.length < 2) return null;
    for (let i = 0; i + 1 < years.length; i++) {
      const span = years[i + 1] - years[i];
      if (span <= 2) {
        return {
          id: 'title-cluster',
          facet: 'honors',
          weight: 86,
          text: span === 1
            ? `They went back to back in ${years[i]} and ${years[i + 1]} — the hardest thing to do in this league.`
            : `Two titles in three years, ${years[i]} and ${years[i + 1]}.`,
        };
      }
    }
    return null;
  },

  d => {
    const latest = d.seasons[d.seasons.length - 1]?.year;
    if (!latest || d.honors.championships.length === 0) return null;
    const last = Math.max(...d.honors.championships);
    if (latest - last > 1) return null;
    return {
      id: 'reigning',
      facet: 'honors',
      weight: 92,
      text: latest === last
        ? `They are the reigning champions, and the ${ord(d.honors.championships.length)} title in franchise history came with it.`
        : `They won it in ${last} — the most recent name on the trophy before this season.`,
    };
  },

  d => {
    const latest = d.seasons[d.seasons.length - 1]?.year;
    if (!latest) return null;
    if (d.honors.championships.length === 0) {
      if (d.identity.seasonsPlayed < 8) return null;
      return {
        id: 'no-title',
        facet: 'honors',
        weight: 79,
        text: `${plural(d.identity.seasonsPlayed, 'season')} in, and the trophy case is still missing the one that matters${d.honors.groupTitles.length ? ` — though ${plural(d.honors.groupTitles.length, 'division title')} says they keep getting close` : ''}.`,
      };
    }
    const settled = lastSettled(d);
    if (settled === null) return null;
    const last = Math.max(...d.honors.championships);
    const drought = settled - last;
    if (drought < 8) return null;
    return {
      id: 'drought',
      facet: 'honors',
      weight: 70,
      text: `The last title was ${last}. ${plural(drought, 'season')} have gone by since, and ${plural(d.honors.playoffAppearances.filter(y => y > last).length, 'playoff berth')} with it.`,
    };
  },

  d => {
    const n = d.honors.groupTitles.length;
    if (n < 5) return null;
    const years = d.honors.groupTitles.map(t => t.year);
    const groups = [...new Set(d.honors.groupTitles.map(t => t.groupName))];
    return {
      id: 'group-haul',
      facet: 'honors',
      weight: 80,
      text: groups.length >= 3
        ? `${plural(n, 'division title')}, and they have won one in ${plural(groups.length, 'different group')} — ${list(groups)} — as the league kept redrawing the map.`
        : `${plural(n, 'division title')} across ${plural(d.identity.seasonsPlayed, 'season')}, most recently ${Math.max(...years)}.`,
    };
  },

  /* Scored the most, watched the playoffs. */
  d => {
    const wasted = d.honors.pointsTitles.filter(y => !d.honors.playoffAppearances.includes(y));
    if (wasted.length === 0) return null;
    return {
      id: 'points-title-no-playoffs',
      facet: 'honors',
      weight: 85,
      text: `In ${list(wasted)} they outscored every team in the league and still missed the playoffs${wasted.length > 1 ? ' — and did it more than once' : ''}.`,
    };
  },

  /* Multiple scoring crowns is its own kind of résumé. */
  d => {
    const t = d.honors.pointsTitles;
    if (t.length < 3) return null;
    return {
      id: 'points-titles',
      facet: 'honors',
      weight: 78,
      text: `They have led the league in scoring ${plural(t.length, 'time')} — ${list(t)} — more often than most franchises manage a division.`,
    };
  },

  /* ---------------------------------------------------------- postseason -- */

  /*
   * Finals record, from `honors.finals` rather than `career.playoff.byRound`.
   *
   * The game log begins in 2007, so the round tally had Fightin' Longshanks at
   * 3-0 in finals while their trophy case holds four titles — 2005 predates
   * every recorded game. `honors.finals` unions the trophy case with the game
   * log and gets 4-0.
   *
   * The coverage is one-sided, though: no Surrendered Keys row exists before
   * 2007, so a pre-2007 final records a winner and no loser. "Every trip has
   * ended with the trophy" is therefore only sayable for a franchise that did
   * not exist in the unrecorded window — hence `lossesComplete`.
   */
  d => {
    const f = d.honors.finals;
    if (f.wins.length < 2 || f.losses.length > 0) return null;
    return {
      id: 'finals-unbeaten',
      facet: 'postseason',
      weight: 84,
      text: f.lossesComplete
        ? `Getting there is the hard part. They are ${f.wins.length}-0 once they reach the final — every trip has ended with the trophy.`
        : `They are ${f.wins.length}-0 in title games, as far as the trophy case goes: ${list(f.wins)}, and the league kept no record of a runner-up before ${f.lossesKnownFrom}.`,
    };
  },
  d => {
    const f = d.honors.finals;
    if (f.losses.length < 2 || f.wins.length > 0) return null;
    return {
      id: 'finals-winless',
      facet: 'postseason',
      weight: 84,
      text: `${plural(f.losses.length, 'trip')} to the final, ${plural(f.losses.length, 'loss', 'losses')} — ${list(f.losses)}. The last step is the one they have never taken.`,
    };
  },

  /* A finals record with results in both columns. */
  d => {
    const f = d.honors.finals;
    if (f.wins.length === 0 || f.losses.length === 0) return null;
    if (f.wins.length + f.losses.length < 4) return null;
    const trips = f.wins.length + f.losses.length;
    const W = f.wins.length, L = f.losses.length;
    return {
      id: 'finals-record',
      facet: 'postseason',
      weight: 82,
      text: pick([
        `${plural(trips, 'trip')} to the final and they have won ${W}: titles in ${list(f.wins)}, runner-up in ${list(f.losses)}.`,
        `${W}-${L} in title games. They won ${list(f.wins)} and lost ${list(f.losses)}.`,
        `They have reached ${plural(trips, 'final')} and taken ${W} of them — champions in ${list(f.wins)}, beaten in ${list(f.losses)}.`,
        `The final is familiar ground: ${plural(trips, 'appearance')}, ${W}-${L}. ${list(f.wins)} went their way, ${list(f.losses)} did not.`,
        `${plural(W, 'title')} from ${plural(trips, 'trip')} to the last game. The ones that got away were ${list(f.losses)}.`,
        `Getting to the final is the part they have solved — ${trips} times. Winning it is ${W}-${L}: ${list(f.wins)} yes, ${list(f.losses)} no.`,
        `Their title-game ledger runs ${W}-${L}, spread across ${list([...f.wins, ...f.losses].sort((a, b) => a - b))}.`,
        `${plural(trips, 'final')}, ${plural(W, 'trophy')}. Champions in ${list(f.wins)}; runners-up in ${list(f.losses)}.`,
        `They have been the last team standing ${plural(W, 'time')} and the second-last ${plural(L, 'time')} — ${trips} trips to the final in all.`,
        `A ${W}-${L} record in finals. ${list(f.wins)} are the good years; ${list(f.losses)} are the other kind.`,
      ], d, 'finals-record'),
    };
  },

  /* Turn up, go home. */
  d => {
    const berths = d.honors.playoffAppearances.length;
    if (berths < 4 || d.career.playoff.wins > 0) return null;
    return {
      id: 'one-and-done',
      facet: 'postseason',
      weight: 86,
      text: `${plural(berths, 'trip')} to the postseason and not one win to show for it — ${rec(d.career.playoff.wins, d.career.playoff.losses)} all time once the bracket starts.`,
    };
  },

  /* A wall at one specific round. */
  d => {
    const rounds = d.career.playoff.byRound.filter(r => !/champ/i.test(r.label));
    const wall = rounds.find(r => r.losses >= 4 && r.wins <= 1);
    if (!wall) return null;
    const round = wall.label.toLowerCase();
    const there = rec(wall.wins, wall.losses);
    const reg = pct(d.career.winPct);
    return {
      id: 'round-wall',
      facet: 'postseason',
      weight: 75,
      text: pick([
        `The ${round} is where their season tends to end: ${there} there, against ${reg} in the regular season.`,
        `They are ${reg} over a regular season and ${there} in the ${round}. Something goes missing.`,
        `${plural(wall.losses, 'exit')} at the ${round}. Their record there is ${there}, from a franchise that wins ${reg} of everything else.`,
        `The ${round} has ended more of their seasons than anything else — ${there}, against ${reg} in the regular season.`,
        `Getting to the ${round} is routine. Getting past it is ${there}.`,
        `Their postseasons keep stopping in the same place: ${there} in the ${round}.`,
        `A ${reg} regular-season franchise that goes ${there} once it reaches the ${round}.`,
        `${there} in the ${round}. For a team that wins ${reg} across a regular season, that is a wall rather than a run of luck.`,
        `The ${round} is the room they cannot get out of: ${there} all time.`,
        `They win ${reg} of their regular-season games and ${there} of their ${round}.`,
      ], d, 'round-wall'),
    };
  },

  d => {
    const seasons = d.identity.seasonsPlayed;
    if (seasons < 8) return null;
    const rate = d.honors.playoffAppearances.length / seasons;
    if (rate < 0.6 && rate > 0.25) return null;
    return {
      id: 'playoff-rate',
      facet: 'postseason',
      weight: 75,
      text: rate >= 0.6
        ? `They are a fixture in the postseason: ${d.honors.playoffAppearances.length} berths in ${plural(seasons, 'season')}.`
        : `The postseason has mostly happened without them — ${d.honors.playoffAppearances.length} berths in ${plural(seasons, 'season')}.`,
    };
  },

  /* How long since they were last in it. */
  d => {
    const settled = lastSettled(d);
    const berths = d.honors.playoffAppearances;
    if (settled === null || berths.length === 0) return null;
    const gap = settled - Math.max(...berths);
    if (gap < 5) return null;
    return {
      id: 'playoff-drought',
      facet: 'postseason',
      weight: 80,
      text: `The last time they played a postseason game was ${Math.max(...berths)}. ${plural(gap, 'season')} have come and gone since.`,
    };
  },

  /* ------------------------------------------------------------- scoring -- */

  d => {
    const raw = d.ranks.pointsPerGame.rank;
    const adj = d.ranks.scoringIndex.rank.rank;
    if (Math.abs(raw - adj) < 4) return null;
    const inflated = adj > raw;
    return {
      id: 'era-correction',
      facet: 'scoring',
      weight: 78 + Math.abs(raw - adj),
      text: inflated
        ? `Careful with the scoring average. They rank ${ord(raw)} in league history on raw points per game, but they played in a higher-scoring era — measured against the league they actually faced, they are only ${ord(adj)}.`
        : `Their scoring average undersells them badly. It ranks ${ord(raw)} all-time, but they played when the whole league scored less; against their own era they are ${ord(adj)}.`,
    };
  },

  d => {
    const r = d.ranks.concededIndex.rank;
    if (r.rank > 2) return null;
    return {
      id: 'conceded',
      facet: 'scoring',
      weight: 68,
      text: `No franchise has been shot at harder. Opponents score ${n1(d.ranks.concededIndex.index)} against them for every 100 the league averages — ${r.rank === 1 ? 'the most' : 'the second most'} in league history.`,
    };
  },

  d => {
    const scored = done(d).filter(s => s.scoringIndex !== null);
    if (scored.length < 6) return null;
    const peak = scored.reduce((a, s) => (s.scoringIndex! > a.scoringIndex! ? s : a));
    if (peak.madePlayoffs || peak.scoringIndex! < 108) return null;
    return {
      id: 'peak-wasted',
      facet: 'scoring',
      weight: 72,
      text: `Their best scoring season relative to the league was ${peak.year}, when they put up ${n1(peak.scoringIndex!)} against a par of 100 — and finished ${peak.finish} of ${peak.teamsInLeague} without a playoff berth.`,
    };
  },

  /* Feast and famine, measured against the league each year. */
  d => {
    const scored = done(d).filter(s => s.scoringIndex !== null);
    if (scored.length < 8) return null;
    const hi = scored.reduce((a, s) => (s.scoringIndex! > a.scoringIndex! ? s : a));
    const lo = scored.reduce((a, s) => (s.scoringIndex! < a.scoringIndex! ? s : a));
    if (hi.scoringIndex! - lo.scoringIndex! < 34) return null;
    return {
      id: 'scoring-range',
      facet: 'scoring',
      weight: 69,
      text: `No franchise swings further year to year: ${n1(hi.scoringIndex!)} against league par in ${hi.year}, ${n1(lo.scoringIndex!)} in ${lo.year}.`,
    };
  },

  /* --------------------------------------------------------- season shape -- */

  /*
   * Boom and bust back to back.
   *
   * The distinct-year guard is load-bearing: a franchise with one season is its
   * own best and worst, and the earlier version printed "0 years separates
   * their best season from their worst: 4-8-1 in 2007, 4-8-1 in 2007" on four
   * different pages.
   */
  d => {
    const b = d.superlatives.bestSeasonByRecord, w = d.superlatives.worstSeasonByRecord;
    if (!b || !w || b.year === w.year) return null;
    if (d.identity.seasonsPlayed < 4) return null;
    const gap = Math.abs(b.year - w.year);
    if (gap > 3) return null;
    if (b.winPct - w.winPct < 0.38) return null;
    return {
      id: 'swing',
      facet: 'season-shape',
      weight: 76,
      text: `${gap === 1 ? 'One year' : `${gap} years`} separates their best season from their worst: ${rec(b.wins, b.losses, b.ties)} in ${b.year}, ${rec(w.wins, w.losses, w.ties)} in ${w.year}.`,
    };
  },

  /* Never good, never bad. The opposite fact, and rarer. */
  d => {
    const s = done(d).filter(x => x.finish !== null);
    if (s.length < 9) return null;
    const finishes = s.map(x => x.finish!);
    const hi = Math.min(...finishes), lo = Math.max(...finishes);
    if (lo - hi > 5 || hi === 1) return null;
    return {
      id: 'metronome',
      facet: 'season-shape',
      weight: 79,
      text: `In ${plural(s.length, 'season')} they have never finished higher than ${ord(hi)} or lower than ${ord(lo)}. No collapse, no breakthrough.`,
    };
  },

  /*
   * Top of the table and bottom of it.
   *
   * Touching either end once over nineteen seasons is unremarkable — it fired
   * for 9 of 17 that way. What is remarkable is doing both repeatedly, or
   * doing both within a few years, which is a statement about volatility
   * rather than about longevity.
   */
  d => {
    const s = done(d).filter(x => x.finish !== null);
    if (s.length < 6) return null;
    const first = s.filter(x => x.finish === 1);
    const last = s.filter(x => x.finish === x.teamsInLeague);
    if (first.length === 0 || last.length === 0) return null;
    // The tightest first-to-last pair, kept as the pair: naming the gap and
    // then listing every year either end produces "in consecutive seasons ...
    // 2015, 2019 and 2025 against 2016", which describes neither.
    const pairs = first.flatMap(f => last.map(l => ({ f, l, gap: Math.abs(f.year - l.year) })));
    const tightest = pairs.reduce((a, x) => (x.gap < a.gap ? x : a));
    const repeat = first.length + last.length >= 4;
    if (!repeat && tightest.gap > 4) return null;
    const fr = rec(tightest.f.wins, tightest.f.losses, tightest.f.ties);
    const lr = rec(tightest.l.wins, tightest.l.losses, tightest.l.ties);
    const span = tightest.gap === 1 ? 'back-to-back seasons' : `${tightest.gap} years`;
    const tops = list(first.map(x => x.year));
    const bottoms = list(last.map(x => x.year));
    return {
      id: 'both-ends',
      facet: 'season-shape',
      weight: repeat ? 81 : 78,
      text: tightest.gap <= 2
        ? pick([
            `${tightest.gap === 1 ? 'In back-to-back seasons' : `Inside ${tightest.gap} years`} they finished top of the league and dead last: ${fr} in ${tightest.f.year}, ${lr} in ${tightest.l.year}.`,
            `${fr} in ${tightest.f.year}, ${lr} in ${tightest.l.year}. First to last inside ${span}.`,
            `Best in the league one year, worst the next but one — ${tightest.f.year} at ${fr}, ${tightest.l.year} at ${lr}.`,
            `The drop took ${span}: ${tightest.f.year} finished first at ${fr}, ${tightest.l.year} finished last at ${lr}.`,
            `Top of the table in ${tightest.f.year} at ${fr}. Bottom of it in ${tightest.l.year} at ${lr}. Nothing in between.`,
            `${span} separate the best season this franchise has had (${fr}, ${tightest.f.year}) from the worst (${lr}, ${tightest.l.year}).`,
            `They went from ${fr} and first in ${tightest.f.year} to ${lr} and last in ${tightest.l.year}.`,
            `First in ${tightest.f.year}, last in ${tightest.l.year}, ${span} apart — ${fr} then ${lr}.`,
            `Whatever ${tightest.f.year} was, it did not keep: ${fr} and top of the league, then ${lr} and bottom of it by ${tightest.l.year}.`,
            `${tightest.f.year}: ${fr}, first. ${tightest.l.year}: ${lr}, last. ${span.charAt(0).toUpperCase()}${span.slice(1)} between them.`,
          ], d, 'both-ends')
        : pick([
            `They have finished top of the league (${tops}) and dead last (${bottoms}). Very little in between has stuck.`,
            `Both ends of the table are familiar: first in ${tops}, last in ${bottoms}.`,
            `This franchise does extremes. First place in ${tops}, last place in ${bottoms}.`,
            `${tops} they finished first. ${bottoms} they finished last. There is not much of a middle to their history.`,
            `They own outright firsts (${tops}) and outright lasts (${bottoms}) — rarely anything in between.`,
            `Top of the league in ${tops}, bottom of it in ${bottoms}. The seasons tend to pick a side.`,
            `A franchise of peaks and holes: first in ${tops}, last in ${bottoms}.`,
            `Their finishes cluster at the edges — first in ${tops}, last in ${bottoms}.`,
            `They have won the whole table (${tops}) and propped it up (${bottoms}), with little settled ground between.`,
            `First in ${tops}. Last in ${bottoms}. Consistency has never been the thing about them.`,
          ], d, 'both-ends'),
    };
  },

  /* Good enough, left out. */
  d => {
    const missed = done(d).filter(s => s.winPct > 0.5 && !s.madePlayoffs);
    if (missed.length < 2) return null;
    return {
      id: 'winning-and-out',
      facet: 'season-shape',
      weight: 77,
      text: `${plural(missed.length, 'time')} they have finished a season above .500 and still missed the bracket — ${list(missed.map(s => `${s.year} at ${rec(s.wins, s.losses, s.ties)}`))}.`,
    };
  },

  /* Second in the group, over and over. */
  d => {
    const s = done(d).filter(x => x.groupFinish !== null);
    const seconds = s.filter(x => x.groupFinish === 2);
    if (seconds.length < 4 || seconds.length <= d.honors.groupTitles.length) return null;
    return {
      id: 'group-bridesmaid',
      facet: 'season-shape',
      weight: 74,
      text: `${plural(seconds.length, 'season')} finishing second in their group, against ${plural(d.honors.groupTitles.length, 'season')} winning it. Someone is always a game ahead of them.`,
    };
  },

  /* ---------------------------------------------------------------- game -- */

  /* The most they ever scored, and it was not enough. */
  d => {
    const hi = d.superlatives.highestScore;
    if (!hi || hi.result !== 'L') return null;
    return {
      id: 'high-score-loss',
      facet: 'game',
      weight: 83,
      text: `The most points they have ever scored — ${n1(hi.teamScore)}, ${hi.label.toLowerCase()} of ${hi.year} — was a loss. ${hi.opponentName} answered with ${n1(hi.opponentScore)}.`,
    };
  },

  /* The least they ever scored, and it nearly held up. */
  d => {
    const lo = d.superlatives.lowestScore;
    if (!lo || Math.abs(lo.margin) > 6 || lo.result !== 'L') return null;
    return {
      id: 'low-and-lost',
      facet: 'game',
      weight: 70,
      text: `Their lowest score ever, ${n1(lo.teamScore)} in ${lo.year}, was also nearly a win: ${lo.opponentName} managed just ${n1(lo.opponentScore)} and took it by ${n1(Math.abs(lo.margin))}.`,
    };
  },

  /*
   * A demolition.
   *
   * Two traps here, both hit on the first attempt. A fixed points threshold is
   * really a filter on era, since league scoring has nearly doubled since 2007
   * — at 85 points this fired for 12 of 17 franchises. And the ratio
   * distribution turned out to be smooth from 1.6x to 3.0x with no natural
   * cut, because the single most extreme game of a long career is always
   * extreme: this is the "slot that always exists" antipattern in rule 1.
   *
   * So it fires only from the WINNING side, which is also what keeps one game
   * from being reported on two pages — 2011's 156-59.8 was showing up as both
   * Riley County's biggest win and Red Hornets' worst loss.
   */
  d => {
    const w = d.superlatives.biggestWin;
    if (!w || w.result !== 'W' || w.opponentScore <= 0) return null;
    if (w.teamScore / w.opponentScore < 2.4) return null;
    return {
      id: 'massacre',
      facet: 'game',
      weight: 73,
      text: `They once put ${n1(w.teamScore)} on ${w.opponentName} and held them to ${n1(w.opponentScore)} — ${w.label.toLowerCase()} of ${w.year}, and still the widest gap they have opened on anyone.`,
    };
  },

  /* Ties. One is not rare — 7 of 17 franchises have one — but a collection is. */
  d => {
    if (d.career.ties < 2) return null;
    return {
      id: 'tie',
      facet: 'game',
      weight: 67,
      text: `They have played ${plural(d.career.ties, 'tie')}, more than any season has a right to produce: two rosters landing on the same number to the decimal.`,
    };
  },

  /* ------------------------------------------------------------ identity -- */

  d => {
    const names = d.identity.formerNames;
    if (names.length < 2) return null;
    return {
      id: 'former-names',
      facet: 'identity',
      weight: 65,
      text: `The name has changed more than most — ${names.join(', ')}, and now ${d.identity.currentName}.`,
    };
  },

  /*
   * Older than the record books.
   *
   * Nearly every original franchise dates to 2004, so the bare fact is common
   * and reads identically everywhere. It only earns a card when something
   * actually HAPPENED in that gap — a title the game log cannot account for,
   * which exists solely in the trophy case.
   */
  d => {
    const logged = d.identity.firstSeasonWithGames;
    if (!logged) return null;
    const early = d.honors.championships.filter(y => y < logged);
    if (early.length === 0) return null;
    return {
      id: 'title-before-records',
      facet: 'identity',
      weight: 82,
      text: early.length === 1
        ? `Their ${early[0]} title has no game behind it. The league did not start logging results until ${logged}, so it exists only in the trophy case.`
        : `${plural(early.length, 'title')} — ${list(early)} — sit in their trophy case with no games behind them. The league did not start logging results until ${logged}.`,
    };
  },

  /*
   * A franchise that came and went.
   *
   * The defunct one-and-two-season teams have no career arc to report, so
   * every rate-based detector correctly declines and the card renders empty.
   * Their whole existence is the fact worth stating.
   */
  d => {
    const s = done(d);
    if (s.length === 0 || s.length > 2 || !d.identity.isDefunct) return null;
    const total = s.reduce(
      (a, x) => ({ w: a.w + x.wins, l: a.l + x.losses, t: a.t + x.ties }),
      { w: 0, l: 0, t: 0 }
    );
    const first = s[0];
    return {
      id: 'brief-history',
      facet: 'identity',
      weight: 86,
      text: s.length === 1
        ? `The whole franchise is one season. They went ${rec(total.w, total.l, total.t)} in ${first.year}, finished ${ord(first.finish ?? 0)} of ${first.teamsInLeague}, and never came back.`
        : `They existed for ${plural(s.length, 'season')}, ${first.year} and ${s[1].year}, went ${rec(total.w, total.l, total.t)} across both, and folded.`,
    };
  },

  /* How they introduced themselves. */
  d => {
    const s = done(d);
    if (s.length < 3) return null;
    const debut = s[0];
    if (debut.finish === null) return null;
    const won = debut.finish <= 2;
    const lost = debut.finish >= debut.teamsInLeague - 1;
    if (!won && !lost) return null;
    return {
      id: 'debut',
      facet: 'season-shape',
      weight: 68,
      text: won
        ? `They arrived fully formed: ${rec(debut.wins, debut.losses, debut.ties)} in their first season, ${ord(debut.finish)} of ${debut.teamsInLeague} in ${debut.year}.`
        : `Their first season was a beating — ${rec(debut.wins, debut.losses, debut.ties)}, ${ord(debut.finish)} of ${debut.teamsInLeague} in ${debut.year}.`,
    };
  },

  /* --------------------------------------------------------------- draft -- */

  d => {
    const dr = d.draft;
    if (!dr) return null;
    const firsts = dr.picks.filter(p => p.pick === 1);
    // Count the drafts that exist, never a span across them: `drafts` has a
    // 2021-2025 hole, so "the 2007-2026 drafts" claims five that do not.
    const recorded = `the ${dr.years.length} drafts the league has order for`;
    if (firsts.length >= 2) {
      return {
        id: 'draft-first',
        facet: 'draft',
        weight: 64,
        text: `They have held the first pick ${plural(firsts.length, 'time')} — ${list(firsts.map(p => p.year))} — out of ${recorded}, which is not the honour it sounds like.`,
      };
    }
    if (dr.picks.length >= 6 && dr.earliest && dr.earliest.pick >= 5) {
      return {
        id: 'draft-late',
        facet: 'draft',
        weight: 60,
        text: `In ${recorded} they have never once picked higher than ${ord(dr.earliest.pick)}, averaging ${dr.averagePick}.`,
      };
    }
    return null;
  },

  /* ---------------------------------------------------------------- form -- */

  d => {
    // "Right now" is meaningless for a franchise that folded in 2007 —
    // `recentForm` is simply its last ten games ever.
    if (d.identity.isDefunct) return null;
    const games = d.recentForm.filter(g => g.countsTowardRecord);
    if (games.length < 8) return null;
    const w = games.filter(g => g.result === 'W').length;
    const l = games.filter(g => g.result === 'L').length;
    if (w >= games.length - 2) {
      return {
        id: 'form-hot',
        facet: 'form',
        weight: 71,
        text: `Right now they are as good as they have looked in a while: ${rec(w, l)} over their last ${games.length} regular-season games.`,
      };
    }
    if (l >= games.length - 2) {
      return {
        id: 'form-cold',
        facet: 'form',
        weight: 71,
        text: `The recent picture is bleak — ${rec(w, l)} across their last ${games.length} regular-season games.`,
      };
    }
    return null;
  },

  /* Where the stars come from. */
  d => {
    if (d.prestige.stars < 4 || d.prestige.drivers.length === 0) return null;
    const top = d.prestige.drivers[0];
    return {
      id: 'prestige',
      facet: 'honors',
      weight: 77,
      text: `Rated a ${d.prestige.stars.toFixed(1)}-star franchise — ${d.prestige.label.toLowerCase()} — and one season carries more of that number than any other: ${top.year}, ${top.note}.`,
    };
  },

  /* Top of the all-time table. */
  d => {
    const r = d.ranks.winPct;
    if (r.rank > 2 || d.identity.seasonsPlayed < 8) return null;
    return {
      id: 'winpct-elite',
      facet: 'season-shape',
      weight: 83,
      text: `${r.rank === 1 ? 'No franchise has won at a higher rate' : 'Only one franchise has won at a higher rate'}: ${rec(d.career.wins, d.career.losses, d.career.ties)}, ${pct(d.career.winPct)}, across ${plural(d.identity.seasonsPlayed, 'season')}.`,
    };
  },

  /* Weekly high scores as a rate. */
  d => {
    const n = d.honors.weeklyHighScores;
    const seasons = d.identity.seasonsPlayed;
    if (!n || seasons < 5) return null;
    const perSeason = n / seasons;
    if (perSeason < 1.4 && perSeason > 0.6) return null;
    const best = [...d.honors.weeklyHighScoresByYear].sort((a, b) => b.count - a.count)[0];
    return {
      id: 'weekly-highs',
      facet: 'scoring',
      weight: 64,
      text: perSeason >= 1.4
        ? `They top the weekly scoreboard constantly — ${plural(n, 'time')} in ${plural(seasons, 'season')}${best && best.count >= 3 ? `, including ${best.count} weeks of ${best.year} alone` : ''}.`
        : `For all the seasons played, they have led a week outright only ${plural(n, 'time')} — roughly once every ${Math.round((seasons / Math.max(n, 1)) * 10) / 10} years.`,
    };
  },
];

/**
 * The most interesting things about this franchise, strongest first.
 *
 * Selection is facet-first, not weight-first. Taking the top five by weight
 * gives a page two head-to-head splits and two streak facts while a bespoke
 * observation about a title or a draft slot sits unused — and, because the
 * high-weight detectors are the general ones, it gives every page the same
 * five shapes. One card per facet until the facets run out, then backfill.
 *
 * Returns fewer — or none — when a franchise simply has not done anything
 * remarkable enough to say.
 */
export function deriveObservations(d: TeamDossier, limit = 5): Observation[] {
  const fired = detectors
    .map(fn => {
      try {
        return fn(d);
      } catch {
        return null;
      }
    })
    .filter((o): o is Observation => o !== null)
    .sort((a, b) => b.weight - a.weight);

  const chosen: Observation[] = [];
  const usedFacets = new Set<Facet>();

  for (const o of fired) {
    if (chosen.length >= limit) break;
    if (usedFacets.has(o.facet)) continue;
    chosen.push(o);
    usedFacets.add(o.facet);
  }

  // Backfill only once every facet the team has is represented.
  for (const o of fired) {
    if (chosen.length >= limit) break;
    if (chosen.includes(o)) continue;
    chosen.push(o);
  }

  return chosen.sort((a, b) => b.weight - a.weight);
}
