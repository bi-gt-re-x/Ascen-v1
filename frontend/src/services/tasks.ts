/**
 * Tasks — the unit of work the whole app is built on.
 *
 * `completeTask` is the one that matters. It is a single call because the
 * backend does the whole thing in one pass: stamps the task done, records how
 * long it took and whether it beat its deadline, awards the XP, recalculates
 * the level, extends the streak, writes a row to the XP ledger and counts the
 * completion toward the user's "complete N tasks" goals. The client never
 * computes any of that — it renders what comes back.
 *
 * Backend: backend/api/tasks.py, backend/api/dashboard.py.
 */
import { del, get, post, put } from './api';
import type { ApiResult, Task, UserStats } from '@/types';

// --------------------------------------------------------------------------
// Reading
// --------------------------------------------------------------------------
export interface UserData {
  stats: UserStats;
  tasks: Task[];
}

/**
 * The dashboard's first call, and the one most other pages piggyback on.
 *
 * Reading this also decays a streak that went stale overnight, so it is the
 * call that makes every page agree on the streak.
 */
export function getUserData(username: string): Promise<ApiResult<UserData>> {
  return get<UserData>('/api/get_user_data', { username });
}

export function listTasks(username: string): Promise<ApiResult<{ tasks: Task[] }>> {
  return get<{ tasks: Task[] }>('/api/tasks', { username });
}

// --------------------------------------------------------------------------
// Writing
// --------------------------------------------------------------------------
export interface NewTask {
  name: string;
  priority?: Task['priority'];
  xp_reward?: number;
  due_date?: string | null;
  show_on_calendar?: boolean;
  /** The week calendar's drag-to-create uses this to place the block. */
  created_at?: string;
  id?: string;
}

export function createTask(
  username: string,
  task: NewTask,
): Promise<ApiResult<{ task_id: string }>> {
  return post<{ task_id: string }>('/api/tasks', { username, ...task });
}

/**
 * Edit a task. Only the fields present are written.
 *
 * `completed` is meaningful as `false` — it re-opens a finished task — so the
 * caller must leave it out rather than pass undefined when it means "don't
 * touch this".
 */
export interface TaskEdit {
  name?: string;
  priority?: Task['priority'];
  xp_reward?: number;
  timer_duration?: number;
  due_date?: string | null;
  completed?: boolean;
}

export function updateTask(
  username: string,
  taskId: string,
  edit: TaskEdit,
): Promise<ApiResult<Record<string, never>>> {
  return put(`/api/tasks/${encodeURIComponent(taskId)}`, { username, ...edit });
}

export function deleteTask(
  username: string,
  taskId: string,
): Promise<ApiResult<Record<string, never>>> {
  return del(`/api/tasks/${encodeURIComponent(taskId)}`, { username });
}

/**
 * Delete a task with no XP, streak or count side effects.
 *
 * For a terminated timer: the task never happened, so nothing about the
 * account's progression should move.
 */
export function deleteTaskWithoutTracking(
  taskId: string,
): Promise<ApiResult<Record<string, never>>> {
  return post('/api/delete_task_no_tracking', { id: taskId });
}

export function pushDueDate(
  username: string,
  taskId: string,
  dueDate: string,
): Promise<ApiResult<Record<string, never>>> {
  return post('/api/update_task_due_date', {
    id: taskId,
    username,
    due_date: dueDate,
  });
}

// --------------------------------------------------------------------------
// Status, timers, completion
// --------------------------------------------------------------------------
export function getTaskStatus(
  taskId: string,
): Promise<ApiResult<{ status: Task['status']; completed: boolean }>> {
  return post('/api/get_task_status', { task_id: taskId });
}

/** Record that a task's timer ran out before it was finished. */
export function timerExpired(
  taskId: string,
): Promise<ApiResult<{ message: string; task_id: string }>> {
  return post('/api/timer_expired', { task_id: taskId });
}

/** Everything that moves when a task is completed. */
export interface CompletionResult {
  message: string;
  xp_earned: number;
  /** XP within the new level, not the lifetime total. */
  new_xp: number;
  new_level: number;
  new_tasks_completed: number;
  xp_required: number;
  current_streak: number;
  best_streak: number;
  task_id: string;
  completion_status: 'done';
}

export function completeTask(
  username: string,
  taskId: string,
): Promise<ApiResult<CompletionResult>> {
  return post<CompletionResult>('/api/complete_task', {
    username,
    task_id: taskId,
  });
}

/**
 * The most recent completion, as `{xp, at}` where `at` is its ledger id.
 *
 * The goals page polls this so a task completed on the dashboard signals
 * through to its console — `at` changes, and that is the signal.
 */
export function lastCompletion(
  username: string,
): Promise<ApiResult<{ xp: number | null; at: string | null }>> {
  return get('/api/last_task_completion', { username });
}

// --------------------------------------------------------------------------
// Stats
// --------------------------------------------------------------------------
/** Fold a batch of XP and completions into today's single ledger row. */
export function trackDailyXp(
  username: string,
  xpEarned: number,
  tasksCompleted: number,
): Promise<ApiResult<{ message: string }>> {
  return post('/api/track_daily_xp', {
    username,
    xp_earned: xpEarned,
    tasks_completed: tasksCompleted,
  });
}
