/**
 * The Month view — the map on the left, the chosen day on the right.
 *
 * Ported from frontend/js/calendar/calendar-month.js and the `#monthView` half
 * of frontend/html/calendar.html. The markup and class names are the
 * originals, so styles/calendar/month.css dresses this unchanged — including
 * the day list and the progress ring, which that stylesheet reaches by id.
 *
 * The day panel is derived, not stored. The original wrote each task into the
 * event store so the list could show it, then filtered those entries out again
 * on save; a task deleted elsewhere left its card behind until the day was
 * re-opened, and a task with no block to sit under vanished. Here the list is
 * computed on render from the store and the database (see
 * components/Calendar/entries.ts), so there is nothing to leave behind.
 *
 * Two pieces of the original's furniture are deliberately not here: the
 * measured alignment that nudged the panel down to meet the month's name, and
 * the 20%-of-the-screen lift that followed it. Both read the layout back from
 * the browser and wrote it into inline styles on every render and resize.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  CalendarShell,
  DayPanel,
  DayProgress,
  MonthGrid,
  dayEntries,
} from '@/components/Calendar';
import { BlockDialogs } from '@/components/Calendar/BlockDialogs';
import { ErrorState, Loading } from '@/components';
import {
  useCalendarStore,
  useCalendarTasks,
  useDayFocus,
  useDocumentTitle,
} from '@/hooks';
import { useBlockActions } from '@/hooks/useBlockActions';
import { buildIntensityIndex } from '@/utils/calendarIntensity';
import { isoOf } from '@/utils/calendarStore';
import type { DayEntry } from '@/components/Calendar';
import '@/styles/calendar/month.css';
import '@/styles/calendar/week.css';
import '@/styles/calendar/day.css';

/** The store's key for a date: unpadded, as it has always been. */
function keyOf(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export default function Month() {
  useDocumentTitle('Calendar · Month');

  const { tasks, username, loading, error, reload, completing, complete } =
    useCalendarTasks();
  const store = useCalendarStore(username);
  const dayFocus = useDayFocus(username);

  const [cursor, setCursor] = useState(() => new Date());
  // The day the panel is showing. Today, until another is picked.
  const [selectedKey, setSelectedKey] = useState(() => keyOf(new Date()));

  const actions = useBlockActions(username, store, tasks, reload);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  // Recounted on every render rather than cached: first load, the fetch
  // landing, a completion and a month change all change the answer, and a
  // stale shading is a lie about how heavy a day was.
  const intensity = useMemo(
    () => buildIntensityIndex(tasks, year, month),
    [month, tasks, year],
  );

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

  if (loading) return <Loading label="Loading your month" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <CalendarShell paneId="monthView">
      <div className="calendar-body">
        <MonthGrid
          year={year}
          month={month}
          selectedKey={selectedKey}
          intensity={intensity}
          onStep={(delta) => setCursor(new Date(year, month + delta, 1))}
          onSelect={setSelectedKey}
        >
          <DayProgress entries={entries} />
        </MonthGrid>

        <DayPanel
          entries={entries}
          focusText={dayFocus.get(selectedIso)}
          onFocusChange={(text) => dayFocus.set(selectedIso, text)}
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
      </div>

      <BlockDialogs actions={actions} />
    </CalendarShell>
  );
}
