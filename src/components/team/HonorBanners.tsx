'use client';

import { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Honor {
  kind: 'championship' | 'group';
  year: number;
  label?: string;
}

/**
 * The pennant rail: championships first, then division/quad titles, each
 * most-recent first.
 *
 * The rail hugs its content and stops growing at a maximum, past which it
 * scrolls horizontally. Mighty Boom already carry ten honors and the league
 * mints five a season, so the count is unbounded — a rail that sized itself to
 * the honors would eventually leave the team name no room.
 */
export function HonorBanners({ honors }: { honors: Honor[] }) {
  const [ref, embla] = useEmblaCarousel({ align: 'start', containScroll: 'trimSnaps', dragFree: true });
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const sync = useCallback(() => {
    if (!embla) return;
    setCanPrev(embla.canScrollPrev());
    setCanNext(embla.canScrollNext());
  }, [embla]);

  useEffect(() => {
    if (!embla) return;
    sync();
    embla.on('select', sync).on('reInit', sync).on('scroll', sync);
  }, [embla, sync]);

  if (honors.length === 0) return null;
  const scrollable = canPrev || canNext;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="relative max-w-[min(100%,49rem)]">
        {/* Edge fades signal that the rail continues past the clip. */}
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-background to-transparent transition-opacity',
            canPrev ? 'opacity-100' : 'opacity-0'
          )}
        />
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-background to-transparent transition-opacity',
            canNext ? 'opacity-100' : 'opacity-0'
          )}
        />
        <div className="overflow-hidden" ref={ref}>
          <ul className="flex gap-1.5 sm:gap-2">
            {honors.map(h => (
              <li key={`${h.kind}-${h.year}`} className="shrink-0">
                <Banner honor={h} />
              </li>
            ))}
          </ul>
        </div>
      </div>

      {scrollable && (
        <div className="flex items-center gap-3 pr-1">
          <button
            type="button"
            onClick={() => embla?.scrollPrev()}
            disabled={!canPrev}
            aria-label="Earlier honors"
            className="text-muted-foreground transition-opacity hover:text-foreground disabled:opacity-25"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => embla?.scrollNext()}
            disabled={!canNext}
            aria-label="Later honors"
            className="text-muted-foreground transition-opacity hover:text-foreground disabled:opacity-25"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

/** A pennant. Swallowtail hem via clip-path, matching the design. */
function Banner({ honor }: { honor: Honor }) {
  const champ = honor.kind === 'championship';
  return (
    <div
      title={champ ? `League champion, ${honor.year}` : `${honor.label ?? 'Division'} winner, ${honor.year}`}
      style={{ clipPath: 'polygon(0 0,100% 0,100% 100%,75% 88%,50% 100%,25% 88%,0 100%)' }}
      className={cn(
        'flex h-[4.5rem] w-[3.25rem] flex-col items-center gap-1 pt-2 sm:h-[6.25rem] sm:w-[4.5rem] sm:pt-3',
        champ
          ? 'bg-foreground text-background'
          : 'justify-center border border-border bg-muted pt-0 text-foreground'
      )}
    >
      {champ ? (
        <span
          aria-hidden
          style={{ clipPath: 'polygon(0 0,100% 0,100% 62%,50% 100%,0 62%)' }}
          className="block h-4 w-3.5 bg-background sm:h-6 sm:w-5"
        />
      ) : (
        <span className="block font-mono text-[0.4rem] uppercase tracking-[0.1em] text-muted-foreground sm:text-[0.5rem]">
          {honor.label ?? 'Division'}
        </span>
      )}
      <span className="font-mono text-[0.65rem] font-semibold tabular-nums sm:text-sm">{honor.year}</span>
    </div>
  );
}
