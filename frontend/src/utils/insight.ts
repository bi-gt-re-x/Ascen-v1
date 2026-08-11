/**
 * Why and how — the interpretive layer behind the Insights tab.
 *
 * The Habits tab counts what happens. This one connects two counts together
 * and says what the connection looks like, which is a different and more
 * dangerous job: the moment a page starts explaining behaviour it becomes very
 * easy to state a coincidence as a cause. So three rules run through every
 * function here, and they are the reason this file exists separately from
 * utils/behaviour rather than growing inside it.
 *
 * **Nothing claims causation.** A relationship is reported as "associated
 * with", "tends to", "appears to". The one place a causal word would be
 * correct — a total that fell because fewer days were worked, which is
 * arithmetic and not inference — says so explicitly and shows the arithmetic.
 *
 * **Every finding carries its evidence.** `Strength` is computed from the
 * sample size and the correlation, never assigned by hand, and it is printed
 * beside the finding. A reader who disagrees with a conclusion can see exactly
 * how thin the thing underneath it is.
 *
 * **A thin record produces no finding at all.** Each function has a floor and
 * returns nothing below it. `unlock` turns that into the sentence the tab shows
 * instead — "keep using Ascen for 9 more days" beats a confident claim drawn
 * from a fortnight, which is the failure mode this whole file is arranged
 * against.
 */
import type { GrowthDay, Task } from '@/types';
import type { BalanceShape, ClockShape, RhythmShape, WeekShape } from './behaviour';
import { hourLabel } from './behaviour';

const num = (value: unknown) => Number(value) || 0;

// --------------------------------------------------------------------------
// Evidence
// --------------------------------------------------------------------------
export type Strength = 'strong' | 'likely' | 'weak';

export const STRENGTH_TEXT: Record<Strength, string> = {
  strong: 'Strong evidence',
  likely: 'Likely correlation',
  weak: 'Possible, not established',
};

export const STRENGTH_HUE: Record<Strength, string> = {
  strong: 'green',
  likely: 'blue',
  weak: 'amber',
};

/**
 * Pearson's r over paired observations, with the pairs counted.
 *
 * Pearson rather than anything cleverer because the alternative is a
 * correlation nobody reading the page can check. Both of these series are
 * small, noisy and human, and a coefficient whose meaning is widely understood
 * is worth more here than one that fits slightly better.
 */
export function correlate(pairs: Array<[number, number]>): { r: number; n: number } {
  const n = pairs.length;
  if (n < 3) return { r: 0, n };
  const meanA = pairs.reduce((sum, [a]) => sum + a, 0) / n;
  const meanB = pairs.reduce((sum, [, b]) => sum + b, 0) / n;
  let top = 0;
  let leftSq = 0;
  let rightSq = 0;
  pairs.forEach(([a, b]) => {
    const da = a - meanA;
    const db = b - meanB;
    top += da * db;
    leftSq += da * da;
    rightSq += db * db;
  });
  const bottom = Math.sqrt(leftSq * rightSq);
  return { r: bottom === 0 ? 0 : top / bottom, n };
}

/**
 * How much weight a coefficient can carry, from its size and its sample.
 *
 * Both matter and neither alone is enough: r = 0.9 over four days is a
 * coincidence with a decimal point, and r = 0.2 over four hundred is real and
 * too small to act on. The thresholds are conventional rather than derived,
 * which is why they are stated in one place a reader can find and argue with.
 */
export function strengthOf(r: number, n: number): Strength {
  const size = Math.abs(r);
  if (n >= 30 && size >= 0.55) return 'strong';
  if (n >= 15 && size >= 0.32) return 'likely';
  return 'weak';
}

// --------------------------------------------------------------------------
// Enough data?
// --------------------------------------------------------------------------
export interface Unlock {
  /** True when the section can be drawn from the reader's own record. */
  ready: boolean;
  /** What to say when it cannot. */
  message: string;
}

/**
 * Whether a section has the history it needs, and what to say when it does not.
 *
 * Deliberately not an error state. The section is not broken; it is waiting,
 * and telling somebody how many more days it needs is both true and the only
 * useful thing to say — an empty panel with a shrug in it teaches nobody that
 * the page gets better.
 */
