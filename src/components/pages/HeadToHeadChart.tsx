'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { HeadToHeadBarChart } from '@/components/ui/head-to-head-bar-chart';

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
    <HeadToHeadBarChart
      data={data.map(h2h => ({
        opponent: h2h.opponent,
        opponentId: h2h.opponentId,
        wins: h2h.wins,
        losses: h2h.losses,
        total: h2h.total || 0
      }))}
      currentTeamId={currentTeamId}
      onBarClick={handleBarClick}
    />
  );
}
