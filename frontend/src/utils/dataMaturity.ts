/**
 * How much this account has actually told us, and what that earns.
 *
 * ## The bug this exists to fix
 *
 * Every gate on the analytics page counted `growth_data.length`. That array is
 * built by backend/tracking/growth.py, which walks *every calendar day* from
 * the account's creation to today and pads the empty ones with zeros — so its
 * length is the account's age and nothing else. An account opened five weeks
 * ago and used twice passed a gate that says it needs twenty-one days of
 * record, and got a page of confident analysis drawn over two days of data.
 *
 * So the number every gate reads is `activeDays`: days with something recorded
 * on them. Calendar age is still computed, as `spanDays`, because "you have
 * been here five weeks" is worth saying — but it is context, never a gate.
 *
 * ## Stages, and why they are floors rather than ranges
 *
 * Five, and a stage is simply the highest floor an account has reached. That
 * shape matters: a reader who works nine days in a fortnight and then stops
 * for a month does not fall back to `early`, because nothing they learned
 * about themselves became untrue. Data does not expire, so stages do not
 * either — the only direction is up.
 *
 * `full` is the existing analytics page, unchanged and unqualified. Everything
 * below it is the same page with the parts that cannot be honest yet replaced
 * by the reason they cannot. Nothing here computes an analysis; it decides
 * which analyses have enough behind them to be worth drawing.
 */
import type { GrowthDay } from '@/types';

/**
 * The five stages, and the active-day count each one starts at.
 *
 * The numbers are the brief — day 3, 7, 14, 30 — read as days of real work
 * rather than days on the calendar, which is the whole point. They are
 * deliberately the same figures a reader would have been told, because the
 * promise "a week of use" is a promise about their effort, not about the
 * Earth's rotation.
 */
export const STAGE_FLOOR = {
  new: 0,
  early: 3,
  weekly: 7,
  developing: 14,
  full: 30,
} as const;

export type Stage = keyof typeof STAGE_FLOOR;

/** Weakest first. The order is load-bearing: `stageFor` walks it downward. */
export const STAGES: Stage[] = ['new', 'early', 'weekly', 'developing', 'full'];

/** What each stage is called where a reader can see it. */
export const STAGE_LABEL: Record<Stage, string> = {
  new: 'Getting started',
  early: 'Early insight',
  weekly: 'Weekly trends',
  developing: 'Developing profile',
  full: 'Full analytics',
};

export interface Maturity {
  /** Days with something recorded on them. The figure every gate reads. */
  activeDays: number;
  /**
   * Calendar days from the first recorded day to the last row of the series.
   *
   * Context only. An account with thirty of these and four active days knows
   * less than one with eight of each, and the gates have to agree with that.
   */
  spanDays: number;
  stage: Stage;
  /** The next stage up, or null once there is nothing above. */
  next: Stage | null;
  /** Active days still needed to reach it. Null at `full`. */
  toNext: number | null;
  /** How far through the current stage toward the next, 0-1. 1 at `full`. */
  progress: number;
  /** The most recent day with anything on it, ISO. Null on an empty record. */
  lastActive: string | null;
}

/**
 * Whether a day counts.
 *
 * Any of the three, because they are three ways of doing the same thing and an
 * account that logs focus without finishing tasks is still telling us about
 * itself. `rated_tasks` is deliberately *not* here: the rating prompt is
 * optional, so requiring it would make a gate out of a question the reader is
 * allowed to ignore.
 */
export function isActiveDay(day: GrowthDay): boolean {
  return (
    (Number(day.tasks_completed) || 0) > 0 ||
    (Number(day.focus_minutes) || 0) > 0 ||
    (Number(day.xp_earned) || 0) > 0
  );
}

/** The highest floor `activeDays` has reached. */
export function stageFor(activeDays: number): Stage {
  for (let index = STAGES.length - 1; index >= 0; index -= 1) {
    const stage = STAGES[index]!;
    if (activeDays >= STAGE_FLOOR[stage]) return stage;
  }
  return 'new';
}

/** Whole days between two ISO dates, or 0 when either will not parse. */
function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from.slice(0, 10)}T00:00:00`);
  const end = Date.parse(`${to.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

export function dataMaturity(days: GrowthDay[]): Maturity {
  const active = days.filter(isActiveDay);
  const activeDays = active.length;
  const stage = stageFor(activeDays);

  const at = STAGES.indexOf(stage);
  const next = at < STAGES.length - 1 ? STAGES[at + 1]! : null;
  const toNext = next ? Math.max(0, STAGE_FLOOR[next] - activeDays) : null;

  /* Through the current stage, not through the whole ladder. A bar that
     measures the distance to `full` sits almost empty for a fortnight and
     tells a reader on day six that they have barely begun, which is both
     discouraging and false — they are one day from the next thing opening. */
  const floor = STAGE_FLOOR[stage];
  const ceiling = next ? STAGE_FLOOR[next] : floor;
  const progress = next && ceiling > floor ? (activeDays - floor) / (ceiling - floor) : 1;

  const first = active[0]?.date ?? null;
  const lastRow = days[days.length - 1]?.date ?? null;

  return {
    activeDays,
    spanDays: first && lastRow ? daysBetween(first, lastRow) + 1 : 0,
    stage,
    next,
    toNext,
    progress: Math.max(0, Math.min(1, progress)),
    lastActive: active[active.length - 1]?.date ?? null,
  };
}
