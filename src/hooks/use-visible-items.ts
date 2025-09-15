'use client';

import { useState, useEffect, useCallback } from 'react';

interface UseVisibleItemsOptions {
  totalItems: number;
  initialVisibleCount?: number;
  incrementCount?: number;
  threshold?: number;
}

export function useVisibleItems({
  totalItems,
  initialVisibleCount = 6,
  incrementCount = 6,
  threshold = 100,
}: UseVisibleItemsOptions) {
  const [visibleCount, setVisibleCount] = useState(initialVisibleCount);

  const loadMore = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + incrementCount, totalItems));
  }, [incrementCount, totalItems]);

  const reset = useCallback(() => {
    setVisibleCount(initialVisibleCount);
  }, [initialVisibleCount]);

  // Reset when total items change (e.g., when filtering)
  useEffect(() => {
    reset();
  }, [totalItems, reset]);

  const hasMore = visibleCount < totalItems;
  const visibleItems = Math.min(visibleCount, totalItems);

  return {
    visibleCount: visibleItems,
    hasMore,
    loadMore,
    reset,
  };
}
