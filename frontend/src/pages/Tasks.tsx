/**
 * Tasks — everything you have on, in one place.
 *
 * ## What this page is for, and what it is not
 *
 * The dashboard already lists tasks, and the line between the two is the same
 * line the rest of the app is drawn on: the dashboard answers *what should I do
 * right now*, so its list is short, ordered for today, and hard to get lost in.
 * This answers *what have I got on* — which needs the things the dashboard
 * refuses to grow: a search, filters that stack, a sort the reader chooses, and
 * selection so a dozen tasks can be dealt with at once.
 *
 * The calendar answers *when*, and this page does not try to: there is no grid
 * here and no drag. A due date is a field on a row.
 *
 * ## Where the truth lives
 *
 * The server. Every figure on the page is counted from the task list the
 * account already serves (`/api/get_user_data`), and every write goes through
 * services/tasks.ts — the same calls the dashboard makes, so a task completed
 * here and a task completed there move exactly the same numbers.
 *
 * Writes are applied to what is on screen rather than re-fetched, because the
 * page knows what it just changed; the server is asked again only when the
 * reader presses Refresh, or when a write fails and the page can no longer
 * vouch for what it is showing. That is `useApi`'s contract and the dashboard's
 * rule, kept here so the two pages cannot drift.
 *
 * ## Skeleton
 *
 * The shape is here and every control works against the real endpoints. What
 * is deliberately not here yet: editing a task's date, priority or XP after it
 * is made (the row renames only), the goal/milestone link, timers, and any
 * grouping other than by due date. Each is a row of the same list, and none of
 * them changes the arithmetic in components/Tasks/board.ts.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  BulkBar,
  Composer,
  EMPTY_QUERY,
  TaskRow,
  TaskSummary,
  Toolbar,
  groupTasks,
  taskCounts,
  type TaskQuery,
} from '@/components/Tasks';
import { Ambient, ErrorState, Loading, RefreshButton, STATS_CHANGED } from '@/components';
import { useDocumentTitle, useSubjects, useUserData } from '@/hooks';
import { tasks as taskService } from '@/services';
import type { NewTask } from '@/services/tasks';
import type { Task } from '@/types';
import { isoStamp } from '@/utils/calendarGrid';
import '@/styles/tasks.css';

export default function Tasks() {
  useDocumentTitle('Tasks');

  const { data, error, loading, refreshing, reload, mutate, username } = useUserData();
  const subjects = useSubjects(username);

  const [query, setQuery] = useState<TaskQuery>(EMPTY_QUERY);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const list = useMemo(() => data?.tasks ?? [], [data]);
  const counts = useMemo(() => taskCounts(list), [list]);
  const groups = useMemo(() => groupTasks(list, query), [list, query]);
  const showing = useMemo(
    () => groups.reduce((sum, group) => sum + group.tasks.length, 0),
    [groups],
  );

  /** Only the subjects this account actually files things under. */
  const used = useMemo(() => subjects.filter((subject) => subject.used > 0), [subjects]);
  const subjectName = useCallback(
    (id: string | undefined) => subjects.find((entry) => entry.id === id)?.label ?? null,
    [subjects],
  );

  // ---- Writes -------------------------------------------------------------
  /**
   * Every write is the same four steps: mark the row busy, call, put the
   * change on screen, and on failure say so and re-read. `run` is those steps
   * once rather than five times.
   */
  const run = useCallback(
    async (id: string | null, action: () => Promise<boolean>) => {
      setBusyId(id);
      setFailure(null);
      try {
        const ok = await action();
        if (!ok) reload();
        return ok;
      } catch (cause) {
        setFailure(cause instanceof Error ? cause.message : 'That did not work.');
        reload();
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [reload],
  );

  const complete = useCallback(
    (task: Task) => {
      if (!username) return Promise.resolve(false);
      return run(task.id, async () => {
        const result = await taskService.completeTask(username, task.id);
        if (!result.success) {
          setFailure(result.message);
          return false;
        }
        const at = new Date();
        mutate((current) => ({
          ...current,
          stats: {
            ...current.stats,
            xp: (Number(current.stats.xp) || 0) + (Number(result.xp_earned) || 0),
            level: result.new_level,
            tasks_completed: result.new_tasks_completed,
            current_streak: result.current_streak,
            best_streak: result.best_streak,
          },
          tasks: current.tasks.map((entry) =>
            String(entry.id) === String(task.id)
              ? { ...entry, status: 'done' as const, completed_at: isoStamp(at) }
              : entry,
          ),
        }));
        // The rail carries the level and the XP total and never re-reads on its
        // own. This is what moves them.
        window.dispatchEvent(new Event(STATS_CHANGED));
        return true;
      });
    },
    [username, mutate, run],
  );

  /**
   * Re-open a finished task.
   *
   * Deliberately not the inverse of completing: `completeTask` awards XP,
   * extends the streak and counts toward goals, and none of that is given back
   * here. The backend owns that decision — this only asks for the status.
   */
  const reopen = useCallback(
    (task: Task) => {
      if (!username) return;
      void run(task.id, async () => {
        const result = await taskService.updateTask(username, task.id, { completed: false });
        if (!result.success) {
          setFailure(result.message);
          return false;
        }
        mutate((current) => ({
          ...current,
          tasks: current.tasks.map((entry) =>
            String(entry.id) === String(task.id)
              ? { ...entry, status: 'todo' as const, completed_at: undefined }
              : entry,
          ),
        }));
        return true;
      });
    },
    [username, mutate, run],
  );

  const rename = useCallback(
    (task: Task, title: string) => {
      if (!username) return;
      void run(task.id, async () => {
        const result = await taskService.updateTask(username, task.id, { name: title });
        if (!result.success) {
          setFailure(result.message);
          return false;
        }
        mutate((current) => ({
          ...current,
          tasks: current.tasks.map((entry) =>
            String(entry.id) === String(task.id) ? { ...entry, title } : entry,
          ),
        }));
        return true;
      });
    },
    [username, mutate, run],
  );

  const drop = useCallback(
    (task: Task) => {
      if (!username) return;
      void run(task.id, async () => {
        const result = await taskService.deleteTask(username, task.id);
        if (!result.success) {
          setFailure(result.message);
          return false;
        }
        mutate((current) => ({
          ...current,
          tasks: current.tasks.filter((entry) => String(entry.id) !== String(task.id)),
        }));
        setPicked((current) => {
          const next = new Set(current);
          next.delete(task.id);
          return next;
        });
        return true;
      });
    },
    [username, mutate, run],
  );

  const add = useCallback(
    (draft: NewTask) => {
      if (!username) return;
      setSaving(true);
      setFailure(null);
      void (async () => {
        try {
          const result = await taskService.createTask(username, draft);
          if (!result.success) {
            setFailure(result.message);
            return;
          }
          // The row the backend wrote is the row just described to it, so it is
          // put on the list rather than fetched back. See the same note in
          // pages/Dashboard.tsx.
          mutate((current) => ({
            ...current,
            tasks: [
              ...current.tasks,
              {
                id: result.task_id,
                user_id: username,
                title: draft.name,
                description: '',
                priority: draft.priority ?? 'medium',
                status: 'todo' as const,
                xp_value: Number(draft.xp_reward) || 0,
                due_date: draft.due_date ?? undefined,
                show_on_calendar: draft.show_on_calendar ?? false,
                created_at: isoStamp(new Date()),
                ...(draft.subject ? { subject: draft.subject } : {}),
              },
            ],
          }));
        } catch (cause) {
          setFailure(cause instanceof Error ? cause.message : 'Could not add that task.');
          reload();
        } finally {
          setSaving(false);
        }
      })();
    },
    [username, mutate, reload],
  );

  // ---- Selection ----------------------------------------------------------
  const select = useCallback((task: Task, on: boolean) => {
    setPicked((current) => {
      const next = new Set(current);
      if (on) next.add(task.id);
      else next.delete(task.id);
      return next;
    });
  }, []);

  /**
   * A bulk action is the single action, repeated in order.
   *
   * One request per task rather than a batch endpoint, because there is not one
   * — and because completing ten tasks is ten completions with ten XP awards
   * and a streak behind them, which is exactly what ten calls produce. Serial
   * rather than parallel: they all move the same account's totals, and the
   * backend recalculates the level on each.
   */
  const bulk = useCallback(
    async (action: (task: Task) => Promise<unknown>) => {
      const chosen = list.filter((task) => picked.has(task.id));
      setSaving(true);
      for (const task of chosen) {
        await action(task);
      }
      setPicked(new Set());
      setSaving(false);
      // One re-read at the end rather than one per task: the page has applied
      // every change already, and this is the cheap way to be sure.
      reload();
    },
    [list, picked, reload],
  );

  // ---- The shell ----------------------------------------------------------
  if (loading) return <Loading label="Reading your tasks" />;
  if (!data) {
    return <ErrorState message={error ?? 'No tasks yet.'} onRetry={username ? reload : undefined} />;
  }

  return (
    <div className="tk-page">
      <Ambient />
      <div className="tk-shell page-shell">
        <header className="tk-head">
          <div>
            <h1>
              <span className="tk-head-ico" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11l3 3 8-8" />
                  <path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />
                </svg>
              </span>
              Tasks
            </h1>
            <p className="tk-quiet">Everything you have on, and what it is worth.</p>
          </div>
          <div className="tk-head-tools">
            <RefreshButton busy={refreshing} onRefresh={reload} />
          </div>
        </header>

        {(failure || error) && (
          <p className="tk-failure" role="alert">
            {failure ?? error}
          </p>
        )}

        <TaskSummary counts={counts} />

        <Composer subjects={subjects} busy={saving} onAdd={add} />

        <Toolbar
          query={query}
          onQuery={setQuery}
          subjects={used}
          showing={showing}
          total={list.length}
        />

        <BulkBar
          count={picked.size}
          busy={saving}
          onComplete={() => void bulk((task) => (task.status === 'done' ? Promise.resolve() : complete(task)))}
          onDelete={() => void bulk((task) => Promise.resolve(drop(task)))}
          onClear={() => setPicked(new Set())}
        />

        {groups.length === 0 ? (
          <p className="tk-empty">
            {list.length === 0
              ? 'Nothing here yet. The box above is the fastest way to change that.'
              : 'No task matches what you are looking for. Clear the filters to see the rest.'}
          </p>
        ) : (
          groups.map((group) => (
            <section className={`tk-group is-${group.key}`} key={group.key}>
              <header className="tk-group-head">
                <h2>
                  {group.label}
                  <span className="tk-group-count">{group.tasks.length}</span>
                </h2>
                <p className="tk-quiet">{group.hint}</p>
              </header>
              <ul className="tk-list">
                {group.tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    subject={subjectName(task.subject)}
                    selected={picked.has(task.id)}
                    busy={busyId === task.id || saving}
                    onSelect={select}
                    onComplete={(entry) => void complete(entry)}
                    onReopen={reopen}
                    onRename={rename}
                    onDelete={drop}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
