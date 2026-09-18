/**
 * Print everything the site knows about one franchise.
 *
 *   pnpm dossier --team 10
 *   pnpm dossier --team "Hauloll"
 *   pnpm dossier --team 10 --json
 *   pnpm dossier --verify            # invariant checks across every team
 *
 * Team accepts a numeric team_id or a case-insensitive substring of the team
 * name. Run via tsx so this shares one implementation with the app.
 */

// Env is loaded by node's --env-file flag in the `dossier` script, not dotenv:
// ESM evaluates every import before any module body runs, and
// src/lib/supabase/client.ts throws at import time when its keys are absent.
import { loadTeamDossier, type TeamDossier } from './src/lib/teams';
import {
  buildSeasonTables,
  weeklyScoreBuckets,
  totalGames,
  leagueScoringLevels,
  eraTotalsForAll,
} from './src/lib/teams';
import { loadLeagueHistory } from './src/lib/briefs/history';
import { computeGroupTitlesFromTables, rankSeason } from './src/lib/teams';
import { calculateStandings } from './src/lib/supabase/api';
import { supabase } from './src/lib/supabase/client';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function resolveTeam(input: string): Promise<number> {
  if (/^\d+$/.test(input)) return Number(input);
  const { data, error } = await supabase.from('teams').select('team_id, team_name');
  if (error) throw new Error(`teams query failed: ${error.message}`);
  const rows = (data || []) as unknown as { team_id: number; team_name: string }[];
  const needle = input.toLowerCase();
  const hits = rows.filter(t => t.team_name?.toLowerCase().includes(needle));
  if (hits.length === 0) throw new Error(`No team matches "${input}"`);
  if (hits.length > 1) {
    throw new Error(
      `"${input}" matches ${hits.length} teams: ${hits.map(h => `${h.team_name} (${h.team_id})`).join(', ')}`
    );
  }
  return hits[0].team_id;
}

const n1 = (v: number) => v.toFixed(1);
const n2 = (v: number) => v.toFixed(2);
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const rec = (w: number, l: number, t: number) => `${w}-${l}${t ? `-${t}` : ''}`;
const signed = (v: number) => (v > 0 ? `+${n2(v)}` : n2(v));

