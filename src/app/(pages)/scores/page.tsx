import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { getTeamProfiles } from '@/lib/contentful/api';
import { supabase } from '@/lib/supabase/client';
import { getMostRecentWeek } from '@/lib/supabase/scores';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import NavigationControls from '@/components/scores/NavigationControls';

export const metadata: Metadata = {
  title: 'Scores | JADDL',
  description: 'View weekly matchup scores and results for the JADDL fantasy football league.',
  keywords: ['fantasy football', 'league', 'JADDL', 'sports', 'competition'],
  authors: [{ name: 'JADDL Commissioner' }],
  creator: 'JADDL League',
  publisher: 'JADDL League',
  robots: 'index, follow',
  openGraph: {
    title: 'JADDL Fantasy Football League',
    description: 'The premier fantasy football league bringing together competitive players for an epic battle of strategy, skill, and a little bit of luck.',
    siteName: 'JADDL Fantasy Football League',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'JADDL Fantasy Football League',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'JADDL Fantasy Football League',
    description: 'The premier fantasy football league bringing together competitive players for an epic battle of strategy, skill, and a little bit of luck.',
    images: ['/og-image.jpg'],
  },
};

export default async function ScoresPage({
  searchParams,
}: {
  searchParams: { year?: string; week?: string; playoffs?: string };
}) {
  // Get the most recent available week as default
  const mostRecentWeek = await getMostRecentWeek();
  
  // Get year, week, and playoffs from URL params, defaulting to most recent week
  const seasonYear = parseInt(searchParams.year || mostRecentWeek.year.toString());
  const currentWeek = parseInt(searchParams.week || mostRecentWeek.week.toString());
  const isPlayoffs = searchParams.playoffs === 'true' || (searchParams.playoffs === undefined && mostRecentWeek.isPlayoff);

  // Fetch teams from Contentful for logos/names
  const contentfulTeams = await getTeamProfiles();

  // Fetch actual games from Supabase
  let query = supabase
    .from('games')
    .select('*')
    .eq('year', seasonYear)
    .eq('week', currentWeek);
  
  // Filter by playoffs if the parameter is provided
  if (isPlayoffs !== undefined) {
    query = query.eq('playoffs', isPlayoffs);
  }
  
  const { data: games, error } = await query.order('id');

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
        <h1 className="text-4xl font-bold text-foreground mb-4">Weekly Scores</h1>
        <div className="px-4 py-2 bg-muted rounded-lg font-semibold mt-2">
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
      </div>

      <NavigationControls 
        seasonYear={seasonYear}
        currentWeek={currentWeek}
        availableYears={availableYears}
        availableWeeks={availableWeeks}
        isPlayoffs={isPlayoffs}
      />

      {/* Week Stats */}
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

      {/* Games Grid */}
      {hasGames ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {enhancedGames.map((game) => (
            <Card key={game.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-col space-y-1.5 p-6 pb-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {isPlayoffs ? 
                      (currentWeek === 1 ? 'Quarterfinals' : 
                       currentWeek === 2 ? 'Semifinals' : 
                       currentWeek === 3 ? 'Championship' : 
                       `Playoff Week ${currentWeek}`) : 
                      'Regular Season'
                    }
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Game #{game.id}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 pt-0 space-y-4">
                <div className={`flex items-center justify-between p-3 rounded-lg ${
                  game.away_score > game.home_score ? 'bg-green-50 border border-green-200' : 'bg-muted'
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
                      <div className="font-semibold text-foreground">{game.awayTeam.name}</div>
                      <div className="text-sm text-muted-foreground">{game.awayTeam.shortName}</div>
                    </div>
                  </div>
                  <div className={`league-score ${game.away_score > game.home_score ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {game.away_score.toFixed(1)}
                  </div>
                </div>
                <div className="text-center text-sm text-muted-foreground font-medium">VS</div>
                <div className={`flex items-center justify-between p-3 rounded-lg ${
                  game.home_score > game.away_score ? 'bg-green-50 border border-green-200' : 'bg-muted'
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
                      <div className="font-semibold text-foreground">{game.homeTeam.name}</div>
                      <div className="text-sm text-muted-foreground">{game.homeTeam.shortName}</div>
                    </div>
                  </div>
                  <div className={`league-score ${game.home_score > game.away_score ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {game.home_score.toFixed(1)}
                  </div>
                </div>
                <div className="text-center pt-2">
                  <div className="text-sm text-green-600 font-medium">Final Score</div>
                </div>
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
