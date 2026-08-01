/**
 * Back, forward, and what period is showing.
 *
 * Shared by all three calendar views, which differ only in how far a step
 * moves — so the step is the caller's business and this only asks for it.
 */
import type { ReactNode } from 'react';

export interface DateNavProps {
  /** "July 27 – August 2, 2026", "August 2026", "Friday, August 1". */
  label: ReactNode;
  onPrevious: () => void;
  onNext: () => void;
  onToday?: () => void;
  /** What a step moves by, for the button labels. */
  unit?: 'day' | 'week' | 'month';
}

export function DateNav({
  label,
  onPrevious,
  onNext,
  onToday,
  unit = 'week',
}: DateNavProps) {
  return (
    <div className="calendar-datenav">
      <h1 className="calendar-period">{label}</h1>
      <div className="calendar-datenav-buttons">
        <button
          type="button"
          onClick={onPrevious}
          aria-label={`Previous ${unit}`}
          className="calendar-step"
        >
          &lsaquo;
        </button>
        <button
          type="button"
          onClick={onNext}
          aria-label={`Next ${unit}`}
          className="calendar-step"
        >
          &rsaquo;
        </button>
        {onToday && (
          <button type="button" onClick={onToday} className="calendar-today">
            Today
          </button>
        )}
      </div>
    </div>
  );
}
