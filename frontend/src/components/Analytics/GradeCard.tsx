/**
 * The report card itself: the overall letter, the five metrics that make it,
 * and the arithmetic between them written out.
 *
 * The grade class goes on the card as well as on the letter. `.grade-A` and
 * its siblings only set `--grade-color`, which inherits — so one class on the
 * card colours the accent rule along its top edge and the letter below it
 * together, which is the whole reason the original put it in both places.
 *
 * "How it's Calculated" is the same prose the page has always carried, and it
 * is deliberately hard-coded rather than derived: it explains the formulas in
 * backend/tracking/analytics.py, and if those change this text is supposed to
 * be edited by someone who has read them.
 */
import { MetricRow } from './MetricRow';
import { gradeClass, metricLines } from './metrics';
import type { Ratings } from '@/types';

export interface GradeCardProps {
  ratings: Ratings;
}

export function GradeCard({ ratings }: GradeCardProps) {
  const { overall } = ratings;
  const grade = gradeClass(overall.grade);

  return (
    <div className={`grade-card ${grade}`}>
      <h2 className="grade-card-title">Grade</h2>

      {/* Big grade letter — no box, no outline; the colour is the whole mark. */}
      <div
        className={`grade-hero-badge grade-badge ${grade}`}
        aria-label={`Overall grade ${overall.grade}`}
      >
        {overall.grade}
      </div>
      <p className="grade-unified">
        Unified Grade Score: {overall.score}/100
      </p>

      <table className="grade-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Raw Data</th>
            <th>Points</th>
            <th>Letter</th>
          </tr>
        </thead>
        <tbody>
          {metricLines(ratings).map((metric) => (
            <MetricRow key={metric.name} metric={metric} />
          ))}
        </tbody>
      </table>

      <div className="grade-calc">
        <h3 className="grade-calc-title">How it&apos;s Calculated</h3>
        <p className="grade-calc-intro">
          Each metric is scored 0–100 from your real activity and given a letter
          grade. Your Unified Grade Score is the average of the five metric
          scores.
        </p>
        <ul className="grade-calc-list">
          <li>
            <strong>Productivity</strong> — XP earned per active day.
          </li>
          <li>
            <strong>Quality</strong> — average XP per completed task.
          </li>
          <li>
            <strong>Consistency</strong> — share of days active since signup.
          </li>
          <li>
            <strong>Efficiency</strong> — deadlines met and completion speed.
          </li>
          <li>
            <strong>Focus</strong> — focused time vs your daily focus goal.
          </li>
        </ul>
        <p className="grade-formula">
          Overall = (Productivity + Quality + Consistency + Efficiency + Focus)
          ÷ 5
        </p>
      </div>
    </div>
  );
}
