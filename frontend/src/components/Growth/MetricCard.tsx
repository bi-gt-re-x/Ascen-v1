/**
 * One of the report card's five metrics.
 *
 * The grade and the trend both come from the backend already computed — this
 * renders them and does no grading of its own, because the grade boundaries
 * live in backend/tracking/analytics.py and a second copy here would drift.
 *
 * The trend arrow is decorative; the direction is also written out in the
 * label so it is not colour-and-shape alone.
 */
import type { Grade, Trend } from '@/types';

export interface MetricCardProps {
  name: string;
  score: number;
  grade: Grade;
  trend: Trend;
  /** "Avg 42 XP/day", "17 of 30 days" — whatever this metric is measuring. */
  detail?: string;
}

const ARROW: Record<Trend['direction'], string> = {
  up: '↑',
  down: '↓',
  flat: '→',
};

export function MetricCard({
  name,
  score,
  grade,
  trend,
  detail,
}: MetricCardProps) {
  return (
    <article className="metric-card" data-grade={grade}>
      <header className="metric-card-header">
        <h3 className="metric-card-name">{name}</h3>
        <span className="metric-card-grade" aria-label={`Grade ${grade}`}>
          {grade}
        </span>
      </header>

      <p className="metric-card-score">{Math.round(score)}</p>
      {detail && <p className="metric-card-detail">{detail}</p>}

      <p className={`metric-card-trend trend-${trend.direction}`}>
        <span aria-hidden="true">{ARROW[trend.direction]}</span>{' '}
        {trend.direction === 'flat'
          ? 'No change this week'
          : `${Math.abs(trend.pct)}% ${trend.direction} this week`}
      </p>
    </article>
  );
}
