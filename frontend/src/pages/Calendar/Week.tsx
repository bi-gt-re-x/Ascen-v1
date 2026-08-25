/**
 * The Week view — seven columns, 6 AM to 5 AM, with the overview beside them.
 *
 * Ported from calendar-week.js and the `#weekView` half
 * of the calendar.html template. The markup and class names are the
 * originals, so styles/calendar/week.css dresses this unchanged.
 *
 * Everything on the page is scoped to the week on screen — the grid, the
 * overview figures, the per-day XP line, the streak dots, the priorities, the
 * focus time — because a column of figures answering questions about different
 * weeks is worse than no column at all. Stepping a week steps all of it.
 *
 * The one exception is Upcoming, which is deliberately about what comes *after*
 * the shown week: everything inside it is already drawn on the grid, and a list
 * repeating that would be the same thing twice.
 *
 * A past week's overview is frozen: its numbers come from the snapshot saved
 * while it was the current week, so editing a task months later cannot rewrite
 * what that week amounted to. The current week keeps its snapshot fresh, and
 * whatever it holds when the week ends is what stays.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarShell,
  ConflictDialog,
  CreateChooser,
  DayColumn,
  SubjectLibrary,
  TimeLabels,
  ViewSwitcher,
  WeekSidebar,
} from '@/components/Calendar';
import { BlockDialogs } from '@/components/Calendar/BlockDialogs';
import { ErrorState, Loading, RefreshButton } from '@/components';
import {
  useCalendarStore,
  useCalendarTasks,
  useDayFocus,
  useDocumentTitle,
  useNow,
  useNowScroll,
  useSettings,
  useSubjectIndex,
  useSubjects,
} from '@/hooks';
import { useBlockActions } from '@/hooks/useBlockActions';
import { planFamilies } from '@/utils/calendarFamilies';
import { useFocusSession } from '@/hooks/useFocusSession';
import {
  useGridDrag,
  type DraggedSlot,
  type DroppedBlock,
} from '@/hooks/useGridDrag';
import { focus as focusService } from '@/services';
import { weekStartDay } from '@/services/settings';
import { dates } from '@/utils';
import {
  blockLabel,
  blockWhen,
  dayEventBlocks,
  dayTaskBlocks,
  layOut,
  nowOffset,
  type Block,
} from '@/utils/calendarGrid';
import { iconUrlFor } from '@/utils/calendarIcons';
import {
  isoOf,
  loadWeekSnapshots,
  monthKey,
  saveWeekSnapshot,
} from '@/utils/calendarStore';
import { subjectXp } from '@/utils/subjectXp';
import type { FocusHistory } from '@/types';
import '@/styles/calendar/month.css';
import '@/styles/calendar/week.css';
import '@/styles/calendar/day.css';
// Last, so the colour system has the final word on every block. See the
// note at the top of it.
import '@/styles/calendar/palette.css';

/**
 * The first day of the week a date falls in.
 *
 * Which day that *is* is the account's to say (Settings, Calendar), so this
 * takes it rather than assuming Monday. Everything else on the page counts
 * seven days forward from whatever comes back, so the grid, the overview, the
 * per-day XP line and the title all move together when it changes.
 */
function weekOf(date: Date, startsOn: 0 | 1): Date {
  return dates.startOfWeek(date, startsOn);
}

