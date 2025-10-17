import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { 
  ArrowLeft, 
  Trophy, 
  Target, 
  TrendingUp, 
  Star, 
  Calendar,
  Users,
  Award,
  Zap,
  BarChart3,
  Activity,
  Target as TargetIcon
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  LineChartComponent, 
  AreaChartComponent, 
  BarChartComponent, 
  PieChartComponent
} from '@/components/ui/charts';
import { PerformanceAreaChart } from '@/components/ui/performance-area-chart';
import { WeeklyPerformanceAreaChart } from '@/components/ui/weekly-performance-area-chart';
import { SeasonHistoryDataTable } from '@/components/pages/SeasonHistoryDataTable';
import { RecentForm } from '@/components/pages/RecentForm';
import { AchievementsCard } from '@/components/pages/AchievementsCard';
import { HeadToHeadChart } from '@/components/pages/HeadToHeadChart';
import { CurvedText } from '@/components/ui/curved-text';

import { getTeamProfiles } from '@/lib/contentful/api';
import { 
  getTeamRecords, 
  getAllTimeTeamRecords,
  getGames, 
  getTeamSeasons, 
  getDivisions, 
  getQuads,
  getTrophyCase
} from '@/lib/supabase/api';
import { getTrophies } from '@/lib/contentful/api';
import { TrophyCase } from '@/types/database';

interface TeamDetailPageProps {
  params: {
    id: string;
  };
}

export async function generateMetadata({ params }: TeamDetailPageProps): Promise<Metadata> {
  const contentfulTeams = await getTeamProfiles();
  const team = contentfulTeams.find(t => t.teamId.toString() === params.id);
  
  if (!team) {
    return {
      title: 'Team Not Found',
      description: 'The team you\'re looking for doesn\'t exist.',
    };
  }

  return {
    title: `${team.teamName} - Team Details`,
    description: `Detailed information, stats, and history for ${team.teamName} in the JADDL fantasy football league.`,
  };
}

