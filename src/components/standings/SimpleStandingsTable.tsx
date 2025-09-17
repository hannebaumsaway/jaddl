'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TeamRecord } from '@/types/database';
import { EnrichedTeam } from '@/lib/utils/team-mapping';

interface SimpleStandingsTableProps {
  title: string;
  records: TeamRecord[];
  teamLookup: Map<number, EnrichedTeam>;
  isSubTable?: boolean;
}

export function SimpleStandingsTable({ title, records, teamLookup, isSubTable = false }: SimpleStandingsTableProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      setIsScrolled(scrollContainer.scrollLeft > 0);
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold tracking-tight text-center">
        {title}
      </h3>
      <div className="overflow-x-auto" ref={scrollContainerRef}>
        <Table className="min-w-[600px]">
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead className="text-left w-10">#</TableHead>
              <TableHead className="text-left w-32 sticky left-0 z-20 bg-background">Team</TableHead>
              <TableHead className="text-center w-36 whitespace-nowrap">Record</TableHead>
              <TableHead className="text-center font-mono w-20">PF</TableHead>
              <TableHead className="text-center font-mono w-20">PA</TableHead>
              <TableHead className="text-center font-mono w-20">+/-</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
              {records.map((record, index) => {
                const team = teamLookup.get(record.team_id);
                const teamName = team?.teamName || record.team?.team_name || 'Unknown Team';
                const shortName = team?.shortName || record.team?.short_name || 'UNK';
                const logo = team?.logo?.url;
                const isLastRow = index === records.length - 1;
                const hasQuadGroup = (record.quad_wins !== undefined) || (record.quad_losses !== undefined) || (record.quad_ties !== undefined);
                const groupWins = hasQuadGroup ? (record.quad_wins ?? 0) : (record.division_wins ?? 0);
                const groupLosses = hasQuadGroup ? (record.quad_losses ?? 0) : (record.division_losses ?? 0);
                const groupTies = hasQuadGroup ? (record.quad_ties ?? 0) : (record.division_ties ?? 0);
                
                return (
                  <TableRow 
                    key={record.team_id} 
                    className="hover:bg-muted/50"
                  >
                    <TableCell>
                      <span className="font-mono text-sm text-muted-foreground">
                        {index + 1}
                      </span>
                    </TableCell>
                    <TableCell className="sticky left-0 z-10 bg-background">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 flex items-center justify-center">
                          {logo ? (
                            <Image
                              src={logo}
                              alt={`${teamName} logo`}
                              width={32}
                              height={32}
                              className="rounded-lg object-cover"
                            />
                          ) : (
                            <span className="text-xl">🏈</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <Link 
                            href={`/teams/${record.team_id}`}
                            className="font-semibold text-foreground hover:text-primary hover:underline transition-colors leading-tight block truncate"
                            title={teamName}
                          >
                            {isScrolled ? shortName : teamName}
                          </Link>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-mono text-foreground font-semibold whitespace-nowrap">
                      {record.wins}-{record.losses}-{record.ties}
                      {' '}
                      <span className="text-muted-foreground">({groupWins}-{groupLosses}-{groupTies})</span>
                    </TableCell>
                    <TableCell className="text-center font-mono text-foreground">
                      {record.points_for.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-center font-mono text-foreground">
                      {record.points_against.toFixed(1)}
                    </TableCell>
                    <TableCell className={`text-center font-mono font-semibold ${
                      record.point_differential > 0 ? 'text-green-600' : 
                      record.point_differential < 0 ? 'text-red-600' : 'text-foreground'
                    }`}>
                      {record.point_differential > 0 ? '+' : ''}{record.point_differential.toFixed(1)}
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
