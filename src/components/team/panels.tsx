import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { TeamDossier } from '@/lib/teams';

const rec = (w: number, l: number, t: number) => `${w}-${l}${t ? `-${t}` : ''}`;
const pct = (v: number) => v.toFixed(3).replace(/^0/, '');
const n1 = (v: number) => v.toFixed(1);
const signed = (v: number) =>
  `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}`;
const ord = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'],
    v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export function Panel({
  label,
  className,
  children,
  actions,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col border border-border bg-card p-4 sm:p-5',
        className
      )}
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-mono text-[0.65rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ vitals */

function Vital({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub: string;
}) {
  return (
    <div className="flex min-w-0 flex-col justify-between gap-2 border border-border bg-card p-4">
      <h2 className="font-mono text-[0.65rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </h2>
      <div>
        <p className="font-mono text-2xl font-medium tabular-nums leading-none sm:text-[1.75rem]">
          {value}
        </p>
        <p className="mt-1.5 font-mono text-[0.7rem] text-muted-foreground">
          {sub}
        </p>
      </div>
    </div>
  );
}

export function Vitals({ d }: { d: TeamDossier }) {
  const c = d.career;
  const stars = d.prestige.stars;
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Vital
        label="Career record"
        value={rec(c.wins, c.losses, c.ties)}
        sub={`${pct(c.winPct)} · ${ord(d.ranks.winPct.rank)} of ${d.ranks.winPct.of}`}
      />
      <Vital
        label="Career scoring"
        value={n1(d.ranks.scoringIndex.index)}
        sub={`index · ${ord(d.ranks.scoringIndex.rank.rank)} of ${d.ranks.scoringIndex.rank.of} · ${c.pointsPerGame} ppg`}
      />
      <Vital
        label="Point differential"
        value={signed(c.pointDiff)}
        sub={`conceded ${n1(d.ranks.concededIndex.index)} · ${ord(d.ranks.concededIndex.rank.rank)} most`}
      />
      <Vital
        label="Prestige"
        value={<Stars value={stars} />}
        sub={`${stars.toFixed(1)} of 5 · ${d.prestige.label}`}
      />
    </div>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5" title={`${value} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <span
            key={i}
            className="relative block text-[1.35rem] leading-none text-border"
            aria-hidden
          >
            ★
            <span
              className="absolute inset-0 overflow-hidden text-foreground"
              style={{ width: `${fill * 100}%` }}
            >
              ★
            </span>
          </span>
        );
      })}
      <span className="sr-only">{value} of 5 stars</span>
    </span>
  );
}

/* -------------------------------------------------------------- recent form */

