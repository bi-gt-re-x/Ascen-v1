/**
 * One task, as a row.
 *
 * The row is the whole of the page's interaction surface: tick it off, rename
 * it in place, select it for a bulk action, or throw it away. There is no
 * detail drawer and there should not be one — a task is a title, a date, a
 * priority and an XP value, and every one of those fits on the row it is
 * already on. A drawer would be a second place to change the same four fields.
 *
 * Renaming is inline and commits on blur or Enter, cancels on Escape. That is
 * the one edit worth making frictionless: a task's name is the thing most
 * often written in a hurry and most often wrong.
 */
import { useEffect, useRef, useState } from 'react';
import { dueLabel } from './board';
import type { Task } from '@/types';

export interface TaskRowProps {
  task: Task;
  /** The subject's display name, already looked up. Null when it has none. */
  subject: string | null;
  selected: boolean;
  /** True while this row's own write is in flight. */
  busy: boolean;
  onSelect: (task: Task, selected: boolean) => void;
  onComplete: (task: Task) => void;
  onReopen: (task: Task) => void;
  onRename: (task: Task, title: string) => void;
  onDelete: (task: Task) => void;
  today?: Date;
}

export function TaskRow({
  task,
  subject,
  selected,
  busy,
  onSelect,
  onComplete,
  onReopen,
  onRename,
  onDelete,
  today,
}: TaskRowProps) {
  const done = task.status === 'done';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const input = useRef<HTMLInputElement>(null);

  // The page re-reads after a refresh and the task arrives as a new object.
  // Re-seed while the editor is closed; while it is open the draft is the
  // reader's and nothing may touch it.
  useEffect(() => {
    if (!editing) setDraft(task.title);
  }, [task.title, editing]);

  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  const commit = () => {
    const title = draft.trim();
    setEditing(false);
    if (!title || title === task.title) {
      setDraft(task.title);
      return;
    }
    onRename(task, title);
  };

  const when = dueLabel(task, today);
  const late = !done && when !== null && when.endsWith('late');

  return (
    <li className={`tk-row pri-${task.priority}${done ? ' is-done' : ''}${selected ? ' is-picked' : ''}`}>
      <label className="tk-pick">
        <input
          type="checkbox"
          checked={selected}
          onChange={(event) => onSelect(task, event.target.checked)}
          aria-label={`Select ${task.title}`}
        />
      </label>

      {/* The tick is a button rather than a checkbox: completing is a write
          with XP, a streak and a level behind it, not a field being set. */}
      <button
        type="button"
        className="tk-tick"
        disabled={busy}
        aria-pressed={done}
        aria-label={`${done ? 'Reopen' : 'Complete'} ${task.title}`}
        onClick={() => (done ? onReopen(task) : onComplete(task))}
      >
        {done ? '✓' : ''}
      </button>

      <div className="tk-body">
        {editing ? (
          <input
            ref={input}
            className="tk-rename"
            value={draft}
            aria-label={`Rename ${task.title}`}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commit();
              if (event.key === 'Escape') {
                setDraft(task.title);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="tk-title"
            onClick={() => setEditing(true)}
            title="Click to rename"
          >
            {task.title}
          </button>
        )}

        <div className="tk-meta">
          <span className={`tk-pri is-${task.priority}`}>{task.priority}</span>
          {subject && <span className="tk-subject">{subject}</span>}
          {when && <span className={`tk-due${late ? ' is-late' : ''}`}>{when}</span>}
          {task.goal_id && <span className="tk-linked">goal</span>}
        </div>
      </div>

      <span className="tk-xp">{Number(task.xp_value) || 0} XP</span>

      <button
        type="button"
        className="tk-drop"
        disabled={busy}
        aria-label={`Delete ${task.title}`}
        title="Delete"
        onClick={() => onDelete(task)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
        </svg>
      </button>
    </li>
  );
}