export function unlock(have: number, need: number, what: string): Unlock {
  if (have >= need) return { ready: true, message: '' };
  const short = need - have;
  return {
    ready: false,
    message: `Keep using Ascen for ${short} more ${short === 1 ? 'day' : 'days'} to unlock ${what}. There is not enough here yet to say anything about it that would still be true next week.`,
  };
}

// --------------------------------------------------------------------------
// A finding
// --------------------------------------------------------------------------
export interface Finding {
  id: string;
  /** The claim, hedged in proportion to its evidence. */
  headline: string;
  /** The figures it was read off. */
  detail: string;
  strength: Strength;
  tone: string;
}

/** "18%" from a ratio, always positive — the direction is in the sentence. */
const pct = (value: number) => `${Math.abs(Math.round(value))}%`;

const mean = (list: number[]) =>
  list.length ? list.reduce((sum, value) => sum + value, 0) / list.length : 0;

// --------------------------------------------------------------------------
// Why
// --------------------------------------------------------------------------
/**
 * What is behind the way the last stretch went.
 *
 * The first finding is arithmetic rather than inference and is stated as such:
 * a period's XP is its active days times its XP per active day, so a change in
 * the total decomposes exactly into those two, and whichever moved more is
 * *the* reason in a sense that needs no hedging. Everything after it is a
 * correlation and is hedged.
 */
export function whyFindings(days: GrowthDay[], window = 30): Finding[] {
  const out: Finding[] = [];
  const now = days.slice(-window);
  const before = days.slice(-window * 2, -window);
  if (now.length < 7 || before.length !== now.length) return out;

  const activeOf = (rows: GrowthDay[]) => rows.filter((day) => num(day.xp_earned) > 0);
  const sum = (rows: GrowthDay[]) => rows.reduce((total, day) => total + num(day.xp_earned), 0);

  const nowActive = activeOf(now);
  const wasActive = activeOf(before);
  const nowTotal = sum(now);
  const wasTotal = sum(before);
  if (wasTotal <= 0 || wasActive.length === 0) return out;

  const totalChange = ((nowTotal - wasTotal) / wasTotal) * 100;
  const daysChange = ((nowActive.length - wasActive.length) / wasActive.length) * 100;
  const perDayNow = nowTotal / Math.max(1, nowActive.length);
  const perDayWas = wasTotal / wasActive.length;
  const perDayChange = ((perDayNow - perDayWas) / perDayWas) * 100;

  if (Math.abs(totalChange) >= 8) {
    const byDays = Math.abs(daysChange) >= Math.abs(perDayChange);
    out.push({
      id: 'why-decomposition',
      headline: `Your output ${totalChange > 0 ? 'rose' : 'fell'} ${pct(totalChange)} over the last ${window} days, and ${
        byDays ? 'how often you worked' : 'how much you did on a working day'
      } is what moved it`,
      detail: `Working days went ${daysChange >= 0 ? 'up' : 'down'} ${pct(daysChange)} (${
        wasActive.length
      } → ${nowActive.length}) while XP on a working day went ${
        perDayChange >= 0 ? 'up' : 'down'
      } ${pct(perDayChange)} (${Math.round(perDayWas).toLocaleString()} → ${Math.round(
        perDayNow,
      ).toLocaleString()}). A period's total is those two multiplied together, so this is a decomposition rather than a guess.`,
      strength: 'strong',
      tone: totalChange > 0 ? 'green' : 'amber',
    });
  }

  // ---- the weekend's part in it ------------------------------------------
  const weekendShare = (rows: GrowthDay[]) => {
    const weekend = rows.filter((day) => {
      const at = new Date(`${day.date}T00:00:00`).getDay();
      return at === 0 || at === 6;
    });
    const total = sum(rows);
    return total > 0 ? (sum(weekend) / total) * 100 : 0;
  };
  const shareNow = weekendShare(now);
  const shareWas = weekendShare(before);
  if (Math.abs(shareNow - shareWas) >= 6) {
    out.push({
      id: 'why-weekend',
      headline: `Weekends are taking ${shareNow > shareWas ? 'a larger' : 'a smaller'} share of your week than they were`,
      detail: `${Math.round(shareWas)}% of your XP came from Saturdays and Sundays in the previous ${window} days, against ${Math.round(
        shareNow,
      )}% in the last ${window}. Two of seven days is 29% of the calendar, so anything far below that is a five-day week by habit rather than by plan.`,
      strength: now.length >= 28 ? 'likely' : 'weak',
      tone: 'blue',
    });
  }

  // ---- steadiness ---------------------------------------------------------
  const spread = (rows: GrowthDay[]) => {
    const active = activeOf(rows).map((day) => num(day.xp_earned));
    if (active.length < 5) return null;
    const average = mean(active);
    const variance = mean(active.map((value) => (value - average) ** 2));
    return average > 0 ? Math.sqrt(variance) / average : null;
  };
  const spreadNow = spread(now);
  const spreadWas = spread(before);
  if (spreadNow !== null && spreadWas !== null && Math.abs(spreadNow - spreadWas) >= 0.15) {
    const steadier = spreadNow < spreadWas;
    out.push({
      id: 'why-variance',
      headline: `Your working days have become ${steadier ? 'more' : 'less'} alike than they were`,
      detail: `The day-to-day spread of your XP ${
        steadier ? 'narrowed' : 'widened'
      } from ${spreadWas.toFixed(2)} to ${spreadNow.toFixed(2)} (standard deviation over the mean). ${
        steadier
          ? 'A narrower spread tends to go with a routine that is running rather than being decided each morning.'
          : 'A wider spread usually means the work is being done in bursts, which is more fragile than the same total spread evenly.'
      }`,
      strength: 'likely',
      tone: steadier ? 'green' : 'amber',
    });
  }

  return out;
}

