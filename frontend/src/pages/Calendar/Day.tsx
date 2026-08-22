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
} from '@/hooks';
import { useBlockActions } from '@/hooks/useBlockActions';
import { planFamilies, weekOf } from '@/utils/calendarFamilies';
import {
  useGridDrag,
  type DraggedSlot,
  type DroppedBlock,
} from '@/hooks/useGridDrag';
import { fmtHM, useFocusSession } from '@/hooks/useFocusSession';
import {
  MAX_DAY_FOCUSES,
  focusList,
  joinFocuses,
} from '@/hooks/useDayFocus';
import { events as eventService } from '@/services';
import { weekStartDay } from '@/services/settings';
import { dates } from '@/utils';
import { iconUrlFor } from '@/utils/calendarIcons';
import {
  blockLabel,
  blockWhen,
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
// Last, so the colour system has the final word on every block. See the
// note at the top of it.
import '@/styles/calendar/palette.css';

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
  const now = useNow();
  const { prefs } = useSettings();

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

  const actions = useBlockActions(username, store, tasks, account);
  const scroller = useRef<HTMLDivElement>(null);

  const iso = dates.isoDate(cursor);
  const todayIso = dates.isoDate(now);
  const isToday = iso === todayIso;

  /** Opening the day lands on the current hour — see hooks/useNowScroll. */
  const centerOnNow = useNowScroll(scroller, !loading && isToday);

  /**
   * The day's focuses, as the row above the grid is editing them.
   *
   * Held here rather than read straight off the store on every render, because
   * the two disagree about one thing on purpose: an empty field. The store
   * keeps a *list of focuses* and drops blanks, so a row the reader has just
   * opened with + is not in it and would vanish from under the cursor before
   * they could type into it. This is the editor's version, which keeps it.
   *
   * They are re-seeded whenever the store says something the row does not
   * already say — a different day, or the account's notes arriving from the
   * server. Writing through does not trip that: what comes back is what was
   * just sent, so a half-opened blank row survives its own keystroke.
   */
  const stored = dayFocus.get(iso);
  const [focuses, setFocuses] = useState<string[]>(() => {
    const list = focusList(stored);
    return list.length ? list : [''];
  });

  useEffect(() => {
    if (joinFocuses(focuses) === stored) return;
    const list = focusList(stored);
    setFocuses(list.length ? list : ['']);
    // `focuses` is read but deliberately not a dependency: it is the thing
    // being corrected, and depending on it would re-run this on every
    // keystroke to conclude that nothing needs correcting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso, stored]);

  // The next list is worked out before anything is set, rather than inside the
  // updater: writing to the store is a side effect, and an updater React is
  // free to call twice is not the place for one.
  const writeFocus = useCallback(
    (index: number, value: string) => {
      const next = focuses.map((item, at) => (at === index ? value : item));
      setFocuses(next);
      dayFocus.setList(iso, next);
    },
    [dayFocus, focuses, iso],
  );

  /** An empty field the reader can type into. Nothing is stored until they do. */
  const addFocus = useCallback(() => {
    if (focuses.length >= MAX_DAY_FOCUSES) return;
    setFocuses([...focuses, '']);
  }, [focuses]);

  const dropFocus = useCallback(
    (index: number) => {
      const kept = focuses.filter((_, at) => at !== index);
      // A day always offers a first field, even with nothing written in it.
      const next = kept.length ? kept : [''];
      setFocuses(next);
      dayFocus.setList(iso, next);
    },
    [dayFocus, focuses, iso],
  );

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

  // One colour plan for the whole week, so nothing on it shares a family until
  // the week has more than twelve distinct things on it — and so the Day view
  // and the Week view agree, both planning the same seven days. See
  // utils/calendarFamilies.
  const plan = useMemo(
    () => planFamilies(weekOf(iso), tasks, store.data),
    [iso, store.data, tasks],
  );

  const { blocks, conflict } = useMemo(
    () =>
      layOut([
        ...dayTaskBlocks(iso, tasks, subjects, plan),
        ...dayEventBlocks(iso, store.data, plan),
      ]),
    [iso, plan, store.data, subjects, tasks],
  );

  /**
   * Scroll the clashing pair into the middle of the window.
   *
   * One column here rather than seven, but the same problem: the clash can be
   * at an hour the reader has not scrolled to, and a dialog naming two blocks
   * they cannot see is a question they cannot answer. The pair are ringed too —
   * `flagged` on the column below.
   */
  const revealConflict = useCallback(() => {
    const box = scroller.current;
    if (!box || !conflict) return;
    const top = Math.min(conflict[0].top, conflict[1].top);
    const bottom = Math.max(
      conflict[0].top + conflict[0].height,
      conflict[1].top + conflict[1].height,
    );
    box.scrollTo({
      top: Math.max(0, (top + bottom) / 2 - box.clientHeight / 2),
      behavior: 'smooth',
    });
  }, [conflict]);

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
  if (!hasData) return <ErrorState message={error ?? 'No data came back.'} onRetry={refresh} />;

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
          {/* Back to today *and* to the hour it is — the same landing the view
              makes when it is opened. */}
          <button
            type="button"
            className="wk-today"
            onClick={() => {
              goTo(new Date());
              centerOnNow();
            }}
          >
            Today
          </button>
        </div>

        {/* The one control on this page that asks the server again. */}
        <RefreshButton className="wk-icon-btn" busy={refreshing} onRefresh={refresh} />
      </div>

      {error && <ErrorState message={error} onRetry={refresh} />}

      <div className="day-layout">
        <div className="day-gridpane">
          {/* The day's focuses: a primary, then up to four more. The same note
              the Week row and the Month view's field show — they show the
              primary; this is where the whole list is written. */}
          <div className="day-allday">
            <div className="wk-allday-label">Focus</div>
            <div className="day-allday-field">
              {focuses.map((text, index) => (
                <div
                  className={`day-focus-item${index === 0 ? ' is-primary' : ''}`}
                  key={index}
                >
                  {/* Guessed from what has been typed, so it answers as the
                      words appear. An empty field has nothing to guess from
                      and shows the ring instead of the catch-all clock. */}
                  {text.trim() ? (
                    <i
                      className="cal-ico day-focus-ico"
                      style={{ ['--ico' as string]: `url(${iconUrlFor(text)})` }}
                      aria-hidden="true"
                    />
                  ) : (
                    <span className="day-focus-ico is-empty" aria-hidden="true" />
                  )}
                  <input
                    type="text"
                    className="day-allday-input"
                    placeholder={
                      index === 0
                        ? "What's your main focus for this day?"
                        : 'And also…'
                    }
                    aria-label={
                      index === 0 ? 'Primary focus' : `Focus ${index + 1}`
                    }
                    value={text}
                    onChange={(event) => writeFocus(index, event.target.value)}
                  />
                  {/* The primary has no remove: a day always has a first line,
                      and clearing the field is what empties it. */}
                  {index > 0 && (
                    <button
                      type="button"
                      className="day-focus-drop"
                      aria-label={`Remove focus ${index + 1}`}
                      title="Remove"
                      onClick={() => dropFocus(index)}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}

              {focuses.length < MAX_DAY_FOCUSES && (
                <button
                  type="button"
                  className="day-focus-add"
                  onClick={addFocus}
                  title={`Add another focus (${focuses.length} of ${MAX_DAY_FOCUSES})`}
                >
                  <span aria-hidden="true">+</span>
                  <span className="day-focus-add-label">Focus</span>
                </button>
              )}
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
              flagged={conflict}
            />
          </div>
        </div>

        <DaySidebar
          miniYear={mini.year}
          miniMonth={mini.month}
          selectedIso={iso}
          weekStart={weekStartDay(prefs)}
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
          where={dayTitle(cursor)}
          sides={[
            {
              name: blockLabel(conflict[0]),
              when: blockWhen(conflict[0]),
              kind: conflict[0].kind,
            },
            {
              name: blockLabel(conflict[1]),
              when: blockWhen(conflict[1]),
              kind: conflict[1].kind,
            },
          ]}
          onReveal={revealConflict}
          onDelete={(which) => openFor(conflict[which], 'delete')}
        />
      )}
    </CalendarShell>
  );
}
