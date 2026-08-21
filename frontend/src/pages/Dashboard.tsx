/**
 * The dashboard — the account's day, at a glance.
 *
 * Four rows: a greeting, four stat cards, the Tasks list beside the Focus
 * panel, and three summary cards along the bottom. Every one of them is
 * counted from a single `/api/get_user_data` call, by the pure functions in
 * components/Dashboard/summary.ts — nothing on this page fetches for itself, so
 * no two panels can disagree about what a task is.
 *
 * The rule the page has always followed and still does: **the backend
 * decides.** Completing a task does not compute the new XP, level or streak
 * locally — it posts, and renders what the post came back with. The response
 * carries every figure that moved (backend/api/tasks.py), so this page never
 * has to guess at one and never has to ask for the whole account again to find
 * out. Adding a task is the same: the row written is the row described.
 *
 * What that buys is a page that does not move under the reader. A re-read used
 * to follow every write, and while it was in flight the cards were rebuilt and
 * their counters restarted from zero — a completed task read as a page flash
 * rather than as a number going up. The Refresh button in the header is the one
 * thing that asks the server again.
 *
 * The focus session is owned here rather than inside the Focus panel, because
 * two things now show it: the panel and the Focus Time stat card. One
 * `useFocusSession` shared between them is what keeps the goal on the card
 * moving when the + on the panel is pressed.
 */
import { useCallback, useMemo, useState } from 'react';
import { Ambient, ErrorState, Loading, RefreshButton, STATS_CHANGED } from '@/components';
import {
  DailyQuote,
  FocusCard,
  FocusPanel,
  LevelUp,
  RecentActivity,
  StreakCard,
  TaskModal,
  TaskPanel,
  TodayCard,
  TopPriorities,
  WeeklyOverview,
  XpCard,
} from '@/components/Dashboard';
import { RatePrompt } from '@/components/Tasks';
import {
  bucketTasks,
  daySummary,
  recentActivity,
  topPriorities,
  weekSummary,
} from '@/components/Dashboard/summary';
import { useDocumentTitle, useSettings, useSubjectIndex, useUserData } from '@/hooks';
import { useFocusSession } from '@/hooks/useFocusSession';
import { tasks as taskService } from '@/services';
import { dates } from '@/utils';
import { isoStamp } from '@/utils/calendarGrid';
import type { TaskTab } from '@/components/Dashboard';
import type { NewTask } from '@/services/tasks';
import type { Task } from '@/types';
import '@/styles/dashboard.css';
import '@/styles/dashboard-home.css';

