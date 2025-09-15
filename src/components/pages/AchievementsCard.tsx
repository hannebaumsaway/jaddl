'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, Target, Zap } from 'lucide-react';

interface AchievementsCardProps {
  championships: number;
  playoffAppearances: number;
  pointsTitles: number;
}

export function AchievementsCard({ championships, playoffAppearances, pointsTitles }: AchievementsCardProps) {
  return (
    <Card className="mb-8 h-full w-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Award className="h-5 w-5 mr-2" />
          Achievements
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex items-center">
        <div className="flex justify-between gap-6 w-full">
          <div className="text-center">
            <div className="text-6xl font-bold text-foreground font-mono">{championships}</div>
            <div className="text-sm text-muted-foreground font-mono">Championships</div>
          </div>
          <div className="text-center">
            <div className="text-6xl font-bold text-foreground font-mono">{playoffAppearances}</div>
            <div className="text-sm text-muted-foreground font-mono">Playoff Appearances</div>
          </div>
          <div className="text-center">
            <div className="text-6xl font-bold text-foreground font-mono">{pointsTitles}</div>
            <div className="text-sm text-muted-foreground font-mono">Points Titles</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
