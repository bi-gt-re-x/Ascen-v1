/**
 * The goals the app keeps for you — XP, streak, tasks, focus.
 *
 * The distinction this whole tab rests on is *who moves the number*. An outcome
 * goal is a thing the reader is doing, and the percentage follows checkpoints
 * they tick. These four are counters the app maintains: the target is chosen
 * once and the figure is never touched again, because touching it would be the
 * account editing its own record of what it did.
 *
 * That is why a system goal has no progress control and no checkpoints, and why
 * its only two actions are the ones that genuinely belong to the reader —
 * changing the target and dropping the goal.
 *
 * A list rather than a grid of cards. Every row carries the same five things —
 * what, how far, of what, the bar, the percentage — and a list lines them up in
 * columns, so four targets read down the page as a comparison. Cards scattered
 * them across a wrapping grid where the second row's bar was nowhere near the
 * first's.
 *
 * New ones are made by SystemGoalWizard, not by the outcome wizard — see the
 * note there for what went wrong when they were.
 */
import { fmtGoalNumber, goalNumbers } from './numbers';
import type { Goal, GoalType } from '@/types';
import type { ReactNode } from 'react';

/** One glyph per counter, so the four are told apart before they are read. */
export const COUNTER_ICON: Record<GoalType, ReactNode> = {
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

function SystemRow({
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
    <li className={`gx-sys${reached ? ' is-done' : ''}`}>
      <span className={`gx-sys-ico is-${n.goalType}`} aria-hidden="true">
        {COUNTER_ICON[n.goalType]}
      </span>
      <div className="gx-sys-name">
        <strong>{goal.title}</strong>
        <span className="gx-quiet">{n.label}</span>
      </div>

      <div className="gx-sys-figures">
        <b>{fmtGoalNumber(n.current, n)}</b>
        <span className="gx-quiet">of {fmtGoalNumber(n.target, n)}</span>
      </div>

      <div
        className="gx-sys-track"
        role="progressbar"
        aria-label={`${goal.title}: ${done}%`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={done}
      >
        <i className={`gx-sys-fill is-${n.goalType}`} style={{ width: `${done}%` }} />
      </div>
      <span className={`gx-sys-pct${reached ? ' is-done' : ''}`}>{done}%</span>

      <div className="gx-sys-foot">
        <button type="button" onClick={() => onEdit(goal)}>
          Change target
        </button>
        <button type="button" className="is-bad" onClick={() => onDelete(goal)}>
          Remove
        </button>
      </div>
    </li>
  );
}

export interface SystemGoalsProps {
  counters: Goal[];
  onEdit: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
  /** Opens SystemGoalWizard. */
  onNew: () => void;
}

export function SystemGoals({ counters, onEdit, onDelete, onNew }: SystemGoalsProps) {
  if (counters.length === 0) {
    return (
      <p className="gx-empty">
        None set. A target on something the app already counts — 50,000 XP, a 30-day streak,
        500 tasks, 100 hours of focus. You pick the number.
        <button type="button" className="gx-link" onClick={onNew}>
          Set one
        </button>
      </p>
    );
  }

  return (
    <>
      <ul className="gx-syslist" aria-label="System goals">
        {counters.map((goal) => (
          <SystemRow key={goal.id} goal={goal} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </ul>
      <button type="button" className="gx-sys-add" onClick={onNew}>
        <span aria-hidden="true">+</span> Add a system goal
      </button>
    </>
  );
}
