/**
 * Goal health — is this actually going to happen?
 *
 * ## Why a percentage is not an answer
 *
 * The obvious way to colour a goal is by how complete it is, and it is wrong
 * in both directions. A goal 40% done with 60% of its time left is fine. A
 * goal 70% done with a week to go is not. Completion says where you are;
 * health has to say whether where you are is good enough given when you are,
 * and those are different questions.
 *
 * So health is a blend, and no single signal can carry it:
 *
 *   pace         progress against the share of the time that has gone
 *   recency      how long since anything happened toward it
 *   consistency  how much of the recent fortnight had work on it
 *   depth        how much of the plan — the checkpoints — is behind you
 *
 * The weights are declared in `WEIGHTS` and add to one. A goal that is ahead
 * of pace but has been untouched for three weeks does not read green, and a
 * goal that is behind pace but worked on every day does not read red — both of
 * those are the failure of a one-metric model and both are common.
 *
 * ## What counts as evidence
 *
 * Recency and consistency are counted off the *tasks linked to the goal*, not
 * off the account's activity as a whole. That distinction is the point of the
 * link: an account can be busy every day and still be doing nothing about the
 * goal it is worried about, and a health model that could not tell those apart
 * would be measuring the person rather than the plan.
 *
 * ## What this file does not do
 *
 * It does not turn tasks into progress. Forty linked tasks and four checkpoints
 * do not make one finished task 2.5% of a goal — see the note at the top of
 * backend/api/goals.py. Tasks are evidence that the work is happening, which is
 * exactly what health is about and exactly what a percentage is not.
 */
import { goalNumbers } from '@/components/Goals/numbers';
import type { Goal, Task } from '@/types';

export type HealthState = 'on-track' | 'at-risk' | 'off-track' | 'not-started';

/**
 * How much each signal is worth.
 *
 * Pace is the largest because it is the only one that knows about the
 * deadline, and a deadline is what makes a goal a goal rather than a wish.
 * Recency is second because the most common way a goal fails is quietly:
 * nothing goes wrong, it simply stops being worked on.
 *
 * When a goal has no deadline, pace cannot be computed at all — there is no
 * "should be here by now" — and its weight is shared out across the other
 * three rather than scored as zero. Scoring it zero would mark every
 * open-ended goal as failing, which is the opposite of true: a goal with no
 * date is one nothing is late for.
 */
const WEIGHTS = { pace: 0.42, recency: 0.26, consistency: 0.16, depth: 0.16 };

/** Above this a goal reads green; above the second it reads amber. */
const ON_TRACK = 0.66;
const AT_RISK = 0.4;

/** The window recency and consistency are measured over. */
const EVIDENCE_DAYS = 14;

/**
 * How far ahead of pace still counts as "ahead".
 *
 * Being twice as far along as the clock says is not twice as healthy as being
 * exactly on pace, so the ratio is capped before it is scored. Without the cap
 * a goal finished early would drown out every other signal for the rest of its
 * life.
 */
const PACE_CEILING = 1.25;

export interface HealthSignals {
  /** 0-1, how much of the goal is done. */
  progress: number;
  /** 0-1, how much of its time has gone. Null with no deadline. */
  expected: number | null;
  /** progress − expected, in points. Null with no deadline. */
  ahead: number | null;
  /** 0-1, decaying from the last day work was recorded against it. */
  recency: number;
  /** 0-1, the share of the last fortnight with work on it. */
  consistency: number;
  /** 0-1, checkpoints completed. Falls back to progress when there are none. */
  depth: number;
  daysLeft: number | null;
  daysTotal: number | null;
  /** Days since the last linked task was finished. Null if never. */
  daysSinceWork: number | null;
  /** Linked tasks finished inside the evidence window. */
  recentTasks: number;
}

export interface GoalHealth {
  state: HealthState;
  label: string;
  /** 0-100. What the state was decided from. */
  score: number;
  /** One line, for the card. The weakest signal, named. */
  reason: string;
  signals: HealthSignals;
}

const LABELS: Record<HealthState, string> = {
  'on-track': 'On Track',
  'at-risk': 'At Risk',
  'off-track': 'Off Track',
  'not-started': 'Not Started',
};

const DAY = 86_400_000;

