import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { getTeamProfiles } from '@/lib/contentful/api';
import { supabase } from '@/lib/supabase/client';
import { getMostRecentWeek } from '@/lib/supabase/scores';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import NavigationControls from '@/components/scores/NavigationControls';
import { TeamSelectorWrapper } from '@/components/scores/TeamSelectorWrapper';

export async function generateMetadata({ searchParams }: {
  searchParams: { year?: string; week?: string; playoffs?: string; team1?: string; team2?: string };
}): Promise<Metadata> {
  // Get the most recent available week as default
  const mostRecentWeek = await getMostRecentWeek();
  const contentfulTeams = await getTeamProfiles();
  
  // Get year, week, and playoffs from URL params, defaulting to most recent week
  const seasonYear = parseInt(searchParams.year || mostRecentWeek.year.toString());
  const currentWeek = parseInt(searchParams.week || mostRecentWeek.week.toString());
  const isPlayoffs = searchParams.playoffs === 'true' || (searchParams.playoffs === undefined && mostRecentWeek.isPlayoff);
  
  // Get team filtering parameters
  const team1Id = searchParams.team1 ? parseInt(searchParams.team1) : null;
  const team2Id = searchParams.team2 && searchParams.team2 !== 'all' ? parseInt(searchParams.team2) : null;
  const isAllGames = team1Id && searchParams.team2 === 'all';
  const isHeadToHead = team1Id && team2Id;

  let title = 'Scores | JADDL';
  let description = 'View weekly matchup scores and results for the JADDL fantasy football league.';

  if (isAllGames) {
    const team = contentfulTeams.find(t => t.teamId === team1Id);
    if (team) {
      title = `${team.teamName} - All Historical Games`;
      description = `Complete game history and scores for ${team.teamName} in the JADDL fantasy football league.`;
    }
  } else if (isHeadToHead) {
    const team1 = contentfulTeams.find(t => t.teamId === team1Id);
    const team2 = contentfulTeams.find(t => t.teamId === team2Id);
    if (team1 && team2) {
      title = `${team1.teamName} vs ${team2.teamName} - Head-to-Head History`;
      description = `Historical head-to-head matchups between ${team1.teamName} and ${team2.teamName} in the JADDL fantasy football league.`;
    }
  } else {
    const weekType = isPlayoffs ? 
      (currentWeek === 1 ? 'Quarterfinals' : 
       currentWeek === 2 ? 'Semifinals' : 
       currentWeek === 3 ? 'Championship' : 
       `Playoff Week ${currentWeek}`) : 
      `Week ${currentWeek}`;
    title = `${seasonYear} ${weekType} Scores`;
    description = `${seasonYear} Season ${weekType} matchup scores and results for the JADDL fantasy football league.`;
  }

  return {
    title,
    description,
    keywords: ['fantasy football', 'league', 'JADDL', 'sports', 'competition'],
    openGraph: {
      title,
      description,
      siteName: 'JADDL Fantasy Football League',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
};

export default async function ScoresPage({
  searchParams,
}: {
  searchParams: { year?: string; week?: string; playoffs?: string; team1?: string; team2?: string };
}) {
  // Get the most recent available week as default
  const mostRecentWeek = await getMostRecentWeek();
  
  // Get year, week, and playoffs from URL params, defaulting to most recent week
  const seasonYear = parseInt(searchParams.year || mostRecentWeek.year.toString());
  const currentWeek = parseInt(searchParams.week || mostRecentWeek.week.toString());
  const isPlayoffs = searchParams.playoffs === 'true' || (searchParams.playoffs === undefined && mostRecentWeek.isPlayoff);
  
  // Get team filtering parameters
  const team1Id = searchParams.team1 ? parseInt(searchParams.team1) : null;
  const team2Id = searchParams.team2 && searchParams.team2 !== 'all' ? parseInt(searchParams.team2) : null;
  const isAllGames = team1Id && searchParams.team2 === 'all';
  const isHeadToHead = team1Id && team2Id;

  // Fetch teams from Contentful for logos/names
  const contentfulTeams = await getTeamProfiles();

  // Fetch actual games from Supabase
  let query = supabase.from('games').select('*');
  
  if (isAllGames) {
    // For all games of a single team, show all games across all years in descending order
    query = query.or(`home_team_id.eq.${team1Id},away_team_id.eq.${team1Id}`);
  } else if (isHeadToHead) {
    // For head-to-head, show all games between the two teams across all years
    query = query.or(`and(home_team_id.eq.${team1Id},away_team_id.eq.${team2Id}),and(home_team_id.eq.${team2Id},away_team_id.eq.${team1Id})`);
  } else {
    // Normal weekly view
    query = query.eq('year', seasonYear).eq('week', currentWeek);
    
    // Filter by playoffs if the parameter is provided
    if (isPlayoffs !== undefined) {
      query = query.eq('playoffs', isPlayoffs);
    }
  }
  
  const { data: games, error } = await query.order('year', { ascending: false }).order('week', { ascending: false });

  const actualGames = games || [];

  // Get available years and weeks
  const { data: availableData } = await supabase
    .from('games')
    .select('year, week, playoffs')
    .order('year', { ascending: false })
    .order('week', { ascending: false });

  const availableYears = Array.from(new Set(availableData?.map((g: any) => g.year) || []));
  
  // Separate regular season and playoff weeks, then combine them properly
  const seasonGames = availableData?.filter((g: any) => g.year === seasonYear) || [];
  const regularSeasonWeeks = Array.from(new Set(seasonGames.filter((g: any) => !g.playoffs).map((g: any) => g.week))).sort((a, b) => a - b);
  const playoffWeeks = Array.from(new Set(seasonGames.filter((g: any) => g.playoffs).map((g: any) => g.week))).sort((a, b) => a - b);
  
  // Create unique week identifiers to prevent duplicates
  const availableWeeks = [
    ...regularSeasonWeeks.map(week => ({ week, isPlayoff: false })),
    ...playoffWeeks.map(week => ({ week, isPlayoff: true }))
  ];

  // Enhance games with Contentful data
  const enhancedGames = actualGames.map((game: any) => {
    const homeContentfulTeam = contentfulTeams.find(t => t.teamId === game.home_team_id);
    const awayContentfulTeam = contentfulTeams.find(t => t.teamId === game.away_team_id);
    
    return {
      ...game,
      homeTeam: {
        name: homeContentfulTeam?.teamName || 'Unknown Team',
        shortName: homeContentfulTeam?.shortName || 'UNK',
        logo: homeContentfulTeam?.logo?.url || '🏈',
        isContentfulLogo: !!homeContentfulTeam?.logo,
      },
      awayTeam: {
        name: awayContentfulTeam?.teamName || 'Unknown Team',
        shortName: awayContentfulTeam?.shortName || 'UNK',
        logo: awayContentfulTeam?.logo?.url || '🏈',
        isContentfulLogo: !!awayContentfulTeam?.logo,
      },
    };
  });

  // Calculate stats
  const completedGames = enhancedGames.filter(game => game.away_score !== null && game.home_score !== null);
  const allScores = completedGames.flatMap(game => [game.home_score || 0, game.away_score || 0]);
  const avgScore = allScores.length > 0 
    ? (allScores.reduce((sum, score) => sum + score, 0) / allScores.length)
    : 0;
  const medianScore = allScores.length > 0 
    ? (() => {
        const sortedScores = [...allScores].sort((a, b) => a - b);
        const mid = Math.floor(sortedScores.length / 2);
        return sortedScores.length % 2 === 0 
          ? (sortedScores[mid - 1] + sortedScores[mid]) / 2
          : sortedScores[mid];
      })()
    : 0;
  const highScore = allScores.length > 0 
    ? Math.max(...allScores)
    : 0;

  // Calculate margins
  const gamesWithMargins = completedGames.map(game => {
    const margin = Math.abs((game.home_score || 0) - (game.away_score || 0));
    const winner = (game.home_score || 0) > (game.away_score || 0) ? game.homeTeam : game.awayTeam;
    const loser = (game.home_score || 0) > (game.away_score || 0) ? game.awayTeam : game.homeTeam;
    return {
      ...game,
      margin,
      winner,
      loser
    };
  });

  const narrowestMargin = gamesWithMargins.length > 0 
    ? gamesWithMargins.reduce((min, game) => game.margin < min.margin ? game : min)
    : null;
  
  const biggestMargin = gamesWithMargins.length > 0 
    ? gamesWithMargins.reduce((max, game) => game.margin > max.margin ? game : max)
    : null;

  // Check if we have games for this year/week
  const hasGames = enhancedGames.length > 0;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-4">
          {isAllGames ? 'All Team Scores' : isHeadToHead ? 'Head-to-Head Matchups' : 'Weekly Scores'}
        </h1>
        {isAllGames ? (
          <div className="px-4 py-2 font-semibold mt-2">
            {contentfulTeams.find(t => t.teamId === team1Id)?.teamName || 'Unknown Team'} - All Historical Games
          </div>
        ) : isHeadToHead ? (
          <TeamSelectorWrapper
            teams={contentfulTeams}
            team1Id={team1Id}
            team2Id={team2Id}
          />
        ) : (
          <div className="px-4 py-2 font-semibold mt-2">
            {seasonYear} Season • {(() => {
              if (isPlayoffs) {
                const playoffRound = currentWeek === 1 ? 'Quarterfinals' : 
                                    currentWeek === 2 ? 'Semifinals' : 
                                    currentWeek === 3 ? 'Championship' : 
                                    `Playoff Week ${currentWeek}`;
                return playoffRound;
              }
              return `Week ${currentWeek}`;
            })()}
          </div>
        )}
      </div>

      {/* Back button for head-to-head and all games view */}
      {(isHeadToHead || isAllGames) && (
        <div className="mb-6 text-center">
          <Link 
            href={isAllGames && team1Id ? `/teams/${team1Id}` : "/scores"}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            ← {isAllGames ? 'Back to Team Page' : 'Back to Weekly Scores'}
          </Link>
        </div>
      )}

      {/* All Games Summary Stats */}
      {isAllGames && (() => {
        const team = contentfulTeams.find(t => t.teamId === team1Id);
        
        if (!team) return null;

        // Calculate all games statistics
        const allTeamGames = enhancedGames.filter(game => 
          game.home_team_id === team1Id || game.away_team_id === team1Id
        );

        if (allTeamGames.length === 0) return null;

        // Calculate wins and losses
        const wins = allTeamGames.filter(game => {
          const isHome = game.home_team_id === team1Id;
          return isHome ? game.home_score > game.away_score : game.away_score > game.home_score;
        }).length;

        const losses = allTeamGames.length - wins;

        // Calculate total points for and against
        const totalPointsFor = allTeamGames.reduce((sum, game) => {
          const isHome = game.home_team_id === team1Id;
          return sum + (isHome ? game.home_score : game.away_score);
        }, 0);

        const totalPointsAgainst = allTeamGames.reduce((sum, game) => {
          const isHome = game.home_team_id === team1Id;
          return sum + (isHome ? game.away_score : game.home_score);
        }, 0);

        const avgPointsFor = totalPointsFor / allTeamGames.length;
        const avgPointsAgainst = totalPointsAgainst / allTeamGames.length;

        // Calculate longest winning and losing streaks
        const calculateStreaks = (games: any[]) => {
          let longestWinStreak = 0;
          let longestLoseStreak = 0;
          let currentWinStreak = 0;
          let currentLoseStreak = 0;
          let winStreakStart: any = null;
          let winStreakEnd: any = null;
          let loseStreakStart: any = null;
          let loseStreakEnd: any = null;
          let currentWinStart: any = null;
          let currentLoseStart: any = null;

          // Sort games by year and week (oldest to newest for streak calculation)
          const sortedGames = [...games].sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            if (a.playoffs !== b.playoffs) return a.playoffs ? 1 : -1;
            return a.week - b.week;
          });

          sortedGames.forEach(game => {
            const isHome = game.home_team_id === team1Id;
            const won = isHome ? game.home_score > game.away_score : game.away_score > game.home_score;

            if (won) {
              if (currentWinStreak === 0) {
                currentWinStart = game;
              }
              currentWinStreak++;
              currentLoseStreak = 0;
              currentLoseStart = null;
              
              if (currentWinStreak > longestWinStreak) {
                longestWinStreak = currentWinStreak;
                winStreakStart = currentWinStart;
                winStreakEnd = game;
              }
            } else {
              if (currentLoseStreak === 0) {
                currentLoseStart = game;
              }
              currentLoseStreak++;
              currentWinStreak = 0;
              currentWinStart = null;
              
              if (currentLoseStreak > longestLoseStreak) {
                longestLoseStreak = currentLoseStreak;
                loseStreakStart = currentLoseStart;
                loseStreakEnd = game;
              }
            }
          });

          return { 
            longestWinStreak, 
            longestLoseStreak,
            winStreakStart,
            winStreakEnd,
            loseStreakStart,
            loseStreakEnd
          };
        };

        const { 
          longestWinStreak, 
          longestLoseStreak,
          winStreakStart,
          winStreakEnd,
          loseStreakStart,
          loseStreakEnd
        } = calculateStreaks(allTeamGames);

        // Separate regular season and playoff games
        const regularSeasonGames = allTeamGames.filter(game => !game.playoffs);
        const playoffGames = allTeamGames.filter(game => game.playoffs);

        const regularWins = regularSeasonGames.filter(game => {
          const isHome = game.home_team_id === team1Id;
          return isHome ? game.home_score > game.away_score : game.away_score > game.home_score;
        }).length;

        const playoffWins = playoffGames.filter(game => {
          const isHome = game.home_team_id === team1Id;
          return isHome ? game.home_score > game.away_score : game.away_score > game.home_score;
        }).length;

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* Overall Record */}
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-2xl font-bold text-foreground mb-2 font-mono">
                  {wins}-{losses}
                </div>
                <div className="text-sm text-muted-foreground">Overall Record</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {((wins / allTeamGames.length) * 100).toFixed(1)}% Win Rate
                </div>
              </CardContent>
            </Card>

            {/* Total Games */}
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-2xl font-bold text-foreground mb-2 font-mono">
                  {allTeamGames.length}
                </div>
                <div className="text-sm text-muted-foreground">Total Games</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {regularSeasonGames.length} regular, {playoffGames.length} playoff
                </div>
              </CardContent>
            </Card>

            {/* Average Points */}
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-2xl font-bold text-foreground mb-2 font-mono">
                  {avgPointsFor.toFixed(1)}
                </div>
                <div className="text-sm text-muted-foreground">Avg Points For</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {avgPointsAgainst.toFixed(1)} against
                </div>
              </CardContent>
            </Card>

            {/* Longest Streaks */}
            <Card>
              <CardContent className="p-6 text-center">
                <div className="flex items-center justify-center gap-4 mb-2">
                  <div className="flex-1">
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-500 font-mono">
                      {longestWinStreak}
                    </div>
                    <div className="text-xs text-muted-foreground">Winning</div>
                    {winStreakStart && winStreakEnd && (
                      <div className="text-[10px] text-muted-foreground mt-1 font-mono">
                        {winStreakStart.year} Wk{winStreakStart.week} - {winStreakEnd.year} Wk{winStreakEnd.week}
                      </div>
                    )}
                  </div>
                  <div className="border-l border-border h-16"></div>
                  <div className="flex-1">
                    <div className="text-2xl font-bold text-rose-600 dark:text-rose-500 font-mono">
                      {longestLoseStreak}
                    </div>
                    <div className="text-xs text-muted-foreground">Losing</div>
                    {loseStreakStart && loseStreakEnd && (
                      <div className="text-[10px] text-muted-foreground mt-1 font-mono">
                        {loseStreakStart.year} Wk{loseStreakStart.week} - {loseStreakEnd.year} Wk{loseStreakEnd.week}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">Longest Streaks</div>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {/* Head-to-Head Summary Stats */}
      {isHeadToHead && (() => {
        const team1 = contentfulTeams.find(t => t.teamId === team1Id);
        const team2 = contentfulTeams.find(t => t.teamId === team2Id);
        
        if (!team1 || !team2) return null;

        // Calculate head-to-head statistics
        const h2hGames = enhancedGames.filter(game => 
          (game.home_team_id === team1Id && game.away_team_id === team2Id) ||
          (game.home_team_id === team2Id && game.away_team_id === team1Id)
        );

        if (h2hGames.length === 0) return null;

        // Calculate wins for each team
        const team1Wins = h2hGames.filter(game => {
          const isTeam1Home = game.home_team_id === team1Id;
          return isTeam1Home ? game.home_score > game.away_score : game.away_score > game.home_score;
        }).length;

        const team2Wins = h2hGames.length - team1Wins;

        // Calculate average scores
        const team1TotalScore = h2hGames.reduce((sum, game) => {
          const isTeam1Home = game.home_team_id === team1Id;
          return sum + (isTeam1Home ? game.home_score : game.away_score);
        }, 0);

        const team2TotalScore = h2hGames.reduce((sum, game) => {
          const isTeam2Home = game.home_team_id === team2Id;
          return sum + (isTeam2Home ? game.home_score : game.away_score);
        }, 0);

        const team1AvgScore = team1TotalScore / h2hGames.length;
        const team2AvgScore = team2TotalScore / h2hGames.length;

        // Calculate longest streak
        const calculateLongestStreak = (games: any[], teamId: number) => {
          let currentStreak = 0;
          let longestStreak = 0;
          let lastWinner = null;

          for (const game of games) {
            const isTeam1Home = game.home_team_id === team1Id;
            const team1Won = isTeam1Home ? game.home_score > game.away_score : game.away_score > game.home_score;
            const winner = team1Won ? team1Id : team2Id;

            if (winner === teamId) {
              if (lastWinner === teamId) {
                currentStreak++;
              } else {
                currentStreak = 1;
              }
            } else {
              currentStreak = 0;
            }

            longestStreak = Math.max(longestStreak, currentStreak);
            lastWinner = winner;
          }

          return longestStreak;
        };

        const team1LongestStreak = calculateLongestStreak(h2hGames, team1Id);
        const team2LongestStreak = calculateLongestStreak(h2hGames, team2Id);

        // Separate regular season and playoff games
        const regularSeasonGames = h2hGames.filter(game => !game.playoffs);
        const playoffGames = h2hGames.filter(game => game.playoffs);

        const team1RegularWins = regularSeasonGames.filter(game => {
          const isTeam1Home = game.home_team_id === team1Id;
          return isTeam1Home ? game.home_score > game.away_score : game.away_score > game.home_score;
        }).length;

        const team1PlayoffWins = playoffGames.filter(game => {
          const isTeam1Home = game.home_team_id === team1Id;
          return isTeam1Home ? game.home_score > game.away_score : game.away_score > game.home_score;
        }).length;

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {/* Overall Record */}
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-2xl font-bold text-foreground mb-2 font-mono">
                  {team1Wins}-{team2Wins}
                </div>
                <div className="text-sm text-muted-foreground">Overall Record</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {team1Wins > team2Wins ? `${team1.shortName} leads` : 
                   team2Wins > team1Wins ? `${team2.shortName} leads` : 
                   'Tied'}
                </div>
              </CardContent>
            </Card>

            {/* Longest Streak */}
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-2xl font-bold text-foreground mb-2 font-mono">
                  {Math.max(team1LongestStreak, team2LongestStreak)}
                </div>
                <div className="text-sm text-muted-foreground">Longest Streak</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {team1LongestStreak > team2LongestStreak ? team1.shortName : team2.shortName}
                </div>
              </CardContent>
            </Card>

            {/* Average Score */}
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-2xl font-bold text-foreground mb-2 font-mono">
                  {team1AvgScore.toFixed(1)} - {team2AvgScore.toFixed(1)}
                </div>
                <div className="text-sm text-muted-foreground">Avg Score</div>
                <div className="text-xs text-muted-foreground mt-1">
                  in favor of {team1AvgScore > team2AvgScore ? team1.shortName : team2.shortName}
                </div>
              </CardContent>
            </Card>

            {/* Playoffs vs Regular Season */}
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-2xl font-bold text-foreground mb-2 font-mono">
                  {playoffGames.length > 0 ? `${team1PlayoffWins}-${playoffGames.length - team1PlayoffWins}` : '0-0'}
                </div>
                <div className="text-sm text-muted-foreground">Playoffs</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {playoffGames.length > 0 ? `${team1RegularWins}-${regularSeasonGames.length - team1RegularWins} regular season` : 'No playoffs'}
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {!isHeadToHead && !isAllGames && (
        <NavigationControls 
          seasonYear={seasonYear}
          currentWeek={currentWeek}
          availableYears={availableYears}
          availableWeeks={availableWeeks}
          isPlayoffs={isPlayoffs}
        />
      )}

      {/* Week Stats - Only show for weekly view */}
      {!isHeadToHead && !isAllGames && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-foreground font-mono">
              {narrowestMargin ? narrowestMargin.margin.toFixed(1) : 'N/A'}
            </div>
            <div className="text-sm text-muted-foreground">Narrowest Margin</div>
            {narrowestMargin && (
              <div className="text-xs text-muted-foreground mt-1">
                {narrowestMargin.winner.shortName} over {narrowestMargin.loser.shortName}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-foreground font-mono">
              {biggestMargin ? biggestMargin.margin.toFixed(1) : 'N/A'}
            </div>
            <div className="text-sm text-muted-foreground">Biggest Margin</div>
            {biggestMargin && (
              <div className="text-xs text-muted-foreground mt-1">
                {biggestMargin.winner.shortName} over {biggestMargin.loser.shortName}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-foreground font-mono">{medianScore.toFixed(1)}</div>
            <div className="text-sm text-muted-foreground">Median Score</div>
            {allScores.length > 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                avg: {avgScore.toFixed(1)}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold text-foreground font-mono">{highScore}</div>
            <div className="text-sm text-muted-foreground">High Score</div>
            {completedGames.length > 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                {(() => {
                  const highScoreGame = completedGames.find(game => 
                    (game.home_score || 0) === highScore || (game.away_score || 0) === highScore
                  );
                  if (highScoreGame) {
                    const isHomeTeam = (highScoreGame.home_score || 0) === highScore;
                    const team = isHomeTeam ? highScoreGame.homeTeam : highScoreGame.awayTeam;
                    return team.shortName;
                  }
                  return 'N/A';
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      )}

      {/* Games Grid */}
      {hasGames ? (
        <div className={(isHeadToHead || isAllGames) ? "space-y-2" : "grid grid-cols-1 md:grid-cols-2 gap-6"}>
          {enhancedGames.map((game) => (
            <Card key={game.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-col space-y-1.5 p-6 pb-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {(isHeadToHead || isAllGames) ? (
                      `${game.year} Season • ${game.playoffs ? 
                        (game.week === 1 ? 'Quarterfinals' : 
                         game.week === 2 ? 'Semifinals' : 
                         game.week === 3 ? 'Championship' : 
                         `Playoff Week ${game.week}`) : 
                        `Week ${game.week}`
                      }`
                    ) : (
                      isPlayoffs ? 
                        (currentWeek === 1 ? 'Quarterfinals' : 
                         currentWeek === 2 ? 'Semifinals' : 
                         currentWeek === 3 ? 'Championship' : 
                         `Playoff Week ${currentWeek}`) : 
                        'Regular Season'
                    )}
                  </div>
                  {!isHeadToHead && !isAllGames && (
                    <div className="text-sm text-muted-foreground">
                      Game #{game.id}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                {(isHeadToHead || isAllGames) ? (
                  // Head-to-head layout: teams side by side on desktop, stacked on mobile
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                    {/* Away Team (Left) */}
                    <div className={`flex items-center space-x-3 p-3 rounded-lg flex-1 ${
                      game.away_score > game.home_score ? 'bg-green-500/10 border border-green-500/20' : 'bg-muted'
                    }`}>
                      <div className="w-8 h-8 flex items-center justify-center">
                        {game.awayTeam.isContentfulLogo ? (
                          <Image
                            src={game.awayTeam.logo}
                            alt={`${game.awayTeam.name} logo`}
                            width={32}
                            height={32}
                            className="rounded-lg"
                          />
                        ) : (
                          <span className="text-xl">🏈</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <Link href={`/teams/${game.away_team_id}`} className="hover:text-primary transition-colors">
                          <div className="font-semibold text-foreground">{game.awayTeam.name}</div>
                          <div className="text-sm text-muted-foreground">{game.awayTeam.shortName}</div>
                        </Link>
                      </div>
                      <div className={`text-2xl font-bold ${game.away_score > game.home_score ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {game.away_score.toFixed(1)}
                      </div>
                    </div>
                    
                    {/* VS Separator */}
                    <div className="px-2 md:px-4 text-sm text-muted-foreground font-medium text-center md:text-left">VS</div>
                    
                    {/* Home Team (Right) */}
                    <div className={`flex items-center space-x-3 p-3 rounded-lg flex-1 ${
                      game.home_score > game.away_score ? 'bg-green-500/10 border border-green-500/20' : 'bg-muted'
                    }`}>
                      <div className="w-8 h-8 flex items-center justify-center">
                        {game.homeTeam.isContentfulLogo ? (
                          <Image
                            src={game.homeTeam.logo}
                            alt={`${game.homeTeam.name} logo`}
                            width={32}
                            height={32}
                            className="rounded-lg"
                          />
                        ) : (
                          <span className="text-xl">🏈</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <Link href={`/teams/${game.home_team_id}`} className="hover:text-primary transition-colors">
                          <div className="font-semibold text-foreground">{game.homeTeam.name}</div>
                          <div className="text-sm text-muted-foreground">{game.homeTeam.shortName}</div>
                        </Link>
                      </div>
                      <div className={`text-2xl font-bold ${game.home_score > game.away_score ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {game.home_score.toFixed(1)}
                      </div>
                    </div>
                  </div>
                ) : (
                  // Regular weekly layout: teams stacked
                  <div className="space-y-4">
                    <div className={`flex items-center justify-between p-3 rounded-lg ${
                      game.away_score > game.home_score ? 'bg-green-500/10 border border-green-500/20' : 'bg-muted'
                    }`}>
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 flex items-center justify-center">
                          {game.awayTeam.isContentfulLogo ? (
                            <Image
                              src={game.awayTeam.logo}
                              alt={`${game.awayTeam.name} logo`}
                              width={32}
                              height={32}
                              className="rounded-lg"
                            />
                          ) : (
                            <span className="text-xl">🏈</span>
                          )}
                        </div>
                        <div>
                          <Link href={`/teams/${game.away_team_id}`} className="hover:text-primary transition-colors">
                            <div className="font-semibold text-foreground">{game.awayTeam.name}</div>
                            <div className="text-sm text-muted-foreground">{game.awayTeam.shortName}</div>
                          </Link>
                        </div>
                      </div>
                      <div className={`league-score ${game.away_score > game.home_score ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {game.away_score.toFixed(1)}
                      </div>
                    </div>
                    <div className="text-center text-sm text-muted-foreground font-medium">VS</div>
                    <div className={`flex items-center justify-between p-3 rounded-lg ${
                      game.home_score > game.away_score ? 'bg-green-500/10 border border-green-500/20' : 'bg-muted'
                    }`}>
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 flex items-center justify-center">
                          {game.homeTeam.isContentfulLogo ? (
                            <Image
                              src={game.homeTeam.logo}
                              alt={`${game.homeTeam.name} logo`}
                              width={32}
                              height={32}
                              className="rounded-lg"
                            />
                          ) : (
                            <span className="text-xl">🏈</span>
                          )}
                        </div>
                        <div>
                          <Link href={`/teams/${game.home_team_id}`} className="hover:text-primary transition-colors">
                            <div className="font-semibold text-foreground">{game.homeTeam.name}</div>
                            <div className="text-sm text-muted-foreground">{game.homeTeam.shortName}</div>
                          </Link>
                        </div>
                      </div>
                      <div className={`league-score ${game.home_score > game.away_score ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {game.home_score.toFixed(1)}
                      </div>
                    </div>
                    <div className="text-center pt-2">
                      <div className="text-sm text-green-600 font-medium">Final Score</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="h-16 w-16 text-muted-foreground mx-auto mb-4">🏈</div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No Games Found</h3>
          <p className="text-muted-foreground mb-6">
            {(() => {
              if (isPlayoffs) {
                const playoffRound = currentWeek === 1 ? 'Quarterfinals' : 
                                    currentWeek === 2 ? 'Semifinals' : 
                                    currentWeek === 3 ? 'Championship' : 
                                    `Playoff Week ${currentWeek}`;
                return `No games found for ${playoffRound} of the ${seasonYear} season.`;
              }
              return `No games found for Week ${currentWeek} of the ${seasonYear} season.`;
            })()}
          </p>
          <div className="text-sm text-muted-foreground">
            Try selecting a different year or week from the navigation above.
          </div>
        </div>
      )}
    </div>
  );
}