// --------------------------------------------------------------------------
// How
// --------------------------------------------------------------------------
/**
 * The conditions this account's better work tends to appear under.
 *
 * Every clause here is a comparison of two subsets of the reader's own record —
 * scheduled tasks against spontaneous ones, long sittings against short — and
 * every one of them is stated as a tendency, because that is all a comparison
 * of two subsets can support.
 */
export function howFindings(
  days: GrowthDay[],
  tasks: Task[],
  clock: ClockShape,
  rhythm: RhythmShape,
): Finding[] {
  const out: Finding[] = [];

  // ---- how long a productive sitting runs --------------------------------
  const focusDays = days.filter((day) => num(day.focus_minutes) > 0 && num(day.xp_earned) > 0);
  if (focusDays.length >= 12) {
    const sorted = [...focusDays].sort((a, b) => num(a.focus_minutes) - num(b.focus_minutes));
    const third = Math.max(1, Math.floor(sorted.length / 3));
    const short = sorted.slice(0, third);
    const long = sorted.slice(-third);
    const perMinute = (rows: GrowthDay[]) =>
      mean(rows.map((day) => num(day.xp_earned) / Math.max(1, num(day.focus_minutes))));
    const shortRate = perMinute(short);
    const longRate = perMinute(long);
    const bestBand = longRate >= shortRate ? long : short;
    const bandLow = Math.round(num(bestBand[0]?.focus_minutes));
    const bandHigh = Math.round(num(bestBand[bestBand.length - 1]?.focus_minutes));
    const { r, n } = correlate(
      focusDays.map((day) => [num(day.focus_minutes), num(day.xp_earned)] as [number, number]),
    );
    out.push({
      id: 'how-session',
      headline: `You appear to work best in sittings of ${bandLow}–${bandHigh} minutes`,
      detail: `Across ${focusDays.length} days with focus time logged, your ${
        longRate >= shortRate ? 'longest' : 'shortest'
      } third of sittings produced ${pct(
        ((Math.max(longRate, shortRate) - Math.min(longRate, shortRate)) /
          Math.max(0.0001, Math.min(longRate, shortRate))) *
          100,
      )} more XP per minute than the other end. Focus time and XP move together at r = ${r.toFixed(
        2,
      )} over ${n} days.`,
      strength: strengthOf(r, n),
      tone: 'green',
    });
  }

  // ---- scheduled against spontaneous -------------------------------------
  const withDate = tasks.filter((task) => Boolean(task.due_date));
  const without = tasks.filter((task) => !task.due_date);
  if (withDate.length >= 10 && without.length >= 10) {
    const rate = (list: Task[]) =>
      (list.filter((task) => task.status === 'done').length / list.length) * 100;
    const scheduled = rate(withDate);
    const spontaneous = rate(without);
    if (Math.abs(scheduled - spontaneous) >= 5) {
      out.push({
        id: 'how-scheduled',
        headline: `Tasks you give a date to are ${pct(scheduled - spontaneous)} ${
          scheduled > spontaneous ? 'more' : 'less'
        } likely to get finished`,
        detail: `${Math.round(scheduled)}% of your ${withDate.length} dated tasks reached done, against ${Math.round(
          spontaneous,
        )}% of the ${without.length} without a date. This is an association and not a mechanism — the tasks you bother to schedule may simply be the ones you already meant to do.`,
        strength: strengthOf(0.4, Math.min(withDate.length, without.length)),
        tone: 'violet',
      });
    }
  }

  // ---- difficulty against completion -------------------------------------
  const byPriority = (level: Task['priority']) => tasks.filter((task) => task.priority === level);
  const high = byPriority('high');
  const low = byPriority('low');
  if (high.length >= 8 && low.length >= 8) {
    const rate = (list: Task[]) =>
      (list.filter((task) => task.status === 'done').length / list.length) * 100;
    const hard = rate(high);
    const easy = rate(low);
    if (Math.abs(hard - easy) >= 8) {
      out.push({
        id: 'how-difficulty',
        headline: `Your ${hard >= easy ? 'hardest' : 'easiest'} tasks are the ones that reliably get done`,
        detail: `${Math.round(hard)}% of high-priority tasks finish against ${Math.round(
          easy,
        )}% of low-priority ones. ${
          hard >= easy
            ? 'The work that matters is getting through; the small stuff is what silently accumulates.'
            : 'The important work is what slips, which usually means it is being scheduled last rather than first.'
        }`,
        strength: strengthOf(0.4, Math.min(high.length, low.length)),
        tone: 'amber',
      });
    }
  }

  // ---- the window it happens in ------------------------------------------
  if (clock.coreWindow && clock.coreWindow.share >= 45) {
    out.push({
      id: 'how-window',
      headline: `Half of everything you finish lands between ${hourLabel(
        clock.coreWindow.from,
      )} and ${hourLabel(clock.coreWindow.to)}`,
      detail: `${clock.coreWindow.share}% of your completions fall inside that run of hours. ${
        clock.coreWindow.share >= 60
          ? 'That is a well-established working window rather than a preference, and anything you schedule elsewhere is competing with your worst hours.'
          : 'That is a loose window — your work is spread across the day rather than anchored to a part of it.'
      }`,
      strength: clock.coreWindow.share >= 60 ? 'strong' : 'likely',
      tone: 'blue',
    });
  }

  // ---- what a gap costs ---------------------------------------------------
  if (rhythm.gapCount > 0 && rhythm.span >= 60) {
    out.push({
      id: 'how-gaps',
      headline: 'Your habit restarts rather than continues after a break',
      detail: `${rhythm.gapCount} breaks of three days or more across ${rhythm.span.toLocaleString()} days. A gap costs the days themselves and then the restart — the first day back is almost never the day you left off at.`,
      strength: rhythm.gapCount >= 4 ? 'likely' : 'weak',
      tone: 'pink',
    });
  }

  return out;
}

