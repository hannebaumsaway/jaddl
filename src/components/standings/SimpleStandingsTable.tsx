'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card className={isSubTable ? "bg-muted/30" : "bg-card"}>
      <CardHeader>
        <CardTitle className={`font-semibold tracking-tight text-center ${
          isSubTable ? 'text-lg' : 'text-xl'
        }`}>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto" ref={scrollContainerRef}>
          <table className="w-full table-auto min-w-[600px]">
            <thead className="sticky top-0 z-10 bg-background">
              <tr className="border-b">
                <th className="text-left py-2 px-2 font-medium text-muted-foreground w-10">#</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground w-32 sticky left-0 z-20 bg-background">Team</th>
                <th className="text-center py-2 px-2 font-medium text-muted-foreground w-36 whitespace-nowrap">Record</th>
                <th className="text-center py-2 px-2 font-medium text-muted-foreground font-mono w-20">PF</th>
                <th className="text-center py-2 px-2 font-medium text-muted-foreground font-mono w-20">PA</th>
                <th className="text-center py-2 px-2 font-medium text-muted-foreground font-mono w-20">+/-</th>
              </tr>
            </thead>
            <tbody>
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
                  <tr 
                    key={record.team_id} 
                    className={`${isLastRow ? '' : 'border-b border-border/50'} hover:bg-muted/50`}
                  >
                    <td className="py-3 px-2">
                      <span className="font-mono text-sm text-muted-foreground">
                        {index + 1}
                      </span>
                    </td>
                    <td className="py-3 px-2 align-top sticky left-0 z-10 bg-background">
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
                    </td>
                    <td className="text-center py-3 px-2 font-mono text-foreground font-semibold whitespace-nowrap w-36">
                      {record.wins}-{record.losses}-{record.ties}
                      {' '}
                      <span className="text-muted-foreground">({groupWins}-{groupLosses}-{groupTies})</span>
                    </td>
                    <td className="text-center py-3 px-2 font-mono text-foreground w-20">
                      {record.points_for.toFixed(1)}
                    </td>
                    <td className="text-center py-3 px-2 font-mono text-foreground w-20">
                      {record.points_against.toFixed(1)}
                    </td>
                    <td className={`text-center py-3 px-2 font-mono font-semibold ${
                      record.point_differential > 0 ? 'text-green-600' : 
                      record.point_differential < 0 ? 'text-red-600' : 'text-foreground'
                    }`}>
                      {record.point_differential > 0 ? '+' : ''}{record.point_differential.toFixed(1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
