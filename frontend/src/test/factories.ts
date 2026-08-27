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
import type { Task, UserStats } from '@/types';

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
