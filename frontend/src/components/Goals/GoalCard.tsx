/**
 * One goal, with its progress.
 *
 * The current and target values live under a different pair of field names for
 * each of the four goal types (`current_xp`/`target_xp`, `current_streak`/…),
 * so `GOAL_FIELDS` maps the type to its pair and this reads whichever applies.
 *
 * Two of the four track themselves. A streak goal follows the account's live
 * streak and a focus goal measures time since it was set, both re-synced
 * server-side on every read — so those two get no manual "+1" control, because
 * adding to them by hand would be overwritten on the next fetch.
 */
import { ProgressBar } from '../ProgressBar';
import { GOAL_FIELDS } from '@/services/constants';
import { format } from '@/utils';
import type { Goal } from '@/types';

export interface GoalCardProps {
  goal: Goal;
  onEdit?: (goal: Goal) => void;
  onDelete?: (goal: Goal) => void;
  /** Only offered for the hand-fed types — see the note above. */
  onAddProgress?: (goal: Goal) => void;
}

/** Whether progress on this type can be added by hand. */
export function isSelfTracking(goal: Goal): boolean {
  return goal.goal_type === 'streak' || goal.goal_type === 'focus';
}

export function GoalCard({
  goal,
  onEdit,
  onDelete,
  onAddProgress,
}: GoalCardProps) {
  const fields = GOAL_FIELDS[goal.goal_type];
  const current = Number(goal[fields.current as keyof Goal] ?? 0);
  const target = Number(goal[fields.target as keyof Goal] ?? 0);
  const done = goal.status === 'completed';

  return (
    <article className={`goal-card${done ? ' is-complete' : ''}`}>
      <header className="goal-card-header">
        <h3 className="goal-card-title">{goal.title}</h3>
        <div className="goal-card-actions">
          {onAddProgress && !isSelfTracking(goal) && !done && (
            <button type="button" onClick={() => onAddProgress(goal)}>
              +1
            </button>
          )}
          {onEdit && (
            <button type="button" onClick={() => onEdit(goal)}>
              Edit
            </button>
          )}
          {onDelete && (
            <button type="button" onClick={() => onDelete(goal)}>
              Delete
            </button>
          )}
        </div>
      </header>

      {goal.description && (
        <p className="goal-card-description">{goal.description}</p>
      )}

      <ProgressBar
        value={goal.progress}
        label={`${format.number(current)} / ${format.number(target)} ${fields.unit}`}
        ariaLabel={`${goal.title}: ${Math.round(goal.progress)}% complete`}
      />

      {goal.deadline && (
        <p className="goal-card-deadline">Deadline: {goal.deadline}</p>
      )}
    </article>
  );
}
