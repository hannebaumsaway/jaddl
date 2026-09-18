/**
 * The week's scores, in the article's right rail.
 *
 * Reference material, not narrative: a reader glances at it while reading the
 * prose, which is why it sticks on desktop rather than scrolling away. On
 * phones the rail stacks above the body, so it collapses to one summary line —
 * six games ahead of the lede would bury the first sentence.
 *
 * The disclosure is a checkbox and a label. `<details>` measured open when it
 * should have been closed, and engines hide its closed content by mechanisms
 * that do not reliably yield to CSS; this is one selector and no JavaScript.
 */

import React from 'react';
import type { WeekSlate } from '@/lib/articles/slate';
import { formatScore as fmt } from '@/lib/articles/format';
import s from './article.module.css';


export function WeekSlateRail({ slate, id = 'slate' }: { slate: WeekSlate; id?: string }) {
  const label = slate.isPlayoff
    ? `ROUND ${slate.week} · ${slate.year}`
    : `WEEK ${slate.week} · ${slate.year}`;

  return (
    <div className={s.slate}>
      <input
        type="checkbox"
        id={`${id}-toggle`}
        className={s.slateToggle}
        aria-controls={`${id}-body`}
      />
      {/* Visible only below 900px; the desktop rail is always open. */}
      <label className={s.slateSummary} htmlFor={`${id}-toggle`}>
        <span className={`${s.mono} ${s.sumLabel}`}>THE SLATE</span>
        <span className={`${s.mono} ${s.sumNums}`}>
          {slate.games.length} GAME{slate.games.length === 1 ? '' : 'S'} &middot; HIGH {fmt(slate.high)}
        </span>
      </label>

      <div className={s.slateBody} id={`${id}-body`}>
        <div className={s.slateHead}>
          <span className={`${s.mono} ${s.slateHeadLabel}`}>THE SLATE</span>
          <span className={`${s.mono} ${s.slateHeadNum}`}>{label}</span>
        </div>

        {slate.games.map((game, i) => (
          <div className={s.slateGame} key={`${game.winner.teamId}-${game.loser.teamId}-${i}`}>
            <div className={s.slateRow}>
              <span className={s.slateName}>{game.winner.name}</span>
              <span className={`${s.mono} ${s.slateValue}`}>{fmt(game.winner.score)}</span>
            </div>
            <div className={`${s.slateRow} ${s.slateLose}`}>
              <span className={s.slateName}>{game.loser.name}</span>
              <span className={`${s.mono} ${s.slateValue}`}>{fmt(game.loser.score)}</span>
            </div>
            {game.tag && <span className={`${s.mono} ${s.slateTag}`}>{game.tag}</span>}
          </div>
        ))}

        <div className={s.slateFoot}>
          <span className={s.mono}>HIGH {fmt(slate.high)}</span>
          <span className={s.mono}>LOW {fmt(slate.low)}</span>
          <span className={s.mono}>AVG {fmt(slate.avg)}</span>
        </div>
      </div>
    </div>
  );
}