export default function Dashboard() {
  useDocumentTitle('Dashboard');

  const { data, error, loading, refreshing, reload, mutate, username } = useUserData();
  const session = useFocusSession(username);
  const subjects = useSubjectIndex(username);
  const { prefs } = useSettings();

  const [tab, setTab] = useState<TaskTab>('today');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  /** The level to celebrate, set when a completion crosses a level boundary. */
  const [levelled, setLevelled] = useState<number | null>(null);

  // Today is read once per render rather than per panel, so a page left open
  // across midnight moves all of its cards over on the same tick.
  const now = new Date();
  const todayIso = dates.isoDate(now);
  const monday = dates.startOfWeek(now);
  const mondayIso = dates.isoDate(monday);
  const sundayIso = dates.isoDate(dates.addDays(monday, 6));

  const tasks = useMemo(() => data?.tasks ?? [], [data]);
  const buckets = useMemo(() => bucketTasks(tasks, todayIso), [tasks, todayIso]);
  const day = useMemo(() => daySummary(tasks, todayIso), [tasks, todayIso]);
  const week = useMemo(
    () => weekSummary(tasks, mondayIso, sundayIso),
    [tasks, mondayIso, sundayIso],
  );
  const priorities = useMemo(() => topPriorities(buckets.today), [buckets.today]);
  const activity = useMemo(() => recentActivity(tasks), [tasks]);

  const complete = useCallback(
    async (task: Task) => {
      if (!username) return;
      setBusyId(task.id);
      setFailure(null);
      try {
        const result = await taskService.completeTask(username, task.id);
        if (!result.success) {
          setFailure(result.message);
          // The page can no longer vouch for what it is showing, so this is
          // one of the two times it asks the server again on its own.
          reload();
          return;
        }
        // The response carries the new level, so the backend still decides what
        // the level is. Comparing against the one it replaces only notices that
        // it went up, which is what the celebration is for.
        const was = data?.stats.level ?? 0;
        if (result.new_level > was) setLevelled(result.new_level);

        // Everything that moved is in the response, so it is written onto the
        // page rather than fetched back. The stamps match the ones the backend
        // wrote — local time, `datetime.now().isoformat()`'s shape — because
        // every "is this today?" test in the app compares them as text.
        const at = new Date();
        mutate((current) => ({
          ...current,
          stats: {
            ...current.stats,
            // `new_xp` is the XP inside the new level; `stats.xp` is the
            // lifetime total, which is what the cards read off it.
            xp: (Number(current.stats.xp) || 0) + (Number(result.xp_earned) || 0),
            level: result.new_level,
            tasks_completed: result.new_tasks_completed,
            current_streak: result.current_streak,
            best_streak: result.best_streak,
          },
          tasks: current.tasks.map((entry) => {
            if (String(entry.id) !== String(task.id)) return entry;
            const created = entry.created_at ? new Date(entry.created_at) : null;
            const due = entry.due_date ? new Date(entry.due_date) : null;
            return {
              ...entry,
              status: 'done' as const,
              completed_at: isoStamp(at),
              ...(created && !Number.isNaN(created.getTime())
                ? {
                    completion_seconds: Math.round(
                      Math.max(0, (at.getTime() - created.getTime()) / 1000),
                    ),
                  }
                : {}),
              ...(due && !Number.isNaN(due.getTime()) ? { met_deadline: at <= due } : {}),
            };
          }),
        }));

        // The rail shows the level and the XP total and is mounted outside the
        // router, so it never re-reads on its own. This is the one thing that
        // moves those numbers.
        window.dispatchEvent(new Event(STATS_CHANGED));

        // Ask how it went, now that the work is banked. Nothing waits on the
        // answer — see `rating` below and components/Tasks/RatePrompt.
        setRating({ id: String(task.id), name: task.title });
      } catch (cause) {
        setFailure(
          cause instanceof Error ? cause.message : 'Could not complete that task.',
        );
        reload();
      } finally {
        setBusyId(null);
      }
    },
    [username, mutate, reload, data],
  );

  // ---- Rating a finished task ---------------------------------------------
  /**
   * The task the prompt is asking about, or null when it is closed.
   *
   * The same prompt the tasks page raises, from the same component, because a
   * task completed here and one completed there have to ask the same question —
   * two dialogs would become two slightly different questions inside a month.
   */
  const [rating, setRating] = useState<{ id: string; name: string } | null>(null);

  const saveRating = useCallback(
    (values: { difficulty?: number; execution?: number }) => {
      const target = rating;
      setRating(null);
      if (!username || !target) return;
      void taskService.rateTask(username, target.id, values).then((result) => {
        if (!result.success) return;
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

  const addTask = useCallback(
    async (task: NewTask & { timer_duration?: number }) => {
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
        // The row the backend wrote is the row that was just described to it
        // (backend/api/tasks.py `_create`), so it is put on the list rather
        // than fetched back. `created_at` is the one field the server fills in
        // when the caller leaves it out, and it fills it in with now.
        mutate((current) => ({
          ...current,
          tasks: [
            ...current.tasks,
            {
              id: result.task_id,
              user_id: username,
              title: task.name,
              description: '',
              priority: task.priority ?? 'medium',
              status: 'todo' as const,
              xp_value: Number(task.xp_reward) || 0,
              due_date: task.due_date ?? undefined,
              show_on_calendar: task.show_on_calendar ?? false,
              created_at: task.created_at ?? isoStamp(new Date()),
              ...(task.subject ? { subject: task.subject } : {}),
              ...(task.timer_duration ? { timer_duration: task.timer_duration } : {}),
            },
          ],
        }));
      } catch (cause) {
        setFailure(cause instanceof Error ? cause.message : 'Could not add that task.');
        reload();
      } finally {
        setSaving(false);
      }
    },
    [username, mutate, reload],
  );

  // Every one of these is guarded on there being nothing to show, not on there
  // being something happening. `reload()` after a completion sets `loading`
  // again while keeping the data it already has, and the page used to answer
  // that by throwing itself away and coming back as a spinner — which is what
  // made a completed task read as a page flash rather than as a number going
  // up. Holding the last good data means the cards stay mounted across the
  // re-read, and their figures travel to the new values instead of being
  // rebuilt from zero (hooks/useCountUp.ts). A reload that fails keeps the page
  // and says so in the banner below rather than replacing it.
  if (loading && !data) return <Loading label="Loading your dashboard" />;
  if (!data) return <ErrorState message={error ?? 'No data came back.'} onRetry={reload} />;

  return (
    <div className="dash">
      {/* The same background the landing page has, minus the glow that follows
          the pointer — see components/Ambient.tsx. */}
      <Ambient />

      {/* The greeting slides away with the stat row while a focus session
          runs — see html.focus-mode in styles/dashboard-home.css. */}
      <header className="dash-greeting">
        <div>
          <h1 className="dash-hello">
            {dates.greeting(now)}, {username}! <span aria-hidden="true">👋</span>
          </h1>
          <p className="dash-sub">Here is your day.</p>
        </div>
        <div className="dash-datebar">
          <p className="dash-date">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
            {dates.formatDate(now, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
          {/* The only thing on this page that asks the server again. Adding a
              task and finishing one both render what their own call answered. */}
          <RefreshButton busy={refreshing} onRefresh={reload} />
        </div>
      </header>

      {/* Both rows are preferences. A reader who does not want the figures
          gets the task list at the top of the page rather than a gap where
          they were — see Settings, Dashboard. */}
      {prefs.show_stats && (
        <div className="dash-stats">
          <TodayCard day={day} />
          <XpCard stats={data.stats} xpToday={day.xp} />
          <FocusCard session={session} />
          <StreakCard stats={data.stats} />
        </div>
      )}

      {/* Whichever went wrong last: the write the reader just asked for, or the
          re-read behind it. Both are shown here, over the page they failed to
          change, rather than in place of it. */}
      {(failure ?? error) && <ErrorState message={failure ?? error ?? ''} />}

      <div className="dash-main">
        <TaskPanel
          buckets={buckets}
          tab={tab}
          onTabChange={setTab}
          busyId={busyId}
          subjects={subjects}
          onComplete={(task) => void complete(task)}
          onAdd={() => setAdding(true)}
        />
        <FocusPanel session={session} />
      </div>

      {prefs.show_insights && (
        <div className="dash-insights">
          <WeeklyOverview week={week} />
          <TopPriorities tasks={priorities} />
          <RecentActivity entries={activity} />
        </div>
      )}

      <DailyQuote />

      {levelled !== null && <LevelUp level={levelled} onDone={() => setLevelled(null)} />}

      {/* Held behind the level-up, not raced against it. Both are triggered by
          the same completion, and a dialog that lands on top of the
          celebration would cover the one moment the app is allowed to be
          pleased with somebody. `levelled` clears itself when the animation
          finishes, and this appears then. */}
      {rating && levelled === null && (
        <RatePrompt
          taskName={rating.name}
          onSubmit={saveRating}
          onClose={() => setRating(null)}
        />
      )}

      <TaskModal
        open={adding}
        busy={saving}
        username={username}
        onClose={() => setAdding(false)}
        onAdd={(task) => void addTask(task)}
      />
    </div>
  );
}
