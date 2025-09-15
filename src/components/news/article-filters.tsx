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

export interface FilterState {
  year?: number;
  week?: number;
  isPlayoff?: boolean;
  tags: string[];
}

interface ArticleFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  availableYears: number[];
  availableTags: string[];
  className?: string;
  isExpanded?: boolean;
}

export function ArticleFilters({
  filters,
  onFiltersChange,
  availableYears,
  availableTags,
  className,
  isExpanded = false
}: ArticleFiltersProps) {
  
  const hasActiveFilters = 
    filters.year !== undefined || 
    filters.week !== undefined || 
    filters.isPlayoff !== undefined || 
    filters.tags.length > 0;

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

  const clearAllFilters = () => {
    onFiltersChange({
      year: undefined,
      week: undefined,
      isPlayoff: undefined,
      tags: []
    });
  };

  const weekOptions = Array.from({ length: 21 }, (_, i) => i);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Clear All Button */}
      {hasActiveFilters && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Clear All
          </Button>
        </div>
      )}

      {/* Active Filters */}
      {hasActiveFilters && (
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
            <Badge key={tag} variant="secondary" className="flex items-center gap-1">
              {tag}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => handleTagToggle(tag)}
              />
            </Badge>
          ))}
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
          <div className="flex items-center space-x-2">
            <Checkbox
              id="playoff-filter"
              checked={filters.isPlayoff === true}
              onCheckedChange={handlePlayoffChange}
            />
            <Label htmlFor="playoff-filter" className="text-sm font-medium">
              Playoff articles only
            </Label>
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
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors font-mono font-normal"
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
