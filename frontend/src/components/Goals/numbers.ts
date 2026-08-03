/**
 * How a goal's numbers are read — the port of the arithmetic in
 * goal.js.
 *
 * All of it is display logic over fields the backend already decides, kept in
 * one place because four different components need the same answers and a
 * second copy of "what counts as done" is how two parts of a page start
 * disagreeing.
 */
import { GOAL_FIELDS } from '@/services/constants';
import type { Goal, GoalType } from '@/types';

/** A goal with no priority set weighs the same as a middling one. */
export const DEFAULT_GOAL_WEIGHT = 5;

export interface GoalNumbers {
  goalType: GoalType;
  current: number;
  target: number;
  /** "XP", "Days", "Tasks", "Focus" — the word shown beside the figures. */
  label: string;
  progress: number;
}

/** The label the goals page shows, which is not the short unit in GOAL_FIELDS. */
const LABELS: Record<GoalType, string> = {
  xp: 'XP',
  streak: 'Days',
  tasks: 'Tasks',
  focus: 'Focus',
};

export function goalNumbers(goal: Goal): GoalNumbers {
  const goalType = goal.goal_type;
  const fields = GOAL_FIELDS[goalType];
  const current = Number(goal[fields.current as keyof Goal] ?? 0);
  const target = Number(goal[fields.target as keyof Goal] ?? 0);

  let progress = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  if (goal.status === 'completed') progress = 100;

  return { goalType, current, target, label: LABELS[goalType], progress };
}

/** Focus values are stored in minutes — shown as "1h 30m". */
export function fmtGoalValue(value: number, goalType: GoalType): string {
  if (goalType !== 'focus') return String(value);
  const total = Math.round(value);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export function goalWeight(goal: Goal): number {
  const p = Math.trunc(Number(goal.priority));
  if (!p || p < 1) return DEFAULT_GOAL_WEIGHT;
  return Math.min(10, p);
}

/**
 * 0-100. A completed goal is 100 whatever its stored numbers say — it is
 * finished, and a rounding artefact should not leave it at 99.
 */
export function goalProgressPct(goal: Goal): number {
  if (goal.status === 'completed') return 100;
  return Math.max(0, Math.min(100, goalNumbers(goal).progress || 0));
}

/**
 * The weighted mean of every goal's progress:
 *
 *     sum(progress x weight) / sum(weight)
 *
 * so a heavily weighted goal moves the bar more than a trivial one. With the
 * worked example — 60%/5, 40%/5, 80%/3, 50%/2 — that is
 * (300 + 200 + 240 + 100) / 15 = 56%.
 */
export function overallProgress(goals: Goal[]): number {
  let weighted = 0;
  let weight = 0;
  goals.forEach((g) => {
    const w = goalWeight(g);
    weighted += goalProgressPct(g) * w;
    weight += w;
  });
  return weight ? weighted / weight : 0;
}

/** An active goal whose deadline has passed. */
export function isOverdue(goal: Goal, now: number = Date.now()): boolean {
  if (!goal.deadline || goal.status !== 'active') return false;
  const at = new Date(goal.deadline).getTime();
  return !Number.isNaN(at) && at < now;
}

/**
 * When the next active deadline passes, in ms from now, or null if none will.
 *
 * The original set one `setTimeout` per goal and had to guard each against the
 * 32-bit overflow — a delay over ~24.8 days wraps and fires immediately, which
 * was flagging far-future deadlines as overdue the moment the page loaded. One
 * timer for the soonest deadline has the same effect with one place to clamp;
 * the caller re-arms after each firing.
 */
export const MAX_TIMEOUT = 0x7fffffff;

export function msUntilNextDeadline(goals: Goal[], now: number = Date.now()): number | null {
  const upcoming = goals
    .filter((g) => g.deadline && g.status === 'active')
    .map((g) => new Date(g.deadline).getTime())
    .filter((t) => !Number.isNaN(t) && t > now);
  if (!upcoming.length) return null;
  return Math.min(Math.min(...upcoming) - now, MAX_TIMEOUT);
}

/** The date under a goal, in the format the original printed. */
export function formatGoalDate(value: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
