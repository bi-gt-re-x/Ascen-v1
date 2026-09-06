/**
 * Growth diagnosis — saying what a number means, not just what it is.
 *
 * "Productivity: 87" is a score, and a score is the end of a sentence nobody
 * started. It tells a reader where they rank against a scale they did not
 * choose, and gives them nothing to do on Monday. The panels this feeds say
 * the other thing:
 *
 *     Your productivity is holding, but your efficiency is falling.
 *     You are finishing 92% of the work you set yourself, and each task is
 *     taking 18% longer than your fortnightly average.
 *     → Cut the next three sittings to 40 minutes and stop on the timer.
 *
 * Three parts, and each is load-bearing. The **headline** names the tension in
 * plain words. The **detail** is the two real figures the tension is made of,
 * so the reader can check the claim rather than believe it. The **action** is
 * one thing to do differently, small enough to start today.
 *
 * ## What a diagnosis is allowed to be
 *
 * A diagnosis is always a *pair*: one measure that is holding up and one that
 * is not, or two that are moving together in a way neither shows alone. A
 * single figure moving is a trend, and the Trends tab already draws it. The
 * value here is the relationship — "more work, worse ratings" is a finding
 * about how this fortnight is being spent that neither number states on its
 * own.
 *
 * ## The rules the rules follow
 *
 * **Both sides must be real.** Every rule checks that both measures have enough
 * behind them before it fires. `MIN_TASKS`, `MIN_RATED` and `MIN_ACTIVE` are
 * the floors, and a rule whose evidence is thinner produces nothing rather than
 * a confident sentence about four tasks.
 *
 * **Nothing is invented.** Every figure printed is a count or a mean of the
 * account's own record over `utils/recent`'s fortnight, compared against the
 * fortnight before it. No projections, no scores, no scaling to 100.
 *
 * **A good diagnosis is a diagnosis.** Three of the rules fire on things going
 * *right* — difficulty rising while execution holds is the clearest signal in
 * the whole app that somebody has actually levelled up, and a page that only
 * ever reports problems is one the reader learns to dread rather than open.
 *
 * **Silence is an answer.** An account whose fortnight looks like the one
 * before it has no tension to report, and is told that rather than handed a
 * rule with the thresholds relaxed until something fired.
 */
import type { GrowthDay, Task } from '@/types';
import { isActiveDay } from './activeDay';
import { RECENT_FLOOR, mean, pctChange } from './recent';

/** Fewest finished tasks in a window before a per-task mean is worth taking. */
const MIN_TASKS = 6;

/** Fewest rated tasks before execution or difficulty is worth comparing. */
const MIN_RATED = 5;

/** Fewest active days before a per-day rate is worth comparing. */
const MIN_ACTIVE = 4;

/** Below this a percentage move is noise, not a direction. */
const MOVE = 10;

/** A larger move, for the rules that should only fire on something plain. */
const BIG_MOVE = 18;

const num = (value: unknown) => Number(value) || 0;

// ---------------------------------------------------------------------------
// Vitals — the measures a diagnosis is assembled from
// ---------------------------------------------------------------------------

/**
 * One window's worth of measures.
 *
 * Every field is either a real reading or `null`. Null means the record cannot
 * answer — no rated tasks, no task carried a due date, nothing was timed — and
 * it is deliberately not zero, because a rule that treats "nobody said" as
 * "the answer was nought" is how an account that never rates anything gets told
 * its execution has collapsed.
 */
export interface Vitals {
  days: number;
  activeDays: number;
  /** Share of days with anything on them, 0-100. */
  activeRate: number;
  xpPerActiveDay: number;
  tasksPerActiveDay: number;
  focusPerActiveDay: number;
  /** Of the work due in this window, the share finished. */
  completionRate: number | null;
  dueCount: number;
  /** Mean minutes from a task being made to being finished, where timed. */
  minutesPerTask: number | null;
  timedCount: number;
  /** Mean execution rating, 1-5. */
  execution: number | null;
  /** Mean difficulty rating, 1-5. */
  difficulty: number | null;
  ratedCount: number;
  /** Share of tasks with a deadline that beat it, 0-100. */
  deadlineRate: number | null;
  deadlineCount: number;
  finishedCount: number;
  /** The longest run of consecutive days with nothing on them. */
  longestGap: number;
}

