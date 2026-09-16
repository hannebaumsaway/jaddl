/**
 * Real-world NFL context for game briefs.
 *
 * The brief knows a player scored 42.75. It has never known *how* — and that
 * texture is most of what makes a recap readable. Worse, without it a writer
 * will reach for memory, and anything after a model's training cutoff gets
 * invented. This module closes that by reading actual box scores.
 *
 * Source is ESPN's public scoreboard/summary API: no key, no rate limit
 * published, and a completed week is immutable.
 *
 * Deliberately uncached. A full week is ~17 requests and a couple of seconds,
 * briefs are built a handful of times a week, and an in-progress week wants
 * fresh data rather than whatever was stored on Sunday evening.
 */

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';

/**
 * Sleeper and ESPN agree on 31 of 32 team abbreviations. Washington is the
 * exception and cost two of 96 matches before this map existed.
 */
const TEAM_ALIASES: Record<string, string> = { WAS: 'WSH' };

const espnTeam = (sleeperTeam: string) => TEAM_ALIASES[sleeperTeam] ?? sleeperTeam;

/**
 * Suffixes and punctuation are the whole problem: Sleeper says "Kyle Pitts"
 * where ESPN says "Kyle Pitts Sr.", and "Travis Etienne" against
 * "Travis Etienne Jr.". Normalising both sides plus the team abbreviation
 * matched 96 of 96 starters in 2026 Week 1.
 */
