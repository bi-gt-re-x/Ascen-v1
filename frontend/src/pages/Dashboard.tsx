/**
 * The dashboard — the account's stats, its task list, and the focus session.
 *
 * Ported from frontend/html/dashboard.html and frontend/js/dashboard.js, with
 * the task row from tasks.js and the session from focus.js. The markup and
 * class names are the originals, so styles/dashboard.css dresses this page
 * unchanged: the port is a change of mechanism, not of appearance.
 *
 * The rule the original followed and this one keeps: **the backend decides.**
 * Completing a task does not compute the new XP, level or streak locally — it
 * posts, and re-reads. The same call also moves goals and the XP ledger, and
 * re-reading is the only way this page and the goals page agree without a
 * second copy of those rules.
 *
 * What the earlier version of this file was missing, and is here now: the Add
 * Task dialog, the Focus panel, the quote line, and a task row that matches
 * what the stylesheet expects.
 */
import { useCallback, useState } from 'react';
import { ErrorState, Loading } from '@/components';
import {
  FocusPanel,
  LevelUp,
  TaskModal,
  TaskRow,
} from '@/components/Dashboard';
import { useDocumentTitle, useUserData } from '@/hooks';
import { tasks as taskService } from '@/services';
import { format } from '@/utils';
import type { NewTask } from '@/services/tasks';
import type { Task } from '@/types';
import '@/styles/dashboard.css';

/**
 * A task belongs to the calendar half of the list when it is scheduled.
 *
 * The original decided this from `show_on_calendar` plus a due date; this is
 * the same test, kept in one place so the two halves cannot both claim a task.
 */
function isCalendarTask(task: Task): boolean {
  return Boolean(task.show_on_calendar && task.due_date);
}

function TaskSection({
  heading,
  items,
  busyId,
  onComplete,
}: {
  heading: string;
  items: Task[];
  busyId: string | null;
  onComplete: (task: Task) => void;
}) {
  return (
    <div className="task-subsection">
      <h3 className="task-subhead">{heading}</h3>
      <ul className="task-list">
        {items.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            busy={busyId === task.id}
            onComplete={onComplete}
          />
        ))}
      </ul>
      {items.length === 0 && <p className="task-empty">Nothing here yet.</p>}
    </div>
  );
}

export default function Dashboard() {
  useDocumentTitle('Dashboard');

  const { data, error, loading, reload, username } = useUserData();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  /** The level to celebrate, set when a completion crosses a level boundary. */
  const [levelled, setLevelled] = useState<number | null>(null);

  const complete = useCallback(
    async (task: Task) => {
      if (!username) return;
      setBusyId(task.id);
      setFailure(null);
      // The level before the write. The response carries `new_level`, so the
      // backend still decides what the level is — this only notices that it
      // went up, which is what the celebration is for.
      const was = data ? format.levelForTotalXp(data.stats.xp).level : 0;
      try {
        const result = await taskService.completeTask(username, task.id);
        if (!result.success) {
          setFailure(result.message);
          return;
        }
        if (result.new_level > was) setLevelled(result.new_level);
        reload();
      } catch (cause) {
        setFailure(
          cause instanceof Error
            ? cause.message
            : 'Could not complete that task.',
        );
      } finally {
        setBusyId(null);
      }
    },
    [username, reload, data],
  );

  const addTask = useCallback(
    async (task: NewTask) => {
      if (!username) return;
      setSaving(true);
      setFailure(null);
      try {
        const result = await taskService.createTask(username, task);
        if (!result.success) {
          setFailure(result.message);
          return;
        }
        setAdding(false);
        reload();
      } catch (cause) {
        setFailure(
          cause instanceof Error ? cause.message : 'Could not add that task.',
        );
      } finally {
        setSaving(false);
      }
    },
    [username, reload],
  );

  if (loading) return <Loading label="Loading your dashboard" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data)
    return <ErrorState message="No data came back." onRetry={reload} />;

  const { stats } = data;
  const level = format.levelForTotalXp(stats.xp);
  const open = data.tasks.filter((task) => task.status === 'todo');
  const todo = open.filter((task) => !isCalendarTask(task));
  const scheduled = open.filter(isCalendarTask);

  return (
    <div className="container">
      <div className="top-section">
        <div className="card user-stats">
          <h2>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4.418 3.582-8 8-8s8 3.582 8 8" />
            </svg>
            User Profile
          </h2>
          <div className="username-row">
            <span className="label">Name:</span>
            <span className="username" id="userNameDisplay">
              {username}
            </span>
          </div>
          <div className="xp-section">
            <div className="xp-label-row">
              <span>
                XP: {format.number(level.xpInLevel)} /{' '}
                {format.number(level.xpRequired)}
              </span>
            </div>
            <div className="xp-bar-container">
              <div
                className="xp-bar-fill"
                style={{ width: `${level.percent}%` }}
                role="progressbar"
                aria-valuenow={Math.round(level.percent)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Level ${level.level} progress`}
              />
            </div>
            <div className="stats-footer">
              <span className="stat-item">Level: {level.level}</span>
            </div>
          </div>
        </div>

        <div className="card streak-stats">
          <h2>Statistics</h2>
          <div className="stat-row">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#A38A70"
              strokeWidth="2"
            >
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
            <span>
              Current Streak: <strong>{stats.current_streak}</strong> Days
            </span>
          </div>
          <div className="stat-row">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#A38A70"
              strokeWidth="2"
            >
              <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.1.2-2.2.5-3.3" />
            </svg>
            <span>
              Best Streak: <strong>{stats.best_streak}</strong> Days
            </span>
          </div>
          <div className="stat-row">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#A38A70"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            <span>
              Tasks Completed:{' '}
              <strong>{format.number(stats.tasks_completed)}</strong>
            </span>
          </div>
        </div>
      </div>

      <div className="bottom-section">
        <div className="card task-manager">
          <div className="task-header">
            <h2>Tasks</h2>
            <button
              type="button"
              className="add-task-btn"
              onClick={() => setAdding(true)}
            >
              + Add Task
            </button>
          </div>

          {failure && <ErrorState message={failure} />}

          <div className="task-groups">
            <TaskSection
              heading="Todo Tasks"
              items={todo}
              busyId={busyId}
              onComplete={complete}
            />
            <TaskSection
              heading="Calendar Tasks"
              items={scheduled}
              busyId={busyId}
              onComplete={complete}
            />
          </div>
        </div>

        <FocusPanel username={username} />
      </div>

      {/* The line the hidden chain replaces on its tenth click — secret/
          easter-egg.js owns this element once today's clue is unlocked. The
          original also fetched a random quote from a third-party API on every
          load, with the key sitting in the page source; that is deliberately
          not carried over. */}
      <div className="quote-container">
        <p id="dailyQuote">
          &quot;The secret of getting ahead is getting started.&quot; - Mark
          Twain
        </p>
      </div>

      {levelled !== null && (
        <LevelUp level={levelled} onDone={() => setLevelled(null)} />
      )}

      <TaskModal
        open={adding}
        busy={saving}
        onClose={() => setAdding(false)}
        onAdd={(task) => void addTask(task)}
      />
    </div>
  );
}
