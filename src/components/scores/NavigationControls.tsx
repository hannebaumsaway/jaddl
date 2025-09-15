'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface NavigationControlsProps {
  seasonYear: number;
  currentWeek: number;
  availableYears: number[];
  availableWeeks: { week: number; isPlayoff: boolean }[];
  isPlayoffs: boolean;
}

export default function NavigationControls({
  seasonYear,
  currentWeek,
  availableYears,
  availableWeeks,
  isPlayoffs,
}: NavigationControlsProps) {
  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newYear = e.target.value;
    window.location.href = `/scores?year=${newYear}&week=1`;
  };

  const handleWeekChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    const [week, isPlayoffStr] = selectedValue.split('-');
    const weekNum = parseInt(week);
    const isPlayoff = isPlayoffStr === 'playoff';
    
    const url = `/scores?year=${seasonYear}&week=${weekNum}${isPlayoff ? '&playoffs=true' : ''}`;
    window.location.href = url;
  };

  // Build a global chronological list of all weeks across all years
  const buildGlobalWeeksList = () => {
    const allWeeks: Array<{ year: number; week: number; isPlayoff: boolean }> = [];
    
    // Sort years in ascending order for chronological building
    const sortedYears = [...availableYears].sort((a, b) => a - b);
    
    for (const year of sortedYears) {
      // For each year, we need to fetch its weeks - but we only have current year's weeks
      // For now, assume a standard pattern: weeks 1-13 regular season, then 1-3 playoffs
      if (year === seasonYear) {
        // Use the actual available weeks for current year
        availableWeeks.forEach(weekInfo => {
          allWeeks.push({
            year,
            week: weekInfo.week,
            isPlayoff: weekInfo.isPlayoff
          });
        });
      } else {
        // For other years, assume standard structure
        // Regular season weeks 1-13
        for (let week = 1; week <= 13; week++) {
          allWeeks.push({ year, week, isPlayoff: false });
        }
        // Playoff weeks 1-3
        for (let week = 1; week <= 3; week++) {
          allWeeks.push({ year, week, isPlayoff: true });
        }
      }
    }
    
    return allWeeks;
  };

  const allWeeks = buildGlobalWeeksList();
  
  // Find current week index in global list
  const currentWeekIndex = allWeeks.findIndex(
    w => w.year === seasonYear && w.week === currentWeek && w.isPlayoff === isPlayoffs
  );
  
  const prevWeek = currentWeekIndex > 0 ? allWeeks[currentWeekIndex - 1] : null;
  const nextWeek = currentWeekIndex < allWeeks.length - 1 ? allWeeks[currentWeekIndex + 1] : null;

  const formatWeekLabel = (week: number, isPlayoff: boolean, year?: number) => {
    const yearPrefix = year && year !== seasonYear ? `${year} ` : '';
    
    if (isPlayoff) {
      if (week === 1) return `${yearPrefix}Quarterfinals`;
      if (week === 2) return `${yearPrefix}Semifinals`;
      if (week === 3) return `${yearPrefix}Championship`;
      return `${yearPrefix}Playoff Week ${week}`;
    }
    return `${yearPrefix}Week ${week}`;
  };

  const getCurrentWeekValue = () => {
    return `${currentWeek}-${isPlayoffs ? 'playoff' : 'regular'}`;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
      {/* Previous Week Button */}
      <Link href={prevWeek ? 
        `/scores?year=${prevWeek.year}&week=${prevWeek.week}${prevWeek.isPlayoff ? '&playoffs=true' : ''}` : 
        '#'
      }>
        <Button 
          variant="outline" 
          disabled={!prevWeek}
          className="flex items-center gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          {prevWeek ? formatWeekLabel(prevWeek.week, prevWeek.isPlayoff, prevWeek.year) : 'No Earlier'}
        </Button>
      </Link>
      
      {/* Year and Week Selectors */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Season:</span>
          <select
            value={seasonYear}
            onChange={handleYearChange}
            className="px-3 py-1 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            {availableYears.map((year: number) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Week:</span>
          <select
            value={getCurrentWeekValue()}
            onChange={handleWeekChange}
            className="px-3 py-1 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            {availableWeeks.map((weekInfo) => {
              const { week, isPlayoff } = weekInfo;
              const value = `${week}-${isPlayoff ? 'playoff' : 'regular'}`;
              const label = formatWeekLabel(week, isPlayoff);
              
              return (
                <option key={value} value={value}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>
      </div>
      
      {/* Next Week Button */}
      <Link href={nextWeek ? 
        `/scores?year=${nextWeek.year}&week=${nextWeek.week}${nextWeek.isPlayoff ? '&playoffs=true' : ''}` : 
        '#'
      }>
        <Button 
          variant="outline" 
          disabled={!nextWeek}
          className="flex items-center gap-2"
        >
          {nextWeek ? formatWeekLabel(nextWeek.week, nextWeek.isPlayoff, nextWeek.year) : 'No Later'}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </Link>
    </div>
  );
}
