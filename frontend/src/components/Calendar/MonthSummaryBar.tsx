/**
 * The strip under the month grid — how the month is going, in one line.
 *
 * A ring and three figures, each carried against the same month a year's worth
 * of habit is actually judged by: the one before it. The comparison is the
 * point of the strip. "6,240 XP" is a number; "6,240 XP, up 18% on July" is a
 * month.
 *
 * A figure with nothing to compare against says nothing rather than something
 * absurd — a first month is not an infinite improvement on the void before it —
 * so the delta line is simply absent until there is a previous month with
 * something in it.
 *
 * This stands where "Day Completion Progress" used to. That ring answered a
 * question about the selected day while sitting under a grid of thirty of
 * them, and the day it described already has a whole column of its own on the
 * right.
 */
import { useCountUp } from '@/hooks/useCountUp';
import { percentChange } from '@/utils/monthSummary';

const RING_R = 26;
const RING_C = 2 * Math.PI * RING_R;

export interface MonthSummaryBarProps {
  /** Days where everything scheduled got done, out of days that had anything. */
  settled: number;
  scheduled: number;
  xpEarned: number;
  avgGoal: number;
  /** The same three figures for the month before, for the deltas. */
  previous: { settled: number; xpEarned: number; avgGoal: number };
  /** "Jul" — the month the deltas are against. */
  previousName: string;
  onViewAnalytics: () => void;
}

/**
 * One "↑ 18% vs Jul" line.
 *
 * Up is green and down is red, but the arrow carries the same claim as the
 * colour so the line still reads without it.
 */
function Delta({
  value,
  suffix,
  against,
}: {
  value: number | null;
  suffix: string;
  against: string;
}) {
  if (value === null || value === 0) return <span className="mv-delta is-flat">— vs {against}</span>;
  const up = value > 0;
  return (
    <span className={`mv-delta${up ? ' is-up' : ' is-down'}`}>
      <span aria-hidden="true">{up ? '↑' : '↓'}</span> {Math.abs(value)}
      {suffix} vs {against}
    </span>
  );
}

export function MonthSummaryBar({
  settled,
  scheduled,
  xpEarned,
  avgGoal,
  previous,
  previousName,
  onViewAnalytics,
}: MonthSummaryBarProps) {
  const percent = scheduled > 0 ? Math.round((settled / scheduled) * 100) : 0;

  // The strip is four numbers about one month; replacing all four between
  // frames when the reader steps to another month leaves nothing to say which
  // of them moved. Travelling to the new figures is what makes the change
  // legible. Nothing moves under prefers-reduced-motion — see useCountUp.
  const shownPercent = Math.round(useCountUp(percent));
  const shownXp = Math.round(useCountUp(xpEarned));
  const shownDays = Math.round(useCountUp(settled));
  const shownGoal = Math.round(useCountUp(avgGoal));

  const filled = (Math.max(0, Math.min(100, shownPercent)) / 100) * RING_C;

  return (
    <section className="mv-summary" aria-label="Month completion progress">
      <div className="mv-summary-ring">
        <svg viewBox="0 0 64 64" role="img" aria-label={`${percent}% of scheduled days cleared`}>
          <circle className="mv-ring-track" cx="32" cy="32" r={RING_R} />
          <circle
            className="mv-ring-fill"
            cx="32"
            cy="32"
            r={RING_R}
            strokeDasharray={`${filled} ${RING_C - filled}`}
            transform="rotate(-90 32 32)"
          />
        </svg>
        <span className="mv-ring-pct">{shownPercent}%</span>
      </div>

      <div className="mv-summary-lead">
        <span className="mv-summary-title">Month Completion Progress</span>
        <span className="mv-summary-sub">
          {settled} / {scheduled} days completed
        </span>
      </div>

      <div className="mv-summary-figs">
        <div className="mv-summary-fig">
          <span className="mv-fig-value">{shownXp.toLocaleString()}</span>
          <span className="mv-fig-label">Total XP Earned</span>
          <Delta
            value={percentChange(xpEarned, previous.xpEarned)}
            suffix="%"
            against={previousName}
          />
        </div>
        <div className="mv-summary-fig">
          <span className="mv-fig-value">{shownDays}</span>
          <span className="mv-fig-label">Days Completed</span>
          {/* A count, so the delta is a count too — "8 more days", not "8%". */}
          <Delta value={settled - previous.settled} suffix="" against={previousName} />
        </div>
        <div className="mv-summary-fig">
          <span className="mv-fig-value">{shownGoal}%</span>
          <span className="mv-fig-label">Avg Daily Goal</span>
          <Delta value={avgGoal - previous.avgGoal} suffix="%" against={previousName} />
        </div>
      </div>

      <button type="button" className="mv-analytics" onClick={onViewAnalytics}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 20V10M12 20V4M19 20v-6" />
        </svg>
        <span>
          View
          <br />
          Analytics
        </span>
      </button>
    </section>
  );
}