/** "16:30" as "4:30 PM". Empty in, "All Day" out — an entry with no time has none. */
function clockLabel(hhmm: string): string {
  const [hours, minutes] = hhmm.split(':').map(Number);
  if (hours === undefined || Number.isNaN(hours) || minutes === undefined) return 'All Day';
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

/** "July 13 – July 19, 2026". */
function weekTitle(opens: Date): string {
  const closes = dates.addDays(opens, 6);
  const long = (date: Date) => dates.formatDate(date, { month: 'long', day: 'numeric' });
  return `${long(opens)} – ${long(closes)}, ${closes.getFullYear()}`;
}

export default function Week() {
  useDocumentTitle('Calendar · Week');

  const account = useCalendarTasks();
  const {
    tasks,
    stats,
    username,
    loading,
    hasData,
    refreshing,
    error,
    refresh,
    completing,
    complete,
  } = account;
  const store = useCalendarStore(username);
  const dayFocus = useDayFocus(username);
  const session = useFocusSession(username);
  const subjects = useSubjectIndex(username);
  // The same catalogue as a list, for the library. Both hooks read one cache,
  // so this is not a second request — see hooks/useSubjects.
  const subjectList = useSubjects(username);
  const now = useNow();
  const navigate = useNavigate();
  const { prefs } = useSettings();

  /* The day the week starts on, from the account's preferences. It arrives a
     moment after the page does, so the week on screen is re-anchored below
     rather than only being right on the second visit. */
  const startsOn = weekStartDay(prefs);
  const [opens, setOpens] = useState(() => weekOf(new Date(), startsOn));
  useEffect(() => {
    setOpens((current) => weekOf(current, startsOn));
  }, [startsOn]);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('wkSidebarCollapsed') === '1';
    } catch {
      return false;
    }
  });
  /**
   * The overview's mini-month cursor.
   *
   * Its own, like the Day view's: paging to March must not drag the week
   * along, or the panel is a second set of week arrows rather than a way to
   * look around. Stepping the week re-syncs it below, so the month on show is
   * always the month the banded week is in unless the reader has gone
   * wandering.
   */
  const [mini, setMini] = useState(() => {
    const start = weekOf(new Date(), startsOn);
    return { year: start.getFullYear(), month: start.getMonth() };
  });
  /** True while the overview column is showing the subject library instead. */
  const [library, setLibrary] = useState(false);
  const [history, setHistory] = useState<FocusHistory>({});
  /** The day whose focus chip is currently an input, if any. */
  const [focusEditing, setFocusEditing] = useState<string | null>(null);

  const actions = useBlockActions(username, store, tasks, account);
  const scroller = useRef<HTMLDivElement>(null);

  const opensIso = dates.isoDate(opens);
  const closesIso = dates.isoDate(dates.addDays(opens, 6));
  const todayIso = dates.isoDate(now);
  const thisWeekIso = dates.isoDate(weekOf(now, startsOn));
  const thisWeek = opensIso === thisWeekIso;

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = dates.addDays(opens, index);
        return {
          date,
          iso: dates.isoDate(date),
          name: dates.formatDate(date, { weekday: 'short' }),
          label: dates.formatDate(date, { month: 'short', day: 'numeric' }),
        };
      }),
    [opens],
  );

  useEffect(() => {
    if (!username) return;
    let live = true;
    void focusService.history(opensIso, closesIso).then((result) => {
      if (live && result.success) setHistory(result.days);
    });
    return () => {
      live = false;
    };
  }, [opensIso, closesIso, username]);

  /** Opening the week lands on the current hour — see hooks/useNowScroll. */
  const centerOnNow = useNowScroll(scroller, !loading && thisWeek);

  // One colour plan for the whole week, so nothing on it shares a family until
  // the week has more than twelve distinct things on it — and so the Day view
  // and the Week view agree, both planning the same seven days. See
  // utils/calendarFamilies.
  const plan = useMemo(
    () => planFamilies(days.map((day) => day.iso), tasks, store.data),
    [days, store.data, tasks],
  );

  const columns = useMemo(
    () =>
      days.map((day) => ({
        ...day,
        ...layOut([
          ...dayTaskBlocks(day.iso, tasks, subjects, plan),
          ...dayEventBlocks(day.iso, store.data, plan),
        ]),
      })),
    [days, plan, store.data, subjects, tasks],
  );

  /** The first clash anywhere this week; the reader has to resolve it. */
  const clash = columns.find((column) => column.conflict);

  /**
   * Put the clashing pair on screen.
   *
   * A week is seven columns of a 23-hour day and the clash can be on any of
   * them, at an hour the reader has not scrolled to — so the dialog's "Show me
   * on the grid" scrolls the earlier of the two to the middle of the window.
   * The pair are ringed as well, by `flagged` on the column below, which is
   * what makes the scroll land on something the eye can find.
   */
  const revealClash = useCallback(() => {
    const box = scroller.current;
    const pair = clash?.conflict;
    if (!box || !pair) return;
    const top = Math.min(pair[0].top, pair[1].top);
    const bottom = Math.max(pair[0].top + pair[0].height, pair[1].top + pair[1].height);
    box.scrollTo({
      top: Math.max(0, (top + bottom) / 2 - box.clientHeight / 2),
      behavior: 'smooth',
    });
  }, [clash]);

  const overview = useMemo(() => {
    const inWeek = (stamp: string | undefined) => {
      const day = (stamp || '').slice(0, 10);
      return Boolean(day) && day >= opensIso && day <= closesIso;
    };

    const weekTasks = tasks.filter((task) => inWeek(task.created_at));
    const done = weekTasks.filter((task) => task.status === 'done');
    const live = {
      total: weekTasks.length,
      done: done.length,
      rate: weekTasks.length ? Math.round((done.length / weekTasks.length) * 100) : 0,
      xp: done.reduce((sum, task) => sum + (Number(task.xp_value) || 0), 0),
    };

    const past = opensIso < thisWeekIso;
    const frozen = loadWeekSnapshots(username)[opensIso];
    if (past && frozen) return frozen;
    // A past week seen for the first time freezes now; the current week keeps
    // its snapshot current. A future week has nothing to record.
    if (opensIso <= thisWeekIso) saveWeekSnapshot(username, opensIso, live);
    return live;
  }, [thisWeekIso, opensIso, closesIso, tasks, username]);

  /**
   * Focused against planned.
   *
   * Today comes from the live session, which the server has not been told
   * about yet — but the server can be ahead when today's focus was tracked in
   * another browser, so the larger of the two wins.
   */
  const focus = useMemo(() => {
    let focusedSeconds = 0;
    let plannedHours = 0;

    Object.entries(history).forEach(([iso, day]) => {
      if (iso === todayIso) return;
      focusedSeconds += Number(day.seconds) || 0;
      plannedHours += Number(day.goal_hours) || 0;
    });

    const today = history[todayIso];
    if (todayIso >= opensIso && todayIso <= closesIso) {
      focusedSeconds += Math.max(session.focused, Number(today?.seconds) || 0);
      plannedHours += session.goalHours;
    } else if (today) {
      focusedSeconds += Number(today.seconds) || 0;
      plannedHours += Number(today.goal_hours) || 0;
    }

    return { focused: focusedSeconds, planned: plannedHours * 3600 };
  }, [history, opensIso, session.focused, session.goalHours, closesIso, todayIso]);

  /**
   * The seven days, as the sidebar's sparkline and streak dots need them.
   *
   * XP is counted from completion stamps rather than from due dates: the
   * question the line answers is "when did the work happen", and a task
   * finished on Friday is Friday's whatever day it was scheduled for. A day
   * with a completion is a day the streak dot is filled — the same test, so the
   * line and the dots can never tell different stories about the same day.
   */
  const weekDays = useMemo(
    () =>
      days.map((day) => {
        let xp = 0;
        let done = 0;
        tasks.forEach((task) => {
          if (task.status !== 'done') return;
          if ((task.completed_at || '').slice(0, 10) !== day.iso) return;
          done += 1;
          xp += Number(task.xp_value) || 0;
        });

        // Focus, day by day, on the same rule the week's total above uses:
        // today's figure is whichever of the live session and the server's
        // record is larger, because the session has not been written back yet
        // but the server can be ahead if today was tracked in another browser.
        const entry = history[day.iso];
        const isToday = day.iso === todayIso;
        const focused = isToday
          ? Math.max(session.focused, Number(entry?.seconds) || 0)
          : Number(entry?.seconds) || 0;
        const planned = isToday
          ? session.goalHours * 3600
          : (Number(entry?.goal_hours) || 0) * 3600;

        return {
          initial: day.name.charAt(0),
          name: day.name,
          xp,
          focused,
          planned,
          active: done > 0,
          future: day.iso > todayIso,
          today: isToday,
        };
      }),
    [days, history, session.focused, session.goalHours, tasks, todayIso],
  );

  /**
   * Where the week's XP went, by subject.
   *
   * Counted on `completed_at` like the sparkline and the streak dots above it,
   * rather than on `created_at` like the overview: this panel is about work
   * that happened, and the day it happened on is the day it was finished.
   */
  const breakdown = useMemo(
    () => subjectXp(tasks, subjects, opensIso, closesIso),
    [opensIso, subjects, closesIso, tasks],
  );

  /**
   * The week's tasks split by priority — how much of the week is hard.
   *
   * Counted on `created_at` like the overview above, so the panel and the
   * figures beside it are answering about the same set of tasks. XP is what
   * was *earned*, not what was on offer: an unfinished high-priority task is a
   * count without a score, which is the honest reading of a week in progress.
   */
  const priorities = useMemo(() => {
    const order = [
      { key: 'low', label: 'Low' },
      { key: 'medium', label: 'Medium' },
      { key: 'high', label: 'High' },
    ];
    const counts = new Map(order.map((row) => [row.key, { count: 0, done: 0, xp: 0 }]));

    tasks.forEach((task) => {
      const day = (task.created_at || '').slice(0, 10);
      if (!day || day < opensIso || day > closesIso) return;
      // Anything unrecognised counts as low, which is how the grid colours it.
      const key = String(task.priority || '').toLowerCase();
      const bucket = counts.get(key) ?? counts.get('low');
      if (!bucket) return;
      bucket.count += 1;
      if (task.status === 'done') {
        bucket.done += 1;
        bucket.xp += Number(task.xp_value) || 0;
      }
    });

    return order.map((row) => ({ ...row, ...counts.get(row.key)! }));
  }, [opensIso, closesIso, tasks]);

  /**
   * What is coming after the week on screen — tasks by due date, events by the
   * day they sit on, soonest first.
   *
   * Deliberately *after* the shown week rather than after today: everything
   * inside the week is already drawn on the grid beside this, and repeating it
   * in a list headed "Upcoming" would be the same thing twice.
   */
  const upcoming = useMemo(() => {
    const day = (stamp: string | undefined) => (stamp || '').slice(0, 10);
    const pretty = (iso: string) =>
      dates.formatDate(dates.fromIsoDate(iso), {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

    const entries = tasks
      .filter((task) => task.status === 'todo' && day(task.due_date) > closesIso)
      .map((task) => ({
        id: `task-${task.id}`,
        iso: day(task.due_date),
        sortAt: `${day(task.due_date)} ${(task.due_date || '').slice(11, 16) || '99:99'}`,
        icon: '📌',
        title: task.title || 'Untitled',
        when: clockLabel((task.due_date || '').slice(11, 16)),
      }));

    Object.entries(store.data).forEach(([key, entry]) => {
      const iso = isoOf(key);
      if (iso <= closesIso) return;
      entry.timestamps.forEach((section, index) => {
        if (section.isDashboardTask) return; // already counted as a task
        entries.push({
          id: `event-${key}-${index}`,
          iso,
          sortAt: `${iso} ${section.startTime || '99:99'}`,
          icon: '🗓️',
          title: section.task || 'Untitled',
          when: clockLabel(section.startTime),
        });
      });
    });

    return entries
      .sort((a, b) => (a.sortAt < b.sortAt ? -1 : a.sortAt > b.sortAt ? 1 : 0))
      .slice(0, 4)
      .map(({ id, icon, title, when, iso }) => ({
        id,
        icon,
        title,
        when,
        date: pretty(iso),
      }));
  }, [store.data, closesIso, tasks]);

  /** A block's menu, resolved back to the thing the dialogs work on. */
  const openFor = useCallback(
    (block: Block, iso: string, intent: 'edit' | 'delete') => {
      if (block.kind === 'event') {
        const section = store.data[monthKey(iso)]?.timestamps.find(
          (entry) =>
            entry.task === block.name &&
            entry.startTime === block.startHM &&
            entry.endTime === block.endHM,
        );
        if (!section) return;
        actions.open({
          type: intent === 'edit' ? 'edit-event' : 'delete-event',
          iso,
          section,
        });
        return;
      }
      const task = tasks.find((entry) => String(entry.id) === block.id);
      if (!task) return;
      actions.open({ type: intent === 'edit' ? 'edit-task' : 'delete-task', iso, task });
    },
    [actions, store.data, tasks],
  );

  /**
   * Dragging on the grid — the only way something is added here now that the
   * bar under it is gone, and a better one: the gesture says when the thing
   * runs as part of saying that it exists.
   *
   * A drag on empty grid parks the slot and asks whether it is an event or a
   * task; the answer opens that dialog with the times already filled in. A drag
   * on a block commits straight away, with no dialog at all — the reader has
   * said what they want by putting it there.
   */
  const [slot, setSlot] = useState<DraggedSlot | null>(null);

  const onDrop = useCallback(
    (drop: DroppedBlock) => {
      if (drop.kind === 'event') {
        const section = store.data[monthKey(drop.fromIso)]?.timestamps.find(
          (entry) =>
            !entry.isDashboardTask &&
            entry.task === drop.id &&
            entry.startTime === drop.fromStartTime &&
            entry.endTime === drop.fromEndTime,
        );
        if (!section) return;
        actions.retime({
          fromIso: drop.fromIso,
          toIso: drop.toIso,
          section,
          startTime: drop.startTime,
          endTime: drop.endTime,
        });
        return;
      }
      const task = tasks.find((entry) => String(entry.id) === drop.id);
      if (!task) return;
      actions.retime({
        fromIso: drop.fromIso,
        toIso: drop.toIso,
        task,
        startAt: drop.startAt,
        endAt: drop.endAt,
      });
    },
    [actions, store.data, tasks],
  );

  const daycols = useGridDrag({
    scroller,
    enabled: !actions.dialog && !slot,
    onCreate: setSlot,
    onDrop,
  });

  const openDragged = useCallback(
    (type: 'add-task' | 'add-event') => {
      if (!slot) return;
      actions.open({
        type,
        iso: slot.iso,
        defaults: { startTime: slot.startTime, endTime: slot.endTime },
      });
      setSlot(null);
    },
    [actions, slot],
  );

  /** Moving the week re-syncs the mini-month to the month that week starts in. */
  const goToWeek = useCallback(
    (date: Date) => {
      const start = weekOf(date, startsOn);
      setOpens(start);
      setMini({ year: start.getFullYear(), month: start.getMonth() });
    },
    [startsOn],
  );

  /* Not a functional update: it has to set the mini-month too, and queueing
     that from inside an updater makes the updater a side effect — which React
     is free to run twice. `opens` in the closure is the state this render was
     drawn from, which is the week the arrow the reader pressed belongs to. */
  const stepWeek = useCallback(
    (weeks: number) => goToWeek(dates.addDays(opens, weeks * 7)),
    [goToWeek, opens],
  );

  const stepMini = useCallback(
    (delta: number) =>
      setMini((current) => {
        const at = new Date(current.year, current.month + delta, 1);
        return { year: at.getFullYear(), month: at.getMonth() };
      }),
    [],
  );

  const toggleSidebar = useCallback(() => {
    setCollapsed((was) => {
      try {
        localStorage.setItem('wkSidebarCollapsed', was ? '' : '1');
      } catch {
        /* private mode: the choice lasts as long as the tab does */
      }
      return !was;
    });
  }, []);

  if (loading) return <Loading label="Loading your week" />;
  // Only when there is no week to show. A refresh that fails keeps the one
  // already on screen and says so in the banner below — throwing the grid away
  // because the second read timed out is the reader's work for the worse.
  if (!hasData) return <ErrorState message={error ?? 'No data came back.'} onRetry={refresh} />;

  return (
    <CalendarShell paneId="weekView" ownSwitcher>
      {/* One row: what week it is and how to move through it on the left, how
          to look at it and what to do with it on the right. The switcher is
          here rather than in the shell above so the view has a single bar of
          controls instead of two stacked ones. */}
      <div className={`wk-header${collapsed ? ' sidebar-collapsed' : ''}`}>
        <div className="wk-headmain">
          <h2 className="wk-title">{weekTitle(opens)}</h2>
          <div className="wk-nav">
            <button
              type="button"
              className="wk-arrow"
              aria-label="Previous week"
              onClick={() => stepWeek(-1)}
            >
              ‹
            </button>
            {/* Not in the design, which has only a back arrow — a week view
                that can be left but not returned from is a trap. */}
            <button
              type="button"
              className="wk-arrow"
              aria-label="Next week"
              onClick={() => stepWeek(1)}
            >
              ›
            </button>
          </div>
          {/* Not disabled on the current week, unlike the Month view's: there
              it would step to a month you are already on and do nothing, but
              here it also puts the now line back in the middle of the grid,
              which is worth a press however far the reader has scrolled. */}
          <button
            type="button"
            className="wk-today"
            onClick={() => {
              goToWeek(new Date());
              centerOnNow();
            }}
          >
            Today
          </button>
        </div>

        <div className="wk-headtools">
          <ViewSwitcher />
          {/* The only thing on this page that re-reads the account. Everything
              else — renaming, resizing, dragging, completing — changes what is
              on screen and leaves the server call to the reader. */}
          <RefreshButton
            className="wk-icon-btn"
            busy={refreshing}
            onRefresh={refresh}
          />
          <button
            className="wk-icon-btn"
            id="wkSidebarToggle"
            type="button"
            aria-expanded={!collapsed}
            aria-controls="wkSidebar"
            title={`${collapsed ? 'Show' : 'Hide'} the overview column`}
            onClick={toggleSidebar}
          >
            {/* A panel, not the design's funnel: this shows and hides the
                column on the right, and there is nothing here to filter. */}
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M15 4v16" />
            </svg>
          </button>
          <button
            type="button"
            className="wk-icon-btn"
            title="Settings"
            onClick={() => navigate('/settings')}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <circle cx="12" cy="12" r="3.2" />
              <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
            </svg>
          </button>
        </div>
      </div>

      {/* A refresh that failed, over the week it failed to change rather than
          in place of it. */}
      {error && <ErrorState message={error} onRetry={refresh} />}

      <div className={`wk-main${collapsed ? ' sidebar-collapsed' : ''}`}>
        <div className="wk-gridwrap">
          <div className="wk-grid-head">
            <div className="wk-corner" />
            <div className="wk-dayhead-row">
              {days.map((day) => (
                <div className="wk-dayhead" key={day.iso}>
                  <div className="wk-dayname">{day.name}</div>
                  <div className={`wk-daydate${day.iso === todayIso ? ' today' : ''}`}>
                    {day.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* One chip per day — the same note the Day and Month views show,
              with the icon guessed from what it says, becoming the input it
              always was when it is clicked. A day with nothing on it offers
              the word instead.
              A day can carry up to five focuses (see hooks/useDayFocus) and a
              column this narrow can show one, so the chip shows the primary
              and counts the rest. Editing here edits the primary and leaves
              the others alone; the Day view is where the whole list lives. */}
          <div className="wk-allday-row">
            <div className="wk-allday-label">Focus</div>
            <div className="wk-allday-cells">
              {days.map((day) => {
                const all = dayFocus.list(day.iso);
                const text = all[0] ?? '';
                const more = Math.max(0, all.length - 1);
                const editing = focusEditing === day.iso;
                return (
                  <div className="wk-allday-cell" key={day.iso}>
                    {editing ? (
                      <input
                        className="wk-day-focus"
                        type="text"
                        autoFocus
                        data-date={day.iso}
                        value={text}
                        placeholder="Focus…"
                        aria-label={`Focus for ${day.name} ${day.label}`}
                        onChange={(event) =>
                          dayFocus.setPrimary(day.iso, event.target.value)
                        }
                        onBlur={() => setFocusEditing(null)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === 'Escape') {
                            event.currentTarget.blur();
                          }
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className={`wk-focus-chip${text ? '' : ' is-empty'}`}
                        aria-label={
                          more
                            ? `Focus for ${day.name} ${day.label}: ${all.join(', ')}`
                            : `Focus for ${day.name} ${day.label}`
                        }
                        title={more ? all.join('\n') : undefined}
                        onClick={() => setFocusEditing(day.iso)}
                      >
                        {text ? (
                          <i
                            className="cal-ico"
                            style={{ ['--ico' as string]: `url(${iconUrlFor(text)})` }}
                            aria-hidden="true"
                          />
                        ) : (
                          <span className="wk-focus-chip-plus" aria-hidden="true">+</span>
                        )}
                        <span className="wk-focus-chip-text">{text || 'Focus'}</span>
                        {more > 0 && (
                          <span className="wk-focus-chip-more" aria-hidden="true">
                            +{more}
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="wk-scroll" ref={scroller}>
            <TimeLabels now={thisWeek ? nowOffset(now) : null} at={now} />
            <div className="wk-daycols" ref={daycols}>
              {/* The now line belongs to the week, not to Monday. Drawn on the
                  day column it marks, it stopped dead at that column's edge —
                  a 250px dash in the middle of a grid, easy to mistake for part
                  of a block. One line across all seven columns is what a reader
                  can find without looking for it, and it sits above the blocks
                  rather than behind them so a busy morning cannot swallow it.
                  The Day view still draws its own, inside its single column. */}
              {thisWeek && nowOffset(now) !== null && (
                <div className="wk-nowline" style={{ top: nowOffset(now) as number }} />
              )}
              {columns.map((column) => (
                <DayColumn
                  key={column.iso}
                  iso={column.iso}
                  blocks={column.blocks}
                  today={column.iso === todayIso}
                  onEdit={(block) => openFor(block, column.iso, 'edit')}
                  onDelete={(block) => openFor(block, column.iso, 'delete')}
                  onComplete={complete}
                  completingId={completing}
                  flagged={column.conflict}
                />
              ))}
            </div>
          </div>

        </div>
        {/* One column, two things it can be. The library replaces the overview
            rather than opening over it: they are the same panel of the same
            width, and a dialog would put the grid behind a scrim at exactly
            the moment the reader wants to watch it change colour. */}
        {library && !collapsed ? (
          <SubjectLibrary
            subjects={subjectList}
            username={username}
            onClose={() => setLibrary(false)}
          />
        ) : (
        <WeekSidebar
          mini={{
            year: mini.year,
            month: mini.month,
            from: opensIso,
            to: closesIso,
            weekStart: startsOn,
            onStep: stepMini,
            onPick: (iso) => goToWeek(dates.fromIsoDate(iso)),
          }}
          onOpenLibrary={() => setLibrary(true)}
          stats={overview}
          streak={Number(stats.current_streak) || 0}
          focus={focus}
          days={weekDays}
          breakdown={breakdown}
          priorities={priorities}
          upcoming={upcoming}
          onViewMonth={() => navigate('/calendar/month')}
          onViewAnalytics={() => navigate('/analytics')}
          collapsed={collapsed}
        />
        )}
      </div>

      <BlockDialogs actions={actions} username={username} wide />

      {slot && (
        <CreateChooser
          when={`${dates.formatDate(dates.fromIsoDate(slot.iso), {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
          })} · ${clockLabel(slot.startTime)} – ${clockLabel(slot.endTime)}`}
          onChoose={(kind) => openDragged(kind === 'event' ? 'add-event' : 'add-task')}
          onCancel={() => setSlot(null)}
        />
      )}

      {clash?.conflict && (
        <ConflictDialog
          where={dates.formatDate(dates.fromIsoDate(clash.iso), {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
          })}
          sides={[
            {
              name: blockLabel(clash.conflict[0]),
              when: blockWhen(clash.conflict[0]),
              kind: clash.conflict[0].kind,
            },
            {
              name: blockLabel(clash.conflict[1]),
              when: blockWhen(clash.conflict[1]),
              kind: clash.conflict[1].kind,
            },
          ]}
          onReveal={revealClash}
          onDelete={(which) => {
            const pair = clash.conflict;
            if (pair) openFor(pair[which], clash.iso, 'delete');
          }}
        />
      )}
    </CalendarShell>
  );
}
