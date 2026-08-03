/**
 * One goal, with its progress.
 *
 * The markup is the one goal.js built by hand in
 * `createGoalElement` — `.goal-item`, `.goal-card-head`, `.gradient-bar` and
 * the rest — because styles/goals.css dresses those class names and the port
 * is a change of mechanism, not of appearance. The scaffold version of this
 * component invented its own names (`.goal-card`, `.goal-card-title`) and so
 * had no styling at all; nothing had rendered it yet, so nothing broke.
 *
 * Two of the four types track themselves. A streak goal follows the account's
 * live streak and a focus goal measures time since it was set, both re-synced
 * server-side on every read — so a focus goal gets no manual controls at all,
 * and says why in their place.
 */
import {
  fmtGoalValue,
  formatGoalDate,
  goalNumbers,
  isOverdue,
} from './numbers';
import type { Goal } from '@/types';

export interface GoalCardProps {
  goal: Goal;
  onEdit?: (goal: Goal) => void;
  onDelete?: (goal: Goal) => void;
  /** The "+1" nudge. Not offered for focus goals — see the note above. */
  onAddProgress?: (goal: Goal, amount: number) => void;
  /** The "Set" box: raise the counter to a figure typed in. */
  onSetProgress?: (goal: Goal, value: number) => void;
  /** Offered in place of the usual controls once the deadline has passed. */
  onGiveUp?: (goal: Goal) => void;
  onMoreTime?: (goal: Goal) => void;
  /** Set while a write for this goal is in flight. */
  busy?: boolean;
}

/** Whether progress on this type is kept by the backend rather than by hand. */
export function isSelfTracking(goal: Goal): boolean {
  return goal.goal_type === 'streak' || goal.goal_type === 'focus';
}

export function GoalCard({
  goal,
  onEdit,
  onDelete,
  onAddProgress,
  onSetProgress,
  onGiveUp,
  onMoreTime,
  busy = false,
}: GoalCardProps) {
  const { goalType, current, target, label, progress } = goalNumbers(goal);
  const isCompleted = goal.status === 'completed';
  const isFocus = goalType === 'focus';
  // Past its deadline: the card turns, its controls become give-up/extend, and
  // adding progress by hand is withdrawn.
  const overdue = isOverdue(goal);
  const priority = Math.max(
    1,
    Math.min(10, Math.trunc(Number(goal.priority)) || 5),
  );

  // Stretch the gradient across the whole track so a partial fill shows the
  // left slice of it (like the mockup), not a squeezed full rainbow.
  const bgSize =
    progress > 0 ? `${(10000 / progress).toFixed(2)}% 100%` : '100% 100%';

  function submitSet(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onSetProgress) return;
    const input = event.currentTarget.elements.namedItem('amount');
    if (!(input instanceof HTMLInputElement)) return;
    const value = parseInt(input.value, 10);
    if (!value || value < 1) return;
    onSetProgress(goal, value);
    input.value = '';
  }

  return (
    <div
      className={`goal-item ${isCompleted ? 'completed' : ''}${overdue ? ' overdue' : ''}`}
      id={`goal-${goal.id}`}
    >
      <div className="goal-card-head">
        <div className="goal-icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="4.5" />
            <circle cx="12" cy="12" r="1" />
          </svg>
        </div>
        <div className="goal-headline">
          <div className="goal-target-big">
            {fmtGoalValue(target, goalType)}
            {isFocus ? '' : ` ${label}`}
          </div>
          <h3 className="goal-title">{goal.title}</h3>
          {goal.description && (
            <p className="goal-description">{goal.description}</p>
          )}
        </div>
        <div className="goal-side">
          <div
            className="goal-stars"
            role="img"
            aria-label={`Priority ${priority} out of 10`}
            title={`Priority ${priority} of 10 — its weight in the overall progress bar`}
          >
            <span className="gs-track">★★★★★</span>
            <span className="gs-fill" style={{ width: `${priority * 10}%` }}>
              ★★★★★
            </span>
          </div>
          <div className="goal-utility-buttons">
            {overdue ? (
              <>
                <button
                  type="button"
                  className="goal-utility-btn give-up"
                  onClick={() => onGiveUp?.(goal)}
                >
                  Give up
                </button>
                <button
                  type="button"
                  className="goal-utility-btn more-time"
                  onClick={() => onMoreTime?.(goal)}
                >
                  More Time
                </button>
              </>
            ) : (
              <>
                {!isCompleted && !isFocus && onAddProgress && (
                  <button
                    type="button"
                    className="goal-utility-btn"
                    disabled={busy}
                    onClick={() => onAddProgress(goal, 1)}
                  >
                    +1
                  </button>
                )}
                {!isCompleted && onEdit && (
                  <button
                    type="button"
                    className="goal-utility-btn edit"
                    onClick={() => onEdit(goal)}
                  >
                    Edit
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    className="goal-utility-btn delete"
                    onClick={() => onDelete(goal)}
                  >
                    Delete
                  </button>
                )}
              </>
            )}
          </div>
          {goal.deadline && (
            <div className="goal-deadline">
              Deadline: {formatGoalDate(goal.deadline)}
            </div>
          )}
        </div>
      </div>

      <div className="progress-bar-container gradient-bar">
        <div
          className={`progress-bar-fill ${isCompleted ? 'completed' : ''}`}
          style={{ width: `${progress}%`, backgroundSize: bgSize }}
        />
      </div>

      <div className="goal-under-row">
        <span className="progress-text">{progress.toFixed(1)}%</span>
        <span className="goal-metric">
          {fmtGoalValue(current, goalType)} / {fmtGoalValue(target, goalType)}{' '}
          {isFocus ? 'focused' : label}
        </span>
        <span className="goal-under-right">
          {isCompleted ? (
            <span className="goal-completed-badge">✓ COMPLETED</span>
          ) : isFocus ? (
            <span
              className="goal-autotrack"
              title="Progress comes from your tracked focus sessions"
            >
              ⏱ Auto-tracks focus time
            </span>
          ) : overdue ? null : (
            /* A form rather than a keypress handler, so Enter and the button
               are one path and the browser does the submitting. The original
               wired `onkeypress` to Enter and `onclick` to the button
               separately, and they could drift. */
            <form className="goal-controls" onSubmit={submitSet}>
              <input
                type="number"
                name="amount"
                id={`progress-input-${goal.id}`}
                placeholder={label}
                min="1"
                disabled={busy}
              />
              <button type="submit" disabled={busy}>
                Set
              </button>
            </form>
          )}
        </span>
      </div>
    </div>
  );
}
