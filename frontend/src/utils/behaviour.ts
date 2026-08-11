/**
 * What the account's own record says about how this person works.
 *
 * The growth and analytics pages answer *how much* — totals, trajectories,
 * whether this stretch beat the last one. This answers *how*: which days carry
 * the work, what hour it happens at, how long a sitting lasts, how long the
 * gaps run, and whether effort is spread across subjects or piled on one.
 *
 * Two pages read it and they read it for opposite reasons. Insights states the
 * findings; Recommendations turns the same numbers into things to do
 * differently. Keeping the arithmetic here is what stops the two pages from
 * quietly disagreeing — a recommendation that contradicts the insight it was
 * derived from is the failure mode this module exists to prevent.
 *
 * Everything is derived from the day series and the account's tasks. Nothing
 * here is invented, and where the record cannot answer a question the function
 * says so with a null rather than guessing.
 */
import type { GrowthDay, Task } from '@/types';

const num = (value: unknown) => Number(value) || 0;

/** Sunday first, matching every other weekday list in the app. */
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// --------------------------------------------------------------------------
// The week
// --------------------------------------------------------------------------
export interface WeekdayStat {
  index: number;
  label: string;
  /** XP per occurrence of this weekday, not summed. */
  avgXp: number;
  avgFocusMinutes: number;
  /** Share of this weekday that had anything on it, 0-100. */
  activeRate: number;
  days: number;
}

/**
 * Each weekday averaged over its own occurrences.
 *
 * Averaged rather than totalled, and this is the one rule that matters here: a
 * ninety-day range holds thirteen Mondays and twelve Sundays, so a total makes
 * the extra Monday look like a preference. Per occurrence, the comparison is
 * about the day and not about the calendar.
 */
export function weekdayProfile(days: GrowthDay[]): WeekdayStat[] {
  const buckets = Array.from({ length: 7 }, () => ({ xp: 0, focus: 0, active: 0, days: 0 }));

  days.forEach((day) => {
    const at = new Date(`${day.date}T00:00:00`).getDay();
    const bucket = buckets[at]!;
    bucket.xp += num(day.xp_earned);
    bucket.focus += num(day.focus_minutes);
    bucket.days += 1;
    if (num(day.xp_earned) > 0) bucket.active += 1;
  });

  return buckets.map((bucket, index) => ({
    index,
    label: WEEKDAYS[index]!,
    avgXp: bucket.days ? bucket.xp / bucket.days : 0,
    avgFocusMinutes: bucket.days ? bucket.focus / bucket.days : 0,
    activeRate: bucket.days ? (bucket.active / bucket.days) * 100 : 0,
    days: bucket.days,
  }));
}

export interface WeekShape {
  stats: WeekdayStat[];
  best: WeekdayStat | null;
  worst: WeekdayStat | null;
  /** Weekday average against weekend average, as a percentage difference. */
  weekendGap: number | null;
  /** How lopsided the week is: the best day over the average day. */
  spread: number;
}

export function weekShape(days: GrowthDay[]): WeekShape {
  const stats = weekdayProfile(days);
  const withDays = stats.filter((stat) => stat.days > 0);
  if (withDays.length === 0) {
    return { stats, best: null, worst: null, weekendGap: null, spread: 1 };
  }

  const best = withDays.reduce((a, b) => (b.avgXp > a.avgXp ? b : a));
  const worst = withDays.reduce((a, b) => (b.avgXp < a.avgXp ? b : a));
  const mean = withDays.reduce((sum, stat) => sum + stat.avgXp, 0) / withDays.length;

  const pick = (indices: number[]) => {
    const chosen = stats.filter((stat) => indices.includes(stat.index) && stat.days > 0);
    if (chosen.length === 0) return null;
    return chosen.reduce((sum, stat) => sum + stat.avgXp, 0) / chosen.length;
  };
  const weekend = pick([0, 6]);
  const weekday = pick([1, 2, 3, 4, 5]);

  return {
    stats,
    best,
    worst,
    weekendGap:
      weekend !== null && weekday !== null && weekday > 0
        ? Math.round(((weekend - weekday) / weekday) * 100)
        : null,
    spread: mean > 0 ? best.avgXp / mean : 1,
  };
}

// --------------------------------------------------------------------------
// The clock
// --------------------------------------------------------------------------
export interface HourStat {
  hour: number;
  label: string;
  tasks: number;
  xp: number;
}

