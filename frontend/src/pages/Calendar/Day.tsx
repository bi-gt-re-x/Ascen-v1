/**
 * The Day view — one column of the same grid, and what the day amounts to.
 *
 * Ported from the `renderDay` half of calendar-week.js
 * (calendar-day.js was already a no-op pointing there) and the `#dayView` part
 * of the calendar.html template. The column is built by the same code as a
 * Week column, so the two views cannot disagree about what a day holds.
 *
 * The sidebar is where this view earns its place. The mini-month keeps its own
 * cursor so you can look ahead without leaving the day; Focus Time *is* the
 * dashboard's focus goal on today and this day's planned block time on any
 * other; and XP Earned comes from the ledger, so it means "since midnight"
 * rather than "since something last recomputed".
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarShell,
  ConflictDialog,
  CreateChooser,
  DayColumn,
  DaySidebar,
  TimeLabels,
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
import {
  useGridDrag,
  type DraggedSlot,
  type DroppedBlock,
} from '@/hooks/useGridDrag';
import { fmtHM, useFocusSession } from '@/hooks/useFocusSession';
import { events as eventService } from '@/services';
import { dates } from '@/utils';
import {
  blockLabel,
  dayEventBlocks,
  dayTaskBlocks,
  hmLabel,
  layOut,
  nowOffset,
  type Block,
  type TaskBlock,
} from '@/utils/calendarGrid';
import { monthKey } from '@/utils/calendarStore';
import '@/styles/calendar/month.css';
import '@/styles/calendar/week.css';
import '@/styles/calendar/day.css';

/** "Friday, August 1, 2026". */
function dayTitle(date: Date): string {
  return dates.formatDate(date, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function Day() {
  useDocumentTitle('Calendar · Day');

  const { tasks, stats, username, loading, error, reload, completing, complete } =
    useCalendarTasks();
  const store = useCalendarStore(username);
  const dayFocus = useDayFocus(username);
  const session = useFocusSession(username);
  const now = useNow();

  const [cursor, setCursor] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  /** The mini-month's own cursor: paging it does not move the day. */
  const [mini, setMini] = useState(() => ({
    year: cursor.getFullYear(),
    month: cursor.getMonth(),
  }));
  const [xpEarned, setXpEarned] = useState<number | null>(null);

  const actions = useBlockActions(username, store, tasks, reload);
  const scroller = useRef<HTMLDivElement>(null);
  const jumpedToNow = useRef(false);

  const iso = dates.isoDate(cursor);
  const todayIso = dates.isoDate(now);
  const isToday = iso === todayIso;

  /** Moving the day re-syncs the mini-month to that day's month. */
  const goTo = useCallback((date: Date) => {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    setCursor(next);
    setMini({ year: next.getFullYear(), month: next.getMonth() });
  }, []);

  // XP is the ledger's answer for this date, re-asked whenever the day
  // changes or a completion has just moved the total.
  useEffect(() => {
    if (!username) return;
    let live = true;
    setXpEarned(null);
    void eventService.xpEarnedOn(username, iso).then((result) => {
      if (live) setXpEarned(result.success ? Number(result.xp_earned) || 0 : 0);
    });
    return () => {
      live = false;
    };
  }, [completing, iso, username]);

  useEffect(() => {
    if (jumpedToNow.current || loading || !isToday) return;
    const top = nowOffset(new Date());
    if (top === null || !scroller.current) return;
    scroller.current.scrollTop = Math.max(0, top - scroller.current.clientHeight / 2);
    jumpedToNow.current = true;
  }, [isToday, loading]);

  const { blocks, conflict } = useMemo(
    () => layOut([...dayTaskBlocks(iso, tasks), ...dayEventBlocks(iso, store.data)]),
    [iso, store.data, tasks],
  );

  /** Every task that belongs to this day, finished or not. */
  const tally = useMemo(() => {
    let total = 0;
    let done = 0;
    tasks.forEach((task) => {
      const when = task.due_date || task.created_at;
      if (!when || dates.isoDate(new Date(when)) !== iso) return;
      total += 1;
      if (task.status === 'done') done += 1;
    });
    return { total, done };
  }, [iso, tasks]);

  /**
   * Focus Time. On today it is the goal the dashboard's panel sets — the same
   * number, editable in both places. On any other day there is no goal to
   * speak of, so it is what that day has been planned to hold.
   */
  const plannedHours = blocks.reduce((sum, block) => sum + (block.end - block.start), 0);
  const focusTime = isToday
    ? fmtHM(session.goalHours * 3600)
    : fmtHM(plannedHours * 3600);

  const pending = useMemo(
    () =>
      blocks
        .filter((block): block is TaskBlock => block.kind === 'task' && !block.done)
        .sort((a, b) => a.start - b.start),
    [blocks],
  );

  const openFor = useCallback(
    (block: Block, intent: 'edit' | 'delete') => {
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
    [actions, iso, store.data, tasks],
  );

  /**
   * The same three drags the Week view offers, on the one column this view has.
   * See pages/Calendar/Week.tsx — the wiring is the same, minus the day the
   * pointer is over, because here there is only ever this one.
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

  const daycol = useGridDrag({
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

  /** The next clear hour on the shown day — 9 AM when it is not today. */
  const addTask = useCallback(() => {
    const startMinutes = Math.min(isToday ? (now.getHours() + 1) * 60 : 9 * 60, 22 * 60);
    actions.open({
      type: 'add-task',
      iso,
      defaults: {
        startTime: minutesToTime(startMinutes),
        endTime: minutesToTime(startMinutes + 60),
      },
    });
  }, [actions, isToday, iso, now]);

  if (loading) return <Loading label="Loading your day" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <CalendarShell paneId="dayView">
      <div className="wk-header day-header">
        <div className="wk-titlegroup">
          <h2 className="wk-title">{dayTitle(cursor)}</h2>
          <div className="wk-nav">
            <button
              type="button"
              className="wk-arrow"
              aria-label="Previous day"
              onClick={() => goTo(dates.addDays(cursor, -1))}
            >
              ❮
            </button>
            <button
              type="button"
              className="wk-arrow"
              aria-label="Next day"
              onClick={() => goTo(dates.addDays(cursor, 1))}
            >
              ❯
            </button>
          </div>
          <button type="button" className="wk-today" onClick={() => goTo(new Date())}>
            Today
          </button>
        </div>
      </div>

      <div className="day-layout">
        <div className="day-gridpane">
          {/* The same per-day note as the Week row and the Month view's field. */}
          <div className="day-allday">
            <div className="wk-allday-label">Focus</div>
            <div className="day-allday-field">
              <input
                type="text"
                className="day-allday-input"
                placeholder="What's your focus for this day?"
                aria-label="Daily focus"
                value={dayFocus.get(iso)}
                onChange={(event) => dayFocus.set(iso, event.target.value)}
              />
            </div>
          </div>

          <div className="wk-scroll day-scroll" ref={scroller}>
            <TimeLabels now={isToday ? nowOffset(now) : null} at={now} />
            <DayColumn
              hostRef={daycol}
              iso={iso}
              blocks={blocks}
              today={isToday}
              now={isToday ? nowOffset(now) : null}
              className="day-col"
              onEdit={(block) => openFor(block, 'edit')}
              onDelete={(block) => openFor(block, 'delete')}
              onComplete={complete}
              completingId={completing}
            />
          </div>
        </div>

        <DaySidebar
          miniYear={mini.year}
          miniMonth={mini.month}
          selectedIso={iso}
          onMiniStep={(delta) =>
            setMini((current) => {
              const stepped = new Date(current.year, current.month + delta, 1);
              return { year: stepped.getFullYear(), month: stepped.getMonth() };
            })
          }
          onPickDate={(picked) => goTo(dates.fromIsoDate(picked))}
          focus={{
            focused: fmtHM(session.focused),
            goal: fmtHM(session.goalHours * 3600),
            percent: session.percent,
          }}
          goalEditable={isToday}
          onSetGoalHours={session.setGoalHours}
          stats={{
            tasks: `${tally.done} / ${tally.total}`,
            focusTime,
            xp: xpEarned,
            streak: Number(stats.current_streak) || 0,
          }}
          pending={pending}
          onComplete={complete}
          completingId={completing}
          onAddTask={addTask}
        />
      </div>

      {/* The Day view acts on one task at a time — its dialogs never offer a
          repeat, exactly as the original's did not. */}
      <BlockDialogs actions={actions} username={username} allowTaskRecurrence={false} />

      {slot && (
        <CreateChooser
          when={`${dates.formatDate(dates.fromIsoDate(slot.iso), {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
          })} · ${hmLabel(slot.startTime)} – ${hmLabel(slot.endTime)}`}
          onChoose={(kind) => openDragged(kind === 'event' ? 'add-event' : 'add-task')}
          onCancel={() => setSlot(null)}
        />
      )}

      {conflict && (
        <ConflictDialog
          names={[blockLabel(conflict[0]), blockLabel(conflict[1])]}
          onDelete={(which) => openFor(conflict[which], 'delete')}
        />
      )}
    </CalendarShell>
  );
}