function atMidnight(value: string): number | null {
  if (!value) return null;
  const time = new Date(`${String(value).slice(0, 10)}T00:00:00`).getTime();
  return Number.isNaN(time) ? null : time;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** The tasks explicitly pointed at this goal. */
export function tasksFor(goal: Goal, tasks: Task[]): Task[] {
  return tasks.filter((task) => task.goal_id === goal.id);
}

/**
 * The work that counts as evidence this goal is being pursued.
 *
 * Not the same as the tasks linked to it, and the difference matters. The four
 * counter goals are fed by the app from *every* completed task — an XP goal
 * advances on any task at all, and a streak or focus goal advances on the
 * account simply being used — so judging one by its links would mark a goal
 * that is visibly filling up as abandoned, because nobody ever linked anything
 * to a goal that does not need it.
 *
 * An outcome goal is the opposite case. Nothing feeds it automatically, so the
 * only thing that says work is happening is work someone pointed at it, and
 * counting the account's general activity there would let a busy fortnight on
 * everything else make a neglected goal look healthy. That is the exact
 * failure this whole model exists to avoid.
 */
export function evidenceFor(goal: Goal, tasks: Task[]): Task[] {
  const measure = goalNumbers(goal).measure;
  if (measure === 'number' || measure === 'milestones') return tasksFor(goal, tasks);
  return tasks;
}

/** The days, most recent first, that a linked task was finished on. */
function workDays(linked: Task[]): string[] {
  const days = new Set<string>();
  linked.forEach((task) => {
    const day = String(task.completed_at || '').slice(0, 10);
    if (day) days.add(day);
  });
  return [...days].sort().reverse();
}

/**
 * Everything known about whether a goal is going to happen.
 *
 * `today` is passed in rather than read from the clock so the whole model is a
 * pure function of its inputs — which is what makes it checkable.
 */
export function goalHealth(
  goal: Goal,
  tasks: Task[],
  today: Date = new Date(),
): GoalHealth {
  const numbers = goalNumbers(goal);
  const progress = clamp01(numbers.progress / 100);
  const linked = evidenceFor(goal, tasks);
  const done = linked.filter((task) => task.status === 'done' && task.completed_at);
  const days = workDays(done);

  const now = atMidnight(today.toISOString()) ?? today.getTime();
  const start = atMidnight(goal.start_date) ?? atMidnight(goal.created_at);
  const end = atMidnight(goal.deadline);

  const daysTotal = start !== null && end !== null ? Math.round((end - start) / DAY) : null;
  const daysLeft = end !== null ? Math.round((end - now) / DAY) : null;

  // How much of the time has gone. Clamped at 1: a goal past its deadline has
  // used all of its time, not 140% of it, and the overdue case is handled
  // outright below rather than by an ever-growing expectation.
  const expected =
    daysTotal !== null && daysTotal > 0 && start !== null
      ? clamp01((now - start) / (daysTotal * DAY))
      : null;

  const lastDay = days[0] ? atMidnight(days[0]) : null;
  const daysSinceWork = lastDay !== null ? Math.round((now - lastDay) / DAY) : null;

  // Full marks the day work happens, nothing left after a fortnight of
  // silence. Linear because the thing being measured is "how stale is this",
  // and a reader's sense of that is linear too.
  const recency =
    daysSinceWork === null ? 0 : clamp01(1 - daysSinceWork / EVIDENCE_DAYS);

  const recentTasks = done.filter((task) => {
    const at = atMidnight(String(task.completed_at));
    return at !== null && now - at < EVIDENCE_DAYS * DAY;
  }).length;

  const activeRecently = days.filter((day) => {
    const at = atMidnight(day);
    return at !== null && now - at < EVIDENCE_DAYS * DAY;
  }).length;
  const consistency = clamp01(activeRecently / EVIDENCE_DAYS);

  const milestones = goal.milestones ?? [];
  const depth = milestones.length
    ? milestones.filter((row) => row.status === 'done').length / milestones.length
    : progress;

  const ahead = expected === null ? null : progress - expected;

  const signals: HealthSignals = {
    progress,
    expected,
    ahead,
    recency,
    consistency,
    depth,
    daysLeft,
    daysTotal,
    daysSinceWork,
    recentTasks,
  };

  // ---- The states that are not a score ----------------------------------
  if (goal.status === 'completed' || progress >= 1) {
    return { state: 'on-track', label: 'Complete', score: 100, reason: 'Reached.', signals };
  }

  // Nothing has happened at all. Not a judgement — a goal set this morning is
  // not failing, and coluring it red would teach the reader to ignore the
  // colour.
  if (progress <= 0 && done.length === 0 && depth <= 0) {
    return {
      state: 'not-started',
      label: LABELS['not-started'],
      score: 0,
      reason: 'Nothing recorded against this yet.',
      signals,
    };
  }

  // Past its date and not finished. No blend is going to talk its way out of
  // that, and a green chip on an overdue goal is the page lying.
  if (daysLeft !== null && daysLeft < 0) {
    return {
      state: 'off-track',
      label: LABELS['off-track'],
      score: Math.round(progress * 100 * 0.3),
      reason: `Its date passed ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} ago and it is ${Math.round(progress * 100)}% done.`,
      signals,
    };
  }

  // ---- The blend ---------------------------------------------------------
  const paceScore =
    expected === null || expected <= 0
      ? null
      : clamp01(progress / expected / PACE_CEILING);

  let score: number;
  if (paceScore === null) {
    // No deadline: pace's weight goes to the other three in their own
    // proportions, rather than being scored as a zero nobody earned.
    const rest = WEIGHTS.recency + WEIGHTS.consistency + WEIGHTS.depth;
    score =
      (recency * WEIGHTS.recency + consistency * WEIGHTS.consistency + depth * WEIGHTS.depth) /
      rest;
  } else {
    score =
      paceScore * WEIGHTS.pace +
      recency * WEIGHTS.recency +
      consistency * WEIGHTS.consistency +
      depth * WEIGHTS.depth;
  }

  const state: HealthState =
    score >= ON_TRACK ? 'on-track' : score >= AT_RISK ? 'at-risk' : 'off-track';

  return {
    state,
    label: LABELS[state],
    score: Math.round(score * 100),
    reason: reasonFor(state, signals),
    signals,
  };
}

/**
 * The line under the chip.
 *
 * Whichever signal is worst, said plainly — because "At Risk" on its own is a
 * colour and not information, and the reader's next question is always the
 * same one. A green goal gets the reason it is green for the same reason: the
 * page should be arguable, not oracular.
 */
function reasonFor(state: HealthState, signals: HealthSignals): string {
  const { ahead, daysLeft, daysSinceWork, consistency, recentTasks } = signals;
  const pct = Math.round(signals.progress * 100);

  if (state === 'on-track') {
    if (ahead !== null && ahead > 0.08) {
      return `${pct}% done with ${Math.round((1 - (signals.expected ?? 0)) * 100)}% of the time left — ahead of pace.`;
    }
    if (recentTasks > 0) {
      return `${pct}% done, and worked on ${recentTasks} time${recentTasks === 1 ? '' : 's'} in the last fortnight.`;
    }
    return `${pct}% done and keeping pace.`;
  }

  // The worst signal is the one worth printing.
  if (daysSinceWork === null) {
    return 'No task has been linked to this yet, so there is nothing to judge the pace by.';
  }
  if (daysSinceWork >= 7) {
    return `Nothing has been done toward this in ${daysSinceWork} days.`;
  }
  if (ahead !== null && ahead < -0.1) {
    const behind = Math.round(Math.abs(ahead) * 100);
    return daysLeft !== null && daysLeft >= 0
      ? `${behind} points behind where the calendar says it should be, with ${daysLeft} days left.`
      : `${behind} points behind pace.`;
  }
  if (consistency < 0.15) {
    return `Only worked on ${Math.round(consistency * EVIDENCE_DAYS)} of the last ${EVIDENCE_DAYS} days.`;
  }
  return `${pct}% done, and the pace is not yet enough for the date on it.`;
}

/**
 * What the goal needs per day from here, against what it is getting.
 *
 * Only meaningful for a goal with a number and a date. The "have" figure is
 * measured from the goal's own start rather than from the whole account,
 * because a goal set in March should not be credited with February.
 */
export interface GoalPace {
  /** Units a day required to finish on time. Null without a date or target. */
  need: number | null;
  /** Units a day it has actually been moving at since it started. */
  have: number | null;
  /** Where it lands at the current rate, as an ISO day. Null if never. */
  lands: string | null;
  /** Days late (positive) or early (negative) that projection is. */
  drift: number | null;
}

export function goalPace(goal: Goal, today: Date = new Date()): GoalPace {
  const numbers = goalNumbers(goal);
  const empty: GoalPace = { need: null, have: null, lands: null, drift: null };
  if (!numbers.target) return empty;

  const now = atMidnight(today.toISOString()) ?? today.getTime();
  const start = atMidnight(goal.start_date) ?? atMidnight(goal.created_at);
  const end = atMidnight(goal.deadline);
  if (start === null) return empty;

  const elapsed = Math.max(1, Math.round((now - start) / DAY));
  const remaining = numbers.target - numbers.current;
  const have = numbers.current / elapsed;
  const daysLeft = end === null ? null : Math.round((end - now) / DAY);
  const need = daysLeft !== null && daysLeft > 0 ? remaining / daysLeft : null;

  if (remaining <= 0) {
    return { need, have, lands: new Date(now).toISOString().slice(0, 10), drift: null };
  }
  if (have <= 0) return { need, have, lands: null, drift: null };

  const daysNeeded = Math.ceil(remaining / have);
  const landing = new Date(now + daysNeeded * DAY);
  return {
    need,
    have,
    lands: landing.toISOString().slice(0, 10),
    drift: end === null ? null : Math.round((landing.getTime() - end) / DAY),
  };
}
