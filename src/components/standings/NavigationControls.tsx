'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface NavigationControlsProps {
  seasonYear: number;
  availableYears: number[];
  prevYear: number | null;
  nextYear: number | null;
}

export default function NavigationControls({
  seasonYear,
  availableYears,
  prevYear,
  nextYear,
}: NavigationControlsProps) {
  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newYear = e.target.value;
    window.location.href = `/standings?year=${newYear}`;
  };

  return (
    <div className="flex items-center justify-center gap-4 mb-6">
      <Link href={prevYear ? `/standings?year=${prevYear}` : '#'}>
        <Button 
          variant="outline" 
          disabled={!prevYear}
          className="flex items-center gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          {prevYear || 'No Earlier'}
        </Button>
      </Link>
      
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
      
      <Link href={nextYear ? `/standings?year=${nextYear}` : '#'}>
        <Button 
          variant="outline" 
          disabled={!nextYear}
          className="flex items-center gap-2"
        >
          {nextYear || 'No Later'}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </Link>
    </div>
  );
}