export function RecentForm({ d }: { d: TeamDossier }) {
  const games = d.recentForm;
  const nameOf = new Map(
    d.opponents.splits.map((o) => [o.opponentId, o.opponentName])
  );
  const w = games.filter((g) => g.result === 'W').length;
  const l = games.filter((g) => g.result === 'L').length;
  const t = games.filter((g) => g.result === 'T').length;
  return (
    <Panel label="Recent form">
      <ol className="flex flex-wrap gap-1 sm:gap-1.5">
        {games.map((g) => (
          <li key={g.gameId}>
            <span
              title={`${g.year} ${g.label} · ${g.teamScore}–${g.opponentScore} vs ${nameOf.get(g.opponentId) ?? 'opponent'}`}
              className={cn(
                'flex h-7 w-7 items-center justify-center font-mono text-[0.7rem] font-semibold',
                g.result === 'W'
                  ? 'bg-foreground text-background'
                  : g.result === 'L'
                    ? 'bg-muted text-muted-foreground'
                    : 'border border-border text-muted-foreground'
              )}
            >
              {g.result}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3 font-mono text-[0.7rem] text-muted-foreground">
        Last {games.length} · {rec(w, l, t)} · oldest first
      </p>
    </Panel>
  );
}

/* -------------------------------------------------------------- trophy case */

/**
 * Everything except championships and division titles — those are the header
 * banners, and repeating them here would waste the panel.
 */
export function TrophyCase({ d }: { d: TeamDossier }) {
  const rows: { name: string; detail: string }[] = [];
  if (d.honors.pointsTitles.length)
    rows.push({
      name: 'Points titles',
      detail: d.honors.pointsTitles.join(', '),
    });
  if (d.honors.weeklyHighScores)
    rows.push({
      name: 'Weekly high scores',
      detail: `${d.honors.weeklyHighScores}×`,
    });
  if (d.honors.playoffAppearances.length)
    rows.push({
      name: 'Playoff berths',
      detail: `${d.honors.playoffAppearances.length}`,
    });
  if (d.career.playoff.games)
    rows.push({
      name: 'Playoff record',
      detail: rec(
        d.career.playoff.wins,
        d.career.playoff.losses,
        d.career.playoff.ties
      ),
    });
  if (d.rivalry)
    rows.push({
      name: d.rivalry.rivalryName,
      detail: `${rec(d.rivalry.record.wins, d.rivalry.record.losses, d.rivalry.record.ties)} v ${d.rivalry.opponentName}`,
    });

  return (
    <Panel label="Trophy case">
      <dl className="flex flex-col">
        {rows.map((r) => (
          <div
            key={r.name}
            className="flex items-baseline justify-between gap-4 border-b border-border py-2 last:border-0"
          >
            <dt className="truncate text-sm">{r.name}</dt>
            <dd className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
              {r.detail}
            </dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

/* ------------------------------------------------------------ season table */

export function SeasonTable({ d }: { d: TeamDossier }) {
  return (
    <Panel
      label={`Season history · ${d.seasons[0]?.year ?? ''}–${d.seasons[d.seasons.length - 1]?.year ?? ''}`}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Year</th>
              <th className="py-2 pr-3 font-medium">Group</th>
              <th className="py-2 pr-3 text-right font-medium">Record</th>
              <th className="py-2 pr-3 text-right font-medium">Win %</th>
              <th className="py-2 pr-3 text-right font-medium">PF</th>
              <th className="py-2 pr-3 text-right font-medium">PA</th>
              <th className="py-2 pr-3 text-right font-medium">Index</th>
              <th className="py-2 pr-3 text-right font-medium">Finish</th>
              <th className="py-2 pl-3 font-medium">Postseason</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {[...d.seasons].reverse().map((s) => (
              <tr
                key={s.year}
                className="border-border/60 border-b last:border-0"
              >
                <td className="py-2 pr-3">
                  {s.year}
                  {s.inProgress && (
                    <span
                      title={`${s.weeksPlayed} of ${s.scheduledWeeks} weeks played`}
                      className="ml-1.5 font-sans text-[0.6rem] uppercase tracking-[0.08em] text-muted-foreground"
                    >
                      live
                    </span>
                  )}
                </td>
                <td className="max-w-[11rem] truncate pr-3 font-sans text-xs text-muted-foreground">
                  {s.groupName ?? '—'}
                </td>
                <td className="py-2 pr-3 text-right">
                  {rec(s.wins, s.losses, s.ties)}
                </td>
                <td className="py-2 pr-3 text-right text-muted-foreground">
                  {pct(s.winPct)}
                </td>
                <td className="py-2 pr-3 text-right">{n1(s.pointsFor)}</td>
                <td className="py-2 pr-3 text-right text-muted-foreground">
                  {n1(s.pointsAgainst)}
                </td>
                <td
                  className={cn(
                    'py-2 pr-3 text-right',
                    s.scoringIndex && s.scoringIndex >= 100
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                  )}
                >
                  {s.scoringIndex === null ? '—' : n1(s.scoringIndex)}
                </td>
                <td
                  className="py-2 pr-3 text-right text-muted-foreground"
                  title={
                    s.inProgress
                      ? 'Current standing — the season is still being played'
                      : undefined
                  }
                >
                  {s.finish ? `${s.finish}/${s.teamsInLeague}` : '—'}
                </td>
                <td className="py-2 pl-3 font-sans text-xs">
                  {s.inProgress ? (
                    <span className="text-muted-foreground">
                      {s.weeksPlayed} of {s.scheduledWeeks} weeks
                    </span>
                  ) : s.playoffResult ? (
                    <span
                      className={
                        s.playoffResult.outcome === 'won-title'
                          ? 'font-medium'
                          : 'text-muted-foreground'
                      }
                    >
                      {s.playoffResult.outcome === 'won-title'
                        ? 'Champion'
                        : s.playoffResult.outcome === 'lost-final'
                          ? 'Lost final'
                          : `Out · ${s.playoffResult.label}`}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------- head to head */

export function HeadToHead({
  d,
  className,
}: {
  d: TeamDossier;
  className?: string;
}) {
  return (
    <Panel
      label={`Head to head · ${d.opponents.splits.length} opponents`}
      className={className}
    >
      <ul className="flex flex-col">
        {d.opponents.splits.map((o) => {
          const share = o.meetings ? (o.wins + o.ties * 0.5) / o.meetings : 0;
          return (
            <li
              key={o.opponentId}
              className="border-b border-border py-2 last:border-0"
            >
              <Link
                href={`/teams/${o.opponentId}`}
                className="group flex items-center gap-3"
              >
                <span className="w-[9.5rem] shrink-0 truncate text-sm group-hover:underline">
                  {o.opponentName}
                </span>
                <span className="relative h-2 flex-1 bg-muted" aria-hidden>
                  <span
                    className="absolute inset-y-0 left-0 bg-foreground"
                    style={{ width: `${share * 100}%` }}
                  />
                </span>
                <span className="w-20 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {rec(o.wins, o.losses, o.ties)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 font-mono text-[0.7rem] leading-relaxed text-muted-foreground">
        Series include playoff meetings. Best:{' '}
        {d.opponents.best?.opponentName ?? '—'} · worst:{' '}
        {d.opponents.worst?.opponentName ?? '—'}
      </p>
    </Panel>
  );
}

/* -------------------------------------------------------- franchise records */

export function FranchiseRecords({
  d,
  className,
}: {
  d: TeamDossier;
  className?: string;
}) {
  const s = d.superlatives;
  const marks: { label: string; value: string; detail: string }[] = [];
  if (s.highestScore)
    marks.push({
      label: 'Highest score',
      value: n1(s.highestScore.teamScore),
      detail: `${s.highestScore.year} ${s.highestScore.label} v ${s.highestScore.opponentName}`,
    });
  if (s.lowestScore)
    marks.push({
      label: 'Lowest score',
      value: n1(s.lowestScore.teamScore),
      detail: `${s.lowestScore.year} ${s.lowestScore.label} v ${s.lowestScore.opponentName}`,
    });
  if (s.biggestWin)
    marks.push({
      label: 'Biggest win',
      value: `+${n1(s.biggestWin.margin)}`,
      detail: `${s.biggestWin.year} ${s.biggestWin.label} v ${s.biggestWin.opponentName}`,
    });
  if (s.worstLoss)
    marks.push({
      label: 'Worst loss',
      value: n1(s.worstLoss.margin),
      detail: `${s.worstLoss.year} ${s.worstLoss.label} v ${s.worstLoss.opponentName}`,
    });
  if (s.longestWinStreak)
    marks.push({
      label: 'Longest win run',
      value: `${s.longestWinStreak.length}`,
      detail: `${s.longestWinStreak.span} · ${s.longestWinStreak.occurrences} team-seasons ever reached it`,
    });
  if (s.longestLoseStreak)
    marks.push({
      label: 'Longest losing run',
      value: `${s.longestLoseStreak.length}`,
      detail: `${s.longestLoseStreak.span} · ${s.longestLoseStreak.occurrences} team-seasons ever reached it`,
    });
  if (s.bestSeasonByRecord)
    marks.push({
      label: 'Best season',
      value: rec(
        s.bestSeasonByRecord.wins,
        s.bestSeasonByRecord.losses,
        s.bestSeasonByRecord.ties
      ),
      detail: `${s.bestSeasonByRecord.year} · ${pct(s.bestSeasonByRecord.winPct)}`,
    });
  if (s.worstSeasonByRecord)
    marks.push({
      label: 'Worst season',
      value: rec(
        s.worstSeasonByRecord.wins,
        s.worstSeasonByRecord.losses,
        s.worstSeasonByRecord.ties
      ),
      detail: `${s.worstSeasonByRecord.year} · ${pct(s.worstSeasonByRecord.winPct)}`,
    });

  return (
    <Panel label="Franchise records" className={className}>
      <dl className="flex flex-col">
        {marks.map((m) => (
          <div
            key={m.label}
            className="flex items-baseline gap-4 border-b border-border py-2.5 last:border-0"
          >
            <dt className="w-[9rem] shrink-0 text-sm">{m.label}</dt>
            <dd className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
              <span className="font-mono text-sm font-medium tabular-nums">
                {m.value}
              </span>
              <span className="truncate text-right font-mono text-[0.7rem] text-muted-foreground">
                {m.detail}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

/* ---------------------------------------------------------------- postseason */

/**
 * The postseason résumé: the round-by-round record, and a strip showing which
 * of the franchise's seasons reached the playoffs at all.
 *
 * Round records are the interesting half — a team can be 9-4 overall and
 * undefeated in finals, which the aggregate hides completely.
 */
export function Postseason({
  d,
  className,
}: {
  d: TeamDossier;
  className?: string;
}) {
  const p = d.career.playoff;
  const berths = new Set(d.honors.playoffAppearances);
  const titles = new Set(d.honors.championshipsFromGames);
  const finals = new Set(d.honors.championshipGameAppearances);
  const seasons = d.seasons.map((s) => s.year);
  const live = new Set(
    d.seasons.filter((s) => s.inProgress).map((s) => s.year)
  );

  return (
    <Panel label="Postseason" className={className}>
      <p className="font-mono text-sm tabular-nums">
        {rec(p.wins, p.losses, p.ties)}
        <span className="ml-2 text-xs text-muted-foreground">
          all-time · {berths.size} berths in {d.identity.seasonsPlayed} seasons
        </span>
      </p>

      <dl className="mt-3 flex flex-col">
        {p.byRound.map((r) => {
          const perfect = r.losses === 0 && r.wins > 0;
          return (
            <div
              key={r.round}
              className="flex items-baseline justify-between gap-4 border-b border-border py-2 last:border-0"
            >
              <dt className="text-sm">{r.label}</dt>
              <dd className="flex items-baseline gap-2">
                {perfect && (
                  <span className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted-foreground">
                    unbeaten
                  </span>
                )}
                <span className="font-mono text-sm tabular-nums">
                  {r.wins}-{r.losses}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>

      <div className="mt-4">
        <ol className="flex flex-wrap gap-1">
          {seasons.map((year) => {
            const champ = titles.has(year);
            const lost = !champ && finals.has(year);
            const made = berths.has(year);
            const running = live.has(year);
            return (
              <li
                key={year}
                title={`${year} · ${champ ? 'champion' : lost ? 'lost the final' : made ? 'made the playoffs' : running ? 'still being played' : 'missed'}`}
                className={cn(
                  'flex h-6 w-8 items-center justify-center font-mono text-[0.6rem] tabular-nums',
                  champ
                    ? 'bg-foreground text-background'
                    : lost
                      ? 'border border-foreground text-foreground'
                      : made
                        ? 'bg-muted text-foreground'
                        : running
                          ? 'border-muted-foreground/50 border border-dashed text-muted-foreground'
                          : 'text-muted-foreground/45'
                )}
              >
                {String(year).slice(2)}
              </li>
            );
          })}
        </ol>
        <p className="mt-3 font-mono text-[0.7rem] text-muted-foreground">
          Filled = champion · outlined = lost the final · shaded = reached the
          playoffs{live.size > 0 && ' · dashed = still being played'}
        </p>
      </div>
    </Panel>
  );
}
