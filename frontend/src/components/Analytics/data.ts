/**
 * The arithmetic behind the analytics page.
 *
 * Everything here reads the day series the backend already builds — the same
 * rows the growth page slices — so the two pages cannot tell different stories
 * about the same account. Where a panel needs something the backend has no
 * answer for, it says so in the open: see `SAMPLE` at the bottom, which is the
 * whole of the invented data on this page and is kept in one place precisely so
 * it can be deleted in one edit when the endpoints exist.
 *
 * The windows here are long ones — a quarter to the whole account — because
 * this page is about trajectory. utils/growthSummary's `RANGES` are the short
 * ones the growth page uses (7/30/90/all), and its helpers all take a
 * `RangeSlice`, so the windows differ and everything downstream is shared.
 */
import {
  compact,
  type RangeSlice,
} from '@/utils/growthSummary';
import { percentileFor } from './score';
import type { GrowthDay } from '@/types';

// --------------------------------------------------------------------------
// Windows
// --------------------------------------------------------------------------
export type WindowKey = '7d' | '30d' | '90d' | '1y' | '2y' | 'all';

export interface WindowOption {
  key: WindowKey;
  label: string;
  /** How many days back it reaches, or null for the whole account. */
  days: number | null;
  /** What the compare-with control calls the period before it. */
  compare: string;
}

/**
 * The one window set, shared by every tab on the page.
 *
 * It was four long windows — a quarter to two years — back when this page was
 * only about trajectory. Habits and Insights ask questions at a much shorter
 * range ("what have I been doing this week") and a picker that started at three
 * months could not express them, while a second picker on those tabs would mean
 * two tabs quietly describing different periods, which is the exact failure the
 * single window exists to prevent. So the set spans both: a week for the
 * behavioural tabs, two years and all time for the long view.
 */
export const WINDOWS: WindowOption[] = [
  { key: '7d', label: '7D', days: 7, compare: 'Previous 7 Days' },
  { key: '30d', label: '30D', days: 30, compare: 'Previous 30 Days' },
  { key: '90d', label: '90D', days: 90, compare: 'Previous 90 Days' },
  { key: '1y', label: '1Y', days: 365, compare: 'Previous Year' },
  { key: '2y', label: '2Y', days: 730, compare: 'Previous 2 Years' },
  { key: 'all', label: 'All Time', days: null, compare: 'No earlier period' },
];

export function windowOption(key: WindowKey): WindowOption {
  return WINDOWS.find((entry) => entry.key === key) ?? WINDOWS[3]!;
}

/**
 * The days a window covers, and the equal-length run immediately before them.
 *
 * The same contract `sliceRange` keeps for the short windows, and for the same
 * reason: every "vs previous" figure on the page is the current slice against
 * `previous`, and a baseline of a different length would report the difference
 * in length as a change in behaviour. All Time has no before, by definition —
 * comparing an account against the void it was created out of is not a
 * comparison.
 */
export function sliceWindow(all: GrowthDay[], key: WindowKey): RangeSlice {
  const { days } = windowOption(key);
  if (days === null) return { current: all, previous: [] };
  const start = Math.max(0, all.length - days);
  return {
    current: all.slice(start),
    previous: all.slice(Math.max(0, start - days), start),
  };
}

/** "Jul 3, 2024 – Jul 3, 2026" — the header's date pill, both years spelled. */
export function spanLabel(days: GrowthDay[]): string {
  const first = days[0]?.date;
  const last = days[days.length - 1]?.date;
  if (!first || !last) return 'No data yet';
  const at = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  return first === last ? at(first) : `${at(first)} – ${at(last)}`;
}

/**
 * "Aug '26" — a month on a chart's x axis.
 *
 * The apostrophe is doing real work. These labels used to read "Aug 26", which
 * on an axis running left to right in time is indistinguishable from the 26th
 * of August — and on the compounding chart, where six labels span five years,
 * a reader saw "Aug 26 · Aug 27 · Aug 28" and read a week. The year is the
 * thing that changes between those labels, so it has to look like one.
 */