const inRange = (iso: string | undefined, from: string, to: string) =>
  Boolean(iso) && iso!.slice(0, 10) >= from && iso!.slice(0, 10) <= to;

/**
 * Read one window's vitals off the day series and the task list.
 *
 * The day series carries the per-day totals the backend already computes; the
 * tasks carry everything the day series cannot hold — what a task was rated,
 * how long it took, whether it had a deadline and beat it. Both are scoped to
 * the same dates so the two halves of a diagnosis describe the same fortnight.
 */
export function vitals(days: GrowthDay[], tasks: Task[]): Vitals {
  const from = days[0]?.date ?? '';
  const to = days[days.length - 1]?.date ?? '';

  const active = days.filter(isActiveDay);
  const activeDays = active.length;

  /* The longest silence in the window. Counted over every day rather than the
     active ones, which is the point: a gap is made of the days that are not
     there. */
  let longestGap = 0;
  let run = 0;
  days.forEach((day) => {
    if (isActiveDay(day)) {
      run = 0;
    } else {
      run += 1;
      longestGap = Math.max(longestGap, run);
    }
  });

  const finished = tasks.filter((task) => task.status === 'done' && inRange(task.completed_at, from, to));

  /* "Planned work" is work that carried a date it was meant to be done by, and
     that date falling inside the window. A task with no due date was never
     planned for a day, so counting it as missed would make an account that
     works from a running list look permanently behind. */
  const due = tasks.filter((task) => inRange(task.due_date, from, to));
  const dueDone = due.filter((task) => task.status === 'done').length;

  const timed = finished
    .map((task) => num(task.completion_seconds))
    .filter((seconds) => seconds > 0);

  const rated = finished.filter(
    (task) => num(task.difficulty) > 0 && num(task.execution) > 0,
  );

  const withDeadline = finished.filter((task) => task.met_deadline !== undefined);
  const metDeadline = withDeadline.filter((task) => task.met_deadline === true).length;

  return {
    days: days.length,
    activeDays,
    activeRate: days.length ? (activeDays / days.length) * 100 : 0,
    xpPerActiveDay: activeDays ? mean(active.map((day) => num(day.xp_earned))) : 0,
    tasksPerActiveDay: activeDays ? mean(active.map((day) => num(day.tasks_completed))) : 0,
    focusPerActiveDay: activeDays ? mean(active.map((day) => num(day.focus_minutes))) : 0,
    completionRate: due.length >= 3 ? (dueDone / due.length) * 100 : null,
    dueCount: due.length,
    minutesPerTask: timed.length >= MIN_TASKS ? mean(timed) / 60 : null,
    timedCount: timed.length,
    execution: rated.length >= MIN_RATED ? mean(rated.map((task) => num(task.execution))) : null,
    difficulty: rated.length >= MIN_RATED ? mean(rated.map((task) => num(task.difficulty))) : null,
    ratedCount: rated.length,
    deadlineRate: withDeadline.length >= 3 ? (metDeadline / withDeadline.length) * 100 : null,
    deadlineCount: withDeadline.length,
    finishedCount: finished.length,
    longestGap,
  };
}

// ---------------------------------------------------------------------------
// The diagnosis
// ---------------------------------------------------------------------------
export type DiagnosisTone = 'good' | 'tension' | 'warning';

export interface Diagnosis {
  id: string;
  tone: DiagnosisTone;
  /** The tension, in plain words. One sentence, no figures. */
  headline: string;
  /** The two readings it is made of. This is where the numbers go. */
  detail: string;
  /** One thing to do differently, small enough to start today. */
  action: string;
  /** What the reader should watch to know whether the action worked. */
  watch: string;
  /** Ranking weight — how loudly this wants to be heard. */
  weight: number;
}

const round = (value: number) => Math.round(value);
const one = (value: number) => (Math.round(value * 10) / 10).toFixed(1);

/** "18% longer" / "12% shorter" — a signed change said as a word. */
const moreLess = (pct: number, more = 'more', less = 'less') =>
  `${round(Math.abs(pct))}% ${pct >= 0 ? more : less}`;

/**
 * Everything the fortnight supports saying, strongest first.
 *
 * `now` is the recent window and `before` the one immediately preceding it —
 * see `recentWindow` in utils/recent. Both are read from the same task list, so
 * every comparison is like against like.
 */
