'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { User, Trophy, Calendar, ChevronRight } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ProcessedTeamProfile } from '@/types/contentful';

function TeamsPageClient() {
  const [showInactive, setShowInactive] = useState(false);
  const [teams, setTeams] = useState<ProcessedTeamProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch teams data on component mount
  React.useEffect(() => {
    async function fetchTeams() {
      try {
        const { getTeamProfiles } = await import('@/lib/contentful/api');
        const contentfulTeams = await getTeamProfiles();
        setTeams(contentfulTeams);
      } catch (error) {
        console.error('Failed to fetch teams:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTeams();
  }, []);

  // Filter teams based on active status
  const filteredTeams = teams.filter(team => 
    showInactive ? true : team.active !== false
  );

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading teams...</p>
        </div>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <Trophy className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Teams Found</h3>
          <p className="text-muted-foreground">
            No teams have been configured in Contentful yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-4">League Teams</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Meet the teams competing in the JADDL fantasy football league. Each team brings its own unique 
          strategy and competitive spirit to make this league exciting week after week.
        </p>

        {/* Show Inactive Teams Switch */}
        <div className="mt-6 flex items-center justify-center gap-3">
          <div className="flex items-center space-x-2">
            <Switch 
              id="show-inactive" 
              checked={showInactive}
              onCheckedChange={setShowInactive}
              className="data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-200 data-[state=unchecked]:border data-[state=unchecked]:border-gray-300 [&>span]:border [&>span]:border-gray-300 [&>span]:bg-white"
            />
            <Label htmlFor="show-inactive" className="text-sm font-medium cursor-pointer">
              Show inactive teams
            </Label>
          </div>
        </div>
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {filteredTeams.map((team) => (
          <Card key={team.id} className="hover:shadow-lg transition-shadow group">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 flex items-center justify-center">
                    {team.logo ? (
                      <Image
                        src={team.logo.url}
                        alt={`${team.teamName} logo`}
                        width={48}
                        height={48}
                        className="rounded-lg"
                      />
                    ) : (
                      <span className="text-3xl">🏈</span>
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-lg group-hover:text-primary transition-colors">
                      {team.teamName}
                    </CardTitle>
                    <div className="text-sm text-muted-foreground">{team.shortName}</div>
                  </div>
                </div>
                {team.active === false && (
                  <div className="px-2 py-1 text-xs font-medium rounded-full border bg-muted text-muted-foreground">
                    Inactive
                  </div>
                )}
              </div>
              {team.yearEstablished && (
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Established {team.yearEstablished}</span>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Team information from Contentful */}
              <div className="bg-muted rounded-lg p-3">
                <div className="text-sm font-medium text-foreground mb-2">
                  Team Information
                </div>
                <div className="space-y-1 text-sm">
                  <div><span className="text-muted-foreground">Name:</span> {team.teamName}</div>
                  <div><span className="text-muted-foreground">Short Name:</span> {team.shortName}</div>
                  {team.yearEstablished && (
                    <div><span className="text-muted-foreground">Established:</span> {team.yearEstablished}</div>
                  )}
                </div>
              </div>

              {/* View Details Button */}
              <div className="pt-2">
                <Button variant="ghost" className="w-full group-hover:bg-muted" asChild>
                  <a href={`/teams/${team.teamId}`}>
                    View Team Details <ChevronRight className="h-4 w-4 ml-1" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator className="my-8" />

      {/* League Stats */}
      <div className="text-center space-y-6">
        <h2 className="text-2xl font-bold text-foreground">League Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6 text-center">
              <Trophy className="h-8 w-8 text-foreground mx-auto mb-2" />
              <div className="text-2xl font-bold text-foreground">
                {teams.filter(t => t.active !== false).length}
              </div>
              <div className="text-sm text-muted-foreground">Active Teams</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <User className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <div className="text-2xl font-bold text-muted-foreground">
                {teams.filter(t => t.active === false).length}
              </div>
              <div className="text-sm text-muted-foreground">Inactive Teams</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <Calendar className="h-8 w-8 text-foreground mx-auto mb-2" />
              <div className="text-2xl font-bold text-foreground">2024</div>
              <div className="text-sm text-muted-foreground">Current Season</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <User className="h-8 w-8 text-foreground mx-auto mb-2" />
              <div className="text-2xl font-bold text-foreground">
                {teams.length}
              </div>
              <div className="text-sm text-muted-foreground">Total Teams</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Server component wrapper
export default function TeamsPage() {
  return <TeamsPageClient />;
}