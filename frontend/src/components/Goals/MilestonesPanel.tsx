/**
 * The Milestones panel — the right column of the goals page.
 *
 * Every goal is a milestone, ticked once it is finished: a completed goal gets
 * a filled check, one still running gets an empty ring. Showing both is what
 * makes the panel a checklist rather than a second copy of the goals list.
 *
 * Only the first few fit without the panel outgrowing the goals column, so the
 * rest are behind "View All".
 *
 * Delete rides along on hover here because completed goals leave the goals
 * list, and this row is then the only place left to remove one from.
 */
import { useState } from 'react';
import { fmtGoalValue, goalNumbers } from './numbers';
import type { Goal } from '@/types';

const MILESTONES_COLLAPSED = 4;

export interface MilestonesPanelProps {
  goals: Goal[];
  onDelete?: (goal: Goal) => void;
}

/**
 * The line under the panel. Cheering someone on for crushing goals they have
 * not set yet reads badly, so it follows what is actually there.
 */
function tipFor(goals: Goal[]): { title: string; body: string } {
  const done = goals.filter((g) => g.status === 'completed').length;
  const active = goals.length - done;

  if (!goals.length) {
    return {
      title: 'Start somewhere.',
      body: 'Set your first goal and it shows up here.',
    };
  }
  if (!done) {
    return {
      title: 'First one pending.',
      body: `${active} goal${active === 1 ? '' : 's'} on the go — finish one to bank it.`,
    };
  }
  if (!active) {
    return {
      title: 'All clear!',
      body: `${done} goal${done === 1 ? '' : 's'} done and nothing outstanding.`,
    };
  }
  return { title: 'Keep it up!', body: "You're crushing your goals." };
}

export function MilestonesPanel({ goals, onDelete }: MilestonesPanelProps) {
  const [expanded, setExpanded] = useState(false);

  // Finished ones first: the panel reads as what you have banked, then what is
  // still outstanding.
  const sorted = goals
    .slice()
    .sort(
      (a, b) =>
        (a.status === 'completed' ? 0 : 1) - (b.status === 'completed' ? 0 : 1),
    );
  const shown = expanded ? sorted : sorted.slice(0, MILESTONES_COLLAPSED);
  const tip = tipFor(sorted);

  return (
    <aside className="milestones-panel">
      <div className="milestones-topline">
        <h2 className="milestones-title">
          <svg
            className="ms-trophy"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
            <path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3" />
            <path d="M12 14v3M9 20h6l-.5-3h-5z" />
          </svg>
          Milestones
        </h2>
        {/* The toggle only earns its place when something is hidden behind it. */}
        <button
          type="button"
          className="ms-viewall"
          id="milestonesViewAll"
          style={{
            display: sorted.length > MILESTONES_COLLAPSED ? '' : 'none',
          }}
          onClick={() => setExpanded((on) => !on)}
        >
          {expanded ? 'Show Less' : 'View All'}
        </button>
      </div>

      <div className="milestones-head">
        <span>Milestone</span>
        <span>Target</span>
      </div>

      <div id="milestonesList">
        {shown.map((goal) => {
          const { goalType, target, label } = goalNumbers(goal);
          const value =
            goalType === 'focus'
              ? `${fmtGoalValue(target, 'focus')} Focus`
              : `${target} ${label}`;
          const done = goal.status === 'completed';
          return (
            <div
              className={`milestone-row ${done ? 'is-done' : ''}`}
              key={goal.id}
            >
              <span className="ms-name" title={goal.title}>
                {goal.title}
              </span>
              <span className="ms-value">{value}</span>
              <span
                className="ms-state"
                title={done ? 'Completed' : 'Still in progress'}
              >
                {done ? (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="m8.5 12 2.5 2.5 4.5-5" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                )}
              </span>
              <button
                type="button"
                className="ms-delete"
                title="Delete this goal"
                onClick={() => onDelete?.(goal)}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      <div
        className="no-milestones"
        id="noMilestones"
        style={{ display: sorted.length ? 'none' : 'block' }}
      >
        <p>
          Set a goal and it will appear here, ticked off once you finish it.
        </p>
      </div>

      <div className="milestones-tip" id="milestonesTip">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
        </svg>
        <div>
          <strong id="milestonesTipTitle">{tip.title}</strong>
          <span id="milestonesTipBody">{tip.body}</span>
        </div>
      </div>
    </aside>
  );
}
