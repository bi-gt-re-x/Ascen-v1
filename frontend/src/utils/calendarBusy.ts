/**
 * Which days have anything on them, and whether any of it is still to do.
 *
 * The mini-month in the Week and Day sidebars was thirty-odd numbers and
 * nothing else — a date picker with no information in it. That is a real gap
 * rather than a cosmetic one: the whole reason to page a small calendar
 * forward is to find out *where the work is*, and a grid of bare numbers can
 * only be asked one day at a time by clicking it and looking somewhere else.
 * It is the same argument the Month view makes about its own grid, applied to
 * the small one two other views carry.
 *
 * So this is the least the mini-month needs to stop being blank: one mark per
 * day that has something scheduled, and a quieter one for a day whose
 * something is all finished. Two states rather than a count, because a cell in
 * the mini-month is eleven pixels of type and a number in it would be a second
 * number beside the date.
 *
 * Both sources, because both own part of the answer: events live in the
 * browser's store and tasks in the account, which is the same split
 * components/Calendar/entries.ts and the Month view's grid read from. Only what
 * the calendar was actually told about counts — `isCalendarPlaced` — so a
 * dashboard to-do that was never put on a day does not put a dot on one.
 */
import { isCalendarPlaced } from '@/utils/calendarGrid';
import { taskCalendarDay } from '@/utils/calendarIntensity';
import { isoOf, type CalendarData } from '@/utils/calendarStore';
import type { Task } from '@/types';

/**
 * A day, and whether everything on it is done.
 *
 * `false` — something is still open — is the interesting value and the one the
 * solid mark is for. `true` is a day that has been dealt with, which is worth
 * a quieter mark rather than none: "nothing left here" and "nothing was ever
 * here" are different answers and the reader is entitled to both.
 */
export type DayLoad = ReadonlyMap<string, boolean>;

export function busyDays(tasks: readonly Task[], data: CalendarData): DayLoad {
  /* Built as a mutable map and handed back as a readonly one. `settled` starts
     true for a day and is turned off by the first unfinished thing on it —
     rather than counting both kinds and comparing at the end, which is two
     tallies to keep in step for an answer that is a single boolean. */
  const load = new Map<string, boolean>();

  const mark = (iso: string, done: boolean) => {
    const settled = load.get(iso);
    load.set(iso, settled === undefined ? done : settled && done);
  };

  tasks.forEach((task) => {
    if (!isCalendarPlaced(task)) return;
    const key = taskCalendarDay(task);
    if (!key) return;
    mark(isoOf(key), task.status === 'done');
  });

  Object.entries(data).forEach(([key, day]) => {
    const iso = isoOf(key);
    day.timestamps.forEach((section) => {
      // A to-do the old calendar mirrored into the store was never a thing on
      // a day — see the note in components/Calendar/entries.ts.
      if (section.isDashboardTask || section.completedTodo) return;
      mark(iso, Boolean(section.completed));
    });
  });

  return load;
}