export function monthLabel(iso: string): string {
  const at = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(at.getTime())) return '';
  const month = at.toLocaleDateString('en-US', { month: 'short' });
  return `${month} '${String(at.getFullYear()).slice(2)}`;
}

/**
 * `want` labels for a run of dates, sampled where the labels are drawn.
 *
 * The x-axis strip is a flex row of equal slots with the label centred in each
 * (`.ax-chart-x` in styles/analytics.css), so the k-th of n labels sits at
 * (k + ½)/n of the width — not at k/(n-1), which is where a naive stride would
 * take its sample from and why the old labels sat about half a slot ahead of
 * the point they named. Sampling at the slot's own centre makes the label and
 * the position agree.
 */
export function axisMarks(dates: string[], want = 6): string[] {
  if (dates.length === 0) return [];
  const count = Math.min(want, dates.length);
  return Array.from({ length: count }, (_, index) => {
    const at = Math.round(((index + 0.5) / count) * (dates.length - 1));
    return monthLabel(dates[Math.min(dates.length - 1, at)] ?? '');
  });
}

/**
 * The same labels for a chart whose x axis is time rather than position.
 *
 * `axisMarks` names the point that sits under each label, which is right when
 * the points are evenly spaced. When they are placed by date — see `at` on
 * AreaChart — the label has to name the *date* under it instead, and there may
 * be no point there at all: the compounding chart has a point every week for a
 * year and then one a quarter for five, so four of its six labels fall in
 * stretches with nothing plotted nearby.
 */
export function axisSpan(fromIso: string, toIso: string, want = 6): string[] {
  const from = new Date(`${fromIso}T00:00:00`).getTime();
  const to = new Date(`${toIso}T00:00:00`).getTime();
  if (Number.isNaN(from) || Number.isNaN(to) || to <= from) return [];
  return Array.from({ length: want }, (_, index) => {
    const at = new Date(from + ((index + 0.5) / want) * (to - from));
    return monthLabel(at.toISOString().slice(0, 10));
  });
}

/**
 * Where each date sits across the width, 0 to 1 — AreaChart's `at`.
 *
 * Linear in time, which is the whole point: a gap of three months has to be
 * three times the gap of one whatever the spacing of the points either side.
 */
export function datePositions(dates: string[]): number[] {
  const times = dates.map((iso) => new Date(`${iso}T00:00:00`).getTime());
  const from = times[0] ?? 0;
  const to = times[times.length - 1] ?? from;
  const span = to - from || 1;
  return times.map((time) => (Number.isNaN(time) ? 0 : (time - from) / span));
}

// --------------------------------------------------------------------------
// The trajectory chart's five series
// --------------------------------------------------------------------------
export type MetricKey = 'xp' | 'focus' | 'tasks' | 'productivity' | 'quality';

export interface MetricOption {
  key: MetricKey;
  label: string;
  /** Reads one day. Cumulative series sum this; rate series average it. */
  read: (day: GrowthDay) => number;
  /**
   * True when the series is a running total — XP earned to date climbs, while
   * productivity is a rate and must not. Drawing a rate cumulatively is how a
   * chart ends up claiming every account improves forever.
   */
  cumulative: boolean;
  format: (value: number) => string;
}

const num = (value: unknown) => Number(value) || 0;

export const METRICS: MetricOption[] = [
  {
    key: 'xp',
    label: 'XP Earned',
    read: (day) => num(day.xp_earned),
    cumulative: true,
    format: (value) => `${compact(value)} XP`,
  },
  {
    key: 'focus',
    label: 'Focus Time',
    read: (day) => num(day.focus_minutes) / 60,
    cumulative: true,
    format: (value) => `${Math.round(value).toLocaleString()}h`,
  },
  {
    key: 'tasks',
    label: 'Tasks Completed',
    read: (day) => num(day.tasks_completed),
    cumulative: true,
    format: (value) => `${Math.round(value).toLocaleString()} tasks`,
  },
  {
    key: 'productivity',
    label: 'Productivity',
    read: (day) => num(day.xp_earned),
    cumulative: false,
    format: (value) => `${Math.round(value).toLocaleString()} XP/day`,
  },
  {
    key: 'quality',
    label: 'Quality Score',
    read: (day) => num(day.avg_task_xp),
    cumulative: false,
    format: (value) => `${value.toFixed(1)} avg XP`,
  },
];

