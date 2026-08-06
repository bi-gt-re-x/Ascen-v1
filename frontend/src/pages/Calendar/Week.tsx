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
  TimeLabels,
  ViewSwitcher,
  WeekSidebar,
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
import { useFocusSession } from '@/hooks/useFocusSession';
import {
  useGridDrag,
  type DraggedSlot,
  type DroppedBlock,
} from '@/hooks/useGridDrag';
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
import { iconUrlFor } from '@/utils/calendarIcons';
import {
  isoOf,
  loadWeekSnapshots,
  monthKey,
  saveWeekSnapshot,
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

/** "16:30" as "4:30 PM". Empty in, "All Day" out — an entry with no time has none. */
function clockLabel(hhmm: string): string {
  const [hours, minutes] = hhmm.split(':').map(Number);
  if (hours === undefined || Number.isNaN(hours) || minutes === undefined) return 'All Day';
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
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
  const navigate = useNavigate();

  const [monday, setMonday] = useState(() => mondayOf(new Date()));
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('wkSidebarCollapsed') === '1';
    } catch {
      return false;
    }
  });
  const [history, setHistory] = useState<FocusHistory>({});
  /** The day whose focus chip is currently an input, if any. */
  const [focusEditing, setFocusEditing] = useState<string | null>(null);

  const actions = useBlockActions(username, store, tasks, reload);
  const scroller = useRef<HTMLDivElement>(null);
  /** The grid's scroll offset, kept across the remount a reload causes. */
  const held = useRef(0);

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
    if (!username) return;
    let live = true;
    void focusService.history(username, mondayIso, sundayIso).then((result) => {
      if (live && result.success) setHistory(result.days);
    });
    return () => {
      live = false;
    };
  }, [mondayIso, sundayIso, username]);

  /**
   * Hold the grid's scroll position across the remount a reload causes.
   *
   * A write to a task reloads the week, `loading` goes true, the whole grid
   * unmounts behind the spinner, and a fresh scroller starts at the top.
   * Dragging an 11 AM task one column across used to answer by throwing the
   * view back to six in the morning.
   *
   * It also used to open scrolled to the current hour, which was worth doing at
   * 141px an hour: four hours fitted on screen and 6 AM was rarely one of them.
   * At 48 the whole waking day is there, so there is nothing to jump to — and
   * the view opens on the morning, which is where the day starts.
   */
  useEffect(() => {
    const box = scroller.current;
    if (loading || !box) return;
    box.scrollTop = held.current;
  }, [loading]);

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
    if (todayIso >= mondayIso && todayIso <= sundayIso) {
      focusedSeconds += Math.max(session.focused, Number(today?.seconds) || 0);
      plannedHours += session.goalHours;
    } else if (today) {
      focusedSeconds += Number(today.seconds) || 0;
      plannedHours += Number(today.goal_hours) || 0;
    }

    return { focused: focusedSeconds, planned: plannedHours * 3600 };
  }, [history, mondayIso, session.focused, session.goalHours, sundayIso, todayIso]);

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
        return {
          initial: day.name.charAt(0),
          xp,
          active: done > 0,
          future: day.iso > todayIso,
          today: day.iso === todayIso,
        };
      }),
    [days, tasks, todayIso],
  );

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
      .filter((task) => task.status === 'todo' && day(task.due_date) > sundayIso)
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
      if (iso <= sundayIso) return;
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
  }, [store.data, sundayIso, tasks]);

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
    <CalendarShell paneId="weekView" ownSwitcher>
      {/* One row: what week it is and how to move through it on the left, how
          to look at it and what to do with it on the right. The switcher is
          here rather than in the shell above so the view has a single bar of
          controls instead of two stacked ones. */}
      <div className={`wk-header${collapsed ? ' sidebar-collapsed' : ''}`}>
        <div className="wk-headmain">
          <h2 className="wk-title">{weekTitle(monday)}</h2>
          <div className="wk-nav">
            <button
              type="button"
              className="wk-arrow"
              aria-label="Previous week"
              onClick={() => setMonday((current) => dates.addDays(current, -7))}
            >
              ‹
            </button>
            {/* Not in the design, which has only a back arrow — a week view
                that can be left but not returned from is a trap. */}
            <button
              type="button"
              className="wk-arrow"
              aria-label="Next week"
              onClick={() => setMonday((current) => dates.addDays(current, 7))}
            >
              ›
            </button>
          </div>
          <button
            type="button"
            className="wk-today"
            disabled={thisWeek}
            onClick={() => setMonday(mondayOf(new Date()))}
          >
            Today
          </button>
        </div>

        <div className="wk-headtools">
          <ViewSwitcher />
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

          {/* One note per day — the same one the Day and Month views show, and
              the same stored text. It reads as a chip with the icon guessed
              from what it says, and becomes the input it always was when it is
              clicked. A day with nothing on it offers the word instead. */}
          <div className="wk-allday-row">
            <div className="wk-allday-label">Focus</div>
            <div className="wk-allday-cells">
              {days.map((day) => {
                const text = dayFocus.get(day.iso);
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
                        onChange={(event) => dayFocus.set(day.iso, event.target.value)}
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
                        aria-label={`Focus for ${day.name} ${day.label}`}
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
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className="wk-scroll"
            ref={scroller}
            onScroll={(event) => {
              held.current = event.currentTarget.scrollTop;
            }}
          >
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
                />
              ))}
            </div>
          </div>

        </div>
        <WeekSidebar
          stats={overview}
          streak={Number(stats.current_streak) || 0}
          focus={focus}
          days={weekDays}
          upcoming={upcoming}
          onViewMonth={() => navigate('/calendar/month')}
          onViewAnalytics={() => navigate('/analytics')}
          collapsed={collapsed}
        />

      </div>

      <BlockDialogs actions={actions} wide />

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
