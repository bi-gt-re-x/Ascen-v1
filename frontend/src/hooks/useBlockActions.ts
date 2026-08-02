/**
 * Creating, editing and deleting from the grid.
 *
 * The Week and Day views offer the same four actions on the same two kinds of
 * thing, so the state machine behind their dialogs is written once here and
 * the dialogs themselves are rendered by components/Calendar/BlockDialogs.
 *
 * Where a change lands depends on what it is. An **event** is the browser's:
 * it goes to the localStorage store, and "all occurrences" means every copy of
 * it, because a recurrence is a copy rather than a reference. A **task** is
 * the account's: it is created, edited and deleted through the API, and an
 * edit is a delete-then-create because a task's start time is its `created_at`
 * and that is not a field the edit endpoint will move.
 *
 * Writes are chained rather than fired together. The datastore is a file the
 * backend rewrites per call, so twelve parallel creates is twelve reads of the
 * same starting state and eleven lost tasks.
 */
import { useCallback, useState } from 'react';
import { tasks as taskService } from '@/services';
import { xpToPriority, type TaskDraft } from '@/components/Calendar/TaskModal';
import type { EventDraft, Scope, UseCalendarStore } from './useCalendarStore';
import { monthKey, type CalendarSection } from '@/utils/calendarStore';
import { dates } from '@/utils';
import type { Task } from '@/types';

export type BlockDialog =
  | { type: 'add-event'; iso: string; defaults?: TimeDefaults }
  | { type: 'add-task'; iso: string; defaults?: TimeDefaults }
  | { type: 'edit-event'; iso: string; section: CalendarSection }
  | { type: 'edit-task'; iso: string; task: Task }
  | { type: 'delete-event'; iso: string; section: CalendarSection }
  | { type: 'delete-task'; iso: string; task: Task }
  | null;

export interface TimeDefaults {
  startTime: string;
  endTime: string;
}

export interface UseBlockActions {
  dialog: BlockDialog;
  open: (dialog: NonNullable<BlockDialog>) => void;
  close: () => void;
  saveEvent: (draft: EventDraft, scope: Scope) => void;
  saveTask: (draft: TaskDraft, scope: Scope) => void;
  removeEvent: (scope: Scope) => void;
  removeTask: (scope: Scope) => void;
  /** How many days this event lands on. */
  eventOccurrences: (section: CalendarSection) => number;
  /** The tasks that repeat with this one, itself included. */
  taskOccurrences: (task: Task) => Task[];
}

/** "18:40" for the time-of-day part of a stored timestamp. */
function hmOf(value: string | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * Tasks store no recurrence of their own, so a series is what looks like one:
 * the same name at the same times on different days — exactly how events group.
 */
function identityOf(task: Task): string {
  return `${task.title || ''}|${hmOf(task.created_at)}|${hmOf(task.due_date)}`;
}

/** Every date a repeat lands on, the base day included, over twelve months. */
function taskDates(baseIso: string, draft: TaskDraft): string[] {
  const out = [baseIso];
  if (draft.recurrence === 'none' || !draft.recurrenceDays.length) return out;

  const base = dates.fromIsoDate(baseIso);
  const end = new Date(base.getFullYear(), base.getMonth() + 12, base.getDate());
  const cursor = new Date(base);
  cursor.setDate(cursor.getDate() + 1);

  while (cursor <= end) {
    const matches =
      draft.recurrence === 'weekly'
        ? draft.recurrenceDays.includes(cursor.getDay())
        : draft.recurrenceDays.includes(cursor.getDate());
    if (matches) out.push(dates.isoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/** Run promise-returning steps one after another. */
function inSequence(steps: Array<() => Promise<unknown>>): Promise<void> {
  return steps.reduce(
    (chain, step) => chain.then(() => step()).then(() => undefined),
    Promise.resolve(),
  );
}

export function useBlockActions(
  username: string | null,
  store: UseCalendarStore,
  allTasks: Task[],
  reload: () => void,
): UseBlockActions {
  const [dialog, setDialog] = useState<BlockDialog>(null);

  const close = useCallback(() => setDialog(null), []);
  const open = useCallback((next: NonNullable<BlockDialog>) => setDialog(next), []);

  const taskOccurrences = useCallback(
    (task: Task) => {
      const identity = identityOf(task);
      return allTasks.filter((other) => identityOf(other) === identity);
    },
    [allTasks],
  );

  const saveEvent = useCallback(
    (draft: EventDraft, scope: Scope) => {
      if (!dialog) return;
      const key = monthKey(dialog.iso);
      if (dialog.type === 'add-event') store.addEvent(key, draft);
      else if (dialog.type === 'edit-event') {
        store.editEvent(key, dialog.section, draft, scope);
      }
      close();
    },
    [close, dialog, store],
  );

  const saveTask = useCallback(
    (draft: TaskDraft, scope: Scope) => {
      if (!dialog || !username) return;
      if (dialog.type !== 'add-task' && dialog.type !== 'edit-task') return;

      const priority = xpToPriority(draft.xp);
      const steps: Array<() => Promise<unknown>> = [];

      // An edit replaces: the old rows go, and the new ones are written from
      // the pattern — which is what lets a weekly repeat become a monthly one.
      const replacing =
        dialog.type === 'edit-task'
          ? scope === 'all'
            ? taskOccurrences(dialog.task)
            : [dialog.task]
          : [];
      replacing.forEach((task) => {
        steps.push(() => taskService.deleteTaskWithoutTracking(String(task.id)));
      });

      const days =
        dialog.type === 'edit-task' && scope === 'one'
          ? [dialog.iso]
          : taskDates(dialog.iso, draft);

      days.forEach((iso, index) => {
        steps.push(() =>
          taskService.createTask(username, {
            id: `${Date.now()}-${index}`,
            name: draft.name,
            priority,
            xp_reward: draft.xp,
            created_at: `${iso}T${draft.startTime}:00`,
            due_date: `${iso}T${draft.endTime}:00`,
            show_on_calendar: true,
          }),
        );
      });

      void inSequence(steps).then(reload);
      close();
    },
    [close, dialog, reload, taskOccurrences, username],
  );

  const removeEvent = useCallback(
    (scope: Scope) => {
      if (dialog?.type !== 'delete-event') return;
      store.removeEvent(monthKey(dialog.iso), dialog.section, scope);
      close();
    },
    [close, dialog, store],
  );

  const removeTask = useCallback(
    (scope: Scope) => {
      if (dialog?.type !== 'delete-task' || !username) return;
      const targets = scope === 'all' ? taskOccurrences(dialog.task) : [dialog.task];
      void inSequence(
        targets.map(
          (task) => () => taskService.deleteTask(username, String(task.id)),
        ),
      ).then(reload);
      close();
    },
    [close, dialog, reload, taskOccurrences, username],
  );

  return {
    dialog,
    open,
    close,
    saveEvent,
    saveTask,
    removeEvent,
    removeTask,
    eventOccurrences: store.occurrenceCount,
    taskOccurrences,
  };
}
