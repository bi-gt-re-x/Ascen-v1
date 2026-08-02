/**
 * Add or edit a task, from the calendar rather than the dashboard.
 *
 * The same layout as the event dialog with XP in place of nothing, because a
 * task on the grid is a real task: it is created in the database with
 * `show_on_calendar`, it is worth XP, and finishing it from the grid awards
 * that XP exactly as ticking it off on the dashboard does.
 *
 * A task's times are its span. `created_at` is the start and `due_date` the
 * end — the grid draws the block between them — which is why the dialog asks
 * for both and why editing one moves the block rather than nudging a deadline.
 *
 * Difficulty is not asked for. It follows from XP on the dashboard's
 * thresholds (under 33 low, under 66 medium, then high), so asking again would
 * be inviting the two to disagree.
 */
import { useEffect, useState } from 'react';
import { RecurrencePicker } from './RecurrencePicker';
import { TimePicker } from './TimePicker';
import type { Scope } from '@/hooks/useCalendarStore';
import type { RecurrenceType } from '@/utils/calendarStore';
import type { TaskPriority } from '@/types';

export const MIN_TASK_XP = 10;
export const MAX_TASK_XP = 100;

/** The dashboard's thresholds, so a block's colour means what it does there. */
export function xpToPriority(xp: number): TaskPriority {
  return xp < 33 ? 'low' : xp < 66 ? 'medium' : 'high';
}

export interface TaskDraft {
  name: string;
  startTime: string;
  endTime: string;
  xp: number;
  recurrence: RecurrenceType;
  recurrenceDays: number[];
}

export interface TaskModalProps {
  initial?: { name: string; startTime: string; endTime: string; xp: number };
  /** True when this task repeats — the edit dialog then asks about scope. */
  recurring?: boolean;
  defaults?: { startTime: string; endTime: string };
  /** The Day view acts on one task only, so it never offers a repeat. */
  allowRecurrence?: boolean;
  onSave: (draft: TaskDraft, scope: Scope) => void;
  onClose: () => void;
  wide?: boolean;
}

export function TaskModal({
  initial,
  recurring,
  defaults,
  allowRecurrence = true,
  onSave,
  onClose,
  wide,
}: TaskModalProps) {
  const editing = Boolean(initial);

  const [name, setName] = useState(initial?.name ?? '');
  const [startTime, setStartTime] = useState(initial?.startTime ?? defaults?.startTime ?? '');
  const [endTime, setEndTime] = useState(initial?.endTime ?? defaults?.endTime ?? '');
  const [xp, setXp] = useState(initial?.xp ?? MIN_TASK_XP);
  const [recurrence, setRecurrence] = useState<RecurrenceType>('none');
  const [days, setDays] = useState<number[]>([]);
  const [scope, setScope] = useState<Scope>('one');
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const missingName = !name.trim();
  const missingDays = recurrence !== 'none' && days.length === 0;

  const setClampedXp = (value: number) =>
    setXp(Math.max(MIN_TASK_XP, Math.min(MAX_TASK_XP, Math.round(value) || MIN_TASK_XP)));

  const save = () => {
    if (missingName || !startTime || !endTime || missingDays) {
      setShowErrors(true);
      return;
    }
    onSave(
      {
        name: name.trim(),
        startTime,
        endTime,
        xp,
        recurrence: allowRecurrence ? recurrence : 'none',
        recurrenceDays: allowRecurrence ? days : [],
      },
      scope,
    );
  };

  return (
    // week.css scopes the XP row's widths under #addTaskModal to out-specify
    // the modal's generic input rules, so the id has to survive the port.
    <div
      id="addTaskModal"
      className={`modal${wide ? ' from-week' : ''}`}
      style={{ display: 'block' }}
      role="dialog"
      aria-modal="true"
      aria-label={editing ? 'Edit task' : 'Add new task'}
    >
      <div className="modal-content">
        <div className="modal-header">
          <h3>{editing ? 'Edit Task' : 'Add New Task'}</h3>
          <span className="close-btn" role="button" tabIndex={0} onClick={onClose}>
            ×
          </span>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="taskName">Task Name:</label>
            <input
              id="taskName"
              type="text"
              className={showErrors && missingName ? 'invalid-input' : ''}
              placeholder="e.g., Finish essay"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
          </div>

          <TimePicker
            id="taskStart"
            label="Start Time:"
            value={startTime}
            onChange={setStartTime}
            invalid={showErrors && !startTime}
          />
          <TimePicker
            id="taskEnd"
            label="End Time:"
            value={endTime}
            onChange={setEndTime}
            invalid={showErrors && !endTime}
          />

          <div className="form-group">
            <label htmlFor="taskXpSlider">
              XP Reward: <span className="xp-value">{xp}</span>
            </label>
            <div className="xp-slider-row">
              <input
                id="taskXpSlider"
                type="range"
                min={MIN_TASK_XP}
                max={MAX_TASK_XP}
                value={xp}
                style={{ flex: 1, accentColor: '#A38A70' }}
                onChange={(event) => setClampedXp(Number(event.target.value))}
              />
              <input
                type="number"
                className="xp-input-field"
                min={MIN_TASK_XP}
                max={MAX_TASK_XP}
                value={xp}
                onChange={(event) => setClampedXp(Number(event.target.value))}
              />
            </div>
          </div>

          {editing && recurring && (
            <div className="form-group">
              <label>Apply changes to:</label>
              <div className="radio-group">
                <label>
                  <input
                    type="radio"
                    name="taskEditScope"
                    checked={scope === 'one'}
                    onChange={() => setScope('one')}
                  />{' '}
                  This occurrence
                </label>
                <label>
                  <input
                    type="radio"
                    name="taskEditScope"
                    checked={scope === 'all'}
                    onChange={() => setScope('all')}
                  />{' '}
                  All occurrences
                </label>
              </div>
            </div>
          )}

          {!editing && allowRecurrence && (
            <RecurrencePicker
              name="taskRecurrenceType"
              type={recurrence}
              days={days}
              onChange={(type, chosen) => {
                setRecurrence(type);
                setDays(chosen);
              }}
              invalid={showErrors && missingDays}
            />
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-confirm" onClick={save}>
            {editing ? 'Save Changes' : 'Add Task'}
          </button>
        </div>
      </div>
    </div>
  );
}
