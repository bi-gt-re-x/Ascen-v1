/**
 * The small month in the Day and Week views' sidebars.
 *
 * It keeps its own month cursor on purpose: paging it does not move the day or
 * the week being shown, so you can look ahead at March without leaving
 * Tuesday. Picking a date is the one thing that moves the view — and doing so
 * re-syncs this back to that date's month.
 *
 * Six rows of seven, always, so the panel does not change height as months
 * start on different days.
 *
 * **Two callers, two ways of saying "here".** The Day view is on one day and
 * passes `selectedIso`, which fills that cell. The Week view is on seven and
 * passes `fromIso`/`toIso`, which bands the row.
 *
 * Both pass `weekStart`, and the Week view is why the prop exists: a week laid
 * on a grid that opens on a different day is not a row at all — it is the tail
 * of one and the head of the next, and a band split across two lines is worse
 * than no band. Which day that is comes from the account (Settings, Calendar);
 * it was fixed at Monday here and Sunday in the Day view until it did, and two
 * calendars in one app disagreeing about where a week begins is the kind of
 * detail a reader notices immediately.
 */
import { dates } from '@/utils';

export interface MiniMonthProps {
  /** The month on show. */
  year: number;
  month: number;
  /** The day the Day view is on. Fills one cell. */
  selectedIso?: string;
  /** An inclusive span to band — the Week view's seven days. */
  fromIso?: string;
  toIso?: string;
  /** 0 for a Sunday-first grid (the default), 1 for Monday-first. */
  weekStart?: 0 | 1;
  onStep: (delta: number) => void;
  onPick: (iso: string) => void;
}

const CELLS = 42;

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function MiniMonth({
  year,
  month,
  selectedIso,
  fromIso,
  toIso,
  weekStart = 0,
  onStep,
  onPick,
}: MiniMonthProps) {
  const first = new Date(year, month, 1);
  // How far back the grid reaches to find the first cell of the week the 1st
  // falls in. `+ 7` keeps the modulo positive when weekStart is ahead of the
  // day the month opens on.
  const lead = (first.getDay() - weekStart + 7) % 7;
  const gridStart = new Date(year, month, 1 - lead);
  const todayIso = dates.isoDate();
  const letters = weekStart === 1 ? [...DOW.slice(1), DOW[0]!] : DOW;

  const cells = Array.from({ length: CELLS }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });

  return (
    <section className="wk-panel day-mini-panel">
      <div className="day-mini-head">
        <span className="day-mini-title">
          {dates.formatDate(first, { month: 'long', year: 'numeric' })}
        </span>
        <div className="day-mini-nav">
          <button
            type="button"
            className="day-mini-arrow"
            aria-label="Previous month"
            onClick={() => onStep(-1)}
          >
            ❮
          </button>
          <button
            type="button"
            className="day-mini-arrow"
            aria-label="Next month"
            onClick={() => onStep(1)}
          >
            ❯
          </button>
        </div>
      </div>

      <div className="day-mini-dow">
        {letters.map((letter, index) => (
          <span key={`${letter}${index}`}>{letter}</span>
        ))}
      </div>

      <div className="day-mini-grid">
        {cells.map((date) => {
          const iso = dates.isoDate(date);
          // The band is drawn cell by cell rather than as one element behind
          // the row: the grid has a 2px gap, and a single bar under seven cells
          // would have to sit outside it. The two ends round themselves.
          const banded = Boolean(fromIso && toIso && iso >= fromIso && iso <= toIso);
          const classes = [
            'day-mini-cell',
            date.getMonth() !== month ? 'is-muted' : '',
            banded ? 'is-inweek' : '',
            banded && iso === fromIso ? 'is-week-head' : '',
            banded && iso === toIso ? 'is-week-tail' : '',
            iso === todayIso ? 'is-today' : '',
            iso === selectedIso ? 'is-selected' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <button
              key={iso}
              type="button"
              className={classes}
              data-iso={iso}
              onClick={() => onPick(iso)}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </section>
  );
}
