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
 * ## The right-hand column
 *
 * The list answers "what have I got on"; the rail beside it answers "what about
 * right now" — the sitting in progress, the next three things, what is on a
 * run, and a one-line way in. None of it takes the page's filters, because
 * searching for "physics" should not empty the panel telling you what is due at
 * four o'clock.
 *
 * ## What is reconstructed rather than recorded
 *
 * Three things on this page are derived from the task list because nothing
 * records them: the trend line under each stat card (from `created_at` and
 * `completed_at`), a task's time estimate (the median `completion_seconds` of
 * its previously finished namesakes), and the streaks (consecutive completion
 * days per title). Each is honest about the past that still exists in the list
 * and no further — see the notes in components/Tasks/board.ts.
 *
 * ## What is deliberately not here yet
 *
 * Editing a task's date, priority or XP after it is made — the row renames
 * only — and the goal/milestone link. Stars are kept in this browser rather
 * than on the account, because the task record has no field for one.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BulkBar,
  Composer,
  EMPTY_QUERY,
  RatePrompt,
  Sidebar,
  StatCards,
  TaskRow,
  Toolbar,
  plannedSeconds,
  groupTasks,
  beyondHorizon,
  statSeries,
  streaks,
  taskCounts,
  upcoming,
  type GroupKey,
  type TaskQuery,
} from '@/components/Tasks';
import { Ambient, ErrorState, Loading, RefreshButton, STATS_CHANGED } from '@/components';
import { measureOf } from '@/components/Goals';
import { useDocumentTitle, usePageEntrance, useSettings, useSubjects, useUserData } from '@/hooks';
import { goals as goalService, tasks as taskService } from '@/services';
import type { NewTask } from '@/services/tasks';
import type { Goal, Task } from '@/types';
import { isoStamp } from '@/utils/calendarGrid';
import '@/styles/tasks.css';

/**
 * How many rows a heading draws before it asks.
 *
 * The filters decide what belongs on the page; this decides how much of it is
 * built at once, and they are not the same question. Even with the horizon
 * bounding both directions, "Everything dated" over "Everything" is every task
 * the account has ever had — four thousand of them here, five years deep — and
 * a TaskRow is a couple of dozen nodes with a checkbox, badges and three icons
 * in it. Mounting the lot cost seconds, and it cost them again on every click
 * of Filter, Group or Sort, because changing any of those rebuilds the list.
 * The controls were doing exactly what they said; the page was too busy
 * building rows nobody had scrolled to for the result to arrive.
 *
 * So a heading draws a screenful or two and offers the rest. The count beside
 * the heading is still the whole group — what is being withheld is the drawing
 * of the rows, never the fact of them.
 */
const PAGE = 60;

/**
 * Starred task ids, kept in this browser.
 *
 * **Not on the account, because the task record has no field for one.** Adding
 * a column, a migration and an endpoint to remember which rows a reader likes
 * the look of is a bigger change than the feature is worth, and a star that
 * lives in localStorage is honest about what it is: a mark on this machine, for
 * pinning a handful of rows to the top of a long list while you work through
 * it. If it ever needs to follow the account, this hook is the one thing that
 * changes.
 */
function useStars(username: string | null): [Set<string>, (id: string) => void] {
  const key = `tasks:starred:${username ?? 'anon'}`;
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || '[]') as string[];
      setIds(new Set(Array.isArray(raw) ? raw : []));
    } catch {
      setIds(new Set());
    }
  }, [key]);

  const toggle = useCallback(
    (id: string) => {
      setIds((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        try {
          localStorage.setItem(key, JSON.stringify([...next]));
        } catch {
          // A browser refusing storage is not a reason to refuse the click.
        }
        return next;
      });
    },
    [key],
  );

  return [ids, toggle];
}

