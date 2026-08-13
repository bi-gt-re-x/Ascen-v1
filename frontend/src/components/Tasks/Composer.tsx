/**
 * Adding a task, as a row at the top of the list rather than a dialog.
 *
 * A dialog to add a task is a dialog to be dismissed: this page exists to have
 * a lot of tasks on it, and the reader adding one is usually adding three. The
 * form stays open, keeps the priority and subject they last chose, clears the
 * name, and puts the cursor back — so the second and third cost a sentence
 * each rather than a round trip through a modal.
 *
 * Only the name is required. Everything else has a default the backend would
 * have applied anyway, and asking for five fields to write down "email Mr Chen"
 * is how a task list stops being used.
 */
import { useRef, useState } from 'react';
import { SubjectPicker } from '@/components';
import type { Subject } from '@/services/subjects';
import type { NewTask } from '@/services/tasks';
import type { TaskPriority } from '@/types';

export interface ComposerProps {
  subjects: Subject[];
  busy: boolean;
  onAdd: (task: NewTask) => void;
}

/** What a task is worth when the reader does not say. Matches the backend's. */
const DEFAULT_XP = 10;

export function Composer({ subjects, busy, onAdd }: ComposerProps) {
  const [name, setName] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [xp, setXp] = useState(DEFAULT_XP);
  const [due, setDue] = useState('');
  const [subject, setSubject] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const field = useRef<HTMLInputElement>(null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const title = name.trim();
    if (!title || busy) return;
    onAdd({
      name: title,
      priority,
      xp_reward: Number(xp) || DEFAULT_XP,
      due_date: due || null,
      subject,
    });
    // The name is the only field cleared: the rest are almost always the same
    // for the next one, and re-choosing them every time is the friction this
    // form exists to remove.
    setName('');
    field.current?.focus();
  };

  return (
    <form className="tk-composer" onSubmit={submit}>
      <div className="tk-composer-main">
        <input
          ref={field}
          className="tk-composer-name"
          value={name}
          placeholder="Add a task…"
          aria-label="Task name"
          onChange={(event) => setName(event.target.value)}
          onFocus={() => setOpen(true)}
        />
        <button type="submit" className="tk-btn is-primary" disabled={busy || !name.trim()}>
          Add
        </button>
        <button
          type="button"
          className="tk-btn is-quiet"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? 'Fewer options' : 'More options'}
        </button>
      </div>

      {open && (
        <div className="tk-composer-more">
          <label className="tk-field">
            <span>Priority</span>
            <select
              className="tk-select"
              value={priority}
              onChange={(event) => setPriority(event.target.value as TaskPriority)}
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>

          <label className="tk-field">
            <span>XP</span>
            <input
              className="tk-input"
              type="number"
              min={0}
              max={999}
              value={xp}
              onChange={(event) => setXp(Number(event.target.value))}
            />
          </label>

          <label className="tk-field">
            <span>Due</span>
            <input
              className="tk-input"
              type="date"
              value={due}
              onChange={(event) => setDue(event.target.value)}
            />
          </label>

          <div className="tk-field tk-field-subject">
            <SubjectPicker
              subjects={subjects}
              value={subject}
              onChange={setSubject}
              label="Subject"
              id="tk-composer"
            />
          </div>
        </div>
      )}
    </form>
  );
}