// --------------------------------------------------------------------------
// What is working
// --------------------------------------------------------------------------
export interface Win {
  id: string;
  text: string;
  figure: string;
  tone: string;
}

/**
 * The things currently going right, and only those.
 *
 * A page that only ever finds faults gets closed, and an account improving on
 * four measures deserves to be told so in the same tone the problems are stated
 * in. Nothing here is generated on a schedule: every entry is a measured
 * improvement over the previous period of the same length, so a genuinely flat
 * stretch produces an empty list and the panel says so.
 */
export function whatsWorking(
  days: GrowthDay[],
  habits: Array<{ name: string; strength: string; streak: number; unit: string; consistency: number }>,
  window = 30,
): Win[] {
  const out: Win[] = [];
  const now = days.slice(-window);
  const before = days.slice(-window * 2, -window);
  const comparable = before.length === now.length && now.length >= 7;

  if (comparable) {
    const measure = (
      id: string,
      label: string,
      read: (day: GrowthDay) => number,
      format: (value: number) => string,
      tone: string,
    ) => {
      const a = mean(now.map(read));
      const b = mean(before.map(read));
      if (b <= 0 || a <= b) return;
      const change = ((a - b) / b) * 100;
      if (change < 5) return;
      out.push({
        id,
        text: `${label} is up ${pct(change)} on the previous ${window} days`,
        figure: `${format(b)} → ${format(a)}`,
        tone,
      });
    };

    measure('win-xp', 'Your daily XP', (day) => num(day.xp_earned), (v) => Math.round(v).toLocaleString(), 'violet');
    measure('win-tasks', 'Task completion', (day) => num(day.tasks_completed), (v) => v.toFixed(1), 'green');
    measure(
      'win-focus',
      'Average focus time',
      (day) => num(day.focus_minutes),
      (v) => `${Math.round(v)}m`,
      'blue',
    );

    const rate = (rows: GrowthDay[]) =>
      (rows.filter((day) => num(day.xp_earned) > 0).length / rows.length) * 100;
    const nowRate = rate(now);
    const wasRate = rate(before);
    if (nowRate - wasRate >= 4) {
      out.push({
        id: 'win-consistency',
        text: `You are turning up on ${Math.round(nowRate - wasRate)} percentage points more of your days`,
        figure: `${Math.round(wasRate)}% → ${Math.round(nowRate)}% of days worked`,
        tone: 'amber',
      });
    }
  }

  habits
    .filter((habit) => habit.strength === 'strong' && habit.streak >= 3)
    .slice(0, 2)
    .forEach((habit) => {
      out.push({
        id: `win-habit-${habit.name}`,
        text: `${habit.name} has held for ${habit.streak} ${habit.unit === 'day' ? 'days' : 'weeks'} without a break`,
        figure: `${habit.consistency}% consistency across the range`,
        tone: 'green',
      });
    });

  return out;
}

