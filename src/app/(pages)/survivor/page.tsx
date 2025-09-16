import React from 'react';
import { Metadata } from 'next';
import { Trophy, Target, Users, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getSurvivorData, getAvailableYears } from '@/lib/supabase/api';
import { getTeamProfiles } from '@/lib/contentful/api';
import { SurvivorGrid } from '@/components/survivor/SurvivorGrid';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Survivor Pool | JADDL Fantasy Football',
  description: 'Track the weekly elimination competition where the lowest scoring team gets eliminated each week.',
};

interface SurvivorPageProps {
  searchParams: { year?: string };
}

export default async function SurvivorPage({ searchParams }: SurvivorPageProps) {
  const selectedYear = searchParams.year ? parseInt(searchParams.year) : new Date().getFullYear();
  
  // Get survivor data and team profiles
  const [survivorData, availableYears, teamProfiles] = await Promise.all([
    getSurvivorData(selectedYear),
    getAvailableYears(),
    getTeamProfiles()
  ]);

  // Get current week data for stats
  const currentWeekData = survivorData[survivorData.length - 1];
  const totalWeeks = survivorData.length;
  const totalTeams = survivorData[0]?.teams.length || 0;
  const remainingTeams = currentWeekData?.teams.filter(t => !t.eliminated).length || 0;
  const eliminatedTeams = totalTeams - remainingTeams;

  // Get all teams with their elimination status
  const allTeams = survivorData[0]?.teams || [];
  const teamEliminationMap = new Map<number, number | null>();
  
  // Find when each team was eliminated
  for (const weekData of survivorData) {
    if (weekData.eliminationWeek) {
      for (const team of weekData.teams) {
        if (team.eliminated && !teamEliminationMap.has(team.team_id)) {
          teamEliminationMap.set(team.team_id, weekData.eliminationWeek);
        }
      }
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center mb-4">
          <Trophy className="h-12 w-12 text-yellow-500 mr-3" />
          <h1 className="text-4xl font-bold text-foreground">Survivor Pool</h1>
        </div>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
          The ultimate test of consistency! Each week, the lowest scoring team is eliminated 
          from the survivor pool. Last team standing wins it all.
        </p>

        {/* Year Selector */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <span className="text-sm font-medium text-muted-foreground">Season:</span>
          <div className="flex gap-2">
            {availableYears.slice(0, 5).map(year => (
              <Button
                key={year}
                variant={year === selectedYear ? "default" : "outline"}
                size="sm"
                asChild
              >
                <Link href={`/survivor?year=${year}`}>
                  {year}
                </Link>
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Teams</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTeams}</div>
            <p className="text-xs text-muted-foreground">
              Started the competition
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Still Alive</CardTitle>
            <Target className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{remainingTeams}</div>
            <p className="text-xs text-muted-foreground">
              Surviving teams
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Eliminated</CardTitle>
            <Trophy className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{eliminatedTeams}</div>
            <p className="text-xs text-muted-foreground">
              Teams eliminated
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Week</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalWeeks}</div>
            <p className="text-xs text-muted-foreground">
              Weeks completed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Survivor Grid */}
      {survivorData.length > 0 ? (
        <SurvivorGrid 
          survivorData={survivorData}
          teamProfiles={teamProfiles}
          teamEliminationMap={teamEliminationMap}
        />
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Trophy className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Survivor Data</h3>
            <p className="text-muted-foreground text-center">
              No survivor data available for {selectedYear}. The competition may not have started yet.
            </p>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
