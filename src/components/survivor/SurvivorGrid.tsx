'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SurvivorData } from '@/lib/supabase/api';
import { ProcessedTeamProfile } from '@/types/contentful';
import Image from 'next/image';

interface SurvivorGridProps {
  survivorData: SurvivorData[];
  teamProfiles: ProcessedTeamProfile[];
  teamEliminationMap: Map<number, number | null>;
}

export function SurvivorGrid({ survivorData, teamProfiles, teamEliminationMap }: SurvivorGridProps) {
  if (survivorData.length === 0) return null;

  // Get all weeks from the survivor data
  const weeks = survivorData.map(w => w.eliminationWeek || 1).sort((a, b) => a - b);
  const maxWeeks = Math.max(...weeks);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center">Survivor Elimination Grid</CardTitle>
        <p className="text-center text-sm text-muted-foreground">
          Each week shows teams ordered by that week's performance (highest to lowest). Faded teams are eliminated.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-full">
            {/* Week Columns - Each week shows teams ordered by that week's performance */}
            <div className="flex gap-3 pb-4" style={{ width: `${maxWeeks * 180}px` }}>
              {Array.from({ length: maxWeeks }, (_, i) => i + 1).map(week => {
                const weekData = survivorData.find(w => (w.eliminationWeek || 1) === week);
                if (!weekData) return null;

                // Sort teams by their score for this week (descending)
                const teamsForWeek = [...weekData.teams].sort((a, b) => (b.score || 0) - (a.score || 0));

                return (
                  <div key={week} className="border rounded-lg p-3 flex-shrink-0" style={{ width: '160px' }}>
                    {/* Week Header */}
                    <div className="text-center mb-3">
                      <h3 className="text-sm font-semibold">Week {week}</h3>
                      <Badge variant="outline" className="text-xs mt-1">
                        {teamsForWeek.length}
                      </Badge>
                    </div>

                    {/* Teams for this week, ordered by performance */}
                    <div className="space-y-1">
                      {teamsForWeek.map((team, index) => {
                        const teamProfile = teamProfiles.find(tp => tp.teamId === team.team_id);
                        const eliminationWeek = teamEliminationMap.get(team.team_id);
                        const isEliminated = eliminationWeek !== undefined;
                        const wasEliminatedThisWeek = weekData.eliminationWeek === week && team.eliminated;

                        return (
                          <div
                            key={`${week}-${team.team_id}`}
                            className={`
                              border rounded p-2 text-center transition-all
                              ${isEliminated && eliminationWeek !== week
                                ? 'bg-gray-100 border-gray-200 opacity-50' 
                                : 'bg-white border-gray-300 hover:shadow-sm'
                              }
                              ${wasEliminatedThisWeek ? 'ring-2 ring-red-500 bg-red-50' : ''}
                            `}
                          >
                            {/* Team Logo */}
                            <div className="flex justify-center mb-1">
                              {teamProfile?.logo ? (
                                <div className="relative w-6 h-6">
                                  <Image
                                    src={teamProfile.logo.url}
                                    alt={teamProfile.teamName}
                                    fill
                                    className={`object-contain ${isEliminated && eliminationWeek !== week ? 'grayscale' : ''}`}
                                  />
                                </div>
                              ) : (
                                <div className={`w-6 h-6 bg-gray-200 rounded flex items-center justify-center text-xs font-bold ${isEliminated && eliminationWeek !== week ? 'grayscale' : ''}`}>
                                  {teamProfile?.shortName?.charAt(0) || '?'}
                                </div>
                              )}
                            </div>

                            {/* Team Name */}
                            <div className={`text-xs font-medium mb-1 ${isEliminated && eliminationWeek !== week ? 'text-gray-500' : 'text-gray-900'}`}>
                              {teamProfile?.shortName || team.team?.team_name || `T${team.team_id}`}
                            </div>

                            {/* Score */}
                            <div className={`text-xs font-bold ${isEliminated && eliminationWeek !== week ? 'text-gray-500' : 'text-blue-600'}`}>
                              {team.score?.toFixed(1) || 'N/A'}
                            </div>

                            {/* Elimination Status */}
                            {wasEliminatedThisWeek && (
                              <div className="text-xs text-red-500 font-medium mt-1">
                                ELIM
                              </div>
                            )}
                            {isEliminated && eliminationWeek !== week && (
                              <div className="text-xs text-gray-500 mt-1">
                                W{eliminationWeek}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-6 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-white border border-gray-300 rounded"></div>
              <span>Active Team</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-100 border border-gray-200 rounded opacity-50"></div>
              <span>Eliminated Team</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-50 border border-red-500 rounded ring-2 ring-red-500"></div>
              <span>Elimination Week</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}