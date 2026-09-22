'use client';

import React from 'react';

/**
 * The cover figure, plus the one measurement its scroll pan cannot get from
 * CSS.
 *
 * The pan runs from the top of the page to the moment the figure's bottom edge
 * reaches the top of the viewport. That end point is not a `view()` range
 * boundary — `exit 100%` is the same instant, but `exit 0%` starts the range
 * when the figure's TOP reaches the viewport top, which leaves the image
 * sitting still for everything above it. And the distance to the end depends on
 * the sticky site header and on how many lines the headline wrapped to, so it
 * cannot be written as a constant.
 *
 * So the timeline is the root scroller and the range is `0 -> var(--pan-end)`,
 * where `--pan-end` is this element's bottom in document coordinates. That is
 * the only thing measured; the motion itself stays in the stylesheet.
 *
 * Before this runs — and if it never does — the stylesheet's own `--pan-end`
 * of `100vh` applies, which pans over roughly the first screen of scrolling
 * rather than not at all.
 */
export function CoverPan({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const r = el.getBoundingClientRect();
      const end = Math.round(r.top + window.scrollY + r.height);
      // A zero or negative range would make the animation ill-formed while the
      // element is still being laid out.
      el.style.setProperty('--pan-end', `${Math.max(1, end)}px`);
    };

    measure();

    // The end moves when the hero reflows (headline rewrapping at a new width)
    // or when the figure's own height changes, so watch both rather than
    // listening for resize alone.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(document.documentElement);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  return (
    <figure ref={ref} className={className}>
      {children}
    </figure>
  );
}
