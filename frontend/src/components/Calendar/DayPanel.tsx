/**
 * "What You'll Do Today" — the month view's right-hand column.
 *
 * The day's focus note is pinned above a scrolling list of cards. Events get a
 * clock icon and can be edited; tasks get a numbered badge, a difficulty pill
 * and — while they are unfinished — a name you can click to finish them. The
 * ring that counts the day off is not here: it belongs under the month grid,
 * in the other column (see DayProgress).
 *
 * The times on a card are only the ones the entry actually has. A to-do that
 * reached the day by being finished has no start, and shows a lone end rather
 * than an empty field beside a dash.
 */
import { useEffect, useState } from 'react';
import { xpToDifficulty } from '@/utils/priority';
import type { DayEntry } from './entries';

export interface DayPanelProps {
  entries: DayEntry[];
  focusText: string;
  onFocusChange: (text: string) => void;
  onAddEvent: () => void;
  onEditEvent: (entry: DayEntry) => void;
  onRemoveEvent: (entry: DayEntry) => void;
  onRenameEvent: (entry: DayEntry, name: string) => void;
  onRetimeEvent: (entry: DayEntry, field: 'startTime' | 'endTime', value: string) => void;
  onComplete: (taskId: string) => void;
  completingId?: string | null;
}

/**
 * The band a card is labelled with.
 *
 * A task carries its own priority and that is what the card says — the same
 * word the task list, the grid blocks and the Week view's priority chart use
 * for it, so one task cannot read "High" in one place and "Medium" in another.
 * An event has no such column, so its band is read off the XP, which is the
 * rule this card has always used.
 */
function difficulty(xp: number, priority?: string): 'High' | 'Medium' | 'Low' {
  if (priority === 'high') return 'High';
  if (priority === 'medium') return 'Medium';
  if (priority === 'low') return 'Low';
  return xpToDifficulty(xp);
}

function EventIcon() {
  return (
    <span className="event-icon">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5V12l3 1.8" />
      </svg>
    </span>
  );
}

function CheckIcon({ className }: { className: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function DayPanel({
  entries,
  focusText,
  onFocusChange,
  onAddEvent,
  onEditEvent,
  onRemoveEvent,
  onRenameEvent,
  onRetimeEvent,
  onComplete,
  completingId,
}: DayPanelProps) {
  let taskNumber = 0;

  // Only one card's menu is open at a time, and a click anywhere else closes
  // it — including a click on one of its own items, which has already acted.
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  useEffect(() => {
    if (!openMenu) return;
    const close = () => setOpenMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMenu]);

  return (
    <div className="calendar-right">
      <div className="calendar-bottom-section">
        <div className="calendar-bottom-box full-width">
          <div className="day-panel-head">
            <h3>What You&apos;ll Do Today</h3>
            {/* The original only ever made an event by dragging a slot on the
                week grid, which left the month view with no way to add one at
                all. It has one now. */}
            <span
              className="day-panel-link"
              role="button"
              tabIndex={0}
              onClick={onAddEvent}
            >
              + Add Event
            </span>
          </div>

          <div className="daily-focus-holder">
            <input
              type="text"
              className="daily-focus-input"
              placeholder="Today's focus..."
              value={focusText}
              onChange={(event) => onFocusChange(event.target.value)}
            />
          </div>

          {/* month.css dresses the list and the ring by id, so both keep the
              ones they have always had. */}
          <ul id="dailyTasks">
            {entries.length === 0 && (
              <li className="no-events-message">No Tasks or Events scheduled yet</li>
            )}

            {entries.map((entry) => {
              const isTask = entry.kind === 'task';
              if (isTask) taskNumber += 1;

              const canComplete = isTask && !entry.completed && Boolean(entry.taskId);
              const level = difficulty(entry.xp, entry.priority);
              const classes = [
                'task-section',
                isTask ? 'dashboard-task' : 'calendar-event',
                isTask ? `priority-${level.toLowerCase()}` : '',
                entry.completed ? 'task-completed' : 'task-in-progress',
                entry.hasConflict && !isTask ? 'conflict' : '',
                canComplete ? 'can-complete' : '',
                completingId && completingId === entry.taskId ? 'is-completing' : '',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <li className={classes} key={entry.key}>
                  {!isTask && <EventIcon />}

                  <div className="card-body">
                    {isTask && (
                      <div className="card-tags">
                        <span className="task-kind-badge">Task {taskNumber}</span>
                        <span className={`difficulty-badge difficulty-${level.toLowerCase()}`}>
                          {level} Priority
                        </span>
                      </div>
                    )}

                    <input
                      type="text"
                      className="task-input-inline"
                      value={entry.name}
                      placeholder="What will you do..."
                      readOnly={isTask}
                      role={canComplete ? 'button' : undefined}
                      title={canComplete ? 'Click to mark complete' : undefined}
                      onClick={() => {
                        if (canComplete && entry.taskId) onComplete(entry.taskId);
                      }}
                      onChange={(event) => onRenameEvent(entry, event.target.value)}
                    />

                    <div className="timestamp-section">
                      {entry.startTime && (
                        <input
                          type="time"
                          className="start-time"
                          value={entry.startTime}
                          disabled={isTask}
                          onChange={(event) =>
                            onRetimeEvent(entry, 'startTime', event.target.value)
                          }
                        />
                      )}
                      {entry.startTime && entry.endTime && <span>-</span>}
                      {entry.endTime && (
                        <input
                          type="time"
                          className="end-time"
                          value={entry.endTime}
                          disabled={isTask}
                          onChange={(event) =>
                            onRetimeEvent(entry, 'endTime', event.target.value)
                          }
                        />
                      )}
                    </div>
                  </div>

                  {/* Events can be edited; a task's card can only be taken off
                      the day, because the task itself belongs to the database. */}
                  <div className="card-menu-wrap">
                    <button
                      type="button"
                      className="card-menu-btn"
                      aria-label="More options"
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpenMenu((current) => (current === entry.key ? null : entry.key));
                      }}
                    >
                      ⋮
                    </button>
                    <div className={`card-menu${openMenu === entry.key ? ' open' : ''}`}>
                      {!isTask && (
                        <button
                          type="button"
                          className="card-menu-item"
                          onClick={() => onEditEvent(entry)}
                        >
                          Edit
                        </button>
                      )}
                      <button
                        type="button"
                        className="card-menu-item"
                        onClick={() => onRemoveEvent(entry)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {isTask && entry.completed && (
                    <span className="completed-badge">
                      Completed <CheckIcon className="completed-check" />
                    </span>
                  )}
                  {canComplete && (
                    <span className="complete-hint">
                      Mark complete <CheckIcon className="completed-check" />
                    </span>
                  )}

                  {entry.subtasks && entry.subtasks.length > 0 && (
                    <ul className="subtasks-list">
                      {entry.subtasks.map((subtask, subIndex) => {
                        const text = typeof subtask === 'string' ? subtask : subtask.text;
                        return (
                          <li className="subtask-item" key={`${entry.key}-sub-${subIndex}`}>
                            <span className="bullet">•</span>
                            <input
                              type="text"
                              className="subtask-input"
                              value={text}
                              readOnly
                            />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

    </div>
  );
}
