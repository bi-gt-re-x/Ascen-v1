/**
 * The goals page's header bar and its three summary cards.
 *
 * Everything here is derived from the goal list rather than fetched: the
 * counts, the weighted overall bar, the donut's split and the month badge are
 * all read off the same array the list below renders, so the header can never
 * disagree with what is under it.
 */
import { Link } from 'react-router-dom';
import { overallProgress } from './numbers';
import type { Goal } from '@/types';

export interface GoalsSummaryProps {
  goals: Goal[];
  /** Average XP per active day, from the same call that returns the goals. */
  avgXpPerDay: number;
  onNewGoal: () => void;
}

/** Goals completed in the current calendar month — the badge on the done card. */
function completedThisMonth(goals: Goal[]): number {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return goals.filter(
    (g) =>
      g.status === 'completed' &&
      String(g.created_at ?? '').slice(0, 7) === monthKey,
  ).length;
}

export function GoalsHeader({
  goals,
  onNewGoal,
}: Omit<GoalsSummaryProps, 'avgXpPerDay'>) {
  const overall = overallProgress(goals);

  return (
    <div className="goals-header">
      <div className="goals-header-titles">
        <h1 className="goals-h1">Goals</h1>
        <p className="goals-sub">Set targets. Track progress. Achieve more.</p>
      </div>
      <div className="goals-overall">
        <span className="goals-overall-label">Overall Progress</span>
        <div className="goals-overall-track">
          <div
            className="goals-overall-fill"
            id="overallProgressFill"
            style={{ width: `${overall}%` }}
          />
        </div>
        <span className="goals-overall-pct" id="overallProgressPct">
          {Math.round(overall)}%
        </span>
      </div>
      <button type="button" className="new-goal-btn" onClick={onNewGoal}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        New Goal
      </button>
    </div>
  );
}

export function GoalsSummaryRow({
  goals,
  avgXpPerDay,
}: Omit<GoalsSummaryProps, 'onNewGoal'>) {
  const completed = goals.filter((g) => g.status === 'completed').length;
  const active = goals.length - completed;
  const total = active + completed;

  // Tan slice = share of goals completed, periwinkle = still active. All-grey
  // when there are no goals yet.
  const ring =
    total > 0
      ? `conic-gradient(#A38A70 0 ${(completed / total) * 100}%, #6d7cf5 ${
          (completed / total) * 100
        }% 100%)`
      : 'conic-gradient(#3a4150 0 100%)';

  return (
    <div className="goals-summary-row">
      <div className="sum-card sum-dark">
        <div className="sum-ring" id="sumRing" style={{ background: ring }}>
          <div className="sum-ring-hole" />
        </div>
        <div className="sum-main">
          <div className="sum-number" id="activeCount">
            {active}
          </div>
          <div className="sum-label">In Progress</div>
          <div className="sum-sub">
            <span id="avgXpDay">{avgXpPerDay}</span> avg. XP/day
          </div>
        </div>
        <Link
          className="sum-link"
          to="/dashboard"
          aria-label="Open dashboard"
          title="Open dashboard"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M7 17 17 7" />
            <path d="M8 7h9v9" />
          </svg>
        </Link>
      </div>

      <div className="sum-card sum-done">
        <div
          className="sum-badge"
          id="monthCompletedBadge"
          title="Completed this month"
        >
          {completedThisMonth(goals)}
        </div>
        <div className="sum-icon">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="9" r="6" />
            <path d="m9 14.5-2 6 5-2.7 5 2.7-2-6" />
            <path d="m9.5 9 1.7 1.7L14.5 7.4" />
          </svg>
        </div>
        <div className="sum-main">
          <div className="sum-number" id="completedCount">
            {completed}
          </div>
          <div className="sum-label">Completed</div>
        </div>
      </div>

      <div className="sum-card sum-total">
        <div className="sum-icon">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8z" />
          </svg>
        </div>
        <div className="sum-main">
          <div className="sum-number" id="totalCount">
            {total}
          </div>
          <div className="sum-label">Total Goals</div>
          <div className="sum-sub">All time</div>
        </div>
      </div>
    </div>
  );
}
