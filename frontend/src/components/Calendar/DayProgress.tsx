/**
 * "Day Completion Progress" — the ring under the month grid.
 *
 * It sits in the left column, below the dates, rather than with the day's
 * cards: it is a summary of the day the grid has selected, and the stylesheet
 * places it there (`.calendar-left #taskCounter.task-counter`).
 *
 * The dash is the share done, drawn as a fraction of the circumference, so the
 * ring fills as the day does.
 */
import { dayProgress, type DayEntry } from './entries';

const RADIUS = 18;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export interface DayProgressProps {
  entries: DayEntry[];
}

export function DayProgress({ entries }: DayProgressProps) {
  const progress = dayProgress(entries);
  const dash = (CIRCUMFERENCE * progress.percent) / 100;

  return (
    <div className="task-counter" id="taskCounter">
      <div className="day-progress">
        <svg className="day-progress-ring" viewBox="0 0 44 44" aria-hidden="true">
          <circle className="dpr-track" cx="22" cy="22" r={RADIUS} />
          <circle
            className="dpr-fill"
            cx="22"
            cy="22"
            r={RADIUS}
            strokeDasharray={`${dash.toFixed(2)} ${CIRCUMFERENCE.toFixed(2)}`}
          />
        </svg>
        <div className="day-progress-text">
          <span className="dpr-title">Day Completion Progress</span>
          <span className="dpr-sub">
            {progress.done} Tasks ({progress.percent}% Completed)
          </span>
        </div>
      </div>
    </div>
  );
}
