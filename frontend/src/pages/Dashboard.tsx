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
 * locally — it posts, and re-reads. That same call also moves goals and the XP
 * ledger, and re-reading is the only way this page and the goals page agree
 * without a second copy of those rules.
 *
 * The focus session is owned here rather than inside the Focus panel, because
 * two things now show it: the panel and the Focus Time stat card. One
 * `useFocusSession` shared between them is what keeps the goal on the card
 * moving when the + on the panel is pressed.
 */
import { useCallback, useMemo, useState } from 'react';
import { Ambient, ErrorState, Loading, STATS_CHANGED } from '@/components';
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
import {
  bucketTasks,
  daySummary,
  recentActivity,
  topPriorities,
  weekSummary,
} from '@/components/Dashboard/summary';
import { useDocumentTitle, useUserData } from '@/hooks';
import { useFocusSession } from '@/hooks/useFocusSession';
import { tasks as taskService } from '@/services';
import { dates } from '@/utils';
import type { TaskTab } from '@/components/Dashboard';
import type { NewTask } from '@/services/tasks';
import type { Task } from '@/types';
import '@/styles/dashboard.css';
import '@/styles/dashboard-home.css';

export default function Dashboard() {
  useDocumentTitle('Dashboard');

  const { data, error, loading, reload, username } = useUserData();
  const session = useFocusSession(username);

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
          return;
        }
        // The response carries the new level, so the backend still decides what
        // the level is. Comparing against the one it replaces only notices that
        // it went up, which is what the celebration is for.
        const was = data?.stats.level ?? 0;
        if (result.new_level > was) setLevelled(result.new_level);
        reload();
        // The rail shows the level and the XP total and is mounted outside the
        // router, so it never re-reads on its own. This is the one thing that
        // moves those numbers.
        window.dispatchEvent(new Event(STATS_CHANGED));
      } catch (cause) {
        setFailure(
          cause instanceof Error ? cause.message : 'Could not complete that task.',
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
        setFailure(cause instanceof Error ? cause.message : 'Could not add that task.');
      } finally {
        setSaving(false);
      }
    },
    [username, reload],
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
      <Ambient cursor={false} />

      {/* The greeting slides away with the stat row while a focus session
          runs — see html.focus-mode in styles/dashboard-home.css. */}
      <header className="dash-greeting">
        <div>
          <h1 className="dash-hello">
            {dates.greeting(now)}, {username}! <span aria-hidden="true">👋</span>
          </h1>
          <p className="dash-sub">Ready to crush your goals today?</p>
        </div>
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
      </header>

      <div className="dash-stats">
        <TodayCard day={day} />
        <XpCard stats={data.stats} xpToday={day.xp} />
        <FocusCard session={session} />
        <StreakCard stats={data.stats} />
      </div>

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
          onComplete={(task) => void complete(task)}
          onAdd={() => setAdding(true)}
        />
        <FocusPanel session={session} />
      </div>

      <div className="dash-insights">
        <WeeklyOverview week={week} />
        <TopPriorities tasks={priorities} />
        <RecentActivity entries={activity} />
      </div>

      <DailyQuote />

      {levelled !== null && <LevelUp level={levelled} onDone={() => setLevelled(null)} />}

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
