'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Activity } from 'lucide-react';

interface RecentFormProps {
  games: Array<{
    week: number;
    year?: number;
    opponent: string;
    teamScore: number;
    oppScore: number;
    result: string;
    pointDiff: number;
    isPlayoff: boolean;
  }>;
}

export function RecentForm({ games }: RecentFormProps) {
  // Get the first 10 games (most recent first, since games are already sorted)
  const recentGames = games
    .filter(game => game.result !== 'TBD')
    .slice(0, 10);

  return (
    <TooltipProvider>
      <Card className="mb-8 h-full w-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="h-5 w-5 mr-2" />
            Recent Form
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-center">
          {recentGames.length > 0 ? (
            <div className="flex justify-center items-center gap-1 sm:gap-2 md:gap-3 w-full">
              {recentGames.map((game, index) => (
                <Tooltip key={index}>
                  <TooltipTrigger asChild>
                    <div
                      className={`aspect-square rounded-lg flex items-center justify-center font-mono font-bold cursor-pointer flex-1 max-w-[3rem] sm:max-w-[3.5rem] md:max-w-[4rem] text-xs sm:text-sm ${
                        game.result === 'W'
                          ? 'bg-neutral-600 text-white'
                          : 'bg-neutral-300 text-neutral-900'
                      }`}
                    >
                      {game.result}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="z-[9999] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 shadow-lg">
                    <p className="font-mono text-sm">
                      {game.year || 'Unknown Year'} - {game.isPlayoff ? 'Playoff' : 'Week'} {game.week}
                    </p>
                    <p className="font-mono text-sm">
                      vs {game.opponent} ({game.teamScore}-{game.oppScore})
                    </p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground">No games played yet.</p>
          )}
          <p className="text-xs text-muted-foreground text-center mt-4">
            Last 10 games (most recent on left)
          </p>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
