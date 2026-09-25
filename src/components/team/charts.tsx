'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const AXIS = 'var(--muted-foreground)';
const INK = 'var(--foreground)';

const tooltipStyle = {
  background: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  fontSize: 12,
  color: 'var(--popover-foreground)',
} as const;

export interface SeasonPoint {
  year: number;
  index: number | null;
  record: string;
  outcome: 'won-title' | 'lost-final' | 'made-playoffs' | 'missed';
  finish: number | null;
  teams: number;
}

/**
 * Scoring index by season, against a fixed par of 100.
 *
 * Plotted as the index rather than raw points-for on purpose: league scoring
 * went from ~92 points a game to ~139, so a raw line mostly draws that step
 * change instead of the team. Par at 100 makes 2007 and 2025 comparable.
 */
export function ScoringIndexChart({
  data,
  insetRight = 8,
}: {
  data: SeasonPoint[];
  /**
   * Extra room on the right of the plot. The uniform mockup laps over this
   * card, and without clearance it sits on top of the two most recent seasons —
   * the ones anyone is actually looking for.
   */
  insetRight?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={data}
        margin={{ top: 12, right: insetRight, bottom: 4, left: -18 }}
      >
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="year"
          tick={{
            fontSize: 11,
            fill: AXIS,
            fontFamily: 'var(--font-mono, monospace)',
          }}
          tickLine={false}
          axisLine={{ stroke: 'var(--border)' }}
          interval="preserveStartEnd"
          minTickGap={18}
        />
        <YAxis
          domain={[
            (dataMin: number) => Math.floor(Math.min(dataMin, 95) - 4),
            (dataMax: number) => Math.ceil(dataMax + 4),
          ]}
          tick={{
            fontSize: 11,
            fill: AXIS,
            fontFamily: 'var(--font-mono, monospace)',
          }}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <ReferenceLine
          y={100}
          stroke={AXIS}
          strokeDasharray="3 3"
          label={{ value: 'par', position: 'right', fontSize: 10, fill: AXIS }}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ stroke: 'var(--border)' }}
          formatter={(v: number) => [v, 'index']}
          labelFormatter={(year, payload) => {
            const p = payload?.[0]?.payload as SeasonPoint | undefined;
            if (!p) return String(year);
            const place = p.finish ? ` · ${p.finish} of ${p.teams}` : '';
            return `${year} · ${p.record}${place}`;
          }}
        />
        <Line
          type="monotone"
          dataKey="index"
          stroke={INK}
          strokeWidth={2}
          connectNulls
          dot={renderOutcomeDot}
          activeDot={{ r: 5, fill: INK }}
          // Recharts gates dot rendering behind an animation-finished flag that
          // does not always fire; the entrance animation buys nothing here anyway.
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/**
 * Marker weight encodes how far a season went.
 *
 * Written as a plain render function returning the element directly: React 19
 * rejects a `key` read off props and then spread back in, which silently
 * produced no dots at all.
 */
function renderOutcomeDot(props: {
  cx?: number;
  cy?: number;
  index?: number;
  payload?: SeasonPoint;
}) {
  const { cx, cy, index, payload } = props;
  const key = `dot-${payload?.year ?? index}`;
  if (cx == null || cy == null || !payload) return <g key={key} />;

  const shared = { cx, cy, key };
  switch (payload.outcome) {
    case 'won-title':
      return (
        <circle
          {...shared}
          r={6}
          fill={INK}
          stroke="var(--background)"
          strokeWidth={2}
        />
      );
    case 'lost-final':
      return (
        <circle
          {...shared}
          r={5}
          fill="var(--background)"
          stroke={INK}
          strokeWidth={2.5}
        />
      );
    case 'made-playoffs':
      return (
        <circle
          {...shared}
          r={3.5}
          fill={AXIS}
          stroke="var(--background)"
          strokeWidth={1.5}
        />
      );
    default:
      return <circle {...shared} r={2} fill={AXIS} opacity={0.5} />;
  }
}

export interface LuckPoint {
  year: number;
  delta: number;
  actual: number;
  expected: number;
}

/**
 * Wins above or below what the team's scoring earned.
 *
 * Expected wins come from the all-play record: for every week, how the team's
 * score would have fared against every other team playing that week. A season
 * bar is actual wins minus that figure.
 */
export function LuckChart({ data }: { data: LuckPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -22 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="year"
          tick={{
            fontSize: 11,
            fill: AXIS,
            fontFamily: 'var(--font-mono, monospace)',
          }}
          tickLine={false}
          axisLine={{ stroke: 'var(--border)' }}
          interval="preserveStartEnd"
          minTickGap={18}
        />
        <YAxis
          tick={{
            fontSize: 11,
            fill: AXIS,
            fontFamily: 'var(--font-mono, monospace)',
          }}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <ReferenceLine y={0} stroke={AXIS} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: 'var(--muted)' }}
          formatter={(v: number, _n, item) => {
            const p = item?.payload as LuckPoint;
            return [
              `${v > 0 ? '+' : ''}${v} · ${p.actual} won, ${p.expected} earned`,
              'vs expectation',
            ];
          }}
        />
        <Bar dataKey="delta" radius={[1, 1, 1, 1]} isAnimationActive={false}>
          {data.map((d) => (
            <Cell
              key={d.year}
              fill={
                d.delta >= 0 ? 'var(--foreground)' : 'var(--muted-foreground)'
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
