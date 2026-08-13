/**
 * How many goals are finished, and how many are being worked on.
 *
 * Two figures, and they are counted here rather than remembered anywhere: a
 * goal's `status` is derived on the server from its own checkpoints after
 * every write (see `_recompute` in backend/api/goals.py), so counting the
 * statuses is reading the same truth the cards above are drawn from. A stored
 * "goals completed" total would be a third opinion, and the one most likely to
 * be wrong — reopening the last checkpoint of a finished goal makes it active
 * again, and a counter that only ever went up would not follow it back.
 */
import { useCountUp } from '@/hooks';
import type { Goal } from '@/types';

export interface GoalStatsProps {
  goals: Goal[];
}

export function GoalStats({ goals }: GoalStatsProps) {
  const completed = goals.filter((goal) => goal.status === 'completed');
  const active = goals.filter((goal) => goal.status !== 'completed');

  // Checkpoints only — a goal with no milestones has nothing to average and
  // would otherwise drag the figure toward zero for having no plan rather than
  // for making no progress.
  const planned = active.filter((goal) => (goal.milestones ?? []).length > 0);
  const reached = planned.reduce(
    (total, goal) =>
      total + (goal.milestones ?? []).filter((row) => row.status === 'done').length,
    0,
  );
  const rungs = planned.reduce((total, goal) => total + (goal.milestones ?? []).length, 0);

  // Counted to rather than replaced, so ticking a checkpoint off is something
  // the reader watches happen here — see hooks/useCountUp.ts.
  const shownCompleted = Math.round(useCountUp(completed.length));
  const shownActive = Math.round(useCountUp(active.length));
  const shownReached = Math.round(useCountUp(reached));
  const shownRungs = Math.round(useCountUp(rungs));

  // `gx-count` rather than `gx-stat`: the strip below already owns that class
  // and its cards carry a header, a mark and a footer these three do not have.
  return (
    <div className="gx-counts">
      <div className="gx-count">
        <strong className="gx-big">{shownCompleted}</strong>
        <span className="gx-quiet">Goals completed</span>
      </div>
      <div className="gx-count">
        <strong className="gx-big">{shownActive}</strong>
        <span className="gx-quiet">Currently active</span>
      </div>
      <div className="gx-count">
        <strong className="gx-big">
          {shownReached}
          <span className="gx-count-of">/{shownRungs}</span>
        </strong>
        <span className="gx-quiet">Checkpoints reached</span>
      </div>
    </div>
  );
}
