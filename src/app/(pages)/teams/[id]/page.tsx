import { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';

import { cn } from '@/lib/utils';
import { loadTeamDossier, deriveObservations } from '@/lib/teams';
import { getTeamProfiles } from '@/lib/contentful/api';
import { getTeams } from '@/lib/supabase/api';

import { HonorBanners, type Honor } from '@/components/team/HonorBanners';
import { Observations } from '@/components/team/Observations';
import {
  TeamSwitcher,
  type SwitcherTeam,
} from '@/components/team/TeamSwitcher';
import {
  ScoringIndexChart,
  LuckChart,
  type SeasonPoint,
  type LuckPoint,
} from '@/components/team/charts';
import {
  Panel,
  Vitals,
  RecentForm,
  TrophyCase,
  SeasonTable,
  HeadToHead,
  FranchiseRecords,
  Postseason,
} from '@/components/team/panels';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { id } = await props.params;
  const profiles = await getTeamProfiles();
  const team = profiles.find((t) => String(t.teamId) === id);
  if (!team) return { title: 'Team not found | JADDL' };
  return {
    title: `${team.teamName} | JADDL`,
    description: `Franchise record, honors, scoring and head-to-head history for ${team.teamName}.`,
    openGraph: { images: team.logo?.url ? [team.logo.url] : undefined },
  };
}

