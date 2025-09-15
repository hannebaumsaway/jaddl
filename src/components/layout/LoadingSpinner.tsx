import React from 'react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div 
      className={cn(
        'animate-spin rounded-full border-2 border-muted border-t-primary',
        sizeClasses[size],
        className
      )}
    />
  );
}

export function LoadingCard() {
  return (
    <div className="league-card animate-pulse">
      <div className="p-6">
        <div className="h-4 bg-muted w-3/4 mb-2"></div>
        <div className="h-3 bg-muted w-1/2 mb-4"></div>
        <div className="space-y-2">
          <div className="h-3 bg-muted"></div>
          <div className="h-3 bg-muted w-5/6"></div>
        </div>
      </div>
    </div>
  );
}

export function LoadingPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center">
        <LoadingSpinner size="lg" className="mx-auto mb-4" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
