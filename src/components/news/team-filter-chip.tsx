'use client';

import React from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TeamFilterChipProps {
  team: {
    id: string;
    teamId: number;
    teamName: string;
    shortName: string;
    logo?: {
      url: string;
      alt: string;
      width?: number;
      height?: number;
    };
  };
  isSelected: boolean;
  onToggle: (teamId: number) => void;
  showRemoveButton?: boolean;
  onRemove?: (teamId: number) => void;
}

export function TeamFilterChip({
  team,
  isSelected,
  onToggle,
  showRemoveButton = false,
  onRemove,
}: TeamFilterChipProps) {
  const handleClick = () => {
    onToggle(team.teamId);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRemove) {
      onRemove(team.teamId);
    }
  };

  return (
    <Badge
      variant={isSelected ? "default" : "outline"}
      className={cn(
        "flex items-center gap-2 px-3 py-2 cursor-pointer transition-all duration-200 hover:scale-105",
        isSelected 
          ? "bg-primary text-primary-foreground border-primary" 
          : "bg-background text-foreground border-border hover:border-primary/50"
      )}
      onClick={handleClick}
    >
      {team.logo?.url ? (
        <Image
          src={team.logo.url}
          alt={`${team.teamName} logo`}
          width={16}
          height={16}
          className="rounded-sm"
        />
      ) : (
        <span className="text-xs">🏈</span>
      )}
      <span className="text-sm font-medium">{team.shortName}</span>
      {showRemoveButton && isSelected && onRemove && (
        <button
          onClick={handleRemove}
          className="ml-1 hover:bg-white/20 rounded-full p-0.5 transition-colors"
          aria-label={`Remove ${team.teamName} filter`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </Badge>
  );
}
