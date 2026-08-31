/**
 * The Month view — the map on the left, the month and the chosen day on the right.
 *
 * The grid was a date picker with shading: thirty bare numbers, coloured by
 * load, with a ring underneath describing whichever one was selected. Every
 * question a reader actually brings to a month view — which days were heavy,
 * what a day is worth, how the month is going against the last one — had to be
 * answered by clicking a square and reading the other column. The grid now
 * carries each day's own counts, the strip below it carries the month, and the
 * column on the right carries the month's shape as well as the day's plan.
 *
 * Everything on the page is scoped to the month on screen, the way the Week
 * view scopes itself to its seven days: stepping a month steps the grid, the
 * summary strip, the overview tiles, the ranked days and the insight together.
 * A column of figures answering questions about different months would be worse
 * than no column at all.
 *
 * The day panel is derived, not stored. The original wrote each task into the
 * event store so the list could show it, then filtered those entries out again
 * on save; a task deleted elsewhere left its card behind until the day was
 * re-opened, and a task with no block to sit under vanished. Here the list is
 * computed on render from the store and the database (see
 * components/Calendar/entries.ts), so there is nothing to leave behind.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarShell,
  DayPanel,
  MonthGrid,
  MonthSidebar,
  MonthSummaryBar,
  ViewSwitcher,
  dayEntries,
} from '@/components/Calendar';
import { BlockDialogs } from '@/components/Calendar/BlockDialogs';
import { RatePrompt } from '@/components/Tasks';
import { ErrorState, Loading, RefreshButton } from '@/components';
import {
  useCalendarStore,
  useCalendarTasks,
  useDayFocus,
  useDocumentTitle,
  useSettings,
} from '@/hooks';
import { useBlockActions } from '@/hooks/useBlockActions';
import { useFocusSession } from '@/hooks/useFocusSession';
import { focus as focusService } from '@/services';
import { weekStartDay } from '@/services/settings';
import { dates } from '@/utils';
import { buildIntensityIndex } from '@/utils/calendarIntensity';
import { isoOf } from '@/utils/calendarStore';
import { monthFigures, monthInsight } from '@/utils/monthSummary';
import type { DayEntry } from '@/components/Calendar';
import type { FocusHistory } from '@/types';
import '@/styles/calendar/month.css';
import '@/styles/calendar/week.css';
import '@/styles/calendar/day.css';
// Last, so the colour system has the final word on every block. See the
// note at the top of it.
import '@/styles/calendar/palette.css';

/** The store's key for a date: unpadded, as it has always been. */
function keyOf(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export default function Month() {
  useDocumentTitle('Calendar · Month');

  const account = useCalendarTasks();
  const {
    tasks,
    username,
    loading,
    hasData,
    refreshing,
    error,
    refresh,
    completing,
    complete,
    rating,
    ratingDepth,
    saveRating,
    closeRating,
  } = account;
  const store = useCalendarStore(username);
  const dayFocus = useDayFocus(username);
  const session = useFocusSession(username);
  const navigate = useNavigate();
  const { prefs } = useSettings();

  const [cursor, setCursor] = useState(() => new Date());
  // The day the panel is showing. Today, until another is picked.
  const [selectedKey, setSelectedKey] = useState(() => keyOf(new Date()));
  const [history, setHistory] = useState<FocusHistory>({});

  const actions = useBlockActions(username, store, tasks, account);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  /**
   * Focus records covering the month on screen *and* the month before it.
   *
   * One call rather than two: the summary strip is entirely comparisons, so
   * the previous month is never optional, and asking for both ends in a single
   * range means the two halves of every delta always come from the same
   * response.
   */
  useEffect(() => {
    if (!username) return;
    let live = true;
    const start = dates.isoDate(new Date(year, month - 1, 1));
    const end = dates.isoDate(new Date(year, month + 1, 0));
    void focusService.history(start, end).then((result) => {
      if (live && result.success) setHistory(result.days);
    });
    return () => {
      live = false;
    };
  }, [month, username, year]);

  /**
   * Today's focus, folded into the record the server returned.
   *
   * The live session has not been written back yet, but the server can be
   * ahead of it when today was tracked in another browser — so the larger of
   * the two wins, which is the rule the Week view's figures use as well.
   */
  const focusHistory = useMemo(() => {
    const todayIso = dates.isoDate();
    const stored = history[todayIso];
    return {
      ...history,
      [todayIso]: {
        seconds: Math.max(session.focused, Number(stored?.seconds) || 0),
        goal_hours: session.goalHours || Number(stored?.goal_hours) || 0,
      },
    };
  }, [history, session.focused, session.goalHours]);

  // Recounted on every render rather than cached: first load, the fetch
  // landing, a completion and a month change all change the answer, and a
  // stale shading is a lie about how heavy a day was.
  const intensity = useMemo(
    () => buildIntensityIndex(tasks, year, month),
    [month, tasks, year],
  );

  const figures = useMemo(
    () => monthFigures(year, month, tasks, store.data, focusHistory),
    [focusHistory, month, store.data, tasks, year],
  );

  /**
   * How far into the month on screen the reader has actually got, and the same
   * depth into the month before it.
   *
   * The strip and the insight card are all comparisons, and comparing eight
   * days of August against the whole of July says only that July had more
   * month in it — every delta reads as a collapse until the 31st. So the
   * previous month is counted to the same depth: eight days in, it is July
   * 1–8. A month already finished is compared in full, and one that has not
   * started has nothing on either side.
   *
   * February is why `compared` is a `min`: thirty-one days into March, there
   * are only twenty-eight to hold it against.
   */
  const { compared, previousLength } = useMemo(() => {
    const now = new Date();
    const length = new Date(year, month + 1, 0).getDate();
    const prevLength = new Date(year, month, 0).getDate();
    const sameMonth = now.getFullYear() === year && now.getMonth() === month;
    const started = new Date(year, month, 1) <= now;
    const elapsed = sameMonth ? now.getDate() : started ? length : 0;
    return { compared: Math.min(elapsed, prevLength), previousLength: prevLength };
  }, [month, year]);

  const previous = useMemo(
    () =>
      monthFigures(
        new Date(year, month - 1, 1).getFullYear(),
        new Date(year, month - 1, 1).getMonth(),
        tasks,
        store.data,
        focusHistory,
        new Date(),
        compared,
      ),
    [compared, focusHistory, month, store.data, tasks, year],
  );

  const previousMonthName = dates.formatDate(new Date(year, month - 1, 1), {
    month: 'short',
  });

  /**
   * "Jul", or "Jul 1–8" when only part of it is on the other side.
   *
   * A month that has not started compares against nothing, so there is no
   * stretch to name and it falls back to the month — every delta beside it is
   * absent anyway, both sides being zero.
   */
  const previousName =
    compared >= previousLength || compared === 0
      ? previousMonthName
      : `${previousMonthName} 1${compared === 1 ? '' : `–${compared}`}`;

  const insight = useMemo(() => {
    const first = new Date(year, month, 1);
    const future = first > new Date();
    const against =
      compared >= previousLength || compared === 0
        ? 'last month'
        : `the first ${compared === 1 ? 'day' : `${compared} days`} of last month`;
    return monthInsight(figures, previous, future, against);
  }, [compared, figures, month, previous, previousLength, year]);

  const entries = useMemo(
    () => dayEntries(selectedKey, store.data[selectedKey]?.timestamps ?? [], tasks),
    [selectedKey, store.data, tasks],
  );

  const selectedIso = isoOf(selectedKey);

  const editEvent = useCallback(
    (entry: DayEntry) => {
      if (!entry.section) return;
      actions.open({ type: 'edit-event', iso: selectedIso, section: entry.section });
    },
    [actions, selectedIso],
  );

  const removeEntry = useCallback(
    (entry: DayEntry) => {
      if (entry.kind === 'event') {
        if (!entry.section) return;
        actions.open({ type: 'delete-event', iso: selectedIso, section: entry.section });
        return;
      }
      const task = tasks.find((candidate) => String(candidate.id) === entry.taskId);
      if (task) actions.open({ type: 'delete-task', iso: selectedIso, task });
    },
    [actions, selectedIso, tasks],
  );

  /** A day in the corner of the grid: step to its month, then select it. */
  const selectOther = useCallback((date: Date) => {
    setCursor(new Date(date.getFullYear(), date.getMonth(), 1));
    setSelectedKey(keyOf(date));
  }, []);

  const goToday = useCallback(() => {
    const now = new Date();
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedKey(keyOf(now));
  }, []);

  if (loading) return <Loading label="Loading your month" />;
  if (!hasData) return <ErrorState message={error ?? 'No data came back.'} onRetry={refresh} />;

  return (
    <CalendarShell paneId="monthView" ownSwitcher>
      {error && <ErrorState message={error} onRetry={refresh} />}

      <div className="mv-body">
        {/* The switcher rides in the grid's own header, on the line with the
            month and the arrows, rather than floating in the card's corner —
            one bar of controls for the view instead of two. */}
        <MonthGrid
          year={year}
          month={month}
          selectedKey={selectedKey}
          weekStart={weekStartDay(prefs)}
          intensity={intensity}
          days={figures.days}
          onStep={(delta) => setCursor(new Date(year, month + delta, 1))}
          onToday={goToday}
          onSelect={setSelectedKey}
          onSelectOther={selectOther}
          tools={
            <>
              <ViewSwitcher />
              {/* The only thing on this page that re-reads the account. */}
              <RefreshButton busy={refreshing} onRefresh={refresh} />
            </>
          }
        >
          <MonthSummaryBar
            settled={figures.settled}
            scheduled={figures.scheduled}
            xpEarned={figures.xpEarned}
            avgGoal={figures.avgGoal}
            previous={previous}
            previousName={previousName}
            onViewAnalytics={() => navigate('/analytics')}
          />
        </MonthGrid>

        <aside className="mv-side">
          <section className="mv-card mv-card-plan">
            {/* `focusText` is the *primary* of the day's focuses. A day can
                carry five now — the Day view is where the rest are written —
                and this field edits the first without disturbing them. */}
            <DayPanel
              entries={entries}
              focusText={dayFocus.primary(selectedIso)}
              onFocusChange={(text) => dayFocus.setPrimary(selectedIso, text)}
              onAddEvent={() =>
                actions.open({
                  type: 'add-event',
                  iso: selectedIso,
                  defaults: { startTime: '09:00', endTime: '10:00' },
                })
              }
              onEditEvent={editEvent}
              onRemoveEvent={removeEntry}
              onRenameEvent={(entry, name) => {
                if (entry.index === undefined) return;
                store.patchSection(selectedKey, entry.index, { task: name });
              }}
              onRetimeEvent={(entry, field, value) => {
                if (entry.index === undefined) return;
                store.patchSection(selectedKey, entry.index, { [field]: value });
              }}
              onComplete={complete}
              completingId={completing}
            />
          </section>

          <MonthSidebar
            tasks={figures.tasks}
            done={figures.done}
            focused={figures.focused}
            planned={figures.planned}
            xpEarned={figures.xpEarned}
            best={figures.best}
            top={figures.top}
            insight={insight}
            onViewAll={() => navigate('/analytics')}
          />
        </aside>
      </div>

      <BlockDialogs actions={actions} username={username} />

      {/* The same question the dashboard and the tasks page ask after a
          completion, from the same component — a task finished on a grid
          block goes into the record with the same two numbers against it as
          one ticked off a list. Raised by useCalendarTasks, which honours the
          account's rating_depth and never opens this at 'none'. */}
      {rating && (
        <RatePrompt
          taskName={rating.name}
          depth={ratingDepth}
          onSubmit={saveRating}
          onClose={closeRating}
        />
      )}
    </CalendarShell>
  );
}
