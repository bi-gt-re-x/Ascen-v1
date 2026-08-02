/**
 * The month: five or six rows of days, Monday first.
 *
 * A day's number is coloured by how much that day is carrying — light blue
 * through to navy — and today is not treated specially, because today is as
 * busy as it is and the grid is a map of load rather than a calendar of
 * anniversaries. Which day is selected shows as the white dot the stylesheet
 * draws, not as another colour competing with the shading.
 */
import type { ReactNode } from 'react';
import { intensityBlue, intensityFor, type IntensityIndex } from '@/utils/calendarIntensity';
import { dates } from '@/utils';

export interface MonthGridProps {
  year: number;
  month: number;
  /** The store key of the chosen day, "2026-7-4". */
  selectedKey: string | null;
  intensity: IntensityIndex;
  onStep: (delta: number) => void;
  onSelect: (dateKey: string) => void;
  /** Rendered under the dates, in the same column — the progress ring. */
  children?: ReactNode;
}

/** Monday-first, so `getDay()` has to be rotated before it means a column. */
function leadingBlanks(year: number, month: number): number {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

export function MonthGrid({
  year,
  month,
  selectedKey,
  intensity,
  onStep,
  onSelect,
  children,
}: MonthGridProps) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const showingThisMonth = today.getMonth() === month && today.getFullYear() === year;

  return (
    <div className="calendar-left">
      <div className="calendar-header">
        <h2>{dates.formatDate(new Date(year, month, 1), { month: 'long', year: 'numeric' })}</h2>
        <div className="calendar-nav-arrows">
          <button
            type="button"
            className="nav-arrow"
            aria-label="Previous month"
            onClick={() => onStep(-1)}
          >
            ❮
          </button>
          <button
            type="button"
            className="nav-arrow"
            aria-label="Next month"
            onClick={() => onStep(1)}
          >
            ❯
          </button>
        </div>
      </div>

      <div className="calendar-grid day-names-row">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((letter, index) => (
          <div className="day-name" key={`${letter}${index}`}>
            {letter}
          </div>
        ))}
      </div>

      <div className="calendar-grid">
        {Array.from({ length: leadingBlanks(year, month) }, (_, index) => (
          <div className="calendar-day empty" key={`blank-${index}`} />
        ))}

        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          const dateKey = `${year}-${month + 1}-${day}`;
          const load = intensityFor(intensity, dateKey).percentage;
          const classes = [
            'calendar-day',
            showingThisMonth && day === today.getDate() ? 'today' : '',
            selectedKey === dateKey ? 'selected' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div
              className={classes}
              key={dateKey}
              data-date={dateKey}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(dateKey)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                onSelect(dateKey);
              }}
            >
              <span
                className="day-number"
                style={
                  load > 0
                    ? {
                        background: intensityBlue(load),
                        color: load >= 45 ? '#ffffff' : '#0b1b3a',
                      }
                    : undefined
                }
              >
                {day}
              </span>
            </div>
          );
        })}
      </div>

      {children}
    </div>
  );
}