export default function Tasks() {
  useDocumentTitle('Tasks');

  const { data, error, loading, refreshing, reload, mutate, username } = useUserData();
  const subjects = useSubjects(username);
  const { prefs } = useSettings();

  /* The account's outcome goals, for the link control on each row. Read once
     rather than through useApi: nothing on this page writes a goal, and a
     failed read means the row offers no goals rather than the page failing. */
  const [goals, setGoals] = useState<Goal[]>([]);
  useEffect(() => {
    if (!username) return;
    let live = true;
    void goalService.getGoals(username).then((result) => {
      if (live && result.success) setGoals(result.goals ?? []);
    });
    return () => {
      live = false;
    };
  }, [username]);

  /** Only outcome goals: a counter goal advances itself and has no work to name. */
  const linkable = useMemo(
    () => goals.filter((goal) => ['number', 'milestones'].includes(measureOf(goal))),
    [goals],
  );

  /**
   * The view this page opens on, from the account's preferences.
   *
   * Four of the controls above the list have a preference behind them
   * (Settings, Tasks) and this is where the two meet. It is what the page
   * starts on and what "Reset the view" goes back to — not what the page stays
   * on: every control still changes the view for this visit, and none of them
   * writes a preference. Somebody narrowing to one subject for a minute has
   * not changed their mind about how the page should open.
   *
   * `EMPTY_QUERY` still supplies the rest — the search, the subject and
   * priority filters, the direction — because those are about one list at one
   * moment and there is nothing to remember.
   */
  const opening = useMemo<TaskQuery>(
    () => ({
      ...EMPTY_QUERY,
      status: prefs.task_status,
      sort: prefs.task_sort,
      horizon: prefs.task_horizon,
    }),
    [prefs.task_horizon, prefs.task_sort, prefs.task_status],
  );

  const [query, setQuery] = useState<TaskQuery>(opening);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [group, setGroup] = useState<GroupKey>(prefs.task_group);

  /* The preferences arrive a moment after the page does, so what it opened on
     may have been the built-in defaults rather than the account's. This
     corrects that — and stops the moment the reader touches a control, because
     from then on what is on screen is their answer and not a stale guess. */
  const viewChosen = useRef(false);
  useEffect(() => {
    if (viewChosen.current) return;
    setQuery(opening);
    setGroup(prefs.task_group);
  }, [opening, prefs.task_group]);

  const changeQuery = useCallback((next: TaskQuery) => {
    viewChosen.current = true;
    setQuery(next);
  }, []);

  const [shut, setShut] = useState<Set<string>>(new Set());
  /** Per heading, how many rows it has been asked to draw. See `PAGE`. */
  const [drawn, setDrawn] = useState<Record<string, number>>({});
  const [composing, setComposing] = useState(false);
  const [starred, setStarred] = useStars(username);
  const [pageMenu, setPageMenu] = useState(false);
  const pageMenuRef = useRef<HTMLDivElement>(null);

  // The header's overflow closes the same way every other menu on the page
  // does. Kept here rather than in a shared hook because it is the only one
  // outside components/Tasks/Toolbar.
  useEffect(() => {
    if (!pageMenu) return;
    const away = (event: MouseEvent) => {
      if (pageMenuRef.current && !pageMenuRef.current.contains(event.target as Node)) {
        setPageMenu(false);
      }
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [pageMenu]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const list = useMemo(() => data?.tasks ?? [], [data]);
  const counts = useMemo(() => taskCounts(list), [list]);
  const series = useMemo(() => statSeries(list), [list]);
  const nextUp = useMemo(() => upcoming(list, 3), [list]);
  const beyond = useMemo(() => beyondHorizon(list, query), [list, query]);
  const runs = useMemo(() => streaks(list, 3), [list]);
  const subjectName = useCallback(
    (id: string | undefined) => subjects.find((entry) => entry.id === id)?.label ?? null,
    [subjects],
  );

  // Grouping is the reader's to choose, and it composes with the sort — the
  // one pairing that cannot is date headings under a non-date order, which
  // flattens and says so. See `groupTasks`.
  const groups = useMemo(
    () => groupTasks(list, query, new Date(), group, subjectName),
    [group, list, query, subjectName],
  );
  const showing = useMemo(
    () => groups.reduce((sum, group) => sum + group.tasks.length, 0),
    [groups],
  );

  /**
   * The subjects worth a chip, the ones on the current list first.
   *
   * `subject.used` is a lifetime count, and ordering the chips by it put an
   * account's biggest-ever subjects in the row while the two subjects every
   * open task actually carries sat behind "+ More". A filter row is for cutting
   * down what is on screen, so it is ordered by what is on screen — with the
   * lifetime count as the tiebreak, so the tail past the open list is still in
   * a sensible order rather than an arbitrary one.
   */
  const used = useMemo(() => {
    const here = new Map<string, number>();
    list.forEach((task) => {
      if (task.status === 'done' || !task.subject) return;
      here.set(task.subject, (here.get(task.subject) ?? 0) + 1);
    });
    return subjects
      .filter((subject) => subject.used > 0 || here.has(subject.id))
      .sort(
        (a, b) => (here.get(b.id) ?? 0) - (here.get(a.id) ?? 0) || b.used - a.used,
      );
  }, [subjects, list]);

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
        // Ask, now that the work is banked and nothing depends on the answer —
        // unless the reader has turned the questions off in Settings. How many
        // are asked is that same preference: see components/Tasks/RatePrompt.
        if (prefs.rating_depth !== 'none') {
          setRating({ id: String(task.id), name: task.title });
        }
        return true;
      });
    },
    [username, mutate, run, prefs.rating_depth],
  );

  // ---- Rating a finished task ---------------------------------------------
  /**
   * The task the prompt is asking about, or null when it is closed.
   *
   * Set *after* the completion has landed, so the dialog is never open over a
   * task that failed to complete. Nothing downstream waits on it: the row is
   * already done, the XP is already banked, and every route out of the dialog —
   * Save, Skip, Escape, the backdrop — simply clears this.
   */
  const [rating, setRating] = useState<{ id: string; name: string } | null>(null);

  const saveRating = useCallback(
    (values: { difficulty?: number; execution?: number; reason?: string }) => {
      const target = rating;
      setRating(null);
      if (!username || !target) return;
      void taskService.rateTask(username, target.id, values).then((result) => {
        if (!result.success) return;
        // Onto the local copy, so a re-render of the row shows what was said
        // without a round trip for the whole list.
        mutate((current) => ({
          ...current,
          tasks: current.tasks.map((entry) =>
            String(entry.id) === target.id ? { ...entry, ...values } : entry,
          ),
        }));
      });
    },
    [mutate, rating, username],
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

  /* Linking a task to a goal after the fact. `null` unlinks. The milestone is
     cleared alongside it: a checkpoint only means anything against its own
     goal, and the backend would drop a mismatched one anyway. */
  const link = useCallback(
    (task: Task, goalId: string | null) => {
      if (!username) return;
      void run(task.id, async () => {
        const result = await taskService.updateTask(username, task.id, {
          goal_id: goalId,
          milestone_id: null,
        });
        if (!result.success) {
          setFailure(result.message);
          return false;
        }
        mutate((current) => ({
          ...current,
          tasks: current.tasks.map((entry) =>
            String(entry.id) === String(task.id)
              ? { ...entry, goal_id: goalId ?? undefined, milestone_id: undefined }
              : entry,
          ),
        }));
        return true;
      });
    },
    [mutate, run, username],
  );

  const drop = useCallback(
    (task: Task, ask = true) => {
      if (!username) return;
      // The confirmation is a preference; off means the click is the decision.
      // `ask` is how the bulk bar opts out of it: twelve selected rows used to
      // mean twelve separate confirm dialogs, one per task, which is not asking
      // a question — it is charging for the answer. It asks once, up there,
      // for all of them.
      if (ask && prefs.confirm_delete && !window.confirm(`Delete “${task.title}”?`)) return;
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
    [username, mutate, run, prefs.confirm_delete],
  );

  const add = useCallback(
    (draft: NewTask) => {
      if (!username) return;
      setSaving(true);
      setFailure(null);
      void (async () => {
        try {
          // `show_on_calendar` is stated rather than left out. The backend's
          // default for it is `True` (backend/api/tasks.py), so a draft that
          // stayed quiet — which is every draft this page makes, from the
          // composer and from Quick Add alike — landed on the calendar as a
          // block running from the moment it was typed to whenever it was due.
          // Type "History essay", due Friday, and a four-day bar appeared
          // across a grid the reader keeps for things they actually scheduled.
          // pages/Dashboard.tsx found the same hole and states the same field;
          // tasks reach the calendar by being made on it.
          //
          // The optimistic row below has always said `false`, so until the
          // next reload the page also disagreed with what it had just stored.
          const result = await taskService.createTask(username, {
            show_on_calendar: false,
            ...draft,
          });
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
   * The selection, cut down to what the filters actually left on the page.
   *
   * `picked` outlives the list it was made from — tick two rows, then search,
   * change the subject chip, or pull the horizon back to the week, and those
   * rows leave the page while their ids stay in the set. Read raw, that gave a
   * bar reading "2 selected" over a list showing neither of them, and a Delete
   * button that reached past the filter and removed two tasks the reader could
   * not see. An irreversible action has to be about what is on screen.
   *
   * Intersected rather than pruned, so the filter is a lens and not a
   * guillotine: clearing the search brings the rows back still ticked, which is
   * what someone who narrowed the list to find a third one expects. Collapsing
   * a section does not hide a row for this purpose — the heading is still
   * there, still counting them, and folding it away is not deselection.
   */
  const chosen = useMemo(() => {
    if (picked.size === 0) return [];
    const onPage = new Set<string>();
    groups.forEach((entry) => entry.tasks.forEach((task) => onPage.add(String(task.id))));
    return list.filter((task) => picked.has(task.id) && onPage.has(String(task.id)));
  }, [groups, list, picked]);

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
      setSaving(true);
      for (const task of chosen) {
        await action(task);
      }
      // Only what was acted on lets go of its tick. A selection sitting behind
      // the current filter was not part of this action and clearing it here
      // would be the same reach past the filter, in the other direction.
      setPicked((current) => {
        const next = new Set(current);
        chosen.forEach((task) => next.delete(task.id));
        return next;
      });
      setSaving(false);
      // One re-read at the end rather than one per task: the page has applied
      // every change already, and this is the cheap way to be sure.
      reload();
    },
    [chosen, reload],
  );

  const toggleGroup = useCallback((key: string) => {
    setShut((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // A heading expanded to a thousand rows must not carry that expansion onto
  // whatever the next query puts under the same key — "done" and "all" are
  // reused across groupings, and inheriting a large draw count is how the
  // freeze `PAGE` exists to prevent would come back through the side door.
  useEffect(() => {
    setDrawn({});
  }, [query, group]);

  const drawMore = useCallback((key: string, from: number) => {
    setDrawn((current) => ({ ...current, [key]: from + PAGE }));
  }, []);

  /**
   * Changing what the headings are opens all of them again.
   *
   * `shut` holds group keys, and the keys are not unique across groupings —
   * "done" is a due-date bucket and a status group, "all" is every flat list.
   * Collapsing Completed under date headings and then switching to status
   * headings brought the collapse along with it, so a heading the reader had
   * never touched arrived shut. New headings are new sections; they open.
   */
  const chooseGroup = useCallback((key: GroupKey) => {
    viewChosen.current = true;
    setGroup(key);
    setShut(new Set());
  }, []);

  /** Back to the view the account opens on, not to the app's built-in one. */
  const resetView = useCallback(() => {
    viewChosen.current = false;
    setQuery(opening);
    setGroup(prefs.task_group);
    setShut(new Set());
  }, [opening, prefs.task_group]);

  /** Quick Add's three fields, through the same create the full form uses.
   *  The XP is the account's default rather than a number picked here: this
   *  form does not ask for one, and 25 was a third answer to a question the
   *  composer and both task dialogs already agreed on. */
  const quickAdd = useCallback(
    (name: string, due: string | null, priority: 'high' | 'medium' | 'low') => {
      add({ name, priority, due_date: due, xp_reward: prefs.default_xp });
    },
    [add, prefs.default_xp],
  );

  // ---- The shell ----------------------------------------------------------
  /* The arrival cascade. Bound to the read rather than to mount, so it
     starts when there is something to animate — see hooks/usePageEntrance. */
  const entering = usePageEntrance(!loading);

  if (loading) return <Loading label="Reading your tasks" />;
  if (!data) {
    return <ErrorState message={error ?? 'No tasks yet.'} onRetry={username ? reload : undefined} />;
  }

  return (
    <div className="tk-page">
      <Ambient />
      <div className={`tk-shell page-shell${entering ? ' pg-enter' : ''}`}>
        <header className="tk-head">
          <div className="tk-head-title">
            <h1>
              <span className="tk-head-ico" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11l3 3 8-8" />
                  <path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />
                </svg>
              </span>
              Tasks
            </h1>
            <p className="tk-quiet">What is on your plate.</p>
          </div>
          <div className="tk-head-tools">
            <button
              type="button"
              className="tk-new"
              aria-expanded={composing}
              onClick={() => setComposing(!composing)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New Task
              <i className={`tk-new-caret${composing ? ' is-open' : ''}`} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </i>
            </button>
            {/* The overflow: the things that act on the page rather than on a
                task, which is why they are not in the toolbar with the filters. */}
            <div className="tk-row-menu" ref={pageMenuRef}>
              <button
                type="button"
                className="tk-more is-page"
                aria-label="More for this page"
                aria-expanded={pageMenu}
                onClick={() => setPageMenu(!pageMenu)}
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="5" cy="12" r="1.7" />
                  <circle cx="12" cy="12" r="1.7" />
                  <circle cx="19" cy="12" r="1.7" />
                </svg>
              </button>
              {pageMenu && (
                <div className="tk-menu-panel is-row">
                  <button
                    type="button"
                    className="tk-menu-item"
                    onClick={() => { setPageMenu(false); changeQuery({ ...query, status: query.status === 'all' ? 'open' : 'all' }); }}
                  >
                    {query.status === 'all' ? 'Hide completed' : 'Show completed'}
                  </button>
                  <button
                    type="button"
                    className="tk-menu-item"
                    onClick={() => { setPageMenu(false); setShut(shut.size > 0 ? new Set() : new Set(groups.map((group) => group.key))); }}
                  >
                    {shut.size > 0 ? 'Expand all' : 'Collapse all'}
                  </button>
                  <button
                    type="button"
                    className="tk-menu-item"
                    onClick={() => { setPageMenu(false); resetView(); }}
                  >
                    Reset the view
                  </button>
                  <button
                    type="button"
                    className="tk-menu-item"
                    onClick={() => { setPageMenu(false); reload(); }}
                  >
                    Refresh
                  </button>
                </div>
              )}
            </div>
            <RefreshButton busy={refreshing} onRefresh={reload} />
          </div>
        </header>

        {(failure || error) && (
          <p className="tk-failure" role="alert">
            {failure ?? error}
          </p>
        )}

        <div className="tk-body">
          <div className="tk-main">
            <StatCards counts={counts} series={series} />

            {composing && (
              <Composer
                subjects={subjects}
                busy={saving}
                onAdd={add}
                defaultXp={prefs.default_xp}
                defaultPriority={prefs.default_priority}
              />
            )}

            <Toolbar
              query={query}
              onQuery={changeQuery}
              subjects={used}
              showing={showing}
              total={list.length}
              group={group}
              onGroup={chooseGroup}
            />

            <BulkBar
              count={chosen.length}
              busy={saving}
              onComplete={() => void bulk((task) => (task.status === 'done' ? Promise.resolve() : complete(task)))}
              onDelete={() => {
                if (
                  prefs.confirm_delete
                  && !window.confirm(
                    chosen.length === 1
                      ? `Delete “${chosen[0]?.title}”?`
                      : `Delete ${chosen.length} tasks?`,
                  )
                ) {
                  return;
                }
                void bulk((task) => Promise.resolve(drop(task, false)));
              }}
              onClear={() => setPicked(new Set())}
            />

            {groups.length === 0 ? (
              <p className="tk-empty">
                {list.length === 0
                  ? 'Nothing here yet. Quick Add is the fastest way to change that.'
                  : 'No task matches. Clear the filters to see the rest.'}
              </p>
            ) : (
              groups.map((group) => {
                const closed = shut.has(group.key);
                const cap = drawn[group.key] ?? PAGE;
                const rest = group.tasks.length - cap;
                return (
                  <section className={`tk-group is-${group.key}`} key={group.key}>
                    <header className="tk-group-head">
                      <button
                        type="button"
                        className="tk-group-toggle"
                        aria-expanded={!closed}
                        onClick={() => toggleGroup(group.key)}
                      >
                        <h2>
                          {group.label}
                          <span className="tk-group-count">{group.tasks.length}</span>
                        </h2>
                        <i className={`tk-group-caret${closed ? ' is-shut' : ''}`} aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </i>
                      </button>
                      <p className="tk-quiet">{group.hint}</p>
                    </header>
                    {!closed && (
                      <ul className="tk-list">
                        {group.tasks.slice(0, cap).map((task) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            subject={subjectName(task.subject)}
                            goals={linkable}
                            onLink={link}
                            estimate={plannedSeconds(task)}
                            selected={picked.has(task.id)}
                            starred={starred.has(task.id)}
                            busy={busyId === task.id || saving}
                            onSelect={select}
                            onComplete={(entry) => void complete(entry)}
                            onReopen={reopen}
                            onRename={rename}
                            onDelete={drop}
                            onStar={(entry) => setStarred(entry.id)}
                          />
                        ))}
                      </ul>
                    )}
                    {!closed && rest > 0 && (
                      <button
                        type="button"
                        className="tk-more-rows"
                        onClick={() => drawMore(group.key, cap)}
                      >
                        Show {Math.min(rest, PAGE).toLocaleString()} more
                        <span> of {rest.toLocaleString()} left in {group.label}</span>
                      </button>
                    )}
                  </section>
                );
              })
            )}

            {/* The horizon, stated where the list stops rather than only in
                the menu that set it — a list that quietly ends seven days out
                is a list a reader assumes is all of it. */}
            {query.horizon === 'week' && beyond > 0 && (
              <p className="tk-horizon">
                {beyond.toLocaleString()} more outside this week.{' '}
                <button type="button" onClick={() => changeQuery({ ...query, horizon: 'all' })}>
                  Show everything
                </button>
              </p>
            )}
          </div>

          <Sidebar
            username={username}
            upcoming={nextUp}
            streaks={runs}
            busy={saving}
            defaultPriority={prefs.default_priority}
            subjectName={subjectName}
            onAdd={quickAdd}
            onOpenFull={() => setComposing(true)}
            onShowUpcoming={() => {
              changeQuery({ ...EMPTY_QUERY, sort: 'due' });
              chooseGroup('due');
            }}
            onShowStreaks={() =>
              changeQuery({ ...EMPTY_QUERY, status: 'done', sort: 'created', descending: true })
            }
          />
        </div>
      </div>

      {/* Over everything, after the completion has landed. See `rating`. */}
      {rating && (
        <RatePrompt
          taskName={rating.name}
          depth={prefs.rating_depth}
          onSubmit={saveRating}
          onClose={() => setRating(null)}
        />
      )}
    </div>
  );
}