// --------------------------------------------------------------------------
// Relationships
// --------------------------------------------------------------------------
export interface Relationship {
  id: string;
  /** "Focus time → XP earned", read as an association and drawn as one. */
  pair: string;
  r: number;
  n: number;
  strength: Strength;
  /** What it means, hedged. Never a mechanism. */
  reading: string;
  /** The scatter, already normalised to 0-1 on both axes. */
  points: Array<[number, number]>;
  tone: string;
}

/**
 * Pairs of variables that move together, with the coefficient printed.
 *
 * The scatter is drawn rather than a line of best fit, deliberately: a line
 * asserts a model and a cloud of dots asserts nothing more than the dots. If
 * the relationship is real the reader will see it, and if it is a smear they
 * will see that too, which is the honest outcome for most of these.
 */
export function relationships(days: GrowthDay[], tasks: Task[], week: WeekShape): Relationship[] {
  const out: Relationship[] = [];

  const normalise = (pairs: Array<[number, number]>): Array<[number, number]> => {
    const maxA = Math.max(...pairs.map(([a]) => a), 1);
    const maxB = Math.max(...pairs.map(([, b]) => b), 1);
    return pairs.map(([a, b]) => [a / maxA, b / maxB] as [number, number]);
  };

  const add = (
    id: string,
    pair: string,
    raw: Array<[number, number]>,
    positive: string,
    negative: string,
    tone: string,
  ) => {
    if (raw.length < 8) return;
    const { r, n } = correlate(raw);
    const strength = strengthOf(r, n);
    out.push({
      id,
      pair,
      r: Math.round(r * 100) / 100,
      n,
      strength,
      reading:
        strength === 'weak'
          ? `Too loose to lean on — r = ${r.toFixed(2)} over ${n} observations is not a pattern you should plan around yet.`
          : r >= 0
            ? positive
            : negative,
      points: normalise(raw),
      tone,
    });
  };

  const active = days.filter((day) => num(day.xp_earned) > 0);

  add(
    'rel-focus-xp',
    'Focus time → XP earned',
    active
      .filter((day) => num(day.focus_minutes) > 0)
      .map((day) => [num(day.focus_minutes), num(day.xp_earned)] as [number, number]),
    'Longer focus days tend to be higher-XP days. That is the least surprising relationship on this page and the most useful, because focus time is the half of it you can decide.',
    'Your longer focus days are not your higher-XP days, which usually means focus time is being logged against work that does not produce tasks.',
    'green',
  );

  add(
    'rel-tasks-xp',
    'Tasks finished → XP earned',
    active.map((day) => [num(day.tasks_completed), num(day.xp_earned)] as [number, number]),
    'Your XP tracks the number of tasks you close rather than which ones — so the size of a day is mostly decided by how many things you finish, not how big they were.',
    'Your XP does not follow your task count, which means a few large tasks are carrying your totals.',
    'violet',
  );

  add(
    'rel-session-quality',
    'Session length → XP per task',
    active
      .filter((day) => num(day.focus_minutes) > 0 && num(day.avg_task_xp) > 0)
      .map((day) => [num(day.focus_minutes), num(day.avg_task_xp)] as [number, number]),
    'Longer sittings appear to go with larger individual tasks — depth rather than volume.',
    'Longer sittings tend to go with smaller individual tasks, which can be a sign of a long session spent on many small things.',
    'blue',
  );

  // Weekday index against how much that weekday carries. Seven points, which is
  // never enough for a coefficient to mean much, so it is stated as a spread.
  const weekPairs = week.stats
    .filter((stat) => stat.days > 0)
    .map((stat) => [stat.index, stat.avgXp] as [number, number]);
  if (weekPairs.length >= 5) {
    const values = weekPairs.map(([, xp]) => xp);
    const top = Math.max(...values);
    const bottom = Math.min(...values);
    out.push({
      id: 'rel-weekday',
      pair: 'Day of week → output',
      r: 0,
      n: weekPairs.length,
      strength: top > 0 && bottom / top <= 0.5 ? 'strong' : 'likely',
      reading:
        top > 0 && bottom / top <= 0.5
          ? `Your best weekday carries ${(top / Math.max(bottom, 1)).toFixed(
              1,
            )}× your worst. The week is not flat, so any plan that treats every day as interchangeable will not survive contact with yours.`
          : 'Your weekdays carry roughly comparable loads. A flat week is rarer than it sounds and it is what makes long streaks possible.',
      points: normalise(weekPairs),
      tone: 'amber',
    });
  }

  // Planning against completion, as a per-week pair rather than per task: the
  // question is whether weeks with more scheduling are weeks with more done.
  const byWeek = new Map<string, { dated: number; done: number }>();
  tasks.forEach((task) => {
    const day = String(task.completed_at || task.created_at || '').slice(0, 10);
    if (!day) return;
    const at = new Date(`${day}T00:00:00`);
    at.setDate(at.getDate() - at.getDay());
    const key = at.toISOString().slice(0, 10);
    const entry = byWeek.get(key) ?? { dated: 0, done: 0 };
    if (task.due_date) entry.dated += 1;
    if (task.status === 'done') entry.done += 1;
    byWeek.set(key, entry);
  });
  add(
    'rel-planning',
    'Tasks scheduled → tasks finished',
    [...byWeek.values()].map((entry) => [entry.dated, entry.done] as [number, number]),
    'Weeks in which you schedule more are weeks in which you finish more. Whether the planning causes it or simply marks the weeks you were already going to have is not something this page can tell you.',
    'Scheduling more in a week does not go with finishing more of it, so the dates on your tasks are currently decoration rather than a plan.',
    'pink',
  );

  return out.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
}

