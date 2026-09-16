'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface SwitcherTeam {
  teamId: number;
  name: string;
  shortName: string | null;
  logo?: { url: string; alt: string } | null;
}

/**
 * The lateral browse rail. Every franchise is a sliver; the active one opens to
 * show its full crest, and hovering another previews it in colour without
 * collapsing the current selection.
 *
 * Below `lg` the vertical accordion has nowhere to go, so it becomes a
 * horizontal strip of crests above the content.
 */
export function TeamSwitcher({ teams, activeId }: { teams: SwitcherTeam[]; activeId: number }) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <>
      {/* Vertical accordion, lg and up */}
      <nav
        aria-label="Teams"
        className="sticky top-0 hidden h-[calc(100vh-4rem)] w-[13.5rem] shrink-0 flex-col border-r border-border lg:flex"
      >
        {teams.map(team => {
          const active = team.teamId === activeId;
          const lit = active || hovered === team.teamId;
          return (
            <Link
              key={team.teamId}
              href={`/teams/${team.teamId}`}
              aria-current={active ? 'page' : undefined}
              onMouseEnter={() => setHovered(team.teamId)}
              onMouseLeave={() => setHovered(null)}
              className={cn(
                'group relative block overflow-hidden border-b border-border transition-[flex-grow] duration-300 ease-out',
                active ? 'flex-[8]' : 'flex-[1] hover:flex-[1.6]'
              )}
            >
              {team.logo?.url ? (
                <Image
                  src={team.logo.url}
                  alt=""
                  fill
                  sizes="216px"
                  className={cn(
                    'object-cover transition-all duration-300',
                    lit ? 'opacity-100 saturate-100' : 'opacity-30 saturate-0 group-hover:opacity-60'
                  )}
                />
              ) : (
                <span className="absolute inset-0 bg-muted" />
              )}
              <span className="sr-only">{team.name}</span>
              {active && (
                <span className="absolute bottom-2 left-2 font-mono text-[0.6rem] font-medium uppercase tracking-[0.12em] text-white mix-blend-difference">
                  {team.shortName ?? team.name}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Horizontal strip, below lg */}
      <nav aria-label="Teams" className="flex gap-1 overflow-x-auto border-b border-border px-4 py-2 lg:hidden">
        {teams.map(team => {
          const active = team.teamId === activeId;
          return (
            <Link
              key={team.teamId}
              href={`/teams/${team.teamId}`}
              aria-current={active ? 'page' : undefined}
              title={team.name}
              className={cn(
                'relative h-11 w-11 shrink-0 overflow-hidden rounded-sm border transition-opacity',
                active ? 'border-foreground opacity-100' : 'border-transparent opacity-40'
              )}
            >
              {team.logo?.url ? (
                <Image src={team.logo.url} alt="" fill sizes="44px" className="object-cover" />
              ) : (
                <span className="absolute inset-0 bg-muted" />
              )}
              <span className="sr-only">{team.name}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