export function metricOption(key: MetricKey): MetricOption {
  return METRICS.find((entry) => entry.key === key) ?? METRICS[0]!;
}

export type Grain = 'daily' | 'weekly' | 'monthly';

export const GRAINS: Array<{ key: Grain; label: string; days: number }> = [
  { key: 'daily', label: 'Daily', days: 1 },
  { key: 'weekly', label: 'Weekly', days: 7 },
  { key: 'monthly', label: 'Monthly', days: 30 },
];

export interface SeriesPoint {
  /** The bucket's closing day, ISO. */
  date: string;
  value: number;
}

/**
 * One metric over one window, bucketed.
 *
 * Two years of days is 730 points in a box a few hundred pixels wide, which is
 * a smear rather than a line — so days are grouped and the bucket is closed on
 * its last day. A cumulative metric reads its running total off that closing
 * day; a rate averages the days inside it. Getting that backwards is the
 * difference between "XP to date" and "XP on the last Tuesday of the month".
 *
 * Buckets are also what makes the previous period drawable on the same axis:
 * two runs of the same length bucket to the same number of points, so the
 * dashed line sits under the solid one at the same x for the same distance
 * into the period rather than at the same date.
 */
export function bucketed(
  days: GrowthDay[],
  metric: MetricOption,
  grain: Grain,
  maxPoints = 60,
): SeriesPoint[] {
  if (days.length === 0) return [];

  const grainDays = GRAINS.find((entry) => entry.key === grain)?.days ?? 1;
  const size = Math.max(grainDays, Math.ceil(days.length / maxPoints));

  const out: SeriesPoint[] = [];
  let running = 0;
  let inBucket = 0;
  let count = 0;

  days.forEach((day, index) => {
    const value = metric.read(day);
    running += value;
    inBucket += value;
    count += 1;

    if (index % size !== size - 1 && index !== days.length - 1) return;
    out.push({
      date: day.date,
      value: metric.cumulative ? running : count ? inBucket / count : 0,
    });
    inBucket = 0;
    count = 0;
  });

  return out;
}

/** The whole-window figure a metric comes to, in the units it is stated in. */
export function metricTotal(days: GrowthDay[], metric: MetricOption): number {
  if (days.length === 0) return 0;
  const sum = days.reduce((acc, day) => acc + metric.read(day), 0);
  return metric.cumulative ? sum : sum / days.length;
}

// --------------------------------------------------------------------------
// Consistency
// --------------------------------------------------------------------------
export interface Consistency {
  /** Share of the window's days with any XP on them, 0-100. */
  rate: number;
  /** The same for the period before, or null when there is none. */
  previousRate: number | null;
  /** "May 2025", and the share of its days that were active. */
  bestMonth: { label: string; rate: number } | null;
}

function activeRate(days: GrowthDay[]): number {
  if (days.length === 0) return 0;
  const active = days.filter((day) => num(day.xp_earned) > 0).length;
  return (active / days.length) * 100;
}

/**
 * How much of the window was worked, and which calendar month was worked most.
 *
 * Active days over days in the window, not over days since the account was
 * created: a reader looking at 2Y is asking about those two years. A month is
 * only eligible for "most consistent" once the window holds most of it —
 * otherwise the current month, three days old and all three worked, wins every
 * time at 100% and the panel congratulates the reader for Tuesday.
 */