export function diagnose(now: Vitals, before: Vitals): Diagnosis[] {
  const found: Diagnosis[] = [];
  const enough = now.days >= RECENT_FLOOR && now.activeDays >= MIN_ACTIVE;
  if (!enough) return found;

  const push = (item: Diagnosis) => found.push(item);

  // ---- Getting through the work, but each piece costs more ---------------
  const slower =
    now.minutesPerTask !== null && before.minutesPerTask !== null
      ? pctChange(now.minutesPerTask, before.minutesPerTask)
      : null;

  if (now.completionRate !== null && now.completionRate >= 70 && slower !== null && slower >= MOVE) {
    push({
      id: 'productive-inefficient',
      tone: 'tension',
      headline: 'Your output is holding, but each task is costing more.',
      detail: `You finished ${round(now.completionRate)}% of the work you gave yourself a date for, and the average task took ${moreLess(slower, 'longer', 'less time')} than it did the fortnight before — ${round(now.minutesPerTask!)} minutes against ${round(before.minutesPerTask!)}.`,
      action: 'Put a timer on the next three sittings at your old average and stop when it goes, finished or not. A task that will not fit is two tasks.',
      watch: 'Minutes per task, back toward where it was, with the completion rate unmoved.',
      weight: 92,
    });
  }

  // ---- Doing more, finishing worse ---------------------------------------
  const volume = pctChange(now.tasksPerActiveDay, before.tasksPerActiveDay);
  const exec =
    now.execution !== null && before.execution !== null
      ? pctChange(now.execution, before.execution)
      : null;

  if (volume !== null && volume >= MOVE && exec !== null && exec <= -MOVE) {
    push({
      id: 'volume-over-quality',
      tone: 'warning',
      headline: 'You are getting through more, and rating it worse.',
      detail: `Tasks per working day are ${moreLess(volume, 'up', 'down')}, and your own execution rating fell from ${one(before.execution!)} to ${one(now.execution!)} out of 5 across ${now.ratedCount} rated tasks.`,
      action: 'Take one task off tomorrow and give the time to the hardest one left. The count is not the thing being measured.',
      watch: 'Execution back above ' + one(before.execution!) + ' without the task count collapsing.',
      weight: 95,
    });
  }

  // ---- Harder work, quality holding — the clearest good news there is -----
  const harder =
    now.difficulty !== null && before.difficulty !== null
      ? pctChange(now.difficulty, before.difficulty)
      : null;

  if (harder !== null && harder >= MOVE && exec !== null && exec >= -4) {
    push({
      id: 'levelling-up',
      tone: 'good',
      headline: 'You have moved up a level of difficulty without losing quality.',
      detail: `The work you rated got harder — ${one(before.difficulty!)} to ${one(now.difficulty!)} out of 5 — and your execution held at ${one(now.execution!)}. That is the pattern that actually means improvement rather than practice.`,
      action: 'Keep the difficulty and stop adding volume. This is the fortnight to repeat, not to beat.',
      watch: 'Difficulty steady at ' + one(now.difficulty!) + ' for another fortnight before you push again.',
      weight: 88,
    });
  }

  // ---- Avoiding the hard work --------------------------------------------
  if (harder !== null && harder <= -MOVE && now.ratedCount >= MIN_RATED) {
    push({
      id: 'drifting-easy',
      tone: 'warning',
      headline: 'The work is getting easier, and that is a choice you did not make on purpose.',
      detail: `Average difficulty fell from ${one(before.difficulty!)} to ${one(now.difficulty!)} out of 5 over ${now.ratedCount} rated tasks, while you kept finishing about as many. Easy work still pays XP, which is exactly why this is hard to notice.`,
      action: 'Put one task you expect to rate 4 or 5 for difficulty at the top of tomorrow, before anything else.',
      watch: 'At least one task a day rated 4+ for difficulty this week.',
      weight: 84,
    });
  }

  // ---- Showing up, but the sittings are thinning -------------------------
  const perDay = pctChange(now.xpPerActiveDay, before.xpPerActiveDay);
  if (now.activeRate >= 75 && perDay !== null && perDay <= -MOVE) {
    push({
      id: 'present-but-thin',
      tone: 'tension',
      headline: 'You are turning up every day, and doing less each time.',
      detail: `You worked on ${now.activeDays} of ${now.days} days — ${round(now.activeRate)}% — but a working day is now worth ${round(now.xpPerActiveDay)} XP against ${round(before.xpPerActiveDay)} before, ${moreLess(perDay, 'more', 'less')}.`,
      action: 'The streak is safe; spend it. Pick two days this week and give one of them a proper long sitting instead of the daily minimum.',
      watch: 'XP on your two best days, not the number of days.',
      weight: 80,
    });
  }

  // ---- Cramming: same output, fewer days ---------------------------------
  const attendance = pctChange(now.activeRate, before.activeRate);
  if (attendance !== null && attendance <= -MOVE && perDay !== null && perDay >= MOVE) {
    push({
      id: 'cramming',
      tone: 'tension',
      headline: 'The same work, packed into fewer days.',
      detail: `You worked ${now.activeDays} days of ${now.days} against ${before.activeDays} before, and each of those days carried ${moreLess(perDay, 'more', 'less')} XP. The total held; the spread did not.`,
      action: 'Move one task off your heaviest day onto the emptiest one. Spread beats intensity for anything you intend to remember.',
      watch: 'Working days back above ' + round(before.activeRate) + '% with the daily total roughly where it is.',
      weight: 78,
    });
  }

  // ---- Longer sessions, no more to show for them -------------------------
  const focus = pctChange(now.focusPerActiveDay, before.focusPerActiveDay);
  if (focus !== null && focus >= BIG_MOVE && perDay !== null && Math.abs(perDay) < MOVE && now.focusPerActiveDay > 20) {
    push({
      id: 'time-without-return',
      tone: 'warning',
      headline: 'You are putting in more time and getting the same back.',
      detail: `Focus is ${moreLess(focus, 'up', 'down')} — ${round(now.focusPerActiveDay)} minutes a working day against ${round(before.focusPerActiveDay)} — and the XP those days earn has not moved. The extra time is going somewhere that is not finished work.`,
      action: 'Time one session end to end and write down where the first twenty minutes went. It is usually the start, not the middle.',
      watch: 'XP per working day rising while focus minutes stay where they are.',
      weight: 82,
    });
  }

  // ---- Deadlines slipping -------------------------------------------------
  const deadlines =
    now.deadlineRate !== null && before.deadlineRate !== null
      ? now.deadlineRate - before.deadlineRate
      : null;

  if (now.deadlineRate !== null && now.deadlineRate < 60 && deadlines !== null && deadlines <= -MOVE) {
    push({
      id: 'deadlines-slipping',
      tone: 'warning',
      headline: 'You are finishing the work, and finishing it late.',
      detail: `${round(now.deadlineRate)}% of the ${now.deadlineCount} dated tasks you closed beat their date, down from ${round(before.deadlineRate!)}%. The work is getting done; the dates are not describing it any more.`,
      action: 'For the next week, put the date a day earlier than you mean it, or stop putting dates on the tasks that do not really have one.',
      watch: 'The share beating their date, back over 60%.',
      weight: 86,
    });
  }

  // ---- The gap ------------------------------------------------------------
  if (now.longestGap >= 3 && now.activeRate < 70) {
    push({
      id: 'gap',
      tone: 'tension',
      headline: 'The problem is not the working days, it is the ones between them.',
      detail: `Your longest silence this fortnight ran ${now.longestGap} days, and you worked ${round(now.activeRate)}% of days overall. On the days you did work you averaged ${round(now.xpPerActiveDay)} XP, which is not the behaviour of somebody who has lost interest.`,
      action: 'Put one fifteen-minute task on the day after your next working day. Closing the gap is worth more than lengthening the session.',
      watch: 'Longest gap under three days.',
      weight: 90,
    });
  }

  // ---- Everything holding -------------------------------------------------
  if (
    found.length === 0 &&
    now.activeRate >= 60 &&
    volume !== null &&
    Math.abs(volume) < MOVE &&
    now.finishedCount >= MIN_TASKS
  ) {
    push({
      id: 'steady',
      tone: 'good',
      headline: 'Nothing is pulling against anything else.',
      detail: `${now.finishedCount} tasks over ${now.activeDays} working days, at ${round(now.xpPerActiveDay)} XP a day, and neither the pace nor the ratings moved more than a rounding error from the fortnight before.`,
      action: 'This is the baseline to change something against. Pick one thing — difficulty, or a subject you have been avoiding — and move only that.',
      watch: 'Whichever one thing you change, against these figures.',
      weight: 40,
    });
  }

  return found.sort((a, b) => b.weight - a.weight);
}
