'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { StackedBarChartComponent } from '@/components/ui/charts';

interface HeadToHeadChartProps {
  data: Array<{
    opponent: string;
    opponentId: number;
    wins: number;
    losses: number;
    total: number;
  }>;
  currentTeamId: number;
}

export function HeadToHeadChart({ data, currentTeamId }: HeadToHeadChartProps) {
  const router = useRouter();

  const handleBarClick = (opponentName: string, opponentId: number) => {
    // Navigate to scores page with team filtering
    const url = `/scores?team1=${currentTeamId}&team2=${opponentId}` as any;
    router.push(url);
  };

  return (
    <div className="h-64 sm:h-80">
      <StackedBarChartComponent
        data={data.map(h2h => ({
          opponent: h2h.opponent,
          opponentId: h2h.opponentId,
          wins: h2h.wins,
          losses: h2h.losses,
          total: h2h.total || 0
        }))}
        xKey="opponent"
        yKeys={['wins', 'losses']}
        yAxisDomain={[0, 30]}
        onBarClick={handleBarClick}
      />
    </div>
  );
}
