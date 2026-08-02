/**
 * One row of the grade table: what was measured, the points it earned, and
 * the letter those points come to.
 *
 * The original carried an id on the row and on the badge (`#card-focus`,
 * `#grade-focus`) so growth.js could find them and write into them. Nothing
 * reaches into this from outside and no stylesheet selects those ids, so they
 * are gone; the grade class they were the handle for is set here instead.
 */
import { gradeClass, type MetricLine } from './metrics';

export interface MetricRowProps {
  metric: MetricLine;
}

export function MetricRow({ metric }: MetricRowProps) {
  return (
    <tr className={gradeClass(metric.grade)}>
      <td className="gt-metric">
        <span className="gt-emoji" aria-hidden="true">
          {metric.emoji}
        </span>
        {metric.label}
      </td>
      <td>{metric.raw}</td>
      <td>{metric.score}</td>
      <td>
        <span
          className={`grade-badge gt-badge ${gradeClass(metric.grade)}`}
          aria-label={`Grade ${metric.grade}`}
        >
          {metric.grade}
        </span>
      </td>
    </tr>
  );
}
