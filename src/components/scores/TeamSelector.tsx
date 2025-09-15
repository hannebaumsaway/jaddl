'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { ChevronDown, Check } from 'lucide-react';
import { ProcessedTeamProfile } from '@/types/contentful';

interface TeamSelectorProps {
  teams: ProcessedTeamProfile[];
  selectedTeamId: number | null;
  onTeamSelect: (teamId: number) => void;
  label: string;
  excludeTeamId?: number | null;
}

export function TeamSelector({ teams, selectedTeamId, onTeamSelect, label, excludeTeamId }: TeamSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedTeam = teams.find(team => team.teamId === selectedTeamId);
  const availableTeams = teams.filter(team => team.teamId !== excludeTeamId);

  const handleTeamSelect = (teamId: number) => {
    onTeamSelect(teamId);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-muted-foreground mb-2">{label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full p-3 border border-input bg-background rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring flex items-center justify-between"
        >
          <div className="flex items-center space-x-3">
            {selectedTeam ? (
              <>
                <div className="w-8 h-8 flex items-center justify-center">
                  {selectedTeam.logo ? (
                    <Image
                      src={selectedTeam.logo.url}
                      alt={`${selectedTeam.teamName} logo`}
                      width={32}
                      height={32}
                      className="rounded-lg"
                    />
                  ) : (
                    <span className="text-xl">🏈</span>
                  )}
                </div>
                <span className="font-medium">{selectedTeam.teamName}</span>
              </>
            ) : (
              <span className="text-muted-foreground">Select {label}</span>
            )}
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-background border border-input rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {availableTeams.map((team) => (
              <button
                key={team.teamId}
                type="button"
                onClick={() => handleTeamSelect(team.teamId)}
                className="w-full p-3 text-left hover:bg-muted focus:bg-muted focus:outline-none flex items-center space-x-3"
              >
                <div className="w-8 h-8 flex items-center justify-center">
                  {team.logo ? (
                    <Image
                      src={team.logo.url}
                      alt={`${team.teamName} logo`}
                      width={32}
                      height={32}
                      className="rounded-lg"
                    />
                  ) : (
                    <span className="text-xl">🏈</span>
                  )}
                </div>
                <span className="font-medium flex-1">{team.teamName}</span>
                {selectedTeamId === team.teamId && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