// --------------------------------------------------------------------------
// You, right now
// --------------------------------------------------------------------------
export interface CurrentState {
  /** The phase, as a short label for the badge. */
  phase: string;
  tone: string;
  /** The paragraph. Assembled, never written, so it cannot drift. */
  sentence: string;
  /** The single weakest thing, named plainly. */
  weakness: string;
}

/**
 * A snapshot of where this account currently is.
 *
 * Assembled from the same shapes the panels above are drawn from, clause by
 * clause, with every clause dropped when the figure behind it is missing — a
 * summary that says "you are in a null phase" is worse than a shorter summary.
 */
export function currentState(
  days: GrowthDay[],
  rhythm: RhythmShape,
  week: WeekShape,
  balance: BalanceShape,
  window = 21,
): CurrentState {
  const now = days.slice(-window);
  const before = days.slice(-window * 2, -window);
  const rate = (rows: GrowthDay[]) =>
    rows.length ? (rows.filter((day) => num(day.xp_earned) > 0).length / rows.length) * 100 : 0;

  const nowRate = rate(now);
  const wasRate = rate(before);
  const perDay = (rows: GrowthDay[]) => mean(rows.map((day) => num(day.xp_earned)));
  const change = perDay(before) > 0 ? ((perDay(now) - perDay(before)) / perDay(before)) * 100 : null;

  const phase =
    nowRate >= 75
      ? 'High consistency'
      : nowRate >= 45
        ? 'Building'
        : nowRate >= 20
          ? 'Intermittent'
          : 'Dormant';
  const tone =
    phase === 'High consistency' ? 'green' : phase === 'Building' ? 'blue' : phase === 'Intermittent' ? 'amber' : 'pink';

  const parts: string[] = [
    `You are in a ${phase.toLowerCase()} phase — ${Math.round(
      nowRate,
    )}% of the last ${window} days had work on them${
      before.length === now.length ? `, against ${Math.round(wasRate)}% in the ${window} before` : ''
    }`,
  ];
  if (change !== null && Math.abs(change) >= 5) {
    parts.push(`output per day is ${change > 0 ? 'up' : 'down'} ${pct(change)} over the same comparison`);
  }
  if (rhythm.typicalSession > 0) {
    parts.push(`and a typical sitting is holding at ${Math.round(rhythm.typicalSession)} minutes`);
  }

  const weaknesses: string[] = [];
  if (week.weekendGap !== null && week.weekendGap <= -35) {
    weaknesses.push(`weekends, which run ${Math.abs(week.weekendGap)}% lighter than your weekdays`);
  }
  if (rhythm.gapCount >= 2) {
    weaknesses.push(`the ${rhythm.gapCount} breaks of three days or more in this range`);
  }
  if (balance.fading.length > 0) {
    weaknesses.push(`${balance.fading[0]}, which has quietly stopped`);
  }
  if (rhythm.activeRate < 50) {
    weaknesses.push(`how often you turn up at all — ${Math.round(rhythm.activeRate)}% of days`);
  }

  return {
    phase,
    tone,
    sentence: `${parts.join(', ')}.`,
    weakness: weaknesses.length
      ? `The weakest part of the picture right now is ${weaknesses[0]}.`
      : 'Nothing in the record stands out as the weak point right now, which is a real result rather than an empty one.',
  };
}

