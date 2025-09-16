'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Target, TrendingDown, Clock } from 'lucide-react';
import { SurvivorData } from '@/lib/supabase/api';
import { ProcessedTeamProfile } from '@/types/contentful';

interface SurvivorStatsProps {
  survivorData: SurvivorData[];
  teamProfiles: ProcessedTeamProfile[];
}

export function SurvivorStats({ survivorData, teamProfiles }: SurvivorStatsProps) {
  if (survivorData.length === 0) return null;

  // Calculate stats
  const allTeams = survivorData[0]?.teams || [];
  const totalTeams = allTeams.length;
  const totalWeeks = survivorData.length;
  
  // Find the winner (last team standing)
  const winner = allTeams.find(team => {
    const eliminatedWeeks = survivorData.filter(week => 
      week.teams.some(t => t.team_id === team.team_id && t.eliminated)
    );
    return eliminatedWeeks.length === 0;
  });

  // Find teams with lowest scores each week
  const weeklyEliminations = survivorData.map(week => {
    const eliminatedTeam = week.teams.find(t => t.eliminated);
    const teamProfile = teamProfiles.find(tp => tp.teamId === eliminatedTeam?.team_id);
    return {
      week: week.eliminationWeek || 1,
      team: teamProfile || eliminatedTeam?.team,
      score: eliminatedTeam?.score || 0
    };
  });

  // Calculate average elimination score
  const avgEliminationScore = weeklyEliminations.reduce((sum, elim) => sum + elim.score, 0) / weeklyEliminations.length;

  // Find highest elimination score (best performance by eliminated team)
  const highestEliminationScore = Math.max(...weeklyEliminations.map(elim => elim.score));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Winner Card */}
      {winner && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <Trophy className="h-5 w-5" />
              Survivor Champion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-3">
              {(() => {
                const winnerProfile = teamProfiles.find(tp => tp.teamId === winner.team_id);
                return (
                  <>
                    {winnerProfile?.logo && (
                      <div className="relative w-12 h-12">
                        <img
                          src={winnerProfile.logo.url}
                          alt={winnerProfile.teamName}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-lg text-green-900">
                        {winnerProfile?.teamName || winner.team?.team_name || `Team ${winner.team_id}`}
                      </h3>
                      <p className="text-sm text-green-700">
                        Survived all {totalWeeks} weeks without being eliminated
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weekly Eliminations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Weekly Eliminations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {weeklyEliminations.map((elimination, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="text-xs">
                    Week {elimination.week}
                  </Badge>
                  <span className="text-sm font-medium">
                    {'teamName' in (elimination.team || {}) 
                      ? (elimination.team as any).teamName 
                      : ('name' in (elimination.team || {}) 
                        ? (elimination.team as any).name 
                        : `Team ${elimination.team?.team_id || 'Unknown'}`)}
                  </span>
                </div>
                <div className="text-sm text-red-600 font-bold">
                  {elimination.score.toFixed(1)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Competition Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Total Teams:</span>
              <span className="font-medium">{totalTeams}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Total Weeks:</span>
              <span className="font-medium">{totalWeeks}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Teams Eliminated:</span>
              <span className="font-medium">{totalTeams - (winner ? 1 : 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Avg Elimination Score:</span>
              <span className="font-medium">{avgEliminationScore.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Highest Elimination Score:</span>
              <span className="font-medium text-green-600">{highestEliminationScore.toFixed(1)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Competition Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Competition Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-sm">
              <span className="font-medium">Started:</span> Week 1 with {totalTeams} teams
            </div>
            <div className="text-sm">
              <span className="font-medium">Format:</span> Lowest scorer eliminated each week
            </div>
            <div className="text-sm">
              <span className="font-medium">Status:</span> 
              {winner ? (
                <span className="text-green-600 ml-1">Completed - Winner Crowned</span>
              ) : (
                <span className="text-yellow-600 ml-1">In Progress</span>
              )}
            </div>
            {winner && (
              <div className="text-sm">
                <span className="font-medium">Final Survivor:</span> 
                <span className="text-green-600 ml-1">
                  {teamProfiles.find(tp => tp.teamId === winner.team_id)?.teamName || 
                   winner.team?.team_name || `Team ${winner.team_id}`}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