export function normalizeName(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|v)\.?$/g, '')
    .replace(/[.'’-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface NflTeamSide {
  abbr: string;
  name: string;
  score: number;
  homeAway: 'home' | 'away';
  winner: boolean;
}

export interface NflGame {
  id: string;
  date: string;
  /** e.g. "Final" or "Final/OT". */
  status: string;
  overtime: boolean;
  teams: NflTeamSide[];
  /** Raw per-player stat categories, keyed by display name. */
  players: Record<string, { team: string; lines: Record<string, Record<string, string>> }>;
  scoringPlays: { quarter: number | null; team: string | null; text: string }[];
}

export interface NflWeek {
  season: number;
  week: number;
  games: NflGame[];
  /** normalized("name")|TEAM -> the player's line, for fast lookup. */
  index: Map<string, NflPlayerLine>;
}

export interface NflPlayerLine {
  displayName: string;
  team: string;
  game: NflGame;
  lines: Record<string, Record<string, string>>;
}

async function json(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ESPN request failed (${res.status}): ${url}`);
  return res.json();
}

/** Every box score for one NFL week, indexed for lookup by player. */
export async function loadNflWeek(season: number, week: number): Promise<NflWeek> {
  const board = await json(`${ESPN}/scoreboard?dates=${season}&seasontype=2&week=${week}`);
  const events: any[] = board.events || [];

  const games = await Promise.all(
    events.map(async (e): Promise<NflGame> => {
      const s = await json(`${ESPN}/summary?event=${e.id}`);
      const comp = s.header?.competitions?.[0] ?? {};
      const status: string = comp.status?.type?.shortDetail ?? '';

      const players: NflGame['players'] = {};
      for (const team of s.boxscore?.players || []) {
        const abbr = team.team?.abbreviation;
        for (const cat of team.statistics || []) {
          for (const a of cat.athletes || []) {
            const nm = a.athlete?.displayName;
            if (!nm) continue;
            players[nm] ??= { team: abbr, lines: {} };
            players[nm].lines[cat.name] = Object.fromEntries(
              (cat.labels || []).map((l: string, i: number) => [l, (a.stats || [])[i]])
            );
          }
        }
      }

      return {
        id: e.id,
        date: (e.date || '').slice(0, 10),
        status,
        overtime: /OT/i.test(status),
        teams: (comp.competitors || []).map((c: any) => ({
          abbr: c.team?.abbreviation,
          name: c.team?.displayName,
          score: Number(c.score),
          homeAway: c.homeAway,
          winner: !!c.winner,
        })),
        players,
        scoringPlays: (s.scoringPlays || []).map((p: any) => ({
          quarter: p.period?.number ?? null,
          team: p.team?.abbreviation ?? null,
          text: p.text ?? '',
        })),
      };
    })
  );

  const index = new Map<string, NflPlayerLine>();
  for (const game of games) {
    for (const [displayName, d] of Object.entries(game.players)) {
      index.set(`${normalizeName(displayName)}|${d.team}`, {
        displayName,
        team: d.team,
        game,
        lines: d.lines,
      });
    }
  }

  return { season, week, games, index };
}

/** Look up a Sleeper-named player. Returns null rather than guessing. */
export function findPlayer(
  weekData: NflWeek,
  sleeperName: string,
  sleeperTeam: string | null
): NflPlayerLine | null {
  if (!sleeperTeam) return null;
  return weekData.index.get(`${normalizeName(sleeperName)}|${espnTeam(sleeperTeam)}`) ?? null;
}

/* ---------------------------------------------------------------- summary */

const num = (v: string | undefined): number => {
  const n = parseFloat(String(v ?? '').split(/[\s/-]/)[0]);
  return Number.isFinite(n) ? n : 0;
};

/**
 * A one-line stat line in the shape a recap would quote: "8 rec, 92 yds, 2 TD".
 * Returns null for players with no meaningful offensive line, so callers do not
 * print an empty stat line for an offensive lineman or a kicker.
 */
export function statLine(p: NflPlayerLine): string | null {
  const parts: string[] = [];
  const pass = p.lines.passing;
  const rush = p.lines.rushing;
  const rec = p.lines.receiving;

  if (pass?.['C/ATT']) {
    const td = num(pass.TD), int = num(pass.INT);
    parts.push(
      `${pass['C/ATT']} for ${pass.YDS}` +
      (td ? `, ${td} TD` : '') +
      (int ? `, ${int} INT` : '')
    );
  }
  if (rush && num(rush.CAR) > 0) {
    const td = num(rush.TD);
    parts.push(`${rush.CAR} car for ${rush.YDS}${td ? `, ${td} TD` : ''}`);
  }
  if (rec && (num(rec.REC) > 0 || num(rec.TGTS) > 0)) {
    const td = num(rec.TD);
    parts.push(
      `${rec.REC} of ${rec.TGTS ?? '?'} for ${rec.YDS}` + (td ? `, ${td} TD` : '')
    );
  }
  return parts.length ? parts.join('; ') : null;
}

/** "BUF 36 @ HOU 31" plus an OT marker. */
export function gameLine(g: NflGame): string {
  const away = g.teams.find(t => t.homeAway === 'away');
  const home = g.teams.find(t => t.homeAway === 'home');
  if (!away || !home) return g.status;
  return `${away.abbr} ${away.score} @ ${home.abbr} ${home.score}${g.overtime ? ' (OT)' : ''}`;
}

/**
 * Things worth a writer's attention that the fantasy score alone hides.
 *
 * Each is a statement of fact, phrased for a human to judge rather than to
 * reuse verbatim. The most important by far is `qb-pulled`: without it, a
 * quarterback who was benched after five throws looks identical to a
 * quarterback who played badly all afternoon, and a recap will blame the owner
 * for a lineup decision nobody would have made differently.
 */
export function playerNotes(p: NflPlayerLine): string[] {
  const notes: string[] = [];
  const g = p.game;
  const mine = g.teams.find(t => t.abbr === p.team);
  const opp = g.teams.find(t => t.abbr !== p.team);

  const pass = p.lines.passing;
  const rec = p.lines.receiving;
  const rush = p.lines.rushing;

  if (pass?.['C/ATT']) {
    const att = num(String(pass['C/ATT']).split('/')[1]);
    // Someone else on the same team throwing more means this one came out.
    const teammates = Object.entries(g.players)
      .filter(([nm, d]) => d.team === p.team && nm !== p.displayName && d.lines.passing?.['C/ATT'])
      .map(([nm, d]) => ({ nm, att: num(String(d.lines.passing['C/ATT']).split('/')[1]), line: d.lines.passing }));
    const bigger = teammates.find(t => t.att > att);
    if (att > 0 && att < 12 && bigger) {
      notes.push(
        `Pulled after ${att} attempts — ${bigger.nm} finished the game ` +
        `(${bigger.line['C/ATT']} for ${bigger.line.YDS}` +
        (num(bigger.line.TD) ? `, ${num(bigger.line.TD)} TD` : '') + ').'
      );
    }
    if (pass.QBR && num(pass.QBR) < 20 && att >= 10) {
      notes.push(`QBR of ${pass.QBR}.`);
    }
  }

  if (rec) {
    const tg = num(rec.TGTS), catches = num(rec.REC), yds = num(rec.YDS);
    if (tg > 0 && tg <= 4) notes.push(`Only ${tg} target${tg === 1 ? '' : 's'}.`);
    if (catches === 0 && tg > 0) {
      notes.push(tg === 1 ? 'Targeted once, no catch.' : `Targeted ${tg} times without a catch.`);
    }
    if (yds >= 100 && num(rec.TD) === 0) notes.push(`${yds} yards without reaching the end zone.`);
  }

  if (num(rush?.TD) + num(rec?.TD) + num(pass?.TD) >= 3) {
    notes.push(`Three or more touchdowns.`);
  }

  if (mine && opp) {
    const combined = mine.score + opp.score;
    if (combined >= 70) notes.push(`Came out of a ${mine.score}-${opp.score} shootout.`);
    if (g.overtime) notes.push(`Game went to overtime.`);
  }

  return notes;
}

/**
 * How a team defense actually earned its fantasy score: points conceded, sacks
 * and takeaways. A DEF has no box-score line of its own, so this is assembled
 * from what the opposing offense did.
 */
export function defenseNotes(weekData: NflWeek, sleeperTeam: string): string[] {
  const abbr = espnTeam(sleeperTeam);
  const game = weekData.games.find(g => g.teams.some(t => t.abbr === abbr));
  if (!game) return [];
  const mine = game.teams.find(t => t.abbr === abbr);
  const opp = game.teams.find(t => t.abbr !== abbr);
  if (!mine || !opp) return [];

  let sacks = 0;
  let takeaways = 0;
  for (const [, d] of Object.entries(game.players)) {
    if (d.team !== abbr) continue;
    const def = d.lines.defensive;
    if (def) sacks += num(def.SACKS);
    const ints = d.lines.interceptions;
    if (ints) takeaways += num(ints.INT);
  }

  return [
    `Conceded ${opp.score} to ${opp.abbr}` +
    `, with ${sacks || 'no'} sack${sacks === 1 ? '' : 's'}` +
    ` and ${takeaways || 'no'} takeaway${takeaways === 1 ? '' : 's'}.`,
  ];
}
