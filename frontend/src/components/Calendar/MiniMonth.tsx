/**
 * The small month in the Day view's sidebar.
 *
 * It keeps its own month cursor on purpose: paging it does not move the day
 * being shown, so you can look ahead at March without leaving Tuesday. Picking
 * a date is the one thing that moves the Day view — and doing so re-syncs this
 * back to that date's month.
 *
 * Six rows of seven, always, so the panel does not change height as months
 * start on different days.
 */
import { dates } from '@/utils';

export interface MiniMonthProps {
  /** The month on show. */
  year: number;
  month: number;
  /** The day the Day view is on. */
  selectedIso: string;
  onStep: (delta: number) => void;
  onPick: (iso: string) => void;
}

const CELLS = 42;

export function MiniMonth({ year, month, selectedIso, onStep, onPick }: MiniMonthProps) {
  const first = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - first.getDay());
  const todayIso = dates.isoDate();

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
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((letter, index) => (
          <span key={`${letter}${index}`}>{letter}</span>
        ))}
      </div>

      <div className="day-mini-grid">
        {cells.map((date) => {
          const iso = dates.isoDate(date);
          const classes = [
            'day-mini-cell',
            date.getMonth() !== month ? 'is-muted' : '',
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