export default async function TeamDetailPage({ params }: TeamDetailPageProps) {
  const contentfulTeams = await getTeamProfiles();
  const team = contentfulTeams.find(t => t.teamId.toString() === params.id);
  
  if (!team) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Team Not Found</h1>
        <p className="text-muted-foreground mb-4">The team you're looking for doesn't exist.</p>
        <Button asChild>
          <Link href="/teams">Back to Teams</Link>
        </Button>
      </div>
    );
  }

  // Fetch comprehensive all-time data from Supabase
  const allTeamRecords = await getAllTimeTeamRecords(); // Get all years
  const allGames = await getGames(); // Get all years
  const teamSeasons = await getTeamSeasons();
  
  // Get the most recent year that has games played
  const currentYear = allGames.length > 0 
    ? Math.max(...allGames.map(g => g.year || 0))
    : new Date().getFullYear();
  const divisions = await getDivisions();
  const quads = await getQuads();
  const trophyCaseData = await getTrophyCase(undefined, team.teamId); // Get all trophies for this team
  
  // Get all trophies from Contentful to match with trophy_case data
  const allTrophies = await getTrophies();
  
  // Join trophy_case data with Contentful trophy data
  const trophyCase = trophyCaseData.map(trophy => {
    const contentfulTrophy = allTrophies.find(t => t.trophyId === trophy.trophy_id);
    return {
      ...trophy,
      trophyName: contentfulTrophy?.trophyName || `Trophy ${trophy.trophy_id}`,
      trophyDescription: contentfulTrophy?.trophyDescription || '',
      trophyImage: contentfulTrophy?.trophyImage?.url || null
    };
  });
  
  // Filter team records for this specific team across all years
  const allTeamRecordsForTeam = allTeamRecords.filter(r => r.team_id === team.teamId);
  
  // Filter games for this specific team across all years
  const allTeamGames = allGames.filter(g => 
    g.home_team_id === team.teamId || g.away_team_id === team.teamId
  );
  
  // Filter team seasons for this specific team
  const currentTeamSeasons = teamSeasons.filter(ts => ts.team_id === team.teamId);
  
  // Get current season data
  const currentTeamRecords = allTeamRecordsForTeam.filter(r => r.year === currentYear);

  // Calculate current season stats
  const currentSeasonRecord = currentTeamRecords.find(r => r.year === currentYear);
  
  // Get current quad/division info
  const currentSeason = currentTeamSeasons.find(ts => ts.year === currentYear);
  const currentQuad = currentSeason?.quad_id ? quads.find(q => q.quad_id === currentSeason.quad_id) : null;
  const currentDivision = currentSeason?.division_id ? divisions.find(d => d.division_id === currentSeason.division_id) : null;

  // Calculate performance over time using all-time data
  const performanceData = allTeamRecordsForTeam
    .sort((a, b) => (a.year || 0) - (b.year || 0))
    .map(record => ({
      year: (record.year || 0).toString(),
      wins: record.wins,
      losses: record.losses,
      winPercentage: record.win_percentage,
      pointsFor: record.points_for,
      pointsAgainst: record.points_against,
      pointDiff: record.points_for - record.points_against,
    }));

  // Calculate weekly performance for current season
  const currentSeasonGames = allTeamGames
    .filter(g => g.year === currentYear)
    .sort((a, b) => a.week - b.week)
    .map(game => {
      const isHome = game.home_team_id === team.teamId;
      const teamScore = isHome ? game.home_score : game.away_score;
      const oppScore = isHome ? game.away_score : game.home_score;
      const opponent = isHome ? 
        contentfulTeams.find(t => t.teamId === game.away_team_id)?.shortName || 'Unknown' :
        contentfulTeams.find(t => t.teamId === game.home_team_id)?.shortName || 'Unknown';
      
      return {
        week: game.week,
        opponent,
        teamScore: teamScore || 0,
        oppScore: oppScore || 0,
        result: teamScore && oppScore ? (teamScore > oppScore ? 'W' : 'L') : 'TBD',
        pointDiff: teamScore && oppScore ? teamScore - oppScore : 0,
        isPlayoff: game.playoffs || false,
      };
    });

  // Calculate all-time games for Recent Form (last 10 games across all seasons)
  const allTimeGames = allTeamGames
    .filter(g => g.home_score && g.away_score) // Only completed games
    .sort((a, b) => {
      // Sort by year first (most recent first), then by playoffs vs regular season, then by week (most recent first)
      if (a.year !== b.year) return (b.year || 0) - (a.year || 0);
      if (a.playoffs !== b.playoffs) return b.playoffs ? 1 : -1; // Playoffs first within same year
      return (b.week || 0) - (a.week || 0); // Higher week numbers first
    })
    .map(game => {
      const isHome = game.home_team_id === team.teamId;
      const teamScore = isHome ? game.home_score : game.away_score;
      const oppScore = isHome ? game.away_score : game.home_score;
      const opponent = isHome ? 
        contentfulTeams.find(t => t.teamId === game.away_team_id)?.shortName || 'Unknown' :
        contentfulTeams.find(t => t.teamId === game.home_team_id)?.shortName || 'Unknown';
      
      return {
        week: game.week,
        year: game.year,
        opponent,
        teamScore: teamScore || 0,
        oppScore: oppScore || 0,
        result: teamScore && oppScore ? (teamScore > oppScore ? 'W' : 'L') : 'TBD',
        pointDiff: teamScore && oppScore ? teamScore - oppScore : 0,
        isPlayoff: game.playoffs || false,
      };
    });

  // Calculate streaks and records
  const calculateStreak = (games: any[]) => {
    let currentStreak = 0;
    let streakType = 'W';
    
    for (let i = games.length - 1; i >= 0; i--) {
      if (games[i].result === 'W') {
        if (streakType === 'W') currentStreak++;
        else break;
      } else if (games[i].result === 'L') {
        if (streakType === 'L') currentStreak++;
        else break;
      }
    }
    
    return { type: streakType, count: currentStreak };
  };

  const currentStreak = calculateStreak(currentSeasonGames.filter(g => g.result !== 'TBD'));

  // Calculate all-time career totals
  const careerTotals = allTeamRecordsForTeam.reduce((acc, record) => ({
    totalWins: acc.totalWins + record.wins,
    totalLosses: acc.totalLosses + record.losses,
    totalPointsFor: acc.totalPointsFor + record.points_for,
    totalPointsAgainst: acc.totalPointsAgainst + record.points_against,
    totalGames: acc.totalGames + record.wins + record.losses + (record.ties || 0),
  }), { totalWins: 0, totalLosses: 0, totalPointsFor: 0, totalPointsAgainst: 0, totalGames: 0 });

  const careerWinPercentage = careerTotals.totalGames > 0 ? (careerTotals.totalWins / careerTotals.totalGames) * 100 : 0;
  const careerPointDiff = careerTotals.totalPointsFor - careerTotals.totalPointsAgainst;
  const careerGameAverage = careerTotals.totalGames > 0 ? careerTotals.totalPointsFor / careerTotals.totalGames : 0;

  // Calculate league-wide game averages for ranking
  const leagueGameAverages = allTeamRecords.reduce((acc, record) => {
    const existing = acc.find(item => item.teamId === record.team_id);
    if (!existing) {
      acc.push({
        teamId: record.team_id,
        totalPointsFor: record.points_for,
        totalGames: record.wins + record.losses + (record.ties || 0)
      });
    } else {
      existing.totalPointsFor += record.points_for;
      existing.totalGames += record.wins + record.losses + (record.ties || 0);
    }
    return acc;
  }, [] as { teamId: number; totalPointsFor: number; totalGames: number }[]);

  // Calculate game averages and sort
  const uniqueLeagueAverages = leagueGameAverages
    .map(team => ({
      teamId: team.teamId,
      gameAverage: team.totalGames > 0 ? team.totalPointsFor / team.totalGames : 0
    }))
    .sort((a, b) => b.gameAverage - a.gameAverage);

  // Find current team's ranking
  const currentTeamRank = uniqueLeagueAverages.findIndex(team => team.teamId === parseInt(params.id)) + 1;
  const totalTeams = uniqueLeagueAverages.length;
  
  // Generate ranking text
  const getRankingText = (rank: number, total: number) => {
    if (rank === 1) return "League best";
    if (rank === 2) return "2nd in league";
    if (rank === 3) return "3rd in league";
    if (rank === total) return "Last in league";
    return `${rank}th in league`;
  };

  // Calculate achievements
  // Championships: Get all championship trophies (trophy_id=1) with their years
  const championshipTrophies = trophyCase.filter(trophy => trophy.trophy_id === 1);
  const championships = championshipTrophies.length;

  // Playoff appearances: Count seasons where team made playoffs
  const playoffAppearances = allTeamGames
    .filter(g => g.playoffs)
    .map(g => g.year)
    .filter((year, index, arr) => arr.indexOf(year) === index).length;

  // Points titles: Count seasons where team scored the most points in the league (regular season only)
  const pointsTitles = (() => {
    // Group games by year and calculate points for each team
    const teamPointsByYear = new Map<string, number>();
    
    // Process all games to calculate regular season points for each team
    allGames
      .filter(game => !game.playoffs && game.home_score !== null && game.away_score !== null)
      .forEach(game => {
        const year = game.year;
        if (!year) return;
        
        // Add home team points
        const homeKey = `${year}-${game.home_team_id}`;
        const currentHomePoints = teamPointsByYear.get(homeKey) || 0;
        teamPointsByYear.set(homeKey, currentHomePoints + (game.home_score || 0));
        
        // Add away team points
        const awayKey = `${year}-${game.away_team_id}`;
        const currentAwayPoints = teamPointsByYear.get(awayKey) || 0;
        teamPointsByYear.set(awayKey, currentAwayPoints + (game.away_score || 0));
      });
    
    // Find the team with most points each year
    const yearlyLeaders = new Map<number, { teamId: number; points: number }>();
    
    teamPointsByYear.forEach((points, key) => {
      const [yearStr, teamIdStr] = key.split('-');
      const year = parseInt(yearStr);
      const teamId = parseInt(teamIdStr);
      
      const currentLeader = yearlyLeaders.get(year);
      if (!currentLeader || points > currentLeader.points) {
        yearlyLeaders.set(year, { teamId, points });
      }
    });
    
    // Count how many times our team was the leader
    let count = 0;
    yearlyLeaders.forEach((leader, year) => {
      if (leader.teamId === team.teamId) {
        count++;
      }
    });
    
    return count;
  })();

  // Calculate achievements and records (all-time and current season)
  const achievements = [];
  
  // Current season achievements
  if (currentSeasonRecord) {
    if (currentSeasonRecord.win_percentage > 0.8) {
      achievements.push({ title: 'Elite Season', description: '80%+ Win Rate', icon: '🏆', color: 'text-yellow-600' });
    }
    if (currentSeasonRecord.points_for > 1500) {
      achievements.push({ title: 'High Scorer', description: '1500+ Points', icon: '🎯', color: 'text-blue-600' });
    }
    if (currentSeasonRecord.points_for - currentSeasonRecord.points_against > 200) {
      achievements.push({ title: 'Point Differential Master', description: '200+ Point Diff', icon: '⚡', color: 'text-green-600' });
    }
  }

  // All-time achievements
  if (careerWinPercentage > 0.6) {
    achievements.push({ title: 'Career Winner', description: '60%+ Career Win Rate', icon: '👑', color: 'text-purple-600' });
  }
  if (careerTotals.totalPointsFor > 5000) {
    achievements.push({ title: 'Career Scorer', description: '5000+ Career Points', icon: '💎', color: 'text-indigo-600' });
  }
  if (careerPointDiff > 500) {
    achievements.push({ title: 'Career Dominator', description: '500+ Career Point Diff', icon: '🚀', color: 'text-red-600' });
  }

  // Find best and worst seasons
  const bestSeason = allTeamRecordsForTeam.reduce((best, current) => 
    (current.win_percentage || 0) > (best.win_percentage || 0) ? current : best
  );
  const worstSeason = allTeamRecordsForTeam.reduce((worst, current) => 
    (current.win_percentage || 0) < (worst.win_percentage || 0) ? current : worst
  );

  // Get comprehensive historical performance data
  const historicalData = allTeamRecordsForTeam
    .sort((a, b) => (a.year || 0) - (b.year || 0))
    .map(record => ({
      year: record.year || 0,
      record: `${record.wins}-${record.losses}`,
      winPercentage: (record.win_percentage || 0) * 100,
      pointsFor: record.points_for || 0,
      pointsAgainst: record.points_against || 0,
      pointDiff: (record.points_for || 0) - (record.points_against || 0),
    }));

  // Calculate head-to-head records (all-time)
  const headToHeadData = allTeamGames
    .filter(g => g.home_score && g.away_score)
    .reduce((acc, game) => {
      const isHome = game.home_team_id === team.teamId;
      const opponentId = isHome ? game.away_team_id : game.home_team_id;
      const opponent = contentfulTeams.find(t => t.teamId === opponentId);
      
      if (!opponent) return acc;
      
      const existing = acc.find(h => h.opponentId === opponentId);
      if (existing) {
        existing.games++;
        if ((isHome && (game.home_score || 0) > (game.away_score || 0)) || (!isHome && (game.away_score || 0) > (game.home_score || 0))) {
          existing.wins++;
        } else {
          existing.losses++;
        }
      } else {
        acc.push({
          opponentId,
          opponentName: opponent.shortName || 'Unknown',
          games: 1,
          wins: (isHome && (game.home_score || 0) > (game.away_score || 0)) || (!isHome && (game.away_score || 0) > (game.home_score || 0)) ? 1 : 0,
          losses: (isHome && (game.home_score || 0) > (game.away_score || 0)) || (!isHome && (game.away_score || 0) > (game.home_score || 0)) ? 0 : 1,
        });
      }
      return acc;
    }, [] as any[]);


  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back Button */}
      <div className="mb-6">
        <Button variant="ghost" asChild>
          <Link href="/teams">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Teams
          </Link>
        </Button>
      </div>

      {/* Team Hero Section */}
      <div className="text-center mb-12">
        <div className="mb-6">
          {team.logo?.url ? (
            <Image
              src={team.logo.url}
              alt={`${team.teamName} logo`}
              width={240}
              height={240}
              className="mx-auto rounded-2xl shadow-lg"
            />
          ) : (
            <div className="text-8xl mb-4">🏈</div>
          )}
        </div>
        <div className="text-center mb-4">
          <CurvedText 
            text={team.teamName}
            radius={1600}
          />
        </div>
        
        {/* Championship Stars */}
        {championshipTrophies.length > 0 && (
          <TooltipProvider>
            <div className="flex justify-center items-center gap-2 mb-6">
              {championshipTrophies
                .sort((a, b) => a.year - b.year)
                .map((championship, index) => {
                  // Check if this team's championship is the most recent across the entire league
                  const isReigningChampion = championship.year === currentYear;
                  return (
                    <Tooltip key={index}>
                      <TooltipTrigger asChild>
                        <Star 
                          className={`h-6 w-6 cursor-pointer ${
                            isReigningChampion 
                              ? 'text-yellow-500 fill-yellow-500' 
                              : 'text-foreground fill-foreground'
                          }`} 
                        />
                      </TooltipTrigger>
                      <TooltipContent className="z-[9999] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 shadow-lg">
                        <p className="font-mono text-sm">Championship {championship.year}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
            </div>
          </TooltipProvider>
        )}
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-12 text-lg text-muted-foreground">
          {team.yearEstablished && (
            <span className="font-mono">Est. {team.yearEstablished}</span>
          )}
          {currentQuad && (
            <span className="font-mono">{currentQuad.quad_name}</span>
          )}
          {currentDivision && (
            <div className="flex items-center gap-2">
              <TargetIcon className="h-5 w-5" />
              <span className="font-mono text-lg">{currentDivision.division_name}</span>
            </div>
          )}
        </div>
      </div>

                    {/* Achievements and Recent Form */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <AchievementsCard
                  championships={championships}
                  playoffAppearances={playoffAppearances}
                  pointsTitles={pointsTitles}
                />
                <RecentForm games={allTimeGames} />
              </div>

      {/* Career Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-foreground mb-2 font-mono">
              {careerTotals.totalWins}-{careerTotals.totalLosses}
            </div>
            <div className="text-sm text-muted-foreground">Career Record</div>
            <div className="text-xs text-muted-foreground mt-1 font-mono">
              {careerWinPercentage.toFixed(1)}% Win Rate
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-foreground mb-2 font-mono">
              {careerGameAverage.toFixed(1)}
            </div>
            <div className="text-sm text-muted-foreground">Game Average</div>
            <div className="text-xs text-muted-foreground mt-1 font-mono">
              {getRankingText(currentTeamRank, totalTeams)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-3xl font-bold text-foreground mb-2 font-mono">
              {careerTotals.totalGames}
            </div>
            <div className="text-sm text-muted-foreground">Games Played</div>
            <div className="text-xs text-muted-foreground mt-1 font-mono">
              {allTeamRecordsForTeam.length} seasons
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className={`text-3xl font-bold mb-2 font-mono ${
              careerPointDiff > 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'
            }`}>
              {careerPointDiff > 0 ? '+' : ''}
              {careerPointDiff.toFixed(0)}
            </div>
            <div className="text-sm text-muted-foreground">Career Point Diff</div>
            <div className="text-xs text-muted-foreground mt-1 font-mono">
              {bestSeason ? `${bestSeason.year} best` : ''}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
        {/* Performance Over Time */}
        <PerformanceAreaChart data={performanceData} />

        {/* Weekly Performance */}
        <WeeklyPerformanceAreaChart data={currentSeasonGames} />
      </div>


      {/* Head-to-Head Records */}
      {headToHeadData.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Target className="h-5 w-5 mr-2" />
              Head-to-Head Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HeadToHeadChart
              data={headToHeadData.map(h2h => ({
                opponent: h2h.opponentName,
                opponentId: h2h.opponentId,
                wins: h2h.wins,
                losses: h2h.losses,
                total: h2h.games || 0
              }))}
              currentTeamId={team.teamId}
            />
            <div className="mt-4 text-center text-sm text-muted-foreground font-mono">
              <div className="flex items-center justify-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded" style={{backgroundColor: '#525252'}}></div>
                  <span>Wins (bottom)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded" style={{backgroundColor: '#d4d4d4'}}></div>
                  <span>Losses (top)</span>
                </div>
              </div>
              <p className="mt-2">Bar length shows total games played</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trophy Case */}
      {trophyCase.filter(trophy => trophy.trophy_id !== 6).length > 0 && (
        <div className="mb-8">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-foreground" />
                <h2 className="text-2xl font-bold text-foreground">Trophy Case</h2>
              </div>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <TooltipProvider>
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-10 gap-4">
                  {trophyCase
                    .filter(trophy => trophy.trophy_id !== 6) // Exclude "briefly badasses" trophies
                    .sort((a, b) => a.trophy_id - b.trophy_id) // Order by trophy_id ascending
                    .map((trophy, index) => (
                      <Tooltip key={index}>
                        <TooltipTrigger asChild>
                          <div className="bg-neutral-100 rounded-lg px-3 py-4 flex flex-col items-center text-center cursor-pointer hover:bg-neutral-200 transition-colors">
                            <div className="w-16 h-16 flex items-center justify-center mb-2">
                              {trophy.trophyImage ? (
                                <Image
                                  src={trophy.trophyImage}
                                  alt={`Trophy ${trophy.trophy_id}`}
                                  width={56}
                                  height={56}
                                  className="object-contain"
                                />
                              ) : (
                                <Trophy className="w-8 h-8 text-muted-foreground" />
                              )}
                            </div>
                            <p className="text-base text-muted-foreground font-mono">{trophy.year}</p>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="z-[9999] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 shadow-lg">
                          <p className="font-mono text-sm">{trophy.trophyName || `Trophy ${trophy.trophy_id}`}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                </div>
              </TooltipProvider>
            </CardContent>
          </Card>
        </div>
      )}



      {/* Season History Table */}
      <div className="mb-8">
        <SeasonHistoryDataTable 
          title="Season History"
          data={historicalData}
          teamId={team.teamId}
        />
      </div>

      {/* Quick Actions */}
      <div className="text-center mt-8 space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Explore More</h3>
        <div className="flex flex-wrap justify-center gap-4">
          <Button variant="outline" asChild>
            <Link href="/standings">Current Standings</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/scores">Recent Scores</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/teams">All Teams</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