export function consistency(slice: RangeSlice): Consistency {
  const byMonth = new Map<string, GrowthDay[]>();
  slice.current.forEach((day) => {
    const key = day.date.slice(0, 7);
    const bucket = byMonth.get(key);
    if (bucket) bucket.push(day);
    else byMonth.set(key, [day]);
  });

  let bestMonth: Consistency['bestMonth'] = null;
  byMonth.forEach((days, key) => {
    if (days.length < 20) return;
    const rate = activeRate(days);
    if (bestMonth && rate <= bestMonth.rate) return;
    const at = new Date(`${key}-01T00:00:00`);
    bestMonth = {
      label: at.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      rate: Math.round(rate),
    };
  });

  const comparable = slice.previous.length === slice.current.length;
  return {
    rate: Math.round(activeRate(slice.current)),
    previousRate: comparable ? Math.round(activeRate(slice.previous)) : null,
    bestMonth,
  };
}

// --------------------------------------------------------------------------
// Compounding
// --------------------------------------------------------------------------
export interface Compounding {
  /** XP a day, averaged over every day of the window. */
  dailyAverage: number;
  projectedYear: number;
  projectedFiveYear: number;
  /** The account's real running total, bucketed. */
  actual: SeriesPoint[];
  /** Where the current pace leads, from today to five years out. */
  projected: SeriesPoint[];
}

/**
 * What the current pace comes to if it simply continues.
 *
 * A straight-line projection and nothing cleverer: XP a day times the days
 * ahead, added to what is already banked. The curve in the panel bends because
 * the actual half is a real history that accelerated, not because the forecast
 * assumes acceleration — a projection that compounds its own growth rate would
 * promise every account the moon by year three.
 */
export function compounding(slice: RangeSlice, all: GrowthDay[]): Compounding {
  const days = slice.current;
  const earned = days.reduce((sum, day) => sum + num(day.xp_earned), 0);
  const dailyAverage = days.length ? earned / days.length : 0;

  const actual = bucketed(days, metricOption('xp'), 'weekly', 40).map((point, _index, list) => ({
    ...point,
    // Running total of the window, lifted onto the account's lifetime total so
    // the two halves of the chart meet rather than stepping at the join.
    value:
      num(all[all.length - 1]?.cumulative_xp) -
      (list[list.length - 1]!.value - point.value),
  }));

  const banked = num(all[all.length - 1]?.cumulative_xp);
  const lastDate = days[days.length - 1]?.date ?? new Date().toISOString().slice(0, 10);
  const projected: SeriesPoint[] = [];
  for (let month = 0; month <= 60; month += 3) {
    const at = new Date(`${lastDate}T00:00:00`);
    at.setMonth(at.getMonth() + month);
    projected.push({
      date: at.toISOString().slice(0, 10),
      value: banked + dailyAverage * month * 30.44,
    });
  }

  return {
    dailyAverage: Math.round(dailyAverage),
    projectedYear: Math.round(dailyAverage * 365),
    projectedFiveYear: Math.round(dailyAverage * 365 * 5),
    actual,
    projected,
  };
}

// --------------------------------------------------------------------------
// The yearly comparison
// --------------------------------------------------------------------------
export interface ComparisonBar {
  label: string;
  current: number;
  previous: number;
  format: (value: number) => string;
}

/**
 * The five headline figures, this period beside the one before it.
 *
 * Every bar is a pair from the same slice the tiles above are drawn from, so
 * the panel restates the tiles rather than recomputing them differently. When
 * there is no previous period the bars still draw — at zero, which reads as
 * "nothing to compare with" and is the truth.
 */
