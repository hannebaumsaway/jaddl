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
 * `weight` is roughly "how much would this make someone in the league look
 * up". Only the strongest few are shown.
 */

import type { TeamDossier } from './dossier';

export interface Observation {
  id: string;
  text: string;
  weight: number;
}

const rec = (w: number, l: number, t = 0) => `${w}-${l}${t ? `-${t}` : ''}`;
const pct = (v: number) => v.toFixed(3).replace(/^0/, '');
const n1 = (v: number) => v.toFixed(1);
const ord = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

type Detector = (d: TeamDossier) => Observation | null;

const detectors: Detector[] = [
  /* The schedule giveth and taketh away. */
  d => {
    const gap = d.luck.luckDelta;
    if (Math.abs(gap) < 4) return null;
    const unlucky = gap < 0;
    return {
      id: 'luck-gap',
      weight: 90 + Math.min(Math.abs(gap), 20),
      text: unlucky
        ? `They have scored like a ${pct(d.luck.allPlay.winPct)} team and finished ${pct(d.career.winPct)}. Across ${plural(d.identity.seasonsPlayed, 'season')} that is ${n1(Math.abs(gap))} wins the schedule took off them${Math.abs(gap) > 10 ? ' — more than most franchises win in a season' : ''}.`
        : `Their record flatters them. Against the whole league each week they would be ${pct(d.luck.allPlay.winPct)}; the draw handed them ${n1(gap)} wins more than the scoring earned.`,
    };
  },

  /* Raw scoring rank vs the era-adjusted one. */
  d => {
    const raw = d.ranks.pointsPerGame.rank;
    const adj = d.ranks.scoringIndex.rank.rank;
    if (Math.abs(raw - adj) < 4) return null;
    const inflated = adj > raw;
    return {
      id: 'era-correction',
      weight: 78 + Math.abs(raw - adj),
      text: inflated
        ? `Careful with the scoring average. They rank ${ord(raw)} in league history on raw points per game, but they played in a higher-scoring era — measured against the league they actually faced, they are only ${ord(adj)}.`
        : `Their scoring average undersells them badly. It ranks ${ord(raw)} all-time, but they played when the whole league scored less; against their own era they are ${ord(adj)}.`,
    };
  },

  /* A record nobody else holds. */
  d => {
    const s = d.superlatives.longestLoseStreak;
    if (!s || s.occurrences !== 1 || s.longestEver?.teamId !== d.identity.teamId) return null;
    return {
      id: 'worst-streak-ever',
      weight: 95,
      text: `The ${s.length}-game slide in ${s.year} is not just their worst run — it is the longest losing streak any franchise has put together in league history.`,
    };
  },
  d => {
    const s = d.superlatives.longestWinStreak;
    if (!s || s.occurrences !== 1 || s.longestEver?.teamId !== d.identity.teamId) return null;
    return {
      id: 'best-streak-ever',
      weight: 95,
      text: `Nobody has ever strung together more than their ${s.length} straight wins in ${s.year}.`,
    };
  },

  /* Trophies that do not match the ledger. */
  d => {
    const titles = d.honors.championships.length;
    if (titles < 2 || d.career.winPct >= 0.49) return null;
    if (d.ranks.winPct.rank <= d.ranks.winPct.of / 2) return null;
    return {
      id: 'titles-losing-record',
      weight: 88,
      text: `${plural(titles, 'championship')}, and a losing record to go with them. They are ${rec(d.career.wins, d.career.losses, d.career.ties)} all time, ${ord(d.ranks.winPct.rank)} of ${d.ranks.winPct.of} on win percentage.`,
    };
  },

  /* Perfect in a round. */
  d => {
    const final = d.career.playoff.byRound.find(r => /champ/i.test(r.label));
    if (!final || final.wins < 2 || final.losses > 0) return null;
    return {
      id: 'finals-unbeaten',
      weight: 84,
      text: `Getting there is the hard part. They are ${final.wins}-0 once they reach the final — every trip has ended with the trophy.`,
    };
  },
  d => {
    const final = d.career.playoff.byRound.find(r => /champ/i.test(r.label));
    if (!final || final.losses < 2 || final.wins > 0) return null;
    return {
      id: 'finals-winless',
      weight: 84,
      text: `${plural(final.losses, 'trip')} to the final, ${plural(final.losses, 'loss', 'losses')}. The last step is the one they have never taken.`,
    };
  },

  /* A rivalry decided by nothing. */
  d => {
    const r = d.rivalry;
    if (!r || r.meetings < 12) return null;
    if (Math.abs(r.record.wins - r.record.losses) > 1) return null;
    return {
      id: 'rivalry-knife-edge',
      weight: 80,
      text: `${r.rivalryName} could not be closer: ${rec(r.record.wins, r.record.losses, r.record.ties)} against ${r.opponentName} across ${plural(r.meetings, 'meeting')}. One more result flips it.`,
    };
  },

  /* The team they cannot beat. */
  d => {
    const worst = d.opponents.worst;
    if (!worst || worst.meetings < 12 || worst.winPct > 0.36) return null;
    return {
      id: 'nemesis',
      weight: 74,
      text: `${worst.opponentName} own them. ${rec(worst.wins, worst.losses, worst.ties)} across ${plural(worst.meetings, 'meeting')} is the worst they have fared against anybody.`,
    };
  },

  /* Scored the most, watched the playoffs. */
  d => {
    const wasted = d.honors.pointsTitles.filter(y => !d.honors.playoffAppearances.includes(y));
    if (wasted.length === 0) return null;
    return {
      id: 'points-title-no-playoffs',
      weight: 82,
      text: `In ${wasted.join(' and ')} they outscored every team in the league and still missed the playoffs${wasted.length > 1 ? ' — twice' : ''}.`,
    };
  },

  /* Peak scoring season, nothing to show for it. */
  d => {
    const scored = d.seasons.filter(s => s.scoringIndex !== null && !s.inProgress);
    if (scored.length < 6) return null;
    const peak = scored.reduce((a, s) => (s.scoringIndex! > a.scoringIndex! ? s : a));
    if (peak.madePlayoffs || peak.scoringIndex! < 108) return null;
    return {
      id: 'peak-wasted',
      weight: 72,
      text: `Their best scoring season relative to the league was ${peak.year}, when they put up ${n1(peak.scoringIndex!)} against a par of 100 — and finished ${peak.finish} of ${peak.teamsInLeague} without a playoff berth.`,
    };
  },

  /* Boom and bust, back to back. */
  d => {
    const b = d.superlatives.bestSeasonByRecord, w = d.superlatives.worstSeasonByRecord;
    if (!b || !w) return null;
    const gap = Math.abs(b.year - w.year);
    if (gap > 3) return null;
    return {
      id: 'swing',
      weight: 76,
      text: `${gap === 1 ? 'One year' : `${gap} years`} separates their best season from their worst: ${rec(b.wins, b.losses, b.ties)} in ${b.year}, ${rec(w.wins, w.losses, w.ties)} in ${w.year}.`,
    };
  },

  /* Still waiting. */
  d => {
    const latest = d.seasons[d.seasons.length - 1]?.year;
    if (!latest) return null;
    if (d.honors.championships.length === 0) {
      if (d.identity.seasonsPlayed < 8) return null;
      return {
        id: 'no-title',
        weight: 79,
        text: `${plural(d.identity.seasonsPlayed, 'season')} in, and the trophy case is still missing the one that matters${d.honors.groupTitles.length ? ` — though ${plural(d.honors.groupTitles.length, 'division title')} says they keep getting close` : ''}.`,
      };
    }
    const last = Math.max(...d.honors.championships);
    const drought = latest - last;
    if (drought < 8) return null;
    return {
      id: 'drought',
      weight: 70,
      text: `The last title was ${last}. ${plural(drought, 'season')} have gone by since, and ${plural(d.honors.playoffAppearances.filter(y => y > last).length, 'playoff berth')} with it.`,
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
      weight: 66,
      text: share <= 0.4
        ? `Tight games do not go their way. In the ${n} decided by ${c.margin} points or fewer they are ${rec(c.wins, c.losses, c.ties)}.`
        : `They win the ones that come down to the wire — ${rec(c.wins, c.losses, c.ties)} in games decided by ${c.margin} points or fewer.`,
    };
  },

  /* The lowest-scoring game they ever played, and it was close. */
  d => {
    const lo = d.superlatives.lowestScore;
    if (!lo || Math.abs(lo.margin) > 3 || lo.result !== 'L') return null;
    return {
      id: 'low-and-lost',
      weight: 64,
      text: `Their lowest score ever, ${n1(lo.teamScore)} in ${lo.year}, was also nearly a win: ${lo.opponentName} managed just ${n1(lo.opponentScore)} and took it by ${n1(Math.abs(lo.margin))}.`,
    };
  },

  /* Reigning, or recently so. */
  d => {
    const latest = d.seasons[d.seasons.length - 1]?.year;
    if (!latest || d.honors.championships.length === 0) return null;
    const last = Math.max(...d.honors.championships);
    if (latest - last > 1) return null;
    return {
      id: 'reigning',
      weight: 92,
      text: latest === last
        ? `They are the reigning champions, and the ${ord(d.honors.championships.length)} title in franchise history came with it.`
        : `They won it in ${last} — the most recent name on the trophy before this season.`,
    };
  },

  /* Titles bunched together. */
  d => {
    const years = [...d.honors.championships].sort((a, b) => a - b);
    if (years.length < 2) return null;
    for (let i = 0; i + 1 < years.length; i++) {
      const span = years[i + 1] - years[i];
      if (span <= 2) {
        return {
          id: 'title-cluster',
          weight: 86,
          text: span === 1
            ? `They went back to back in ${years[i]} and ${years[i + 1]} — the hardest thing to do in this league.`
            : `Two titles in three years, ${years[i]} and ${years[i + 1]}.`,
        };
      }
    }
    return null;
  },

  /* A pile of division titles. */
  d => {
    const n = d.honors.groupTitles.length;
    if (n < 5) return null;
    const years = d.honors.groupTitles.map(t => t.year);
    return {
      id: 'group-haul',
      weight: 80,
      text: `${plural(n, 'division title')} across ${plural(d.identity.seasonsPlayed, 'season')} — they have finished top of their group roughly every ${Math.round(d.identity.seasonsPlayed / n)} years, most recently in ${Math.max(...years)}.`,
    };
  },

  /* Reliably there, or reliably not. */
  d => {
    const seasons = d.identity.seasonsPlayed;
    if (seasons < 8) return null;
    const rate = d.honors.playoffAppearances.length / seasons;
    if (rate < 0.6 && rate > 0.25) return null;
    return {
      id: 'playoff-rate',
      weight: 75,
      text: rate >= 0.6
        ? `They are a fixture in the postseason: ${d.honors.playoffAppearances.length} berths in ${plural(seasons, 'season')}.`
        : `The postseason has mostly happened without them — ${d.honors.playoffAppearances.length} berths in ${plural(seasons, 'season')}.`,
    };
  },

  /* Top of the all-time table. */
  d => {
    const r = d.ranks.winPct;
    if (r.rank > 2 || d.identity.seasonsPlayed < 8) return null;
    return {
      id: 'winpct-elite',
      weight: 83,
      text: `${r.rank === 1 ? 'No franchise has won at a higher rate' : 'Only one franchise has won at a higher rate'}: ${rec(d.career.wins, d.career.losses, d.career.ties)}, ${pct(d.career.winPct)}, across ${plural(d.identity.seasonsPlayed, 'season')}.`,
    };
  },

  /* Where the stars come from. */
  d => {
    if (d.prestige.stars < 4 || d.prestige.drivers.length === 0) return null;
    const top = d.prestige.drivers[0];
    return {
      id: 'prestige',
      weight: 77,
      text: `Rated a ${d.prestige.stars.toFixed(1)}-star franchise — ${d.prestige.label.toLowerCase()} — and it is recent form doing the work: ${top.year} alone (${top.note}) carries more of that number than any other season.`,
    };
  },

  /* A franchise that keeps renaming itself. */
  d => {
    const names = d.identity.formerNames;
    if (names.length < 2) return null;
    return {
      id: 'former-names',
      weight: 62,
      text: `The name has changed more than most: ${names.join(', ')}, and now ${d.identity.currentName}.`,
    };
  },

  /* How rare their best run actually was. */
  d => {
    const s = d.superlatives.longestWinStreak;
    if (!s || s.length < 6 || s.occurrences > 20) return null;
    if (s.longestEver?.teamId === d.identity.teamId && s.occurrences === 1) return null;
    return {
      id: 'streak-rarity',
      weight: 61,
      text: `The ${s.length} straight they won in ${s.year} is rarer than it sounds — only ${s.occurrences} team-seasons in league history have managed a run that long.`,
    };
  },

  /* Weekly high scores as a rate. */
  d => {
    const n = d.honors.weeklyHighScores;
    const seasons = d.identity.seasonsPlayed;
    if (!n || seasons < 5) return null;
    const perSeason = n / seasons;
    if (perSeason < 1.3 && perSeason > 0.7) return null;
    return {
      id: 'weekly-highs',
      weight: 58,
      text: perSeason >= 1.3
        ? `They top the weekly scoreboard a lot: ${plural(n, 'time')} in ${plural(seasons, 'season')}, better than once a year.`
        : `For all the seasons played, they have led a week outright only ${plural(n, 'time')} — roughly once every ${Math.round(seasons / Math.max(n, 1) * 10) / 10} years.`,
    };
  },

  /* The one they always beat. */
  d => {
    const best = d.opponents.best;
    if (!best || best.meetings < 12 || best.winPct < 0.64) return null;
    return {
      id: 'favourite',
      weight: 60,
      text: `If they could pick an opponent it would be ${best.opponentName}: ${rec(best.wins, best.losses, best.ties)} across ${plural(best.meetings, 'meeting')}.`,
    };
  },

  /* Older than the record books. */
  d => {
    const first = d.identity.firstYear;
    const logged = d.identity.firstSeasonWithGames;
    if (!first || !logged || first >= logged) return null;
    return {
      id: 'predates-log',
      weight: 55,
      text: `The franchise goes back to ${first}, ${plural(logged - first, 'season')} before the league started keeping game records in ${logged}.`,
    };
  },

  /* Conceding more than anyone. */
  d => {
    const r = d.ranks.concededIndex.rank;
    if (r.rank > 2) return null;
    return {
      id: 'conceded',
      weight: 68,
      text: `No franchise has been shot at harder. Opponents score ${n1(d.ranks.concededIndex.index)} against them for every 100 the league averages — ${r.rank === 1 ? 'the most' : 'the second most'} in league history.`,
    };
  },
];

/**
 * The two to five most interesting things about this franchise, strongest
 * first. Returns fewer — or none — when a team simply has not done anything
 * remarkable enough to say.
 */
export function deriveObservations(d: TeamDossier, limit = 5): Observation[] {
  return detectors
    .map(fn => {
      try {
        return fn(d);
      } catch {
        return null;
      }
    })
    .filter((o): o is Observation => o !== null)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit);
}
