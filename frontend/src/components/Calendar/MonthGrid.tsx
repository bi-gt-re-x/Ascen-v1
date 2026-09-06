/**
 * The month: six rows of seven, Monday first, drawn as a table of cells.
 *
 * It used to be twenty-eight bare numbers floating on the page, and a number
 * on its own says only that the day exists. Each cell now carries what the day
 * is actually holding — how many things are on it, what they are worth, and
 * how much of it got done — so the grid can be read as a map of the month
 * rather than as a date picker with shading.
 *
 * **A day with nothing on it says nothing.** It used to say "0 events" and
 * "0 XP", and in a month with a few busy days that is thirty cells of the same
 * two zeroes: the reader's eye has to skip past a paragraph of noise to find
 * the four days that are not empty. An empty day is now the number alone, and
 * the difference between an empty grid and a full one is visible from across
 * the room.
 *
 * The bar along a cell's foot is the day's tasks, done against scheduled. It
 * is the one thing the grid could not say before at all — the counts tell you
 * a day was busy and never whether it went well — and it is drawn as a rule
 * rather than a figure because forty-two of anything has to be readable
 * without being read.
 *
 * The number is a filled badge, coloured by what the day is worth. It used to
 * be shaded by priority-weighted load measured against the busiest day *on
 * screen*, which meant the same Tuesday changed colour when you stepped to a
 * month with a heavier day in it and no colour meant anything you could write
 * down. The bands are fixed now (`XP_BANDS` in utils/monthSummary) and the
 * legend under the grid says what each one is — which is the difference
 * between a heat map and a key.
 *
 * Today is the one cell with a tinted background and carries a star; the day
 * the panel is showing carries a ring.
 *
 * The rows always add to six, so stepping between a five-row month and a
 * six-row one does not resize the grid under the reader's cursor. The days
 * that fill the corners belong to the neighbouring months and are drawn as
 * such — dimmed, and carrying no counts, because they are context rather than
 * content. Clicking one still goes there.
 */
import { useMemo } from 'react';
import { XP_BANDS, xpBand, type MonthDay } from '@/utils/monthSummary';
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

      {/* The headings and the cells are one card now. They were two objects
          with a gap between them, which left the grid reading as a table
          somebody had dropped a row of labels above rather than as the
          calendar it is. */}
      <div className="mv-card">
        <div className="mv-daynames" aria-hidden="true">
          {names.map((name, index) => (
            <div
              className={`mv-dayname${
                (weekStart === 1 ? index >= 5 : index === 0 || index === 6)
                  ? ' is-weekend'
                  : ''
              }`}
              key={name}
            >
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
          const count = day?.events ?? 0;
          const xp = day?.xp ?? 0;
          const tasks = day?.tasks ?? 0;
          const done = day?.done ?? 0;
          const settled = Boolean(day?.settled);
          const weekend = cell.date.getDay() === 0 || cell.date.getDay() === 6;
          const band = xpBand(xp);
          const isToday = cell.key === todayKey;

          const classes = [
            'mv-cell',
            isToday ? 'is-today' : '',
            cell.key === selectedKey ? 'is-selected' : '',
            count === 0 ? 'is-empty' : '',
            settled ? 'is-settled' : '',
            weekend ? 'is-weekend' : '',
          ]
            .filter(Boolean)
            .join(' ');

          /* Said in full for a screen reader, because the cell itself says it
             in dots and a rule. An empty day is "nothing on it" rather than a
             recitation of zeroes, for the same reason it draws nothing. */
          const spoken = count
            ? `${count} ${count === 1 ? 'thing' : 'things'}, ${xp} XP`
              + (tasks ? `, ${done} of ${tasks} tasks done` : '')
            : 'nothing on it';

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
              })}: ${spoken}`}
              onClick={() => onSelect(cell.key)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                onSelect(cell.key);
              }}
            >
              <span className="mv-cell-top">
                <span className={`mv-daynum band-${band}`}>{cell.date.getDate()}</span>

                {/* Today wears a star and a finished day wears a tick, and no
                    day wears both — today is not finished until it is, and on
                    the day it is the tick is the better news. */}
                {settled ? (
                  <span
                    className="mv-cell-flag is-clear"
                    aria-hidden="true"
                    title="Everything on this day is done"
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="m5 12.5 4.5 4.5L19 7.5" />
                    </svg>
                  </span>
                ) : isToday ? (
                  <span className="mv-cell-flag is-today" aria-hidden="true" title="Today">
                    <svg viewBox="0 0 24 24">
                      <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9-5.3-2.8-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8z" />
                    </svg>
                  </span>
                ) : null}
              </span>

              {count > 0 && (
                <span className="mv-cell-meta">
                  <span className="mv-cell-events">
                    <i className="mv-cell-dot" aria-hidden="true" />
                    {count}
                  </span>
                  {xp > 0 && (
                    <span className="mv-cell-xp">{xp.toLocaleString()} XP</span>
                  )}
                </span>
              )}

              {/* The day's things, one segment each, in their own bands — so a
                  day reads as "four things, two of them big" without the reader
                  having to turn a number back into an impression. A finished
                  task's segment is filled; an unfinished one is the same colour
                  at a quarter strength, which is how the row doubles as the
                  day's progress. */}
              {day && day.marks.length > 0 && (
                <span className="mv-cell-marks" aria-hidden="true">
                  {day.marks.map((mark, index) => (
                    <i
                      key={index}
                      className={`mv-mark band-${mark}${index < done ? ' is-done' : ''}`}
                    />
                  ))}
                </span>
              )}
              {!day?.marks.length && tasks > 0 && (
                <span className="mv-cell-marks" aria-hidden="true" />
              )}
            </div>
          );
        })}
        </div>

        {/* The key. A colour that cannot be looked up is decoration, and the
            whole point of moving off "shaded against the busiest day on
            screen" was that these bands are fixed enough to be written down.
            Inside the card, under the cells it explains. */}
        <ul className="mv-legend">
          {XP_BANDS.map((entry) => (
            <li key={entry.key}>
              <i className={`mv-legend-dot band-${entry.key}`} aria-hidden="true" />
              {entry.label}
              {entry.note && <span className="mv-legend-note">({entry.note})</span>}
            </li>
          ))}
        </ul>
      </div>

      {children}
    </div>
  );
}
