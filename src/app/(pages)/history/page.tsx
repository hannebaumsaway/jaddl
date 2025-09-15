import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { Trophy, Crown, Star, Target, Calendar, TrendingUp, Swords, ThumbsUp, ThumbsDown } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { getLeagueHistory } from '@/lib/supabase/history';
import { getTeams } from '@/lib/supabase/api';
import Image from 'next/image';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';

export const metadata: Metadata = {
  title: 'League History',
  description: 'Explore the complete history of the JADDL fantasy football league, including past champions, records, and memorable moments.',
};

// Removed static milestones and rivalries; now sourced from Supabase

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default async function HistoryPage() {
  // Fetch real league history data and teams
  const [leagueHistory, teams] = await Promise.all([
    getLeagueHistory(),
    getTeams()
  ]);

  // Helper function to get team ID from team name
  const getTeamIdFromName = (teamName: string): number | null => {
    const team = teams.find(t => t.team_name === teamName);
    return team ? team.team_id : null;
  };

  // Helper component for team links
  const TeamLink = ({ teamName, children }: { teamName: string; children: React.ReactNode }) => {
    const teamId = getTeamIdFromName(teamName);
    if (teamId) {
      return (
        <Link href={`/teams/${teamId}`} className="text-primary hover:text-primary/80 hover:underline">
          {children}
        </Link>
      );
    }
    return <span>{children}</span>;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-4">League History</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Explore the complete history of the JADDL fantasy football league, 
          including past champions, records, and memorable moments.
        </p>
      </div>

      {/* Champions Section */}
      <section className="mb-12 py-4">
        <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center">
          <Trophy className="h-6 w-6 mr-2" />
          League Champions
        </h2>
        <div className="w-full max-w-[calc(100vw-8rem)] mx-auto">
          <Carousel 
            className="w-full" 
            opts={{
              align: "start",
              loop: false,
            }}
          >
          <CarouselContent className="-ml-2 md:-ml-4 p-2">
            {leagueHistory.champions.map((champion, index) => (
              <CarouselItem key={champion.year} className="pl-2 md:pl-4 basis-[280px]">
                <Card className={`h-full ${index === 0 ? 'ring-2 ring-yellow-400 bg-yellow-50' : ''}`}>
                  <CardContent className="p-6 text-center">
                    <div className="mb-2 flex justify-center">
                      {champion.logo && champion.logo !== '🏈' ? (
                        <Image
                          src={champion.logo}
                          alt={`${champion.team} logo`}
                          width={48}
                          height={48}
                          className="w-12 h-12 object-contain"
                        />
                      ) : (
                        <div className="text-3xl">🏈</div>
                      )}
                    </div>
                    <div className="text-lg font-bold text-foreground">{champion.year}</div>
                    <div className="font-semibold text-foreground">
                      <TeamLink teamName={champion.team}>{champion.team}</TeamLink>
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">{champion.owner}</div>
                    <div className="text-xs text-muted-foreground">
                      Regular: {champion.record}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Playoffs: {champion.playoffRecord}
                    </div>
                    {index === 0 && (
                      <div className="mt-2">
                        <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                          Defending Champ
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
        </div>
      </section>

      {/* Records Section */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center">
          <Star className="h-6 w-6 mr-2" />
          League Records
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Season Records</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Highest Season Score</span>
                <div className="text-right">
                  <div className="font-bold text-foreground">
                    {leagueHistory.seasonRecords.highestSeasonScore.value}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <TeamLink teamName={leagueHistory.seasonRecords.highestSeasonScore.team}>
                      {leagueHistory.seasonRecords.highestSeasonScore.team}
                    </TeamLink> ({leagueHistory.seasonRecords.highestSeasonScore.year})
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Most Wins</span>
                <div className="text-right">
                  <div className="font-bold text-foreground">
                    {leagueHistory.seasonRecords.mostWins.value}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <TeamLink teamName={leagueHistory.seasonRecords.mostWins.team}>
                      {leagueHistory.seasonRecords.mostWins.team}
                    </TeamLink> ({leagueHistory.seasonRecords.mostWins.year})
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Best Win %</span>
                <div className="text-right">
                  <div className="font-bold text-foreground">
                    {leagueHistory.seasonRecords.bestWinPercentage.value.toFixed(3)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <TeamLink teamName={leagueHistory.seasonRecords.bestWinPercentage.team}>
                      {leagueHistory.seasonRecords.bestWinPercentage.team}
                    </TeamLink> ({leagueHistory.seasonRecords.bestWinPercentage.year})
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Game Records</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Highest Single Game</span>
                <div className="text-right">
                  <div className="font-bold text-foreground">
                    {leagueHistory.gameRecords.highestSingleGame.value}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <TeamLink teamName={leagueHistory.gameRecords.highestSingleGame.team}>
                      {leagueHistory.gameRecords.highestSingleGame.team}
                    </TeamLink> (Week {leagueHistory.gameRecords.highestSingleGame.week}, {leagueHistory.gameRecords.highestSingleGame.year})
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Biggest Blowout</span>
                <div className="text-right">
                  <div className="font-bold text-foreground">
                    {leagueHistory.gameRecords.biggestBlowout.value}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <TeamLink teamName={leagueHistory.gameRecords.biggestBlowout.team}>
                      {leagueHistory.gameRecords.biggestBlowout.team}
                    </TeamLink> over <TeamLink teamName={leagueHistory.gameRecords.biggestBlowout.opponent}>
                      {leagueHistory.gameRecords.biggestBlowout.opponent}
                    </TeamLink> (Week {leagueHistory.gameRecords.biggestBlowout.week}, {leagueHistory.gameRecords.biggestBlowout.year})
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Closest Game</span>
                <div className="text-right">
                  <div className="font-bold text-foreground">
                    {leagueHistory.gameRecords.closestGame.value.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <TeamLink teamName={leagueHistory.gameRecords.closestGame.team}>
                      {leagueHistory.gameRecords.closestGame.team}
                    </TeamLink> over <TeamLink teamName={leagueHistory.gameRecords.closestGame.opponent}>
                      {leagueHistory.gameRecords.closestGame.opponent}
                    </TeamLink> (Week {leagueHistory.gameRecords.closestGame.week}, {leagueHistory.gameRecords.closestGame.year})
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* All-Time Leaders */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center">
          <TrendingUp className="h-6 w-6 mr-2" />
          All-Time Leaders
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">All-Time Win %</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {leagueHistory.allTime.winPctLeaders.map((row, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <TeamLink teamName={row.team}>
                      <span className="text-foreground">{row.team}</span>
                    </TeamLink>
                    <span className="font-mono">{row.percentage.toFixed(3)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">All-Time PPG</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {leagueHistory.allTime.ppgLeaders.map((row, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <TeamLink teamName={row.team}>
                      <span className="text-foreground">{row.team}</span>
                    </TeamLink>
                    <span className="font-mono">{row.ppg.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Streaks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              {leagueHistory.allTime.longestWinStreak && (
                <div className="text-center">
                  <div className="text-sm text-muted-foreground mb-2 flex items-center justify-center gap-1">
                    <ThumbsUp className="h-4 w-4" />
                    Longest Winning Streak
                  </div>
                  <div className="text-4xl font-bold text-foreground mb-3 font-mono">
                    {leagueHistory.allTime.longestWinStreak.length}
                  </div>
                  <div className="text-sm text-foreground mb-1">
                    <TeamLink teamName={leagueHistory.allTime.longestWinStreak.team}>
                      {leagueHistory.allTime.longestWinStreak.team}
                    </TeamLink>
                  </div>
                  {leagueHistory.allTime.longestWinStreak.span && (
                    <div className="text-xs text-muted-foreground">
                      {leagueHistory.allTime.longestWinStreak.span}
                    </div>
                  )}
                </div>
              )}
              {leagueHistory.allTime.longestLosingStreak && (
                <div className="text-center">
                  <div className="text-sm text-muted-foreground mb-2 flex items-center justify-center gap-1">
                    <ThumbsDown className="h-4 w-4" />
                    Longest Losing Streak
                  </div>
                  <div className="text-4xl font-bold text-foreground mb-3 font-mono">
                    {leagueHistory.allTime.longestLosingStreak.length}
                  </div>
                  <div className="text-sm text-foreground mb-1">
                    <TeamLink teamName={leagueHistory.allTime.longestLosingStreak.team}>
                      {leagueHistory.allTime.longestLosingStreak.team}
                    </TeamLink>
                  </div>
                  {leagueHistory.allTime.longestLosingStreak.span && (
                    <div className="text-xs text-muted-foreground">
                      {leagueHistory.allTime.longestLosingStreak.span}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Milestones */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center">
          <Calendar className="h-6 w-6 mr-2" />
          League Milestones
        </h2>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {(leagueHistory.milestones || []).map((milestone, index) => (
                <div key={`${milestone.title}-${index}`} className="flex items-start space-x-4 pb-4 border-b border-border last:border-b-0">
                  <div className="text-sm text-muted-foreground font-medium min-w-[64px]">
                    {milestone.title}
                  </div>
                  <div className="flex-1">
                    {milestone.description && <p className="text-sm text-muted-foreground">{milestone.description}</p>}
                  </div>
                </div>
              ))}
              {(!leagueHistory.milestones || leagueHistory.milestones.length === 0) && (
                <div className="text-sm text-muted-foreground">No milestones available.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Rivalries */}
      <section>
        <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center">
          <Swords className="h-6 w-6 mr-2" />
          Historic Rivalries
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(leagueHistory.rivalries || []).map((rivalry, index) => (
            <Card key={`${rivalry.name}-${index}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{rivalry.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-sm">
                    <div className="font-medium text-foreground">
                      <TeamLink teamName={rivalry.teams?.[0] || ''}>{rivalry.teams?.[0]}</TeamLink> vs <TeamLink teamName={rivalry.teams?.[1] || ''}>{rivalry.teams?.[1]}</TeamLink>
                    </div>
                    <div className="text-muted-foreground">{rivalry.record}</div>
                  </div>
                  {rivalry.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {rivalry.description}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {(!leagueHistory.rivalries || leagueHistory.rivalries.length === 0) && (
            <div className="text-sm text-muted-foreground">No rivalries available.</div>
          )}
        </div>
      </section>
    </div>
  );
}
