'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { TeamSelector } from './TeamSelector';
import { ProcessedTeamProfile } from '@/types/contentful';

interface TeamSelectorWrapperProps {
  teams: ProcessedTeamProfile[];
  team1Id: number | null;
  team2Id: number | null;
}

export function TeamSelectorWrapper({ teams, team1Id, team2Id }: TeamSelectorWrapperProps) {
  const router = useRouter();

  const handleTeam1Select = (teamId: number) => {
    router.push(`/scores?team1=${teamId}&team2=${team2Id}` as any);
  };

  const handleTeam2Select = (teamId: number) => {
    router.push(`/scores?team1=${team1Id}&team2=${teamId}` as any);
  };

  return (
    <div className="flex items-center justify-center gap-4 mt-6">
      {/* Team 1 Selector */}
      <div className="flex-1 max-w-xs">
        <TeamSelector
          teams={teams}
          selectedTeamId={team1Id}
          onTeamSelect={handleTeam1Select}
          label="Team 1"
          excludeTeamId={team2Id}
        />
      </div>

      {/* VS Separator */}
      <div className="flex items-center justify-center mt-8">
        <span className="text-2xl font-bold text-muted-foreground">VS</span>
      </div>

      {/* Team 2 Selector */}
      <div className="flex-1 max-w-xs">
        <TeamSelector
          teams={teams}
          selectedTeamId={team2Id}
          onTeamSelect={handleTeam2Select}
          label="Team 2"
          excludeTeamId={team1Id}
        />
      </div>
    </div>
  );
}
