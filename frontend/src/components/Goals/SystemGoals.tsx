/**
 * The goals the app keeps for you — XP, streak, tasks, focus.
 *
 * The distinction this whole tab rests on is *who moves the number*. An outcome
 * goal is a thing the reader is doing, and the percentage follows checkpoints
 * they tick. These four are counters the app maintains: the target is chosen
 * once and the figure is never touched again, because touching it would be the
 * account editing its own record of what it did.
 *
 * That is why a system card has no progress control and no checkpoints, and why
 * its only two actions are the ones that genuinely belong to the reader —
 * changing the target and dropping the goal.
 *
 * These cards were the rail's second tab, and the rail's second tab was the
 * bottom of the page before that. They are a tab of their own now: an XP target
 * and a streak target are not commentary on the outcome goals, they are a
 * different kind of goal, and a page whose navigation says so does not need a
 * rail repeating it.
 */
import { fmtGoalNumber, goalNumbers } from './numbers';
import type { Goal, GoalType } from '@/types';
import type { ReactNode } from 'react';

/** One glyph per counter, so the four are told apart before they are read. */
const ICON: Record<GoalType, ReactNode> = {
  xp: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
    </svg>
  ),
  streak: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M12 3c3 4 5 6 5 9a5 5 0 0 1-10 0c0-1.5.7-2.8 1.7-4C9.5 9.5 11 7 12 3z" />
    </svg>
  ),
  tasks: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M4 12h16M4 17h9" />
      <path d="m15.5 17.5 1.5 1.5 3-3" />
    </svg>
  ),
  focus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  ),
};

const pct = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

function SystemCard({
  goal,
  onEdit,
  onDelete,
}: {
  goal: Goal;
  onEdit: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
}) {
  const n = goalNumbers(goal);
  const done = pct(n.progress);
  const reached = done >= 100;

  return (
    <article className={`gx-sys${reached ? ' is-done' : ''}`}>
      <header className="gx-sys-head">
        <span className={`gx-sys-ico is-${n.goalType}`} aria-hidden="true">
          {ICON[n.goalType]}
        </span>
        <div className="gx-sys-name">
          <strong>{goal.title}</strong>
          <span className="gx-quiet">{n.label}</span>
        </div>
        <span className={`gx-sys-pct${reached ? ' is-done' : ''}`}>{done}%</span>
      </header>

      <div className="gx-sys-figures">
        <b>{fmtGoalNumber(n.current, n)}</b>
        <span className="gx-quiet">of {fmtGoalNumber(n.target, n)}</span>
      </div>

      <div className="gx-sys-track" role="presentation">
        <i className={`gx-sys-fill is-${n.goalType}`} style={{ width: `${done}%` }} />
      </div>

      <footer className="gx-sys-foot">
        <button type="button" onClick={() => onEdit(goal)}>
          Change target
        </button>
        <button type="button" className="is-bad" onClick={() => onDelete(goal)}>
          Remove
        </button>
      </footer>
    </article>
  );
}

export interface SystemGoalsProps {
  counters: Goal[];
  onEdit: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
  onNew: () => void;
}

export function SystemGoals({ counters, onEdit, onDelete, onNew }: SystemGoalsProps) {
  if (counters.length === 0) {
    return (
      <p className="gx-empty">
        None set. A system goal is a target on something the app already counts for you — reach
        50,000 XP, hold a 30-day streak, finish 500 tasks, log 100 hours of focus. You pick the
        number; the figure underneath is whatever your record already says.
        <button type="button" className="gx-link" onClick={onNew}>
          Set one
        </button>
      </p>
    );
  }

  return (
    <div className="gx-sysgrid">
      {counters.map((goal) => (
        <SystemCard key={goal.id} goal={goal} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}