function render(d: TeamDossier): string {
  const L: string[] = [];
  const rule = (s: string) => L.push('', `── ${s} ${'─'.repeat(Math.max(0, 58 - s.length))}`);

  const id = d.identity;
  L.push(`${id.currentName}${id.shortName ? `  (${id.shortName})` : ''}  [team ${id.teamId}]`);
  if (id.owner) L.push(`${id.owner}${id.location ? ` — ${id.location}` : ''}`);
  L.push(
    `${id.isDefunct ? 'DEFUNCT — ' : ''}${id.seasonsPlayed} season${id.seasonsPlayed === 1 ? '' : 's'}` +
      (id.firstSeasonWithGames ? `, ${id.firstSeasonWithGames}-${id.lastSeasonWithGames}` : '')
  );
  if (id.formerNames.length) L.push(`formerly: ${id.formerNames.join(' → ')}`);
  if (id.firstYear && id.firstSeasonWithGames && id.firstYear < id.firstSeasonWithGames) {
    L.push(`franchise dates to ${id.firstYear}, before the game log`);
  }
  const stars = '\u2605'.repeat(Math.floor(d.prestige.stars)) +
    (d.prestige.stars % 1 ? '\u00bd' : '') +
    '\u2606'.repeat(5 - Math.ceil(d.prestige.stars));
  L.push(`prestige ${stars}  ${d.prestige.stars.toFixed(1)}/5 — ${d.prestige.label} (rating ${n1(d.prestige.rating)})`);
  L.push(d.eraNote);

  const c = d.career;
  rule('CAREER');
  L.push(`  regular season  ${rec(c.wins, c.losses, c.ties)}   ${pct(c.winPct)}   (${c.games} games)`);
  L.push(`  points          ${n1(c.pointsFor)} for / ${n1(c.pointsAgainst)} against   diff ${signed(c.pointDiff)}`);
  L.push(`  per game        ${n2(c.pointsPerGame)} for / ${n2(c.pointsAgainstPerGame)} against`);
  L.push(`  playoffs        ${rec(c.playoff.wins, c.playoff.losses, c.playoff.ties)}` +
    (c.playoff.byRound.length
      ? `   ${c.playoff.byRound.map(r => `${r.label} ${r.wins}-${r.losses}`).join(', ')}`
      : ''));
  L.push(`  league rank     win% ${d.ranks.winPct.rank}/${d.ranks.winPct.of}` +
    `   pts/g ${d.ranks.pointsPerGame.rank}/${d.ranks.pointsPerGame.of} (raw)` +
    `   pts against/g ${d.ranks.pointsAgainstPerGame.rank}/${d.ranks.pointsAgainstPerGame.of} (raw)`);
  L.push(`  era-adjusted    scoring ${n1(d.ranks.scoringIndex.index)} ` +
    `(${d.ranks.scoringIndex.rank.rank}/${d.ranks.scoringIndex.rank.of})` +
    `   conceded ${n1(d.ranks.concededIndex.index)} ` +
    `(${d.ranks.concededIndex.rank.rank}/${d.ranks.concededIndex.rank.of})   [100 = par for the seasons played]`);

  const lk = d.luck;
  rule('LUCK');
  L.push(`  all-play        ${rec(lk.allPlay.wins, lk.allPlay.losses, lk.allPlay.ties)}   ${pct(lk.allPlay.winPct)}`);
  L.push(`  expected wins   ${n2(lk.expectedWins)}   actual ${lk.actualWins}   delta ${signed(lk.luckDelta)}`);
  L.push(`  close (<=${lk.closeGames.margin})     ${rec(lk.closeGames.wins, lk.closeGames.losses, lk.closeGames.ties)}`);
  L.push(`  blowouts (>=${lk.blowouts.margin}) ${lk.blowouts.wins}-${lk.blowouts.losses}`);
  const luckiest = [...lk.bySeason].sort((a, b) => b.luckDelta - a.luckDelta);
  if (luckiest.length > 1) {
    const best = luckiest[0];
    const worst = luckiest[luckiest.length - 1];
    L.push(`  luckiest season ${best.year} ${signed(best.luckDelta)} wins   unluckiest ${worst.year} ${signed(worst.luckDelta)}`);
  }

  const h = d.honors;
  rule('HONORS');
  L.push(`  championships   ${h.championships.join(', ') || 'none'}`);
  L.push(`  title games     ${h.championshipGameAppearances.join(', ') || 'none'}`);
  L.push(`  group titles    ${h.groupTitles.map(t => `${t.year} ${t.groupName}`).join(', ') || 'none'}`);
  L.push(`  playoffs        ${h.playoffAppearances.length} appearances` +
    (h.playoffAppearances.length ? ` (${h.playoffAppearances.join(', ')})` : ''));
  L.push(`  points titles   ${h.pointsTitles.join(', ') || 'none'}`);
  L.push(`  weekly highs    ${h.weeklyHighScores}`);
  if (d.rivalry) {
    const r = d.rivalry;
    L.push(`  rivalry         ${r.rivalryName} vs ${r.opponentName}` +
      `   ${rec(r.record.wins, r.record.losses, r.record.ties)}` +
      (r.trophyName ? `   plays for the ${r.trophyName}` : ''));
  }

  const s = d.superlatives;
  rule('EXTREMES');
  const gm = (label: string, m: typeof s.highestScore) =>
    m && L.push(`  ${label.padEnd(15)} ${n1(m.teamScore)}-${n1(m.opponentScore)} vs ${m.opponentName} (${m.year} ${m.label})`);
  gm('highest score', s.highestScore);
  gm('lowest score', s.lowestScore);
  gm('biggest win', s.biggestWin);
  gm('worst loss', s.worstLoss);
  for (const st of [s.longestWinStreak, s.longestLoseStreak]) {
    if (!st) continue;
    L.push(`  longest ${st.kind === 'W' ? 'win ' : 'loss'} run  ${st.length} — ${st.span}` +
      `   (${st.occurrences} team-seasons ever reached ${st.length}+)`);
  }
  if (s.bestSeasonByRecord) {
    const b = s.bestSeasonByRecord;
    L.push(`  best season     ${b.year} ${rec(b.wins, b.losses, b.ties)} (${pct(b.winPct)})`);
  }
  if (s.worstSeasonByRecord) {
    const w = s.worstSeasonByRecord;
    L.push(`  worst season    ${w.year} ${rec(w.wins, w.losses, w.ties)} (${pct(w.winPct)})`);
  }

  rule('PRESTIGE');
  L.push(`  ${d.prestige.stars.toFixed(1)} stars — ${d.prestige.label}`);
  L.push(`  rating ${n1(d.prestige.rating)}, from ${n1(d.prestige.effectiveSeasons)} decayed seasons of evidence`);
  L.push('  biggest contributors:');
  for (const dr of d.prestige.drivers) {
    L.push(`    ${dr.year}  ${n1(dr.contribution).padStart(6)}  ${dr.note}`);
  }

  rule('SEASONS');
  L.push('  year  group              rec       pct     PF      PA   idx  fin  streak  playoffs');
  for (const s2 of d.seasons) {
    L.push(
      `  ${s2.year}  ${(s2.groupName ?? '—').slice(0, 18).padEnd(18)} ` +
      `${rec(s2.wins, s2.losses, s2.ties).padEnd(9)} ` +
      `${pct(s2.winPct).padStart(6)} ` +
      `${n1(s2.pointsFor).padStart(7)} ${n1(s2.pointsAgainst).padStart(7)} ` +
      `${(s2.scoringIndex === null ? '—' : n1(s2.scoringIndex)).padStart(5)} ` +
      `${String(s2.finish ?? '—').padStart(3)}/${String(s2.teamsInLeague).padEnd(2)} ` +
      `${(s2.streak ?? '—').padEnd(6)} ` +
      `${s2.playoffResult ? (s2.playoffResult.outcome === 'won-title' ? 'CHAMPION' : s2.playoffResult.outcome === 'lost-final' ? 'lost final' : `out ${s2.playoffResult.label}`) : ''}`
    );
  }

  rule(`HEAD TO HEAD (series includes playoffs; ${d.opponents.minMeetings}+ meetings ranked)`);
  for (const o of d.opponents.splits) {
    L.push(
      `  ${o.opponentName.padEnd(26)} ${rec(o.wins, o.losses, o.ties).padEnd(9)} ` +
      `${pct(o.winPct).padStart(6)}  ${String(o.meetings).padStart(3)} mtgs  ` +
      `${(o.currentStreak ?? '').padEnd(4)} ` +
      `${o.playoff.wins + o.playoff.losses + o.playoff.ties ? `(${o.playoff.wins}-${o.playoff.losses} playoff)` : ''}`
    );
  }
  if (d.opponents.best) L.push(`  best matchup:  ${d.opponents.best.opponentName} (${pct(d.opponents.best.winPct)})`);
  if (d.opponents.worst) L.push(`  worst matchup: ${d.opponents.worst.opponentName} (${pct(d.opponents.worst.winPct)})`);

  if (d.draft) {
    rule(`DRAFT ORDER (${d.draft.eraLabel})`);
    L.push(`  average pick ${n2(d.draft.averagePick)}` +
      (d.draft.earliest ? `   earliest ${d.draft.earliest.pick} (${d.draft.earliest.year})` : '') +
      (d.draft.latest ? `   latest ${d.draft.latest.pick} (${d.draft.latest.year})` : ''));
    L.push(`  ${d.draft.picks.map(p => `${p.year}:${p.pick}`).join('  ')}`);
  }

  const cc = d.crossChecks;
  if (cc.championshipDisagreements.length || cc.groupTitleDisagreements.length) {
    rule('CROSS-CHECK FAILURES');
    if (cc.championshipDisagreements.length) {
      L.push(`  championships disagree for: ${cc.championshipDisagreements.join(', ')}`);
    }
    if (cc.groupTitleDisagreements.length) {
      L.push(`  group titles disagree for: ${cc.groupTitleDisagreements.join(', ')}`);
    }
  }

  return L.join('\n');
}

