/**
 * Goals — "earn N XP", "reach an N-day streak", "complete N tasks",
 * "focus N minutes".
 *
 * Two of the four track themselves and the client should not try to help. A
 * streak goal follows the account's live streak, up as it grows and back to
 * zero when it breaks; a focus goal measures time accumulated since it was
 * set. Both are re-synced by the backend on every `getGoals()`, which is why
 * that call is the way to refresh them and why polling it is how the goals
 * page stays live.
 *
 * Backend: backend/api/goals.py.
 */
import { get, post } from './api';
import type { ApiResult, Goal, GoalType } from '@/types';

export interface GoalsResult {
  goals: Goal[];
  /** Average XP per active day — the goals page's "IN PROGRESS" card. */
  avg_xp_per_day: number;
}

/** Every goal, with the self-tracking ones brought up to date first. */
export function getGoals(username: string): Promise<ApiResult<GoalsResult>> {
  return get<GoalsResult>('/api/get_goals', { username });
}

export interface NewGoal {
  title: string;
  goal_type: GoalType;
  description?: string;
  /** Only the target matching `goal_type` is required. */
  target_xp?: number;
  target_streak?: number;
  target_tasks?: number;
  target_focus?: number;
  priority?: number;
  deadline?: string;
  id?: string;
}

export function addGoal(
  username: string,
  goal: NewGoal,
): Promise<ApiResult<{ message: string }>> {
  return post('/api/add_goal', { username, ...goal });
}

/** Edit a goal. Only the fields present are written. */
export type GoalEdit = Partial<
  Pick<
    Goal,
    | 'title'
    | 'description'
    | 'status'
    | 'progress'
    | 'goal_type'
    | 'deadline'
    | 'priority'
    | 'current_xp'
    | 'current_streak'
    | 'current_tasks'
    | 'current_focus'
    | 'target_xp'
    | 'target_streak'
    | 'target_tasks'
    | 'target_focus'
  >
>;

export function updateGoal(
  username: string,
  goalId: string,
  edit: GoalEdit,
): Promise<ApiResult<Record<string, never>>> {
  return post('/api/update_goal', { id: goalId, username, ...edit });
}

export function deleteGoal(
  username: string,
  goalId: string,
): Promise<ApiResult<Record<string, never>>> {
  return post('/api/delete_goal', { goal_id: goalId, username });
}

export interface ProgressResult {
  goal_type: GoalType;
  current: number;
  target: number;
  status: Goal['status'];
  completed: boolean;
}

/**
 * Add to one goal's counter by hand, capped at its target.
 *
 * Only XP, streak and task goals can be advanced this way — a focus goal reads
 * its progress from tracked focus time and ignores a manual nudge.
 */
export function addProgress(
  goalId: string,
  amount: { xp?: number; streak?: number; tasks?: number },
): Promise<ApiResult<ProgressResult>> {
  return post<ProgressResult>('/api/update_goal_progress', {
    goal_id: goalId,
    xp_to_add: amount.xp ?? 0,
    streak_to_add: amount.streak ?? 0,
    tasks_to_add: amount.tasks ?? 0,
  });
}

export interface AppliedXp {
  updated: Array<{
    id: string;
    title: string;
    current_xp: number;
    target_xp: number;
    status: Goal['status'];
  }>;
  completed: AppliedXp['updated'];
}

/**
 * Apply a completed task's XP to every active XP goal.
 *
 * `completeTask` already does this server-side, so this is for the cases where
 * XP was earned some other way — not something to call after a completion, or
 * the XP counts twice.
 */
export function applyTaskXp(
  username: string,
  xp: number,
): Promise<ApiResult<AppliedXp>> {
  return post<AppliedXp>('/api/auto_apply_task_xp', { username, xp });
}
