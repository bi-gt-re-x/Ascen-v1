/**
 * One task, as a row.
 *
 * The row answers, left to right, the questions asked of it in order: is it
 * done, what is it, how urgent, what is it about, when is it owed, how long
 * will it take, what is it worth. The colour down the left edge repeats the
 * priority rather than replacing the badge — it is what makes a screenful of
 * rows scannable at a glance, and a colour alone would be the only carrier of
 * the information for a reader who cannot see it.
 *
 * Renaming happens in place: double-click the title, or press Enter on it. The
 * alternative is a dialog for the single most common edit there is.
 */
import { useEffect, useRef, useState } from 'react';
import type { Task } from '@/types';
import { dueLine, spellDuration } from './board';

export interface TaskRowProps {
  task: Task;
  /** The subject's printable name, already looked up. */
  subject: string | null;
  /** Seconds set aside for it on the calendar, or null when it has no block. */
  estimate: number | null;
  selected: boolean;
  starred: boolean;
  busy: boolean;
  onSelect: (task: Task, on: boolean) => void;
  onComplete: (task: Task) => void;
  onReopen: (task: Task) => void;
  onRename: (task: Task, title: string) => void;
  onDelete: (task: Task) => void;
  onStar: (task: Task) => void;
}

const CAL = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);

const CLOCK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export function TaskRow({
  task,
  subject,
  estimate,
  selected,
  starred,
  busy,
  onSelect,
  onComplete,
  onReopen,
  onRename,
  onDelete,
  onStar,
}: TaskRowProps) {
  const done = task.status === 'done';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const [menu, setMenu] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing) field.current?.select();
  }, [editing]);

  useEffect(() => {
    if (!menu) return;
    const away = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenu(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [menu]);

  const commit = () => {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== task.title) onRename(task, next);
    else setDraft(task.title);
  };

  const when = dueLine(task);

  return (
    <li className={`tk-row is-${task.priority}${done ? ' is-done' : ''}${busy ? ' is-busy' : ''}`}>
      <label className="tk-check">
        <input
          type="checkbox"
          checked={done}
          disabled={busy}
          aria-label={done ? `Re-open ${task.title}` : `Complete ${task.title}`}
          onChange={() => (done ? onReopen(task) : onComplete(task))}
        />
        <span aria-hidden="true" />
      </label>

      <div className="tk-row-body">
        <div className="tk-row-line">
          {editing ? (
            <input
              ref={field}
              className="tk-rename"
              value={draft}
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
            <span
              className="tk-title"
              role="button"
              tabIndex={0}
              title="Double-click to rename"
              onDoubleClick={() => setEditing(true)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') setEditing(true);
              }}
            >
              {task.title}
            </span>
          )}
          <span className={`tk-tag is-${task.priority}`}>
            {task.priority[0]!.toUpperCase() + task.priority.slice(1)}
          </span>
          {subject && <span className="tk-tag is-subject">{subject}</span>}
        </div>

        <div className="tk-row-meta">
          {when && (
            <span className={task.status !== 'done' && when.includes('late') ? 'is-late' : undefined}>
              <i aria-hidden="true">{CAL}</i>
              {when}
            </span>
          )}
          {estimate !== null && (
            <span title="The block you set aside for this on the calendar">
              <i aria-hidden="true">{CLOCK}</i>
              Est. {spellDuration(estimate)}
            </span>
          )}
        </div>
      </div>

      <span className="tk-xp">+{(Number(task.xp_value) || 0).toLocaleString()} XP</span>

      <button
        type="button"
        className={`tk-star${starred ? ' is-on' : ''}`}
        aria-pressed={starred}
        aria-label={starred ? `Unstar ${task.title}` : `Star ${task.title}`}
        onClick={() => onStar(task)}
      >
        <svg viewBox="0 0 24 24" fill={starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <path d="M12 3.5l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.9l6-.8z" />
        </svg>
      </button>

      <div className="tk-row-menu" ref={menuRef}>
        <button
          type="button"
          className="tk-more"
          aria-label={`More for ${task.title}`}
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="1.7" />
            <circle cx="12" cy="12" r="1.7" />
            <circle cx="19" cy="12" r="1.7" />
          </svg>
        </button>
        {menu && (
          <div className="tk-menu-panel is-row">
            <button type="button" className="tk-menu-item" onClick={() => { setMenu(false); setEditing(true); }}>
              Rename
            </button>
            <label className="tk-menu-item is-pick">
              <input
                type="checkbox"
                checked={selected}
                onChange={(event) => onSelect(task, event.target.checked)}
              />
              Select
            </label>
            <button type="button" className="tk-menu-item" onClick={() => { setMenu(false); onStar(task); }}>
              {starred ? 'Remove star' : 'Star'}
            </button>
            <button
              type="button"
              className="tk-menu-item is-bad"
              onClick={() => { setMenu(false); onDelete(task); }}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
