/**
 * One task on the dashboard's list.
 *
 * The checkbox is a **div**, not an `<input type="checkbox">` — that is what
 * styles/dashboard.css dresses (a 20px rounded box with a bronze border that
 * gets a ✓ written into it), and an input with those rules on it renders as a
 * native control wearing the wrong clothes. The scaffold version used an input.
 *
 * Completing is a three-beat animation the original built by hand: the check
 * appears, the row goes green, and after a beat it collapses and leaves. The
 * classes are `completing`, `completed-state` and `removing`, all defined in
 * dashboard.css; what is here is the sequence, not the styling.
 *
 * A task with no due date says so. It used to show a count-up timer, and the
 * original dropped that on the grounds that there is nothing to count toward.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Task } from '@/types';

/** How long the ✓ shows before the row starts leaving. */
const CHECK_MS = 220;
/** How long the leaving animation runs before the row is gone. */
const REMOVE_MS = 420;

export interface TaskRowProps {
  task: Task;
  busy?: boolean;
  onComplete: (task: Task) => void;
}

export function TaskRow({ task, busy = false, onComplete }: TaskRowProps) {
  const [phase, setPhase] = useState<'idle' | 'checked' | 'leaving'>('idle');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  const complete = useCallback(() => {
    // Guard against a second click while the row is on its way out.
    if (phase !== 'idle' || busy) return;
    setPhase('checked');
    timers.current.push(
      setTimeout(() => {
        setPhase('leaving');
        timers.current.push(setTimeout(() => onComplete(task), REMOVE_MS));
      }, CHECK_MS),
    );
  }, [phase, busy, onComplete, task]);

  const classes = [
    'task-item',
    phase !== 'idle' ? 'completing' : '',
    phase !== 'idle' ? 'completed-state' : '',
    phase === 'leaving' ? 'removing' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const due = task.due_date ? new Date(task.due_date) : null;

  return (
    <li className={classes} id={`task-${task.id}`}>
      <div className="task-left">
        <div
          className="task-checkbox"
          role="checkbox"
          aria-checked={phase !== 'idle'}
          aria-label={`Complete ${task.title}`}
          tabIndex={0}
          onClick={complete}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              complete();
            }
          }}
        >
          {phase !== 'idle' ? '✓' : ''}
        </div>
        <span className="task-name">{task.title}</span>
      </div>

      {due ? (
        <span className="task-due-date">
          Due:{' '}
          {due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })},{' '}
          {due.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </span>
      ) : (
        <span className="task-due-date task-nodue">No due date</span>
      )}
    </li>
  );
}
