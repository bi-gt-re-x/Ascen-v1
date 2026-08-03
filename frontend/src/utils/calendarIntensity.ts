/**
 * How heavy a day looks on the month grid.
 *
 * The shading is a record of the day's load, not a to-do list that empties as
 * the day goes: a task counts whether or not it has been finished. Each one
 * counts for its priority, so a day holding two hard tasks reads heavier than
 * a day holding two easy ones, and the weight is measured against the busiest
 * day of the month on screen — with a full day's work as the floor under that
 * comparison, so a quiet month does not paint its one easy task the darkest
 * navy on the map.
 *
 * Everything is counted from the database's tasks and nothing else. The
 * browser's own copy of a task holds whatever it saved the first time, which
 * is a second way for the shading to disagree with the account's real load.
 *
 * Ported from the intensity half of calendar-month.js.
 */
import { isCalendarPlaced } from './calendarGrid';
import type { Task } from '@/types';

/** What a task of each priority contributes. */
const PRIORITY_WEIGHT: Record<string, number> = { low: 1, medium: 2, high: 3 };

/** Two high-priority tasks: the weight that reads as a full day. */
const DAY_FULL_LOAD = 6;

/** A day carrying anything never fades to nothing. */
const MIN_SHADE = 12;

export interface DayLoad {
  count: number;
  weight: number;
  xp: number;
}

export interface IntensityIndex {
  byDate: Record<string, DayLoad>;
  max: number;
}

/** A date as the month grid keys it: "2026-7-4". */
function dayKeyOf(stamp: string | undefined): string | null {
  if (!stamp) return null;
  const date = new Date(stamp);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/**
 * Which day a task belongs to, or none.
 *
 * A task placed on the calendar sits on its deadline. A dashboard to-do is
 * never planned onto a day, so it sits on no day at all until it is finished —
 * and then on the day it was finished, which is when the work happened.
 */
export function taskCalendarDay(task: Task): string | null {
  if (isCalendarPlaced(task)) return dayKeyOf(task.due_date);
  return task.status === 'done' ? dayKeyOf(task.completed_at) : null;
}

/** Every task landing in this month, totalled per day. */
export function buildIntensityIndex(
  tasks: Task[],
  year: number,
  month: number,
): IntensityIndex {
  const byDate: Record<string, DayLoad> = {};

  tasks.forEach((task) => {
    const key = taskCalendarDay(task);
    if (!key) return;
    const [taskYear, taskMonth] = key.split('-').map(Number);
    if (taskYear !== year || (taskMonth ?? 0) - 1 !== month) return;

    const entry = byDate[key] ?? { count: 0, weight: 0, xp: 0 };
    entry.count += 1;
    entry.weight += PRIORITY_WEIGHT[String(task.priority || '').toLowerCase()] ?? PRIORITY_WEIGHT.medium ?? 2;
    entry.xp += Number(task.xp_value) || 0;
    byDate[key] = entry;
  });

  const max = Object.values(byDate).reduce((most, entry) => Math.max(most, entry.weight), 0);
  return { byDate, max };
}

export interface DayIntensity {
  taskCount: number;
  avgXp: number;
  /** 0 for a day carrying nothing, MIN_SHADE…100 otherwise. */
  percentage: number;
}

export function intensityFor(index: IntensityIndex, dateKey: string): DayIntensity {
  const entry = index.byDate[dateKey];
  if (!entry?.count) return { taskCount: 0, avgXp: 0, percentage: 0 };

  const reference = Math.max(index.max, DAY_FULL_LOAD);
  const percentage = Math.round((entry.weight / reference) * 100);

  return {
    taskCount: entry.count,
    avgXp: Math.round(entry.xp / entry.count),
    percentage: Math.min(100, Math.max(MIN_SHADE, percentage)),
  };
}

/** Light blue for a light day, deepening to navy as it fills. */
export function intensityBlue(percentage: number): string {
  const ratio = Math.max(0, Math.min(100, percentage)) / 100;
  const light = [158, 200, 250];
  const dark = [10, 31, 82];
  const mixed = light.map((value, index) =>
    Math.round(value + ((dark[index] ?? value) - value) * ratio),
  );
  return `rgb(${mixed[0]}, ${mixed[1]}, ${mixed[2]})`;
}

/** The day panel's bar: green through yellow to red. */
export function intensityBar(percentage: number): string {
  if (percentage >= 80) return 'linear-gradient(90deg, #ff4444, #ff6666)';
  if (percentage >= 60) return 'linear-gradient(90deg, #ffbb33, #ffcc66)';
  return 'linear-gradient(90deg, #4CAF50, #8BC34A)';
}
