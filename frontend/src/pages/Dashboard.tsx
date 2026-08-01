/**
 * The dashboard — the account's live stats and its task list.
 *
 * The first page ported off frontend/js/dashboard.js, and deliberately the
 * first: it exercises the whole scaffold end to end — the typed client, the
 * `success` envelope, the fetch hook's stale-response guard, auth context — so
 * if this page is right, the plumbing under every other page is right too.
 *
 * It emits the **same markup and class names** as frontend/html/dashboard.html
 * (`.container`, `.card user-stats`, `.task-item`, …) so src/styles/dashboard.css
 * dresses it without a line of new CSS. That is the whole reason the
 * stylesheets moved into src/ intact rather than being rewritten: the port is
 * a change of mechanism, not of appearance.
 *
 * What is here is not yet all 1,586 lines of the original. The task editor,
 * the timer, the calendar conflict-checker and the focus panel are still to
 * come. What is here is the part that proves the data path.
 *
 * The rule the original followed and this one keeps: **the backend decides.**
 * Completing a task does not compute the new XP, level or streak locally — it
 * posts, and re-reads. There is no second copy of those rules.
 */
import { useCallback, useState } from 'react';
import { ErrorState, Loading } from '@/components';
import { useDocumentTitle, useUserData } from '@/hooks';
import { tasks as taskService } from '@/services';
import { dates, format } from '@/utils';
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

function TaskRow({
  task,
  busy,
  onComplete,
}: {
  task: Task;
  busy: boolean;
  onComplete: (task: Task) => void;
}) {
  return (
    <li className="task-item">
      <div className="task-left">
        <input
          type="checkbox"
          className="task-checkbox"
          checked={false}
          disabled={busy}
          onChange={() => onComplete(task)}
          aria-label={`Complete ${task.title}`}
        />
        <span className="task-name">{task.title}</span>
      </div>
      {task.due_date ? (
        <span className="task-due-date">
          Due: {dates.formatDate(task.due_date, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </span>
      ) : (
        <span className="task-nodue">{task.xp_value} XP</span>
      )}
    </li>
  );
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

  const complete = useCallback(
    async (task: Task) => {
      if (!username) return;
      setBusyId(task.id);
      setFailure(null);
      try {
        const result = await taskService.completeTask(username, task.id);
        if (!result.success) {
          setFailure(result.message);
          return;
        }
        // Re-read rather than patching state from the response: the same call
        // also moved goals and the XP ledger, and re-reading is the only way
        // this page and the goals page agree without duplicating those rules.
        reload();
      } catch (cause) {
        setFailure(
          cause instanceof Error ? cause.message : 'Could not complete that task.',
        );
      } finally {
        setBusyId(null);
      }
    },
    [username, reload],
  );

  if (loading) return <Loading label="Loading your dashboard" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <ErrorState message="No data came back." onRetry={reload} />;

  const { stats } = data;
  const level = format.levelForTotalXp(stats.xp);
  const open = data.tasks.filter((task) => task.status === 'todo');
  const todo = open.filter((task) => !isCalendarTask(task));
  const scheduled = open.filter(isCalendarTask);

  return (
    <div className="container">
      <div className="top-section">
        <div className="card user-stats">
          <h2>User Profile</h2>
          <div className="username-row">
            <span className="label">Name:</span>
            <span className="username">{username}</span>
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
            <span>
              Current Streak: <strong>{stats.current_streak}</strong> Days
            </span>
          </div>
          <div className="stat-row">
            <span>
              Best Streak: <strong>{stats.best_streak}</strong> Days
            </span>
          </div>
          <div className="stat-row">
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
      </div>
    </div>
  );
}
