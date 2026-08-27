/**
 * Sample rows, shaped like the ones the backend returns.
 *
 * A factory rather than literals inline, for one reason that matters: `Task`
 * has fourteen fields and the functions under test read four of them, so a
 * literal per test is twelve lines of noise around the one value the test is
 * about. `task({ status: 'done', completed_at: '...' })` says what the case is.
 *
 * The defaults are a plain open task with no due date and no subject. Every
 * test overrides exactly what it cares about, so a default that changes cannot
 * quietly change what a test means.
 */
import type { GrowthDay, Task, UserStats } from '@/types';

let counter = 0;

export function task(overrides: Partial<Task> = {}): Task {
  counter += 1;
  return {
    id: `task-${counter}`,
    user_id: 'user-1',
    title: `Task ${counter}`,
    description: '',
    priority: 'low',
    status: 'todo',
    xp_value: 20,
    created_at: '2026-07-01T09:00:00',
    ...overrides,
  };
}

export function stats(overrides: Partial<UserStats> = {}): UserStats {
  return {
    level: 4,
    xp: 640,
    tasks_completed: 12,
    current_streak: 3,
    best_streak: 9,
    charge: 0,
    ...overrides,
  };
}

/**
 * A run of consecutive days, as the growth series returns them.
 *
 * `from` is the first day and `count` the length. Every figure is zero unless
 * the caller says otherwise — the tests that use this care about the *dates*,
 * which is what the windowing and the follow-up slice on.
 */
export function days(from: string, count: number, over: Partial<GrowthDay> = {}): GrowthDay[] {
  const start = new Date(`${from}T00:00:00`);
  return Array.from({ length: count }, (_, index) => {
    const at = new Date(start);
    at.setDate(at.getDate() + index);
    const iso = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(
      at.getDate(),
    ).padStart(2, '0')}`;
    return {
      date: iso,
      day_number: index + 1,
      xp_earned: 0,
      tasks_completed: 0,
      cumulative_xp: 0,
      avg_task_xp: 0,
      focus_minutes: 0,
      cumulative_focus_minutes: 0,
      ...over,
    } as GrowthDay;
  });
}
