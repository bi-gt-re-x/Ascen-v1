/**
 * The dashboard's "Add New Task" dialog.
 *
 * A task carries an XP reward and, optionally, *either* a timer duration *or*
 * a due date — the two are alternatives, which is why the original put an "OR"
 * between the two dropdown buttons. Opening one closes the other here, so the
 * exclusivity is enforced rather than implied.
 *
 * The XP slider and its number box are two views of one value; the original
 * kept them in step with a pair of `oninput` handlers that each wrote to the
 * other, and this holds the value once and renders both from it.
 *
 * A due date is assembled from four controls (date, hour, minute, AM/PM) and
 * sent as one ISO-ish local string, the way `addTaskFromModal` did it.
 */
import { useEffect, useState } from 'react';
import type { NewTask } from '@/services/tasks';

export interface TaskModalProps {
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onAdd: (task: NewTask & { timer_duration?: number }) => void;
}

const MIN_XP = 10;
const MAX_XP = 100;

type Panel = 'none' | 'timer' | 'due';

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) =>
  String(i).padStart(2, '0'),
);

export function TaskModal({
  open,
  busy = false,
  onClose,
  onAdd,
}: TaskModalProps) {
  const [name, setName] = useState('');
  const [xp, setXp] = useState(MIN_XP);
  const [panel, setPanel] = useState<Panel>('none');
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [date, setDate] = useState('');
  const [hour, setHour] = useState('');
  const [minute, setMinute] = useState('');
  const [ampm, setAmpm] = useState('');
  const [invalid, setInvalid] = useState(false);

  // Fresh every time it opens, so yesterday's half-filled task is not waiting.
  useEffect(() => {
    if (!open) return;
    setName('');
    setXp(MIN_XP);
    setPanel('none');
    setHours(0);
    setMinutes(0);
    setDate('');
    setHour('');
    setMinute('');
    setAmpm('');
    setInvalid(false);
  }, [open]);

  if (!open) return null;

  /** Clamp anything typed into the number box back into range. */
  function clampXp(value: string) {
    const n = parseInt(value, 10);
    if (Number.isNaN(n)) return;
    setXp(Math.max(MIN_XP, Math.min(MAX_XP, n)));
  }

  /**
   * The four due-date controls as one local datetime string, or null.
   *
   * A 12-hour clock needs both the hour and the meridiem to mean anything, so
   * an incomplete time is treated as no time rather than as midnight.
   */
  function dueDate(): string | null {
    if (panel !== 'due' || !date) return null;
    if (!hour || !minute || !ampm) return `${date}T00:00`;
    let h = parseInt(hour, 10) % 12;
    if (ampm === 'PM') h += 12;
    return `${date}T${String(h).padStart(2, '0')}:${minute}`;
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setInvalid(true);
      return;
    }
    const task: NewTask & { timer_duration?: number } = {
      name: name.trim(),
      xp_reward: xp,
      due_date: dueDate(),
    };
    // Stored in minutes, entered as hours + minutes.
    if (panel === 'timer') {
      const total = hours * 60 + minutes;
      if (total > 0) task.timer_duration = total;
    }
    onAdd(task);
  }

  return (
    <div id="taskModal" className="modal" style={{ display: 'block' }}>
      <div className="modal-content">
        <span
          className="close"
          role="button"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </span>
        <h2>Add New Task</h2>

        <form onSubmit={submit}>
          <input
            type="text"
            id="modalTaskName"
            className={invalid ? 'invalid-input' : ''}
            placeholder="Task Name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (invalid) setInvalid(false);
            }}
          />

          <div style={{ marginTop: '20px', textAlign: 'left' }}>
            <label
              style={{ fontSize: '13px', fontWeight: 500, color: '#6C757D' }}
            >
              XP Reward:{' '}
              <span id="xpValue" style={{ color: '#A38A70', fontWeight: 700 }}>
                {xp}
              </span>
            </label>
            <div
              style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                marginTop: '6px',
              }}
            >
              <input
                type="range"
                id="xpSlider"
                min={MIN_XP}
                max={MAX_XP}
                value={xp}
                style={{ flex: 1, accentColor: '#A38A70' }}
                onChange={(e) => setXp(Number(e.target.value))}
              />
              <input
                type="number"
                id="xpInput"
                className="xp-input-field"
                min={MIN_XP}
                max={MAX_XP}
                value={xp}
                onChange={(e) => clampXp(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-separator" />

          <div className="dropdown-buttons">
            <div className="dropdown-row">
              <button
                type="button"
                className="dropdown-btn"
                onClick={() =>
                  setPanel((p) => (p === 'timer' ? 'none' : 'timer'))
                }
              >
                Task Timer <span className="dropdown-arrow">▼</span>
              </button>
              <span className="or-text">OR</span>
              <button
                type="button"
                className="dropdown-btn"
                onClick={() => setPanel((p) => (p === 'due' ? 'none' : 'due'))}
              >
                Due Date <span className="dropdown-arrow">▼</span>
              </button>
            </div>

            {panel === 'timer' && (
              <div id="timerDropdown" className="dropdown-content">
                <div className="timer-section">
                  <label
                    style={{
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#6C757D',
                    }}
                  >
                    Timer Duration:
                  </label>
                  <div className="timer-inputs" style={{ marginTop: '8px' }}>
                    <div className="timer-input-group">
                      <label htmlFor="timerHours">Hours</label>
                      <input
                        type="range"
                        id="timerHours"
                        min={0}
                        max={12}
                        value={hours}
                        style={{ accentColor: '#2C302E' }}
                        onChange={(e) => setHours(Number(e.target.value))}
                      />
                      <input
                        type="number"
                        id="timerHoursInput"
                        className="xp-input-field"
                        style={{
                          width: '55px',
                          padding: '4px',
                          fontSize: '12px',
                        }}
                        min={0}
                        max={12}
                        value={hours}
                        onChange={(e) =>
                          setHours(
                            Math.max(
                              0,
                              Math.min(12, Number(e.target.value) || 0),
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="timer-input-group">
                      <label htmlFor="timerMinutes">Minutes</label>
                      <input
                        type="range"
                        id="timerMinutes"
                        min={0}
                        max={60}
                        value={minutes}
                        style={{ accentColor: '#2C302E' }}
                        onChange={(e) => setMinutes(Number(e.target.value))}
                      />
                      <input
                        type="number"
                        id="timerMinutesInput"
                        className="xp-input-field"
                        style={{
                          width: '55px',
                          padding: '4px',
                          fontSize: '12px',
                        }}
                        min={0}
                        max={60}
                        value={minutes}
                        onChange={(e) =>
                          setMinutes(
                            Math.max(
                              0,
                              Math.min(60, Number(e.target.value) || 0),
                            ),
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {panel === 'due' && (
              <div id="dueDateDropdown" className="dropdown-content">
                <div
                  className="due-date-section"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div>
                    <label
                      htmlFor="dueDate"
                      style={{
                        fontSize: '12px',
                        color: '#6C757D',
                        display: 'block',
                        marginBottom: '4px',
                      }}
                    >
                      Select Due Date:
                    </label>
                    <input
                      type="date"
                      id="dueDate"
                      className="due-date-input"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      id="dueHour"
                      className="due-date-input"
                      style={{ flex: 1 }}
                      value={hour}
                      onChange={(e) => setHour(e.target.value)}
                    >
                      <option value="">Hour</option>
                      {HOURS.map((h) => (
                        <option value={h} key={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                    <select
                      id="dueMinute"
                      className="due-date-input"
                      style={{ flex: 1 }}
                      value={minute}
                      onChange={(e) => setMinute(e.target.value)}
                    >
                      <option value="">Minute</option>
                      {MINUTES.map((m) => (
                        <option value={m} key={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <select
                      id="dueAmPm"
                      className="due-date-input"
                      style={{ flex: 1 }}
                      value={ampm}
                      onChange={(e) => setAmpm(e.target.value)}
                    >
                      <option value="">AM/PM</option>
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          <p className="calendar-hint">
            📅 To put a task on the calendar, open the{' '}
            <a href="/calendar">Calendar</a>, drag across a time slot, and
            choose <strong>Task</strong>.
          </p>

          <button type="submit" className="confirm-add-btn" disabled={busy}>
            Confirm &amp; Add Task
          </button>
        </form>
      </div>
    </div>
  );
}
