/**
 * What a day is carrying, as one list.
 *
 * The month view's day panel shows events and tasks together, in the order
 * they happen. The original built that list by *writing* the tasks into the
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
import { isCalendarPlaced } from '@/utils/calendarGrid';
import { taskCalendarDay } from '@/utils/calendarIntensity';
import type { Task } from '@/types';

export interface DayEntry {
  key: string;
  kind: 'event' | 'task';
  /** Where the event sits in the day's stored list. Absent for a task. */
  index?: number;
  name: string;
  /** "HH:MM". A finished to-do has only an end — a completion is a moment. */
  startTime: string;
  endTime: string;
  xp: number;
  completed: boolean;
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
 * A task spans its creation to its deadline, so it sorts by when it starts; a
 * to-do that reached the day by being finished has only the moment it was
 * finished, so it sorts by that.
 */
export function dayEntries(
  dateKey: string,
  sections: CalendarSection[],
  tasks: Task[],
): DayEntry[] {
  const events = markConflicts(sections).map((section, index) => ({
    key: `event:${index}`,
    kind: 'event' as const,
    index,
    name: section.task,
    startTime: section.startTime,
    endTime: section.endTime,
    xp: section.xp ?? 0,
    completed: Boolean(section.completed),
    hasConflict: section.hasConflict,
    subtasks: section.subtasks,
    section,
  }));

  const fromTasks: DayEntry[] = [];

  tasks.forEach((task) => {
    if (taskCalendarDay(task) !== dateKey) return;

    const created = toDate(task.created_at);
    const due = toDate(task.due_date);
    const completed = toDate(task.completed_at);
    const placed = isCalendarPlaced(task);

    // A placed task shows the span it was scheduled for. A finished to-do
    // shows only when it was done: it was never planned onto the day.
    const start = placed ? created || due : null;
    const end = placed ? due : completed;

    fromTasks.push({
      key: `task:${task.id}`,
      kind: 'task',
      name: task.title || '',
      startTime: start ? hhmm(start) : '',
      endTime: end ? hhmm(end) : '',
      xp: Number(task.xp_value) || 0,
      completed: task.status === 'done',
      taskId: String(task.id),
    });
  });

  return [...events, ...fromTasks].sort(
    (a, b) =>
      (minutesOf(a.startTime) ?? minutesOf(a.endTime) ?? 0) -
      (minutesOf(b.startTime) ?? minutesOf(b.endTime) ?? 0),
  );
}

/** The day's completion: how many of its tasks are done, and the share. */
export function dayProgress(entries: DayEntry[]): { done: number; total: number; percent: number } {
  const counted = entries.filter((entry) => entry.kind === 'task' || entry.name.trim() !== '');
  const done = counted.filter((entry) => entry.completed).length;
  const total = counted.length;
  return {
    done,
    total,
    percent: total > 0 ? Math.round((done / total) * 100) : 0,
  };
}