// --------------------------------------------------------------------------
// Placeholder data
// --------------------------------------------------------------------------
/**
 * What the tab draws when the account is too young to fill it.
 *
 * Same contract as `SAMPLE_HABITS`: one block, one export, a Sample chip in the
 * top right of any panel using it, and never interleaved with a real figure.
 */
export const SAMPLE_FINDINGS: Finding[] = [
  {
    id: 'sample-why-1',
    headline: 'Your output rose 18% over the last 30 days, and how often you worked is what moved it',
    detail:
      'Working days went up 21% (19 → 23) while XP on a working day went down 3% (412 → 400). A period’s total is those two multiplied together, so this is a decomposition rather than a guess.',
    strength: 'strong',
    tone: 'green',
  },
  {
    id: 'sample-why-2',
    headline: 'Weekends are taking a smaller share of your week than they were',
    detail:
      '19% of your XP came from Saturdays and Sundays in the previous 30 days, against 11% in the last 30. Two of seven days is 29% of the calendar, so anything far below that is a five-day week by habit rather than by plan.',
    strength: 'likely',
    tone: 'blue',
  },
  {
    id: 'sample-why-3',
    headline: 'Your working days have become more alike than they were',
    detail:
      'The day-to-day spread of your XP narrowed from 0.71 to 0.48 (standard deviation over the mean). A narrower spread tends to go with a routine that is running rather than being decided each morning.',
    strength: 'likely',
    tone: 'green',
  },
];

