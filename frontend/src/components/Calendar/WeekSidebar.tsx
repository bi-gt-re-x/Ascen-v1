/**
 * The Week view's overview column.
 *
 * Five panels, and each one is scoped to the week on screen rather than to
 * "now" — stepping back a week steps all of them back. That is what makes the
 * column readable: every number on it answers a question about the same seven
 * days.
 *
 * Top Priorities lists every outstanding task of the week, not a top three. A
 * task being fourth by XP does not make it not outstanding, so the count goes
 * in the heading and the column scrolls.
 */
import type { Task } from '@/types';

export interface WeekStats {
  total: number;
  done: number;
  rate: number;
  xp: number;
}

export interface WeekSidebarProps {
  stats: WeekStats;
  streak: number;
  /** "1h 30m : 2h" — focused against planned, across the week. */
  focusTime: string;
  priorities: Task[];
  focusText: string;
  onFocusTextChange: (text: string) => void;
  collapsed: boolean;
}

function priorityLabel(task: Task): { className: string; label: string } {
  const priority = String(task.priority || '').toLowerCase();
  const className = priority === 'high' ? 'high' : priority === 'medium' ? 'med' : 'low';
  return {
    className,
    label: priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : '—',
  };
}

export function WeekSidebar({
  stats,
  streak,
  focusTime,
  priorities,
  focusText,
  onFocusTextChange,
  collapsed,
}: WeekSidebarProps) {
  return (
    <aside className="wk-sidebar" id="wkSidebar" hidden={collapsed}>
      <section className="wk-panel">
        <h3 className="wk-panel-title">📈 Weekly Overview</h3>
        <div className="wk-stats">
          <div className="wk-stat">
            <div className="wk-stat-num">{stats.total}</div>
            <div className="wk-stat-label">Total Tasks</div>
          </div>
          <div className="wk-stat">
            <div className="wk-stat-num">{stats.done}</div>
            <div className="wk-stat-label">Completed</div>
          </div>
          <div className="wk-stat">
            <div className="wk-stat-num">{stats.rate}%</div>
            <div className="wk-stat-label">Completion Rate</div>
          </div>
          <div className="wk-stat">
            <div className="wk-stat-num">{stats.xp.toLocaleString()} XP</div>
            <div className="wk-stat-label">Total XP Earned</div>
          </div>
        </div>
      </section>

      <section className="wk-panel">
        <h3 className="wk-panel-title">🎯 Weekly Focus</h3>
        <textarea
          className="wk-focus-input"
          rows={2}
          placeholder="What's your focus this week?"
          aria-label="Weekly focus"
          value={focusText}
          onChange={(event) => onFocusTextChange(event.target.value)}
        />
      </section>

      <section className="wk-panel">
        <h3 className="wk-panel-title">
          🚩 Top Priorities{' '}
          <span className="wk-priorities-count">
            {priorities.length ? `(${priorities.length})` : ''}
          </span>
        </h3>
        <ol className="wk-priorities">
          {priorities.length === 0 ? (
            <li>
              <span>--</span>
              <span className="wk-badge">--</span>
            </li>
          ) : (
            priorities.map((task, index) => {
              const { className, label } = priorityLabel(task);
              return (
                <li key={task.id}>
                  <span>
                    {index + 1}. {task.title || 'Untitled'}
                  </span>
                  <span className={`wk-badge ${className}`}>{label}</span>
                </li>
              );
            })
          )}
        </ol>
      </section>

      {/* Focused time against the time planned for it — the sum of each day's
          focus goal across the shown week. */}
      <section className="wk-panel">
        <h3 className="wk-panel-title">⏱️ Weekly Focus Time</h3>
        <div className="wk-focustime">{focusTime}</div>
        <div className="wk-focustime-sub">Focused : Planned</div>
      </section>

      <section className="wk-panel">
        <h3 className="wk-panel-title">🔥 Streak</h3>
        <div className="wk-streak-num">
          {streak} {streak === 1 ? 'day' : 'days'}
        </div>
        <div className="wk-streak-sub">Keep it up! 🔥</div>
      </section>
    </aside>
  );
}