export default async function TeamPage(props: Props) {
  const { id } = await props.params;
  const teamId = Number(id);
  if (!Number.isFinite(teamId)) notFound();

  const [dossier, profiles, teams] = await Promise.all([
    loadTeamDossier(teamId),
    getTeamProfiles(),
    getTeams(),
  ]);
  if (!dossier) notFound();

  const profile = profiles.find((t) => t.teamId === teamId);
  const d = dossier;

  // The switcher lists active franchises in league order.
  const switcherTeams: SwitcherTeam[] = teams.flatMap((t) => {
    const p = profiles.find((x) => x.teamId === t.team_id);
    if (!p || p.active === false) return [];
    return [
      {
        teamId: t.team_id,
        name: p.teamName,
        shortName: p.shortName ?? null,
        logo: p.logo ?? null,
      },
    ];
  });

  // Championships first, then group titles; each most-recent first.
  const honors: Honor[] = [
    ...[...d.honors.championships]
      .sort((a, b) => b - a)
      .map((year) => ({ kind: 'championship' as const, year })),
    ...[...d.honors.groupTitles]
      .sort((a, b) => b.year - a.year)
      .map((t) => ({
        kind: 'group' as const,
        year: t.year,
        label: t.groupName,
      })),
  ];

  const seasonPoints: SeasonPoint[] = d.seasons.map((s) => ({
    year: s.year,
    index: s.scoringIndex,
    record: `${s.wins}-${s.losses}${s.ties ? `-${s.ties}` : ''}`,
    outcome:
      s.playoffResult?.outcome === 'won-title'
        ? 'won-title'
        : s.playoffResult?.outcome === 'lost-final'
          ? 'lost-final'
          : s.madePlayoffs
            ? 'made-playoffs'
            : 'missed',
    finish: s.finish,
    teams: s.teamsInLeague,
  }));

  const luckPoints: LuckPoint[] = d.luck.bySeason.map((s) => ({
    year: s.year,
    delta: s.luckDelta,
    actual: s.actualWins,
    expected: s.expectedWins,
  }));

  // The mockup is pinned top and bottom, so its height is fixed and its width
  // follows the asset's own aspect. Those differ a lot — 0.617 for one of these
  // and 0.784 for another — so a FIXED lane gives every team a different lap:
  // measured, the wider figure lapped 91px over the cards while the narrower
  // one left an 8px gap and never touched them.
  //
  // The lane therefore follows the asset. FIGURE_HEIGHT is the pinned height of
  // the vitals + chart rows and EDGE_OFFSET the constant between the lane's
  // edge and the card's; both were measured rather than derived, so re-measure
  // if the rows above change height.
  const mockup = profile?.uniformMockup ?? null;
  const FIGURE_HEIGHT = 596;
  const EDGE_OFFSET = 72;
  const LAP = 24;
  const lane =
    mockup?.width && mockup.height
      ? Math.round(
          (mockup.width / mockup.height) * FIGURE_HEIGHT - LAP - EDGE_OFFSET
        )
      : null;
  const currentGroup = d.seasons[d.seasons.length - 1]?.groupName;
  const eyebrow = [currentGroup, d.identity.owner, d.identity.location]
    .filter(Boolean)
    .join(' · ');
  const allPlay = d.luck.allPlay;
  const observations = deriveObservations(d);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <TeamSwitcher teams={switcherTeams} activeId={teamId} />

      <main className="min-w-0 flex-1">
        {/* Header — name left, honor rail right, both on one row above lg */}
        <header className="flex flex-col gap-4 border-b border-border px-4 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
          <div className="min-w-0">
            {eyebrow && (
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">
                {eyebrow}
              </p>
            )}
            <h1 className="mt-1 text-balance text-3xl font-light leading-[1.05] tracking-tight sm:text-4xl lg:text-5xl">
              {d.identity.currentName}
            </h1>
            {d.identity.formerNames.length > 0 && (
              <p className="mt-2 max-w-prose font-mono text-[0.7rem] text-muted-foreground">
                formerly {d.identity.formerNames.join(' → ')}
              </p>
            )}
          </div>
          <div className="lg:pb-1">
            <HonorBanners honors={honors} />
          </div>
        </header>

        <div className="relative">
          <div className="relative z-10 flex flex-col gap-3 px-4 py-5 sm:px-6">
            <div
              className={cn(
                'relative flex flex-col gap-3',
                mockup?.url && 'xl:pr-[23.5rem] 2xl:pr-[26.5rem]'
              )}
            >
              {/* Uniform mockup: a fixed-width lane, figure pinned to its top,
                  left and bottom, in front of the panels.

                  `-top-11` clears the 20px of column padding and reaches 24px
                  up over the row above; `-bottom-3` eats the flex gap so the
                  figure's feet land exactly on the top of the card below. Those
                  two fix the height, so the width follows the asset's aspect.

                  The figure FILLS that lane — `object-cover` anchored top-left,
                  so every edge of the lane is a hard edge for every team and
                  the asset's aspect is absorbed by cropping the bottom rather
                  than by moving anything. A narrow asset simply loses more of
                  its legs.

                  Decorative and click-through. */}
              {mockup?.url && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute -bottom-3 -right-6 -top-11 z-20 hidden w-[30rem] select-none overflow-hidden xl:block 2xl:w-[33rem]"
                >
                  <Image
                    src={mockup.url}
                    alt=""
                    fill
                    priority
                    sizes="(min-width: 1536px) 528px, 480px"
                    className="object-cover object-left-top"
                  />
                </div>
              )}

              <Vitals d={d} />

              <Panel label="Season by season · scoring index against par">
                <div className="h-64 sm:h-72 xl:h-80">
                  <ScoringIndexChart
                    data={seasonPoints}
                    insetRight={mockup?.url ? 96 : 8}
                  />
                </div>
                <p className="mt-3 font-mono text-[0.7rem] leading-relaxed text-muted-foreground">
                  100 is the league&rsquo;s scoring level for that season, so
                  seasons far apart compare directly. Marker weight is how far
                  the postseason went.
                </p>
              </Panel>
            </div>

            <div className="grid gap-3 xl:grid-cols-[1.55fr_1fr]">
              <Panel label="Luck · wins above and below expectation">
                <div className="h-52 sm:h-56">
                  <LuckChart data={luckPoints} />
                </div>
                <p className="mt-3 font-mono text-[0.7rem] leading-relaxed text-muted-foreground">
                  All-play {allPlay.wins}-{allPlay.losses}
                  {allPlay.ties ? `-${allPlay.ties}` : ''} (
                  {allPlay.winPct.toFixed(3).replace(/^0/, '')}) · earned{' '}
                  {d.luck.expectedWins} wins, took {d.luck.actualWins} ·{' '}
                  <span className="font-medium text-foreground">
                    {d.luck.luckDelta > 0 ? '+' : '−'}
                    {Math.abs(d.luck.luckDelta).toFixed(1)} career
                  </span>
                </p>
              </Panel>

              <div className="flex min-w-0 flex-col gap-3">
                <RecentForm d={d} />
                <TrophyCase d={d} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 px-4 pb-10 sm:px-6">
          <Observations observations={observations} />
          <SeasonTable d={d} />
          {/* Head-to-head is the tall one, so it spans both rows and the
              right column stacks records over the postseason résumé. */}
          <div className="grid gap-3 xl:grid-cols-2 xl:grid-rows-[auto_1fr]">
            <HeadToHead d={d} className="xl:row-span-2" />
            <FranchiseRecords d={d} />
            <Postseason d={d} />
          </div>
          <p className="font-mono text-[0.7rem] leading-relaxed text-muted-foreground">
            {d.eraNote}
          </p>
        </div>
      </main>
    </div>
  );
}