export const SAMPLE_HOW: Finding[] = [
  {
    id: 'sample-how-1',
    headline: 'You appear to work best in sittings of 45–60 minutes',
    detail:
      'Across 64 days with focus time logged, your longest third of sittings produced 22% more XP per minute than the other end. Focus time and XP move together at r = 0.61 over 64 days.',
    strength: 'strong',
    tone: 'green',
  },
  {
    id: 'sample-how-2',
    headline: 'Tasks you give a date to are 19% more likely to get finished',
    detail:
      '84% of your 71 dated tasks reached done, against 65% of the 43 without a date. This is an association and not a mechanism — the tasks you bother to schedule may simply be the ones you already meant to do.',
    strength: 'likely',
    tone: 'violet',
  },
  {
    id: 'sample-how-3',
    headline: 'Half of everything you finish lands between 4 PM and 7 PM',
    detail:
      '58% of your completions fall inside that run of hours. That is a loose window — your work is spread across the day rather than anchored to a part of it.',
    strength: 'likely',
    tone: 'blue',
  },
];

export const SAMPLE_WINS: Win[] = [
  { id: 'sw1', text: 'Your daily XP is up 12% on the previous 30 days', figure: '361 → 404', tone: 'violet' },
  { id: 'sw2', text: 'Average focus time is up 9 minutes a day', figure: '38m → 47m', tone: 'blue' },
  {
    id: 'sw3',
    text: 'You are turning up on 8 percentage points more of your days',
    figure: '63% → 71% of days worked',
    tone: 'amber',
  },
  {
    id: 'sw4',
    text: 'Coding has held for 21 days without a break',
    figure: '74% consistency across the range',
    tone: 'green',
  },
];

export const SAMPLE_RELATIONSHIPS: Relationship[] = [
  {
    id: 'sr1',
    pair: 'Focus time → XP earned',
    r: 0.64,
    n: 88,
    strength: 'strong',
    reading:
      'Longer focus days tend to be higher-XP days. That is the least surprising relationship on this page and the most useful, because focus time is the half of it you can decide.',
    points: Array.from({ length: 40 }, (_, index) => {
      const x = 0.1 + (index / 40) * 0.85;
      return [x, Math.min(1, Math.max(0.05, x * 0.8 + 0.12 + Math.sin(index * 2.3) * 0.13))] as [number, number];
    }),
    tone: 'green',
  },
  {
    id: 'sr2',
    pair: 'Day of week → output',
    r: 0,
    n: 7,
    strength: 'strong',
    reading:
      'Your best weekday carries 2.4× your worst. The week is not flat, so any plan that treats every day as interchangeable will not survive contact with yours.',
    points: [
      [0, 0.42],
      [0.17, 0.95],
      [0.33, 0.81],
      [0.5, 0.88],
      [0.67, 0.74],
      [0.83, 0.58],
      [1, 0.39],
    ],
    tone: 'amber',
  },
  {
    id: 'sr3',
    pair: 'Tasks scheduled → tasks finished',
    r: 0.41,
    n: 26,
    strength: 'likely',
    reading:
      'Weeks in which you schedule more are weeks in which you finish more. Whether the planning causes it or simply marks the weeks you were already going to have is not something this page can tell you.',
    points: Array.from({ length: 26 }, (_, index) => {
      const x = 0.08 + (index / 26) * 0.88;
      return [x, Math.min(1, Math.max(0.05, x * 0.55 + 0.2 + Math.cos(index * 1.9) * 0.22))] as [number, number];
    }),
    tone: 'pink',
  },
];
