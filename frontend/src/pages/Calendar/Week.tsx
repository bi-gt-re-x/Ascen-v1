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
  DayColumn,
  TimeLabels,
  ViewSwitcher,
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
import { useFocusSession } from '@/hooks/useFocusSession';
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
  const [focusText, setFocusText] = useState('');
  const [history, setHistory] = useState<FocusHistory>({});
  /** The day whose focus chip is currently an input, if any. */
  const [focusEditing, setFocusEditing] = useState<string | null>(null);
  /** What has been typed into the bar under the grid. */
  const [compose, setCompose] = useState('');

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
   * Open an add dialog from the bar under the grid, carrying whatever has been
   * typed into it as the name and clearing the bar. The times are the next
   * clear hour on the day being shown, which is what the header's "+ Event"
   * button used before this bar replaced it.
   */
  const openCompose = useCallback(
    (type: 'add-task' | 'add-event') => {
      const name = compose.trim();
      const hour = thisWeek ? now.getHours() + 1 : 9;
      actions.open({
        type,
        iso: thisWeek ? todayIso : mondayIso,
        defaults: {
          startTime: minutesToTime(hour * 60),
          endTime: minutesToTime((hour + 1) * 60),
          ...(name ? { name } : {}),
        },
      });
      setCompose('');
    },
    [actions, compose, mondayIso, now, thisWeek, todayIso],
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

          {/* The bar under the grid. It replaces the "+ Event" button that used
              to sit in the header: the same two dialogs, plus somewhere to type
              the name first so the dialog opens already knowing it. Both open
              on the day being shown — today when that is in this week, and
              Monday otherwise, which is the rule the old button followed. */}
          <div className="wk-compose">
            <span className="wk-compose-plus" aria-hidden="true">+</span>
            <input
              className="wk-compose-input"
              type="text"
              placeholder="Add task or event…"
              aria-label="Add a task or event"
              value={compose}
              onChange={(event) => setCompose(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || !compose.trim()) return;
                openCompose('add-task');
              }}
            />
            <button
              type="button"
              className="wk-compose-btn"
              title="New event"
              onClick={() => openCompose('add-event')}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M3 10h18M8 3v4M16 3v4" />
              </svg>
            </button>
            <button
              type="button"
              className="wk-compose-btn"
              title="New task"
              onClick={() => openCompose('add-task')}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 21V4h9l1 2h6v9h-7l-1-2H4" />
              </svg>
            </button>
            <button
              type="button"
              className="wk-compose-go"
              title={compose.trim() ? `Add “${compose.trim()}”` : 'New task'}
              onClick={() => openCompose('add-task')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
        </div>
        <WeekSidebar
          stats={overview}
          streak={Number(stats.current_streak) || 0}
          focus={focus}
          days={weekDays}
          upcoming={upcoming}
          priorities={priorities}
          focusText={focusText}
          onFocusTextChange={(text) => {
            setFocusText(text);
            saveWeeklyFocus(username, mondayIso, text);
          }}
          onViewAnalytics={() => navigate('/analytics')}
          collapsed={collapsed}
        />

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
