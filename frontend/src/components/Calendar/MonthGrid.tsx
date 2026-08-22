/**
 * The month: six rows of seven, Monday first, drawn as a table of cells.
 *
 * It used to be twenty-eight bare numbers floating on the page, and a number
 * on its own says only that the day exists. Each cell now carries what the day
 * is actually holding — how many things are on it and what they are worth —
 * so the grid can be read as a map of the month rather than as a date picker
 * with shading.
 *
 * The number itself keeps its shading: light blue for a light day through to
 * navy for a heavy one, weighted by priority and measured against the busiest
 * day on screen (see utils/calendarIntensity). Today is the one cell with a
 * tinted background, and the day the panel is showing carries a ring.
 *
 * The rows always add to six, so stepping between a five-row month and a
 * six-row one does not resize the grid under the reader's cursor. The days
 * that fill the corners belong to the neighbouring months and are drawn as
 * such — dimmed, and carrying no counts, because they are context rather than
 * content. Clicking one still goes there.
 */
import { useMemo } from 'react';
import {
  intensityBlue,
  intensityFor,
  type IntensityIndex,
} from '@/utils/calendarIntensity';
import type { MonthDay } from '@/utils/monthSummary';
import { dates } from '@/utils';

/** Six rows of seven — the grid never changes height between months. */
const CELLS = 42;

/** Sunday first, and rotated to the week's opening day before it is drawn. */
const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export interface MonthGridProps {
  year: number;
  month: number;
  /** The store key of the chosen day, "2026-8-6". */
  selectedKey: string | null;
  /** 1 for a Monday-first grid (the default), 0 for Sunday-first. From the
      account's preferences — see MiniMonth, which takes the same. */
  weekStart?: 0 | 1;
  intensity: IntensityIndex;
  /** Every day of the month, counted — see utils/monthSummary. */
  days: MonthDay[];
  onStep: (delta: number) => void;
  /** Back to the current month, with today selected. */
  onToday: () => void;
  /** A day of this month, by its store key. */
  onSelect: (dateKey: string) => void;
  /**
   * A day of a neighbouring month. The view has to step there as well as
   * select it, which is why this is not `onSelect`.
   */
  onSelectOther: (date: Date) => void;
  /** The view switcher, rendered on the header's right-hand end. */
  tools?: React.ReactNode;
  /** Rendered under the dates, in the same column — the summary strip. */
  children?: React.ReactNode;
}

/** How many cells of the previous month the grid opens with.
 *
 * `getDay()` counts from Sunday, so it has to be rotated by the day the week
 * opens on before it means a column. `+ 7` keeps the modulo positive.
 */
function leadingBlanks(year: number, month: number, weekStart: 0 | 1): number {
  return (new Date(year, month, 1).getDay() - weekStart + 7) % 7;
}

export function MonthGrid({
  year,
  month,
  selectedKey,
  weekStart = 1,
  intensity,
  days,
  onStep,
  onToday,
  onSelect,
  onSelectOther,
  tools,
  children,
}: MonthGridProps) {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  const thisMonth = today.getMonth() === month && today.getFullYear() === year;

  // The 42 dates the grid draws, whichever months they belong to. Built from
  // one running Date so the month boundaries take care of themselves.
  const cells = useMemo(() => {
    const first = new Date(year, month, 1 - leadingBlanks(year, month, weekStart));
    return Array.from({ length: CELLS }, (_, index) => {
      const date = dates.addDays(first, index);
      return {
        date,
        key: `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
        inMonth: date.getMonth() === month && date.getFullYear() === year,
      };
    });
  }, [month, weekStart, year]);

  /** The seven headings, opening on the same day the cells do. */
  const names = useMemo(
    () => (weekStart === 1 ? [...DAY_NAMES.slice(1), DAY_NAMES[0]!] : DAY_NAMES),
    [weekStart],
  );

  const byKey = useMemo(
    () => new Map(days.map((day) => [day.key, day])),
    [days],
  );

  return (
    <div className="mv-left">
      <div className="mv-header">
        <h2 className="mv-title">
          {dates.formatDate(new Date(year, month, 1), { month: 'long', year: 'numeric' })}
        </h2>
        <div className="mv-nav">
          <button
            type="button"
            className="mv-arrow"
            aria-label="Previous month"
            onClick={() => onStep(-1)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 5 8 12l7 7" />
            </svg>
          </button>
          <button
            type="button"
            className="mv-arrow"
            aria-label="Next month"
            onClick={() => onStep(1)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m9 5 7 7-7 7" />
            </svg>
          </button>
        </div>
        {/* Disabled on the month it would take you to, which is the only
            honest state for a button that would do nothing. */}
        <button type="button" className="mv-today" disabled={thisMonth} onClick={onToday}>
          Today
        </button>
        {tools && <div className="mv-headtools">{tools}</div>}
      </div>

      <div className="mv-daynames" aria-hidden="true">
        {names.map((name) => (
          <div className="mv-dayname" key={name}>
            {name}
          </div>
        ))}
      </div>

      <div className="mv-grid" role="grid">
        {cells.map((cell) => {
          if (!cell.inMonth) {
            return (
              <div
                className="mv-cell is-outside"
                key={cell.key}
                role="button"
                tabIndex={-1}
                onClick={() => onSelectOther(cell.date)}
              >
                <span className="mv-daynum">{cell.date.getDate()}</span>
              </div>
            );
          }

          const day = byKey.get(cell.key);
          const load = intensityFor(intensity, cell.key).percentage;
          const classes = [
            'mv-cell',
            cell.key === todayKey ? 'is-today' : '',
            cell.key === selectedKey ? 'is-selected' : '',
          ]
            .filter(Boolean)
            .join(' ');

          const count = day?.events ?? 0;
          const xp = day?.xp ?? 0;

          return (
            <div
              className={classes}
              key={cell.key}
              data-date={cell.key}
              role="button"
              tabIndex={0}
              aria-label={`${dates.formatDate(cell.date, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}: ${count} ${count === 1 ? 'event' : 'events'}, ${xp} XP`}
              onClick={() => onSelect(cell.key)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                onSelect(cell.key);
              }}
            >
              <span
                className="mv-daynum"
                style={
                  load > 0
                    ? {
                        background: intensityBlue(load),
                        color: load >= 45 ? '#ffffff' : '#0b1b3a',
                      }
                    : undefined
                }
              >
                {cell.date.getDate()}
              </span>
              <span className="mv-cell-events">
                <i className="mv-cell-dot" aria-hidden="true" />
                {count} {count === 1 ? 'event' : 'events'}
              </span>
              <span className={`mv-cell-xp${xp > 0 ? '' : ' is-zero'}`}>
                {xp.toLocaleString()} XP
              </span>
            </div>
          );
        })}
      </div>

      {children}
    </div>
  );
}
