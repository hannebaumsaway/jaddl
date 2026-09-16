'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Observation } from '@/lib/teams';
import { cn } from '@/lib/utils';

const INTERVAL_MS = 6000;

/**
 * A rotating "did you know" card.
 *
 * Auto-advances until the reader takes over: touching either arrow stops the
 * timer for good, on the reasonable assumption that someone steering does not
 * want the thing moving underneath them. It also holds while hovered or
 * keyboard-focused, because prose that swaps mid-sentence loses the reader,
 * and it never auto-advances at all when the system asks for reduced motion.
 */
export function Observations({
  observations,
  className,
}: {
  observations: Observation[];
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [taken, setTaken] = useState(false);
  const [held, setHeld] = useState(false);
  const timer = useRef<number | null>(null);

  const count = observations.length;

  // Tear the timer down imperatively rather than leaving it to the effect's
  // cleanup: the click that takes control has to stop the rotation on the spot,
  // not on whatever render happens next.
  const stop = useCallback(() => {
    if (timer.current !== null) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const go = useCallback(
    (delta: number) => {
      stop();
      setTaken(true);
      setIndex(i => (i + delta + count) % count);
    },
    [count, stop]
  );

  useEffect(() => {
    stop();
    if (taken || held || count < 2) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    timer.current = window.setInterval(() => setIndex(i => (i + 1) % count), INTERVAL_MS);
    return stop;
  }, [taken, held, count, stop]);

  if (count === 0) return null;
  const current = observations[index];

  return (
    <section
      className={cn('flex min-w-0 flex-col border border-border bg-card p-4 sm:p-5', className)}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={() => setHeld(false)}
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-mono text-[0.65rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Did you know
        </h2>
        {count > 1 && (
          <div className="flex items-center gap-3">
            <span className="font-mono text-[0.65rem] tabular-nums text-muted-foreground">
              {index + 1}/{count}
            </span>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous observation"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next observation"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Measure capped near 58 characters and centred in the card. The fixed
          minimum height keeps a longer fact from shoving the page around as the
          card cycles, and centring vertically stops short ones sitting high. */}
      <div className="flex min-h-[5.5rem] items-center justify-center sm:min-h-[4.5rem]">
        <p
          key={current.id}
          className="observation-text mx-auto max-w-[58ch] text-balance text-center text-[0.95rem] leading-relaxed sm:text-base"
        >
          {current.text}
        </p>
      </div>

      {count > 1 && (
        <div aria-hidden className="mt-4 flex gap-1">
          {observations.map((o, i) => (
            <span
              key={o.id}
              className={cn(
                'h-px flex-1 transition-colors',
                i === index ? 'bg-foreground' : 'bg-border'
              )}
            />
          ))}
        </div>
      )}

      <style>{`
        .observation-text { animation: obs-in 320ms ease-out both; }
        @keyframes obs-in {
          from { opacity: 0; transform: translateY(3px); }
          to   { opacity: 1; transform: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .observation-text { animation: none; }
        }
      `}</style>
    </section>
  );
}