export interface ClockShape {
  hours: HourStat[];
  peak: HourStat | null;
  /** The narrowest run of hours holding half the finished work. */
  coreWindow: { from: number; to: number; share: number } | null;
  /** Share of tasks finished after 10 PM or before 5 AM, 0-100. */
  lateShare: number;
}

/** "6 PM", "12 AM" — the hour, the way a person says it. */
export function hourLabel(hour: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM';
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve} ${suffix}`;
}

/**
 * When in the day work actually gets finished.
 *
 * Read off `completed_at`, which is the only timestamp on a task that records
 * a moment the person was present — `created_at` is when it was written down,
 * which is a different act and often a different day.
 *
 * The core window is the tightest run of consecutive hours holding half the
 * work. A single peak hour overstates how concentrated a habit is; a run says
 * "this is the shape of your day" and survives one unusual evening.
 */
export function clockShape(tasks: Task[]): ClockShape {
  const hours: HourStat[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: hourLabel(hour),
    tasks: 0,
    xp: 0,
  }));

  let total = 0;
  let late = 0;
  tasks.forEach((task) => {
    if (task.status !== 'done') return;
    const stamp = String(task.completed_at || '');
    const hour = Number(stamp.slice(11, 13));
    if (!stamp || Number.isNaN(hour)) return;
    const bucket = hours[hour];
    if (!bucket) return;
    bucket.tasks += 1;
    bucket.xp += num(task.xp_value);
    total += 1;
    if (hour >= 22 || hour < 5) late += 1;
  });

  if (total === 0) return { hours, peak: null, coreWindow: null, lateShare: 0 };

  const peak = hours.reduce((a, b) => (b.tasks > a.tasks ? b : a));

  // The shortest window covering half the work, tried at every width.
  let coreWindow: ClockShape['coreWindow'] = null;
  for (let width = 1; width <= 24 && !coreWindow; width++) {
    for (let from = 0; from < 24; from++) {
      let inside = 0;
      for (let step = 0; step < width; step++) inside += hours[(from + step) % 24]!.tasks;
      if (inside / total >= 0.5) {
        coreWindow = {
          from,
          to: (from + width) % 24,
          share: Math.round((inside / total) * 100),
        };
        break;
      }
    }
  }

  return { hours, peak, coreWindow, lateShare: Math.round((late / total) * 100) };
}

// --------------------------------------------------------------------------
// Sittings and gaps
// --------------------------------------------------------------------------
export interface RhythmShape {
  /** Focus minutes on a day that had any, averaged. */
  typicalSession: number;
  /** The best single day's focus, and when. */
  longestSession: { minutes: number; date: string } | null;
  /** Days worked out of days in the range, 0-100. */
  activeRate: number;
  /** The longest run of consecutive days with nothing on them. */
  longestGap: { days: number; from: string; to: string } | null;
  /** How many separate gaps of three days or more the range holds. */
  gapCount: number;
  /** Days in the range. */
  span: number;
}

/**
 * How the work is spaced out.
 *
 * A gap of three days is the threshold, and it is a judgement rather than a
 * measurement: one day off is a rest, two is a weekend, and three is the point
 * at which a habit has stopped and has to be restarted. Counting every
 * single-day gap would report a healthy routine as hundreds of interruptions.
 */
export function rhythmShape(days: GrowthDay[]): RhythmShape {
  const worked = days.filter((day) => num(day.xp_earned) > 0 || num(day.focus_minutes) > 0);
  const focusDays = days.filter((day) => num(day.focus_minutes) > 0);

  const typicalSession = focusDays.length
    ? focusDays.reduce((sum, day) => sum + num(day.focus_minutes), 0) / focusDays.length
    : 0;

  const longest = focusDays.reduce<RhythmShape['longestSession']>((best, day) => {
    const minutes = num(day.focus_minutes);
    return !best || minutes > best.minutes ? { minutes, date: day.date } : best;
  }, null);

  let longestGap: RhythmShape['longestGap'] = null;
  let gapCount = 0;
  let run = 0;
  let runStart = '';

  const close = (endedOn: string) => {
    if (run >= 3) {
      gapCount += 1;
      if (!longestGap || run > longestGap.days) {
        longestGap = { days: run, from: runStart, to: endedOn };
      }
    }
    run = 0;
  };

  days.forEach((day) => {
    if (num(day.xp_earned) > 0) {
      close(day.date);
      return;
    }
    if (run === 0) runStart = day.date;
    run += 1;
  });
  close(days[days.length - 1]?.date ?? '');

  return {
    typicalSession,
    longestSession: longest,
    activeRate: days.length ? (worked.length / days.length) * 100 : 0,
    longestGap,
    gapCount,
    span: days.length,
  };
}

// --------------------------------------------------------------------------
// Momentum
// --------------------------------------------------------------------------
export interface Momentum {
  label: string;
  now: number;
  before: number;
  /** Percentage change, or null when there is no earlier window to compare. */
  delta: number | null;
  format: (value: number) => string;
}

/**
 * The last stretch against the one before it, on four measures.
 *
 * Ninety days by default: long enough that a bad fortnight does not read as a
 * decline, short enough that a change of habit six months ago is not still
 * being reported as news.
 */
export function momentum(days: GrowthDay[], window = 90): Momentum[] {
  const now = days.slice(-window);
  const before = days.slice(-window * 2, -window);
  const comparable = before.length === now.length && now.length > 0;

  const sum = (rows: GrowthDay[], read: (day: GrowthDay) => number) =>
    rows.reduce((total, day) => total + read(day), 0);
  const change = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);

  const build = (
    label: string,
    read: (day: GrowthDay) => number,
    format: (value: number) => string,
    perDay = false,
  ): Momentum => {
    const scale = (rows: GrowthDay[]) =>
      perDay && rows.length ? sum(rows, read) / rows.length : sum(rows, read);
    const a = scale(now);
    const b = comparable ? scale(before) : 0;
    return { label, now: a, before: b, delta: comparable ? change(a, b) : null, format };
  };

  return [
    build('XP earned', (day) => num(day.xp_earned), (v) => Math.round(v).toLocaleString()),
    build('Tasks finished', (day) => num(day.tasks_completed), (v) => Math.round(v).toLocaleString()),
    build('Focus hours', (day) => num(day.focus_minutes) / 60, (v) => `${Math.round(v)}h`),
    build(
      'Days worked',
      (day) => (num(day.xp_earned) > 0 ? 1 : 0),
      (v) => `${Math.round(v)}`,
    ),
  ];
}

// --------------------------------------------------------------------------
// Balance
// --------------------------------------------------------------------------
export interface BalanceShape {
  /** Share of XP held by the largest subject, 0-100. */
  concentration: number;
  leader: string | null;
  /** Named subjects carrying at least a twentieth of the work. */
  carrying: number;
  /** Subjects touched in the earlier half but not the later one. */
  fading: string[];
}

/**
 * How evenly effort is spread, and what has quietly stopped.
 *
 * A fading subject is one with real work behind it in the first half of the
 * range and none in the second — which is a fact worth surfacing and is
 * invisible on any total, because the total still remembers it.
 */
export function balanceShape(
  tasks: Task[],
  nameOf: (id: string) => string,
  fromIso: string,
  toIso: string,
): BalanceShape {
  const mid = new Date(
    (new Date(`${fromIso}T00:00:00`).getTime() + new Date(`${toIso}T00:00:00`).getTime()) / 2,
  )
    .toISOString()
    .slice(0, 10);

  const early = new Map<string, number>();
  const late = new Map<string, number>();
  const all = new Map<string, number>();
  let total = 0;

  tasks.forEach((task) => {
    if (task.status !== 'done') return;
    const day = String(task.completed_at || '').slice(0, 10);
    if (!day || day < fromIso || day > toIso) return;
    const subject = task.subject;
    if (!subject) return;
    const xp = num(task.xp_value);
    total += xp;
    all.set(subject, (all.get(subject) ?? 0) + xp);
    const side = day < mid ? early : late;
    side.set(subject, (side.get(subject) ?? 0) + xp);
  });

  if (total === 0) {
    return { concentration: 0, leader: null, carrying: 0, fading: [] };
  }

  const ranked = [...all.entries()].sort((a, b) => b[1] - a[1]);
  const [leaderId, leaderXp] = ranked[0]!;

  return {
    concentration: Math.round((leaderXp / total) * 100),
    leader: nameOf(leaderId),
    carrying: ranked.filter(([, xp]) => xp / total >= 0.05).length,
    fading: [...early.entries()]
      .filter(([id, xp]) => xp / total >= 0.02 && !late.has(id))
      .map(([id]) => nameOf(id)),
  };
}