/**
 * Invariant checks. Each targets a different class of error, so a failure
 * localises the bug rather than just signalling one.
 */
async function verify(): Promise<number> {
  const history = await loadLeagueHistory();
  const tables = buildSeasonTables(history);
  const buckets = weeklyScoreBuckets(history);
  let failures = 0;
  const check = (ok: boolean, label: string, detail = '') => {
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
  };

  console.log('\n── EXPECTED WINS SUM TO GAMES PLAYED ───────────────────');
  // Per week, sum over teams of (beaten + ties/2)/(n-1) is n/2 = games played.
  // A mismatch means the week filter or the tie split is wrong.
  for (const year of tables.years) {
    let expected = 0;
    let actual = 0;
    for (const [key, entries] of buckets) {
      if (Number(key.split(':')[0]) !== year) continue;
      const n = entries.length;
      if (n < 2) continue;
      for (const e of entries) {
        let lower = 0, equal = 0;
        for (const o of entries) {
          if (o === e) continue;
          if (o.score < e.score) lower++;
          else if (o.score === e.score) equal++;
        }
        expected += (lower + equal * 0.5) / (n - 1);
      }
    }
    for (const t of tables.byYear.get(year)!.values()) actual += t.wins + t.ties * 0.5;
    check(Math.abs(expected - actual) < 0.001, `${year}`, `expected ${expected.toFixed(3)} vs actual ${actual.toFixed(3)}`);
  }

  console.log('\n── ALL-PLAY GAMES == WEEKS x (TEAMS-1) ─────────────────');
  {
    let expectedPairs = 0;
    for (const entries of buckets.values()) {
      if (entries.length < 2) continue;
      expectedPairs += entries.length * (entries.length - 1);
    }
    const teamIds = [...new Set(history.games.flatMap(g => [g.home_team_id, g.away_team_id]))];
    let actualPairs = 0;
    for (const id of teamIds) {
      for (const entries of buckets.values()) {
        if (entries.length < 2) continue;
        if (entries.some(e => e.teamId === id)) actualPairs += entries.length - 1;
      }
    }
    check(expectedPairs === actualPairs, 'all-play comparisons', `${actualPairs} of ${expectedPairs}`);
  }

  console.log('\n── SEASON LINES SUM TO CAREER ──────────────────────────');
  const teamIds = [...tables.byYear.get(tables.years[0])!.keys()];
  const allIds = [...new Set(history.games.flatMap(g => [g.home_team_id, g.away_team_id]))].sort((a, b) => a - b);
  for (const id of allIds) {
    const d = await loadTeamDossier(id);
    if (!d) { check(false, `team ${id}`, 'no dossier'); continue; }
    const sum = d.seasons.reduce(
      (a, s) => ({ w: a.w + s.wins, l: a.l + s.losses, t: a.t + s.ties, pf: a.pf + s.pointsFor }),
      { w: 0, l: 0, t: 0, pf: 0 }
    );
    const ok =
      sum.w === d.career.wins && sum.l === d.career.losses && sum.t === d.career.ties &&
      Math.abs(sum.pf - d.career.pointsFor) < 0.5;
    check(ok, `${d.identity.currentName.padEnd(26)}`,
      `${rec(sum.w, sum.l, sum.t)} vs ${rec(d.career.wins, d.career.losses, d.career.ties)}`);
    if (d.crossChecks.championshipDisagreements.length) {
      check(false, `  championship cross-check ${d.identity.currentName}`, d.crossChecks.championshipDisagreements.join(', '));
    }
    if (d.crossChecks.groupTitleDisagreements.length) {
      check(false, `  group-title cross-check ${d.identity.currentName}`, d.crossChecks.groupTitleDisagreements.join(', '));
    }
  }

  console.log('\n── NO UNFINISHED SEASON IS TREATED AS COMPLETE ─────────');
  {
    const unfinished = tables.years.filter(y => !tables.progress.get(y)?.regularSeasonComplete);
    console.log(`  in progress: ${unfinished.length ? unfinished.map(y => {
      const p = tables.progress.get(y)!;
      return `${y} (${p.regularWeeksPlayed}/${p.scheduledWeeks})`;
    }).join(', ') : 'none'}`);

    let titled = 0, pointed = 0, crowned = 0;
    for (const id of allIds) {
      const d = await loadTeamDossier(id);
      if (!d) continue;
      for (const y of unfinished) {
        if (d.honors.groupTitles.some(t => t.year === y)) titled++;
        if (d.honors.pointsTitles.includes(y)) pointed++;
        if (d.superlatives.bestSeasonByRecord?.year === y) crowned++;
        if (d.superlatives.worstSeasonByRecord?.year === y) crowned++;
        if (d.superlatives.bestSeasonByPoints?.year === y) crowned++;
      }
    }
    check(titled === 0, 'no division title awarded in an unfinished season', `${titled}`);
    check(pointed === 0, 'no points title awarded in an unfinished season', `${pointed}`);
    check(crowned === 0, 'no best/worst season claimed from an unfinished season', `${crowned}`);

    // A partial season must not carry a full season's prestige weight.
    const overweight: string[] = [];
    for (const id of allIds) {
      const d = await loadTeamDossier(id);
      if (!d) continue;
      for (const row of d.prestige.seasons) {
        const p = tables.progress.get(row.year);
        if (!p || p.regularSeasonComplete) continue;
        if (row.played > p.fraction + 0.001) overweight.push(`${d.identity.currentName} ${row.year}`);
      }
    }
    check(overweight.length === 0, 'partial seasons weighted by completion', overweight.join(', '));

    // Rate denominators must not count a season that has not been played.
    const miscounted: string[] = [];
    for (const id of allIds) {
      const d = await loadTeamDossier(id);
      if (!d) continue;
      const played = d.seasons.filter(s => !s.inProgress).length;
      if (d.identity.seasonsPlayed !== played) {
        miscounted.push(`${d.identity.currentName} ${d.identity.seasonsPlayed}≠${played}`);
      }
      if (d.career.seasons !== played) {
        miscounted.push(`${d.identity.currentName} career ${d.career.seasons}≠${played}`);
      }
    }
    check(miscounted.length === 0, 'season counts exclude the live season', miscounted.join(', '));
  }

  console.log('\n── DERIVATIONS MATCH THE STORED TROPHIES ───────────────');
  // The trophy_case is independent, human-recorded ground truth. Where a stored
  // trophy means the same thing this code derives from the game log, they must
  // agree — this is what caught the missing division/quad tiebreak in 2022.
  {
    const { data: tcAll } = await supabase.from('trophy_case').select('*');
    const rows = (tcAll || []) as any[];

    const keys = rows.filter(r => r.trophy_id === 2); // Surrendered Keys: loses the final
    const keysOk = keys.filter(r => tables.playoffShape.get(r.year)?.runnerUpId === r.team_id).length;
    check(keysOk === keys.length, 'Surrendered Keys == derived runner-up', `${keysOk}/${keys.length}`);

    const verm = rows.filter(r => r.trophy_id === 4); // Virtual Vermeil: top scorer
    let vOk = 0;
    for (const r of verm) {
      const table = tables.byYear.get(r.year);
      if (!table) continue;
      const played = [...table.values()].filter(t => t.wins + t.losses + t.ties > 0);
      if (played.length === 0) continue;
      if (played.reduce((a, t) => (t.pointsFor > a.pointsFor ? t : a)).teamId === r.team_id) vOk++;
    }
    check(vOk === verm.length, 'Virtual Vermeil == derived points title', `${vOk}/${verm.length}`);

    // Three trophies mark a group winner, in different eras:
    //   7  Eastern Goblet   East division champ, 2010-2018
    //   3  Jared's Goblet   West division champ over the same years; before
    //                       divisions existed it went to the best record, and
    //                       in 2025 it went to all four quad winners
    //   18 Division Champ   the quad era, 2019-2022
    const grouped = new Set(
      history.leagueSeasons.filter(s => s.structure_type !== 'single_league').map(s => s.year)
    );
    const groupRows = rows.filter(
      r => r.trophy_id === 18 || r.trophy_id === 7 ||
           (r.trophy_id === 3 && grouped.has(r.year))
    );
    const derived = new Set<string>();
    for (const [teamId, titles] of computeGroupTitlesFromTables(history, tables)) {
      for (const t of titles) derived.add(`${t.year}:${teamId}`);
    }
    const gOk = groupRows.filter(r => derived.has(`${r.year}:${r.team_id}`)).length;
    check(gOk === groupRows.length, 'stored group trophies == derived group titles',
      `${gOk}/${groupRows.length}`);

    // Before divisions there was no group to win, so the Goblet crowned the
    // best regular-season record — which is what `rankSeason` returns first.
    const flatGoblets = rows.filter(r => r.trophy_id === 3 && !grouped.has(r.year));
    const fOk = flatGoblets.filter(r => {
      const table = tables.byYear.get(r.year);
      return table ? rankSeason(table)[0] === r.team_id : false;
    }).length;
    check(fOk === flatGoblets.length,
      "Jared's Goblet (pre-division) == best regular-season record",
      `${fOk}/${flatGoblets.length}`);
  }

  console.log('\n── ERA INDEX IS ANCHORED AT 100 ────────────────────────');
  {
    const levels = leagueScoringLevels(tables);
    const era = [...eraTotalsForAll(tables).values()];
    const points = era.reduce((a, e) => a + e.pointsFor, 0);
    const par = era.reduce((a, e) => a + e.par, 0);
    // Every point scored is a point conceded, and par is the same schedule
    // priced at league average, so the league-wide index must be exactly 100.
    check(Math.abs((points / par) * 100 - 100) < 0.0001, 'league-wide scoring index',
      `${((points / par) * 100).toFixed(6)}`);
    const conceded = era.reduce((a, e) => a + e.pointsAgainst, 0);
    check(Math.abs(points - conceded) < 0.5, 'points scored == points conceded',
      `${points.toFixed(1)} vs ${conceded.toFixed(1)}`);

    // Each season must price out exactly too, which catches a wrong denominator
    // in one year rather than letting it average away across the league.
    let bad = 0;
    for (const year of tables.years) {
      const level = levels.get(year)!;
      let pts = 0, parY = 0;
      for (const t of tables.byYear.get(year)!.values()) {
        pts += t.pointsFor;
        parY += level.pointsPerGame * t.pointsGames;
      }
      if (Math.abs(pts - parY) > 0.5) bad++;
    }
    check(bad === 0, 'every season prices to par', `${bad} seasons off`);

    console.log('  league scoring level by season (points per team-game):');
    for (const year of tables.years) {
      console.log(`    ${year}  ${levels.get(year)!.pointsPerGame.toFixed(1)}`);
    }
  }

  console.log('\n── AGREES WITH calculateStandings ──────────────────────');
  for (const year of [2024, 2025]) {
    const standings = await calculateStandings(year);
    const table = tables.byYear.get(year);
    if (!table) { check(false, `${year}`, 'no table'); continue; }
    let mismatched: string[] = [];
    let pfDiffs = 0;
    for (const row of standings.overall) {
      const mine = table.get(row.team_id);
      if (!mine) { mismatched.push(`${row.team_id} missing`); continue; }
      if (mine.wins !== row.wins || mine.losses !== row.losses || mine.ties !== row.ties) {
        mismatched.push(`${row.team?.team_name}: ${rec(mine.wins, mine.losses, mine.ties)} vs ${rec(row.wins, row.losses, row.ties)}`);
      }
      if (Math.abs(mine.pointsFor - row.points_for) > 0.5) pfDiffs++;
    }
    check(mismatched.length === 0, `${year} W-L-T`, mismatched.join('; '));
    // PF is EXPECTED to differ wherever a season has playoff games:
    // calculateStandings adds playoff points into points_for.
    const playoffGames = history.games.filter(g => g.year === year && g.playoffs).length;
    console.log(`  note  ${year} points-for differs for ${pfDiffs} teams (${playoffGames} playoff games folded into standings PF)`);
  }

  console.log('\n── 2025 PLAY-IN HANDLING ───────────────────────────────');
  {
    const wk14 = history.games.filter(g => g.year === 2025 && !g.playoffs && g.week === 14);
    const inBuckets = [...buckets.keys()].includes('2025:14');
    check(wk14.length > 0, 'week 14 games exist', `${wk14.length}`);
    check(!inBuckets, 'week 14 excluded from all-play/expected wins');
    const table = tables.byYear.get(2025)!;
    const wk14Points = wk14.reduce((a, g) => a + (g.home_score ?? 0) + (g.away_score ?? 0), 0);
    const tablePf = [...table.values()].reduce((a, t) => a + t.pointsFor, 0);
    const regPoints = history.games
      .filter(g => g.year === 2025 && !g.playoffs && g.home_score !== null)
      .reduce((a, g) => a + g.home_score! + g.away_score!, 0);
    check(Math.abs(tablePf - regPoints) < 0.5, 'week 14 points DO count toward points-for',
      `table ${tablePf.toFixed(1)} vs regular season ${regPoints.toFixed(1)} (wk14 = ${wk14Points.toFixed(1)})`);
    const maxPlayoffWeek = Math.max(...history.games.filter(g => g.playoffs).map(g => g.week));
    check(maxPlayoffWeek <= 3, 'playoff week holds a round, never an NFL week', `max ${maxPlayoffWeek}`);
  }

  console.log(`\n${failures === 0 ? 'All invariants hold.' : `${failures} FAILURES`}\n`);
  return failures;
}

async function main() {
  if (flag('verify')) {
    process.exit((await verify()) === 0 ? 0 : 1);
  }

  const teamArg = arg('team');
  if (!teamArg) {
    console.error('Usage: pnpm dossier --team <id|name> [--json]   |   pnpm dossier --verify');
    process.exit(1);
  }

  const teamId = await resolveTeam(teamArg);
  const dossier = await loadTeamDossier(teamId);
  if (!dossier) {
    console.error(`No dossier for team ${teamId}`);
    process.exit(1);
  }

  console.log(flag('json') ? JSON.stringify(dossier, null, 2) : render(dossier));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
