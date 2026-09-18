/**
 * In-flow article widgets.
 *
 * Each one exists because a specific fact reads badly as a sentence: a score
 * line, a player's fantasy total against what he actually did, the shape of a
 * series, a franchise's trophy count. They are deliberately unequal in weight —
 * the game marker is a rule across the column, the player line is an
 * annotation hanging off it — so a reader can tell narrative from reference.
 */

import React from 'react';
import { formatScore as fmt } from '@/lib/articles/format';
import s from './article.module.css';


/* ------------------------------------------------------------ game marker */

export interface GameMarkerProps {
  winnerName: string;
  winnerScore: number;
  loserName: string;
  loserScore: number;
  /** e.g. "WEEK HIGH". Margin is always shown; this is appended. */
  tag?: string | null;
  isTie?: boolean;
}

export function GameMarker({
  winnerName, winnerScore, loserName, loserScore, tag, isTie,
}: GameMarkerProps) {
  const margin = winnerScore - loserScore;
  return (
    <div className={s.gameMarker}>
      <span className={s.gameMarkerTeams}>
        {winnerName} <span className={s.mono}>{fmt(winnerScore)}</span>{' '}
        <span className={s.gameMarkerLose}>
          {loserName} <span className={s.mono}>{fmt(loserScore)}</span>
        </span>
      </span>
      <span className={`${s.mono} ${s.gameMarkerMeta}`}>
        {isTie ? 'TIE' : `MARGIN ${fmt(margin)}`}
        {tag ? ` · ${tag}` : ''}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------ player line */

export interface PlayerLineProps {
  /** JADDL fantasy points. */
  points: number;
  name: string;
  /** e.g. "WR · CIN · TB 27 @ CIN 33" — position, NFL team, the real game. */
  meta?: string;
  /** The real box-score line, e.g. "2 of 4 for 12". */
  stat?: string;
  /**
   * The derived note from the brief. Accepts nodes so the load-bearing part —
   * "Pulled after 5 attempts" — can be emphasised without markup in a string.
   */
  note?: React.ReactNode;
  /** Renders the score in the negative colour. Defaults to points below 5. */
  bad?: boolean;
}

export function PlayerLine({ points, name, meta, stat, note, bad }: PlayerLineProps) {
  const isBad = bad ?? points < 5;
  return (
    <div className={s.playerLine}>
      <div className={s.playerTop}>
        <span className={`${s.mono} ${s.playerPts} ${isBad ? s.playerPtsBad : ''}`}>
          {points < 0 ? `−${Math.abs(points).toFixed(1)}` : points.toFixed(1)}
        </span>
        <span className={s.playerName}>{name}</span>
        {meta && <span className={`${s.mono} ${s.playerMeta}`}>{meta}</span>}
      </div>
      {stat && <div className={`${s.mono} ${s.playerStat}`}>{stat}</div>}
      {note && <div className={s.playerNote}>{note}</div>}
    </div>
  );
}

/* ------------------------------------------------------------- series arc */

export interface SeriesArcProps {
  /**
   * One entry per meeting, in order: the first team's cumulative lead in the
   * series after that game. The shape is the point — a series standing alone
   * says nothing about how it got there, which is exactly the mistake this
   * widget exists to stop a writer making.
   */
  differential: number[];
  /** e.g. "Jesus leads 17–16". */
  standing: string;
  leftNote?: string;
  rightNote?: string;
}

export function SeriesArc({ differential, standing, leftNote, rightNote }: SeriesArcProps) {
  if (differential.length < 2) return null;

  const W = 660;
  const H = 78;
  const peak = Math.max(...differential.map(Math.abs), 1);
  const x = (i: number) => (i / (differential.length - 1)) * W;
  const y = (v: number) => H / 2 - (v / peak) * (H / 2 - 6);

  const points = differential.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const maxIdx = differential.indexOf(Math.max(...differential));
  const last = differential.length - 1;

  return (
    <div className={s.arc}>
      <div className={s.arcHead}>
        <span className={`${s.mono} ${s.arcLabel}`}>THE SERIES &middot; {differential.length} MEETINGS</span>
        <span className={s.arcValue}>{standing}</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Series lead across ${differential.length} meetings. ${standing}.`}
      >
        <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="var(--border)" strokeWidth="1" />
        <polyline
          fill="none"
          stroke="var(--foreground)"
          strokeWidth="2"
          strokeLinejoin="round"
          points={points}
        />
        <circle cx={x(maxIdx)} cy={y(differential[maxIdx])} r="3.5" fill="var(--foreground)" />
        <circle cx={x(last)} cy={y(differential[last])} r="3.5" fill="var(--foreground)" />
        {/* Above the peak and centred, so the label never sits on its own dot. */}
        <text
          x={x(maxIdx)}
          y={y(differential[maxIdx]) - 8}
          fontSize="10"
          fill="var(--muted-foreground)"
          fontFamily="monospace"
          textAnchor="middle"
        >
          {differential[maxIdx] > 0 ? `+${differential[maxIdx]}` : differential[maxIdx]}
        </text>
        <text x="4" y={H / 2 - 3} fontSize="9" fill="var(--muted-foreground)" fontFamily="monospace">
          LEVEL
        </text>
      </svg>
      {(leftNote || rightNote) && (
        <div className={s.arcFoot}>
          <span className={s.mono}>{leftNote}</span>
          <span className={s.mono}>{rightNote}</span>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- honors strip */

export interface HonorsStripProps {
  items: { value: number | string; label: string }[];
}

export function HonorsStrip({ items }: HonorsStripProps) {
  return (
    <div className={s.honors}>
      {items.map(item => (
        <div key={item.label}>
          <div className={`${s.mono} ${s.honorsNum} ${item.value === 0 ? s.honorsZero : ''}`}>
            {item.value}
          </div>
          <div className={s.honorsLabel}>{item.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- pull quote */

export function PullQuote({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.pull}>
      <p>{children}</p>
    </div>
  );
}