export function comparisonBars(slice: RangeSlice, score: number | null): ComparisonBar[] {
  const sum = (days: GrowthDay[], read: (day: GrowthDay) => number) =>
    days.reduce((acc, day) => acc + read(day), 0);
  const { current, previous } = slice;
  const perDay = (days: GrowthDay[]) =>
    days.length ? sum(days, (day) => num(day.xp_earned)) / days.length : 0;

  return [
    {
      label: 'XP Earned',
      current: sum(current, (day) => num(day.xp_earned)),
      previous: sum(previous, (day) => num(day.xp_earned)),
      format: compact,
    },
    {
      label: 'Focus Time (hrs)',
      current: sum(current, (day) => num(day.focus_minutes)) / 60,
      previous: sum(previous, (day) => num(day.focus_minutes)) / 60,
      format: (value) => Math.round(value).toLocaleString(),
    },
    {
      label: 'Tasks Completed',
      current: sum(current, (day) => num(day.tasks_completed)),
      previous: sum(previous, (day) => num(day.tasks_completed)),
      format: (value) => Math.round(value).toLocaleString(),
    },
    {
      label: 'Avg Daily XP',
      current: perDay(current),
      previous: perDay(previous),
      format: (value) => Math.round(value).toLocaleString(),
    },
    {
      label: 'Growth Score (/10)',
      current: score ?? 0,
      // No history of the score is recorded, so there is no earlier reading to
      // put beside it. Zero draws no bar, which is better than inventing one.
      previous: 0,
      format: (value) => value.toFixed(1),
    },
  ];
}

// --------------------------------------------------------------------------
// Invented data
// --------------------------------------------------------------------------
/**
 * The two panels nothing in this account can answer, kept together.
 *
 * **Four of the five percentile bars need other people's accounts.** Nothing on
 * the backend aggregates across users — `benchCategories` in utils/growthBench
 * deliberately benchmarks the reader against their own record for exactly this
 * reason — so "top 14% on XP earned" cannot be computed and is a placeholder.
 * The fifth is not: the Growth Score row is placed against the stated
 * distribution in ./score, from this account's own score, which is why
 * `standingRows` takes the score rather than the table carrying a fifth number.
 *
 * **The growth score has no history.** `get_growth_ratings` files a dated
 * snapshot per metric every time it is read (backend/tracking/analytics.py),
 * so the history is being recorded — but no endpoint reads it back out yet.
 * When one does, this shape is what the panel wants.
 *
 * Both panels carry a "Sample" chip in the UI so the figures are never mistaken
 * for the reader's own. Delete this block, the chip, and the props that thread
 * it through when the endpoints land.
 */
export const SAMPLE = {
  /** Percentile bands for the "Where You Stand" panel. */
  standing: [
    { label: 'XP Earned', percentile: 14, tone: 'violet' },
    { label: 'Focus Time', percentile: 18, tone: 'blue' },
    { label: 'Consistency', percentile: 11, tone: 'green' },
    { label: 'Task Completion', percentile: 21, tone: 'amber' },
  ] as Array<{ label: string; percentile: number; tone: string }>,
} as const;

/**
 * The "Where You Stand" rows: four placeholders and one real placement.
 *
 * The Growth Score row runs through the same `percentileFor` the badge on the
 * score panel uses, so the two figures on one page are one figure. They were
 * two constants before, and they disagreed the moment either was touched.
 */
export function standingRows(
  score: number | null,
): Array<{ label: string; percentile: number; tone: string }> {
  return [
    ...SAMPLE.standing,
    {
      label: 'Growth Score',
      percentile: score === null ? 50 : percentileFor(score),
      tone: 'violet',
    },
  ];
}

/**
 * A plausible run-up to the score the account actually has.
 *
 * The endpoint for the real history does not exist yet (see `SAMPLE`), and a
 * panel titled "over time" with one point in it is worse than one with a shape.
 * So the shape is generated and the **last point is the account's real score** —
 * the figure stated beside it is never invented, only the path to it is.
 */
export function scoreHistory(score: number, points = 40): number[] {
  const out: number[] = [];
  for (let index = 0; index < points; index++) {
    const t = index / (points - 1);
    // A climb that flattens, plus a fixed wobble so it reads as a measurement
    // rather than a curve. Deterministic: the same account draws the same line
    // on every render, which a random walk would not.
    const climb = score * (0.55 + 0.45 * Math.sqrt(t));
    const wobble = Math.sin(index * 1.7) * 0.18 + Math.sin(index * 0.6) * 0.12;
    out.push(Math.max(0, index === points - 1 ? score : climb + wobble));
  }
  return out;
}
