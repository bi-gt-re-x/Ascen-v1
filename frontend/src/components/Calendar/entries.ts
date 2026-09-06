/**
 * What a day is carrying, as one list.
 *
 * The month view's day panel shows events and tasks together, in the order
 * they happen. Tasks means *calendar* tasks: a dashboard to-do was never
 * planned onto a day and does not appear on one (see taskCalendarDay).
 *
 * The original built that list by *writing* the tasks into the
 * event store — pushing an entry per task into `dateContent`, then filtering
 * them out again on save so they would not outlive the task — and the seam
 * showed: a task deleted elsewhere left its card behind until the day was
 * re-opened, and a task tucked under a block on a day with no blocks vanished
 * entirely.
 *
 * Here the list is derived on render from the two sources that own the truth:
 * the store for events, the database for tasks. Nothing is written to show
 * something, so nothing can be left behind.
 */
import { markConflicts, type CalendarSection, type Subtask } from '@/utils/calendarStore';
import { familyForSection } from '@/utils/calendarColors';
import { familyForSubject, type Family } from '@/utils/eventPalette';
import { taskCalendarDay } from '@/utils/calendarIntensity';
import type { Task } from '@/types';

export interface DayEntry {
  key: string;
  kind: 'event' | 'task';
  /** Where the event sits in the day's stored list. Absent for a task. */
  index?: number;
  name: string;
  /** "HH:MM". An entry with no time at one end leaves that field empty. */
  startTime: string;
  endTime: string;
  xp: number;
  /**
   * The task's own priority band. Absent on an event, which has no such
   * column — the card falls back to reading the band off the XP.
   */
  priority?: string;
  completed: boolean;
  /**
   * The colour family — a task's from its subject, an event's from what it was
   * given when it was made. One of the twelve in utils/eventPalette; the card
   * wears it as `data-family` and styles/calendar/palette.css does the rest.
   */
  family: Family;
  taskId?: string;
  hasConflict?: boolean;
  subtasks?: Subtask[];
  /** The stored entry, for the edit and delete dialogs. Events only. */
  section?: CalendarSection;
}

function hhmm(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function toDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Minutes past midnight, or null when the field is empty. */
function minutesOf(value: string): number | null {
  const [hours, minutes] = value.split(':').map(Number);
  if (hours === undefined || Number.isNaN(hours)) return null;
  return hours * 60 + (minutes ?? 0);
}

/**
 * The day's entries, in the order they happen.
 *
 * A task spans its creation to its deadline, so it sorts by when it starts.
 */
export function dayEntries(
  dateKey: string,
  sections: CalendarSection[],
  tasks: Task[],
): DayEntry[] {
  // The index has to be the entry's place in the *stored* list, because that
  // is what the panel's rename and retime fields write back through — so the
  // filter comes after the map, not before it. A `isDashboardTask` entry is a
  // to-do the old calendar mirrored into the store; the store drops those on
  // load now (utils/calendarStore), and this is the second lock on the same
  // door: no card for a to-do, whatever is in the file.
  const events = markConflicts(sections)
    .map((section, index) => ({
      key: `event:${index}`,
      kind: 'event' as const,
      index,
      name: section.task,
      startTime: section.startTime,
      endTime: section.endTime,
      xp: section.xp ?? 0,
      completed: Boolean(section.completed),
      family: familyForSection(section),
      hasConflict: section.hasConflict,
      subtasks: section.subtasks,
      section,
    }))
    .filter((entry) => !entry.section.isDashboardTask && !entry.section.completedTodo);

  const fromTasks: DayEntry[] = [];

  tasks.forEach((task) => {
    if (taskCalendarDay(task) !== dateKey) return;

    // Only calendar tasks reach here at all — `taskCalendarDay` places nothing
    // else — so a card always has the span the task was scheduled for.
    const start = toDate(task.created_at) || toDate(task.due_date);
    const end = toDate(task.due_date);

    fromTasks.push({
      key: `task:${task.id}`,
      kind: 'task',
      name: task.title || '',
      startTime: start ? hhmm(start) : '',
      endTime: end ? hhmm(end) : '',
      xp: Number(task.xp_value) || 0,
      priority: String(task.priority || '').toLowerCase() || undefined,
      completed: task.status === 'done',
      family: familyForSubject(task.subject),
      taskId: String(task.id),
    });
  });

  return [...events, ...fromTasks].sort(
    (a, b) =>
      (minutesOf(a.startTime) ?? minutesOf(a.endTime) ?? 0) -
      (minutesOf(b.startTime) ?? minutesOf(b.endTime) ?? 0),
  );
}

