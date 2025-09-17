'use client';

import React from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { TeamFilterChip } from './team-filter-chip';

export interface FilterState {
  year?: number;
  week?: number;
  isPlayoff?: boolean;
  tags: string[];
  featuredTeams: number[];
}

interface ArticleFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  availableYears: number[];
  availableTags: string[];
  availableTeams: {
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
  }[];
  className?: string;
  isExpanded?: boolean;
}

export function ArticleFilters({
  filters,
  onFiltersChange,
  availableYears,
  availableTags,
  availableTeams,
  className,
  isExpanded = false
}: ArticleFiltersProps) {
  
  const hasActiveFilters = 
    filters.year !== undefined || 
    filters.week !== undefined || 
    filters.isPlayoff !== undefined || 
    filters.tags.length > 0 ||
    filters.featuredTeams.length > 0;

  const handleYearChange = (value: string) => {
    const year = value === 'all' ? undefined : parseInt(value);
    onFiltersChange({ ...filters, year });
  };

  const handleWeekChange = (value: string) => {
    const week = value === 'all' ? undefined : parseInt(value);
    onFiltersChange({ ...filters, week });
  };

  const handlePlayoffChange = (checked: boolean) => {
    onFiltersChange({ ...filters, isPlayoff: checked ? true : undefined });
  };

  const handleTagToggle = (tag: string) => {
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter(t => t !== tag)
      : [...filters.tags, tag];
    onFiltersChange({ ...filters, tags: newTags });
  };

  const handleTeamToggle = (teamId: number) => {
    const newTeams = filters.featuredTeams.includes(teamId)
      ? filters.featuredTeams.filter(id => id !== teamId)
      : [...filters.featuredTeams, teamId];
    onFiltersChange({ ...filters, featuredTeams: newTeams });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      year: undefined,
      week: undefined,
      isPlayoff: undefined,
      tags: [],
      featuredTeams: []
    });
  };

  const weekOptions = Array.from({ length: 21 }, (_, i) => i);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Active Filters and Clear All Button */}
      {hasActiveFilters && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Active Filters */}
          <div className="flex flex-wrap gap-2">
            {filters.year !== undefined && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Year: {filters.year}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => onFiltersChange({ ...filters, year: undefined })}
                />
              </Badge>
            )}
            {filters.week !== undefined && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Week: {filters.week}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => onFiltersChange({ ...filters, week: undefined })}
                />
              </Badge>
            )}
            {filters.isPlayoff !== undefined && (
              <Badge variant="secondary" className="flex items-center gap-1">
                {filters.isPlayoff ? 'Playoffs' : 'Regular Season'}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => onFiltersChange({ ...filters, isPlayoff: undefined })}
                />
              </Badge>
            )}
            {filters.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="flex items-center gap-1 [text-transform:lowercase!important]">
                {tag}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => handleTagToggle(tag)}
                />
              </Badge>
            ))}
            {filters.featuredTeams.map(teamId => {
              const team = availableTeams.find(t => t.teamId === teamId);
              if (!team) return null;
              return (
                <Badge key={teamId} variant="secondary" className="flex items-center gap-1">
                  {team.logo?.url ? (
                    <img
                      src={team.logo.url}
                      alt={`${team.teamName} logo`}
                      className="w-3 h-3 rounded-sm"
                    />
                  ) : (
                    <span className="text-xs">🏈</span>
                  )}
                  {team.shortName}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => handleTeamToggle(teamId)}
                  />
                </Badge>
              );
            })}
          </div>
          
          {/* Clear All Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="text-muted-foreground hover:text-foreground self-start sm:self-center"
          >
            <X className="h-4 w-4 mr-1" />
            Clear All
          </Button>
        </div>
      )}

      {/* Filter Options */}
      {isExpanded && (
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Year Filter */}
            <div className="space-y-2">
              <Label htmlFor="year-filter">Year</Label>
              <Select
                value={filters.year?.toString() || 'all'}
                onValueChange={handleYearChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent className="bg-white border shadow-lg z-50">
                  <SelectItem value="all">All Years</SelectItem>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Week Filter */}
            <div className="space-y-2">
              <Label htmlFor="week-filter">Week</Label>
              <Select
                value={filters.week?.toString() || 'all'}
                onValueChange={handleWeekChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select week" />
                </SelectTrigger>
                <SelectContent className="bg-white border shadow-lg z-50">
                  <SelectItem value="all">All Weeks</SelectItem>
                  {weekOptions.map(week => (
                    <SelectItem key={week} value={week.toString()}>
                      {week === 0 ? 'Preseason/Draft' : `Week ${week}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Playoff Filter */}
          <div className="flex items-center space-x-3 p-3 bg-background border rounded-lg hover:bg-muted/50 transition-colors">
            <Checkbox
              id="playoff-filter"
              checked={filters.isPlayoff === true}
              onCheckedChange={handlePlayoffChange}
              className="border-2 border-primary data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <Label 
              htmlFor="playoff-filter" 
              className="text-sm font-medium cursor-pointer flex-1"
            >
              Playoff articles only
            </Label>
          </div>

          <Separator />

          {/* Teams Filter */}
          <div className="space-y-2">
            <Label>Featured Teams</Label>
            <div className="max-h-32 overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {availableTeams.map(team => (
                  <TeamFilterChip
                    key={team.teamId}
                    team={team}
                    isSelected={filters.featuredTeams.includes(team.teamId)}
                    onToggle={handleTeamToggle}
                  />
                ))}
              </div>
            </div>
          </div>

          <Separator />

          {/* Tags Filter */}
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="max-h-32 overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {availableTags.map(tag => (
                  <Badge
                    key={tag}
                    variant={filters.tags.includes(tag) ? "default" : "outline"}
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors font-mono font-normal [text-transform:lowercase!important]"
                    onClick={() => handleTagToggle(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
