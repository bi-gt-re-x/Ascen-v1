/**
 * The Day view's right-hand column: the month, the focus card, the day's
 * numbers, and what is left to do.
 *
 * Focus Time is the one number that changes meaning with the day. On today it
 * *is* the focus goal — the same one the dashboard's Focus panel sets — and
 * clicking it lets you type a new one, so the two pages can never disagree. On
 * any other day there is no goal to speak of, so it shows what that day has
 * been planned to hold, and is read-only.
 */
import { useState } from 'react';
import { MiniMonth } from './MiniMonth';
import { iconUrlFor } from '@/utils/calendarIcons';
import type { TaskBlock } from '@/utils/calendarGrid';

export interface DayStats {
  /** "2 / 5" — of the day's tasks. */
  tasks: string;
  /** Already formatted: "1h 30m". */
  focusTime: string;
  /** Null while the ledger is still being asked. */
  xp: number | null;
  streak: number;
}

export interface DaySidebarProps {
  miniYear: number;
  miniMonth: number;
  selectedIso: string;
  /** The day the account's weeks open on — see MiniMonth. */
  weekStart: 0 | 1;
  onMiniStep: (delta: number) => void;
  onPickDate: (iso: string) => void;

  /** The shared focus session, as the dashboard's panel reports it. */
  focus: { focused: string; goal: string; percent: number };
  /** Only today's goal can be typed into. */
  goalEditable: boolean;
  onSetGoalHours: (hours: number) => void;

  stats: DayStats;
  /** The day's unfinished blocks, earliest first. Five are shown. */
  pending: TaskBlock[];
  onComplete: (taskId: string) => void;
  completingId?: string | null;
  onAddTask: () => void;
}

/** "2h", "1h 30m" or "45m" back to hours; anything unreadable is rejected. */
function parseGoalHours(raw: string): number | null {
  const text = raw.trim().toLowerCase();
  if (!text) return null;

  const hoursAndMinutes = /^(\d+(?:\.\d+)?)\s*h(?:\s*(\d+)\s*m?)?$/.exec(text);
  if (hoursAndMinutes) {
    return Number(hoursAndMinutes[1]) + Number(hoursAndMinutes[2] ?? 0) / 60;
  }
  const minutesOnly = /^(\d+)\s*m$/.exec(text);
  if (minutesOnly) return Number(minutesOnly[1]) / 60;

  const bare = Number(text);
  return Number.isFinite(bare) ? bare : null;
}

export function DaySidebar({
  miniYear,
  miniMonth,
  selectedIso,
  weekStart,
  onMiniStep,
  onPickDate,
  focus,
  goalEditable,
  onSetGoalHours,
  stats,
  pending,
  onComplete,
  completingId,
  onAddTask,
}: DaySidebarProps) {
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalText, setGoalText] = useState('');

  const commitGoal = () => {
    const hours = parseGoalHours(goalText);
    if (hours !== null) onSetGoalHours(hours);
    setEditingGoal(false);
  };

  return (
    <aside className="day-sidebar" id="daySidebar">
      <MiniMonth
        year={miniYear}
        month={miniMonth}
        selectedIso={selectedIso}
        weekStart={weekStart}
        onStep={onMiniStep}
        onPick={onPickDate}
      />

      <section className="wk-panel">
        <div className="day-panel-head">
          <h3 className="wk-panel-title">Focus</h3>
        </div>
        <div className="day-focus-row">
          <span className="day-focus-icon">
            <i
              className="cal-ico"
              style={{
                ['--ico' as string]: `url(${iconUrlFor('focus')})`,
                width: '18px',
                height: '18px',
              }}
            />
          </span>
          <div className="day-focus-main">
            <div className="day-focus-name">Deep Work</div>
            <div className="day-focus-sub">{focus.focused}</div>
          </div>
          <div className="day-focus-time">{focus.goal}</div>
        </div>
        <div className="day-focus-barrow">
          <span>Today&apos;s focus time</span>
          <span className="day-focus-pct">{focus.percent}%</span>
        </div>
        <div className="wk-progress">
          <div className="wk-progress-bar" style={{ width: `${focus.percent}%` }} />
        </div>
      </section>

      <section className="wk-panel">
        <div className="day-panel-head">
          <h3 className="wk-panel-title">Daily Overview</h3>
        </div>
        <div className="wk-stats day-stats">
          <div className="wk-stat">
            <div className="wk-stat-label">Tasks</div>
            <div className="wk-stat-num">{stats.tasks}</div>
            <div className="wk-stat-sub">Completed</div>
          </div>
          <div className="wk-stat">
            <div className="wk-stat-label">Focus Time</div>
            <div
              className={`wk-stat-num day-stat-green${goalEditable ? ' is-editable' : ''}`}
              title={goalEditable ? 'Click to set your focus time' : ''}
              onClick={() => {
                if (!goalEditable || editingGoal) return;
                setGoalText(stats.focusTime);
                setEditingGoal(true);
              }}
            >
              {editingGoal ? (
                <input
                  type="text"
                  value={goalText}
                  autoFocus
                  onChange={(event) => setGoalText(event.target.value)}
                  onBlur={commitGoal}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') commitGoal();
                    if (event.key === 'Escape') setEditingGoal(false);
                  }}
                />
              ) : (
                stats.focusTime
              )}
            </div>
            <div className="wk-stat-sub">Planned</div>
          </div>
          <div className="wk-stat">
            <div className="wk-stat-label">XP Earned</div>
            <div className="wk-stat-num day-stat-purple">{stats.xp ?? '–'}</div>
            <div className="wk-stat-sub">today</div>
          </div>
          <div className="wk-stat">
            <div className="wk-stat-label">Streak</div>
            <div className="wk-stat-num">{stats.streak}</div>
            <div className="wk-stat-sub">days</div>
          </div>
        </div>
      </section>

      <section className="wk-panel">
        <div className="day-panel-head">
          <h3 className="wk-panel-title">Tasks Left</h3>
          <span className="day-panel-link" role="button" tabIndex={0} onClick={onAddTask}>
            + Add Task
          </span>
        </div>
        <ul className="day-tasks-left">
          {pending.length === 0 ? (
            <li className="day-tasks-empty">Nothing left — you’re all caught up. 🎉</li>
          ) : (
            pending.slice(0, 5).map((block) => {
              const priority = String(block.priority || '').toLowerCase();
              const className =
                priority === 'high' ? 'high' : priority === 'medium' ? 'med' : 'low';
              const label = priority
                ? priority.charAt(0).toUpperCase() + priority.slice(1)
                : '—';

              return (
                <li
                  key={block.id}
                  className={`day-task-item${completingId === block.id ? ' is-completing' : ''}`}
                  data-id={block.id}
                >
                  <span className="day-task-ring" />
                  <i
                    className="cal-ico"
                    style={{ ['--ico' as string]: `url(${iconUrlFor(block.title)})` }}
                  />
                  <span
                    className="day-task-name wk-task-name"
                    role="button"
                    tabIndex={0}
                    title="Click to mark complete"
                    onClick={() => onComplete(block.id)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      onComplete(block.id);
                    }}
                  >
                    {block.title}
                  </span>
                  <span className={`day-task-diff ${className}`}>{label}</span>
                </li>
              );
            })
          )}
        </ul>
      </section>
    </aside>
  );
}
