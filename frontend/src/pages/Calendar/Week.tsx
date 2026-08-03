/**
 * The Week view — seven columns, 6 AM to 5 AM, with the overview beside them.
 *
 * Ported from frontend/js/calendar/calendar-week.js and the `#weekView` half
 * of the calendar.html template. The markup and class names are the
 * originals, so styles/calendar/week.css dresses this unchanged.
 *
 * Everything on the page is scoped to the week on screen — the grid, the four
 * overview numbers, the priorities, the focus time — because a column of
 * figures answering questions about different weeks is worse than no column at
 * all. Stepping a week steps all of it.
 *
 * A past week's overview is frozen: its numbers come from the snapshot saved
 * while it was the current week, so editing a task months later cannot rewrite
 * what that week amounted to. The current week keeps its snapshot fresh, and
 * whatever it holds when the week ends is what stays.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarShell,
  ConflictDialog,
  DayColumn,
  TimeLabels,
  WeekSidebar,
  minutesToTime,
} from '@/components/Calendar';
import { BlockDialogs } from '@/components/Calendar/BlockDialogs';
import { ErrorState, Loading } from '@/components';
import {
  useCalendarStore,
  useCalendarTasks,
  useDayFocus,
  useDocumentTitle,
  useNow,
} from '@/hooks';
import { useBlockActions } from '@/hooks/useBlockActions';
import { fmtHM, useFocusSession } from '@/hooks/useFocusSession';
import { focus as focusService } from '@/services';
import { dates } from '@/utils';
import {
  blockLabel,
  dayEventBlocks,
  dayTaskBlocks,
  layOut,
  nowOffset,
  type Block,
} from '@/utils/calendarGrid';
import {
  loadWeekSnapshots,
  loadWeeklyFocus,
  monthKey,
  saveWeekSnapshot,
  saveWeeklyFocus,
} from '@/utils/calendarStore';
import type { FocusHistory } from '@/types';
import '@/styles/calendar/month.css';
import '@/styles/calendar/week.css';
import '@/styles/calendar/day.css';

/** Monday of the week a date falls in. */
function mondayOf(date: Date): Date {
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

/** "July 13 – July 19, 2026". */
function weekTitle(monday: Date): string {
  const sunday = dates.addDays(monday, 6);
  const long = (date: Date) => dates.formatDate(date, { month: 'long', day: 'numeric' });
  return `${long(monday)} – ${long(sunday)}, ${sunday.getFullYear()}`;
}

export default function Week() {
  useDocumentTitle('Calendar · Week');

  const { tasks, stats, username, loading, error, reload, completing, complete } =
    useCalendarTasks();
  const store = useCalendarStore(username);
  const dayFocus = useDayFocus(username);
  const session = useFocusSession(username);
  const now = useNow();

  const [monday, setMonday] = useState(() => mondayOf(new Date()));
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('wkSidebarCollapsed') === '1';
    } catch {
      return false;
    }
  });
  const [focusText, setFocusText] = useState('');
  const [history, setHistory] = useState<FocusHistory>({});

  const actions = useBlockActions(username, store, tasks, reload);
  const scroller = useRef<HTMLDivElement>(null);
  const jumpedToNow = useRef(false);

  const mondayIso = dates.isoDate(monday);
  const sundayIso = dates.isoDate(dates.addDays(monday, 6));
  const todayIso = dates.isoDate(now);
  const currentMondayIso = dates.isoDate(mondayOf(now));
  const thisWeek = mondayIso === currentMondayIso;

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = dates.addDays(monday, index);
        return {
          date,
          iso: dates.isoDate(date),
          name: dates.formatDate(date, { weekday: 'short' }),
          label: dates.formatDate(date, { month: 'short', day: 'numeric' }),
        };
      }),
    [monday],
  );

  useEffect(() => {
    setFocusText(loadWeeklyFocus(username, mondayIso));
  }, [mondayIso, username]);

  useEffect(() => {
    if (!username) return;
    let live = true;
    void focusService.history(username, mondayIso, sundayIso).then((result) => {
      if (live && result.success) setHistory(result.days);
    });
    return () => {
      live = false;
    };
  }, [mondayIso, sundayIso, username]);

  // Land on the current hour rather than at 6 AM — once, when the grid is up.
  useEffect(() => {
    if (jumpedToNow.current || loading || !thisWeek) return;
    const top = nowOffset(new Date());
    if (top === null || !scroller.current) return;
    scroller.current.scrollTop = Math.max(0, top - scroller.current.clientHeight / 2);
    jumpedToNow.current = true;
  }, [loading, thisWeek]);

  const columns = useMemo(
    () =>
      days.map((day) => ({
        ...day,
        ...layOut([
          ...dayTaskBlocks(day.iso, tasks),
          ...dayEventBlocks(day.iso, store.data),
        ]),
      })),
    [days, store.data, tasks],
  );

  /** The first clash anywhere this week; the reader has to resolve it. */
  const clash = columns.find((column) => column.conflict);

  const overview = useMemo(() => {
    const inWeek = (stamp: string | undefined) => {
      const day = (stamp || '').slice(0, 10);
      return Boolean(day) && day >= mondayIso && day <= sundayIso;
    };

    const weekTasks = tasks.filter((task) => inWeek(task.created_at));
    const done = weekTasks.filter((task) => task.status === 'done');
    const live = {
      total: weekTasks.length,
      done: done.length,
      rate: weekTasks.length ? Math.round((done.length / weekTasks.length) * 100) : 0,
      xp: done.reduce((sum, task) => sum + (Number(task.xp_value) || 0), 0),
    };

    const past = mondayIso < currentMondayIso;
    const frozen = loadWeekSnapshots(username)[mondayIso];
    if (past && frozen) return frozen;
    // A past week seen for the first time freezes now; the current week keeps
    // its snapshot current. A future week has nothing to record.
    if (mondayIso <= currentMondayIso) saveWeekSnapshot(username, mondayIso, live);
    return live;
  }, [currentMondayIso, mondayIso, sundayIso, tasks, username]);

  const priorities = useMemo(
    () =>
      tasks
        .filter((task) => {
          if (task.status === 'done') return false;
          const created = (task.created_at || '').slice(0, 10);
          const due = (task.due_date || '').slice(0, 10);
          return (
            (created >= mondayIso && created <= sundayIso) ||
            (Boolean(due) && due >= mondayIso && due <= sundayIso)
          );
        })
        .sort((a, b) => (Number(b.xp_value) || 0) - (Number(a.xp_value) || 0)),
    [mondayIso, sundayIso, tasks],
  );

  /**
   * Focused against planned.
   *
   * Today comes from the live session, which the server has not been told
   * about yet — but the server can be ahead when today's focus was tracked in
   * another browser, so the larger of the two wins.
   */
  const focusTime = useMemo(() => {
    let focusedSeconds = 0;
    let plannedHours = 0;

    Object.entries(history).forEach(([iso, day]) => {
      if (iso === todayIso) return;
      focusedSeconds += Number(day.seconds) || 0;
      plannedHours += Number(day.goal_hours) || 0;
    });

    const today = history[todayIso];
    if (todayIso >= mondayIso && todayIso <= sundayIso) {
      focusedSeconds += Math.max(session.focused, Number(today?.seconds) || 0);
      plannedHours += session.goalHours;
    } else if (today) {
      focusedSeconds += Number(today.seconds) || 0;
      plannedHours += Number(today.goal_hours) || 0;
    }

    return `${fmtHM(focusedSeconds)} : ${fmtHM(plannedHours * 3600)}`;
  }, [history, mondayIso, session.focused, session.goalHours, sundayIso, todayIso]);

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
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <CalendarShell paneId="weekView">
      <div className={`wk-header${collapsed ? ' sidebar-collapsed' : ''}`}>
        <button
          className="wk-sidebar-toggle"
          id="wkSidebarToggle"
          type="button"
          aria-expanded={!collapsed}
          aria-controls="wkSidebar"
          title={`${collapsed ? 'Open' : 'Collapse'} the overview sidebar`}
          onClick={toggleSidebar}
        >
          <span className="wk-sidebar-toggle-icon">{collapsed ? '❯' : '❮'}</span> Overview
        </button>

        <div className="wk-headmain">
          <div className="wk-titlegroup">
            <h2 className="wk-title">{weekTitle(monday)}</h2>
            <div className="wk-nav">
              <button
                type="button"
                className="wk-arrow"
                aria-label="Previous week"
                onClick={() => setMonday((current) => dates.addDays(current, -7))}
              >
                ❮
              </button>
              <button
                type="button"
                className="wk-arrow"
                aria-label="Next week"
                onClick={() => setMonday((current) => dates.addDays(current, 7))}
              >
                ❯
              </button>
            </div>
            {/* Until dragging a slot is back, this is how a block is made:
                the next clear hour on the day the grid is showing. */}
            <button
              type="button"
              className="wk-today"
              onClick={() =>
                actions.open({
                  type: 'add-event',
                  iso: thisWeek ? todayIso : mondayIso,
                  defaults: {
                    startTime: minutesToTime((thisWeek ? now.getHours() + 1 : 9) * 60),
                    endTime: minutesToTime((thisWeek ? now.getHours() + 2 : 10) * 60),
                  },
                })
              }
            >
              + Event
            </button>
          </div>
        </div>
      </div>

      <div className={`wk-main${collapsed ? ' sidebar-collapsed' : ''}`}>
        <WeekSidebar
          stats={overview}
          streak={Number(stats.current_streak) || 0}
          focusTime={focusTime}
          priorities={priorities}
          focusText={focusText}
          onFocusTextChange={(text) => {
            setFocusText(text);
            saveWeeklyFocus(username, mondayIso, text);
          }}
          collapsed={collapsed}
        />

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

          {/* One note per day — the same one the Day and Month views show. */}
          <div className="wk-allday-row">
            <div className="wk-allday-label">Focus</div>
            <div className="wk-allday-cells">
              {days.map((day) => (
                <div className="wk-allday-cell" key={day.iso}>
                  <input
                    className="wk-day-focus"
                    type="text"
                    data-date={day.iso}
                    value={dayFocus.get(day.iso)}
                    placeholder="Focus…"
                    aria-label={`Focus for ${day.name} ${day.label}`}
                    onChange={(event) => dayFocus.set(day.iso, event.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="wk-scroll" ref={scroller}>
            <TimeLabels now={thisWeek ? nowOffset(now) : null} at={now} />
            <div className="wk-daycols">
              {columns.map((column) => (
                <DayColumn
                  key={column.iso}
                  iso={column.iso}
                  blocks={column.blocks}
                  today={column.iso === todayIso}
                  now={column.iso === todayIso ? nowOffset(now) : null}
                  onEdit={(block) => openFor(block, column.iso, 'edit')}
                  onDelete={(block) => openFor(block, column.iso, 'delete')}
                  onComplete={complete}
                  completingId={completing}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <BlockDialogs actions={actions} wide />

      {clash?.conflict && (
        <ConflictDialog
          names={[blockLabel(clash.conflict[0]), blockLabel(clash.conflict[1])]}
          onDelete={(which) => {
            const pair = clash.conflict;
            if (pair) openFor(pair[which], clash.iso, 'delete');
          }}
        />
      )}
    </CalendarShell>
  );
}
