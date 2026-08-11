/**
 * What is moving, and which way — the arithmetic behind the Trends tab.
 *
 * The other tabs each answer a question about a period: Habits says what
 * happens in it, Insights says why, Recommendations says what to change. This
 * one is about the derivative rather than the level — is the line going up, how
 * fast, and is that a real slope or last Tuesday.
 *
 * Two ideas do all the work here and they are deliberately separate:
 *
 * **A comparison** puts one stretch beside the equivalent one before it. This
 * week against last week, this month against last month, the last thirty days
 * against the thirty before. It is exact, it needs no model, and it is what a
 * reader means by "am I doing better".
 *
 * **A direction** fits a line through every day in the window and reports its
 * slope. It answers the question a single comparison cannot — whether the
 * change is a trend or a fluctuation — and it is stated with the noise beside
 * it, because a slope without a sense of the scatter around it is a number
 * pretending to be a finding.
 */
import type { GrowthDay } from '@/types';

const num = (value: unknown) => Number(value) || 0;

const mean = (list: number[]) =>
  list.length ? list.reduce((sum, value) => sum + value, 0) / list.length : 0;

// --------------------------------------------------------------------------
// What gets tracked
// --------------------------------------------------------------------------
export interface TrendMetric {
  key: string;
  label: string;
  read: (day: GrowthDay) => number;
  format: (value: number) => string;
  /** Averaged per day rather than summed — a rate, not a total. */
  rate?: boolean;
  tone: string;
}

export const TREND_METRICS: TrendMetric[] = [
  {
    key: 'xp',
    label: 'XP earned',
    read: (day) => num(day.xp_earned),
    format: (value) => Math.round(value).toLocaleString(),
    tone: 'violet',
  },
  {
    key: 'tasks',
    label: 'Tasks finished',
    read: (day) => num(day.tasks_completed),
    format: (value) => Math.round(value).toLocaleString(),
    tone: 'green',
  },
  {
    key: 'focus',
    label: 'Focus time',
    read: (day) => num(day.focus_minutes),
    format: (value) => (value >= 60 ? `${Math.round(value / 60)}h` : `${Math.round(value)}m`),
    tone: 'blue',
  },
  {
    key: 'active',
    label: 'Days worked',
    read: (day) => (num(day.xp_earned) > 0 ? 1 : 0),
    format: (value) => Math.round(value).toLocaleString(),
    tone: 'amber',
  },
  {
    key: 'quality',
    label: 'XP per task',
    read: (day) => num(day.avg_task_xp),
    format: (value) => value.toFixed(1),
    rate: true,
    tone: 'pink',
  },
];

// --------------------------------------------------------------------------
// Comparisons
// --------------------------------------------------------------------------
export type ComparisonKey = 'week' | 'month' | 'thirty';

export interface ComparisonOption {
  key: ComparisonKey;
  label: string;
  /** What the two halves are called, in order. */
  nowLabel: string;
  wasLabel: string;
}

export const COMPARISONS: ComparisonOption[] = [
  { key: 'week', label: 'This week vs last', nowLabel: 'This week', wasLabel: 'Last week' },
  { key: 'month', label: 'This month vs last', nowLabel: 'This month', wasLabel: 'Last month' },
  {
    key: 'thirty',
    label: 'Last 30 days vs previous',
    nowLabel: 'Last 30 days',
    wasLabel: 'Previous 30',
  },
];

/**
 * The two stretches a comparison puts beside each other.
 *
 * Calendar comparisons are cut on real boundaries — the week starts on Sunday,
 * the month on the first — which means the current one is usually incomplete,
 * and that is stated rather than corrected for. Padding a partial week out to
 * seven days would invent days; comparing four days against seven and calling
 * the difference a decline would be worse. So the panel says how far into the
 * period the reader is and lets them read it accordingly. The rolling
 * comparison has no such problem and is the honest default for "am I improving".
 */
export function comparisonSlices(
  days: GrowthDay[],
  key: ComparisonKey,
): { now: GrowthDay[]; was: GrowthDay[]; partial: number | null } {
  const last = days[days.length - 1]?.date;
  if (!last) return { now: [], was: [], partial: null };

  if (key === 'thirty') {
    return { now: days.slice(-30), was: days.slice(-60, -30), partial: null };
  }

  const at = new Date(`${last}T00:00:00`);
  if (key === 'week') {
    const intoWeek = at.getDay() + 1;
    return {
      now: days.slice(-intoWeek),
      was: days.slice(-(intoWeek + 7), -intoWeek),
      partial: intoWeek < 7 ? intoWeek : null,
    };
  }

  const intoMonth = at.getDate();
  const previousLength = new Date(at.getFullYear(), at.getMonth(), 0).getDate();
  return {
    now: days.slice(-intoMonth),
    was: days.slice(-(intoMonth + previousLength), -intoMonth),
    partial: intoMonth < new Date(at.getFullYear(), at.getMonth() + 1, 0).getDate() ? intoMonth : null,
  };
}

export interface TrendRow {
  key: string;
  label: string;
  now: number;
  was: number;
  /** Percentage change, or null when the two stretches are not comparable. */
  delta: number | null;
  nowText: string;
  wasText: string;
  /** The current stretch day by day, for the row's sparkline. */
  series: number[];
  tone: string;
}

/**
 * Every metric across a comparison, with the change between them.
 *
 * The two stretches must be the same length for a percentage to mean anything —
 * a partial week against a whole one reports the missing days as a collapse. So
 * when they are not, `delta` is null and the panel prints "not comparable yet"
 * rather than a number that would be read as a result.
 */
export function trendRows(days: GrowthDay[], key: ComparisonKey): TrendRow[] {
  const { now, was } = comparisonSlices(days, key);
  const comparable = now.length > 0 && was.length === now.length;

  return TREND_METRICS.map((metric) => {
    const total = (rows: GrowthDay[]) => {
      const values = rows.map(metric.read);
      return metric.rate ? mean(values.filter((value) => value > 0)) : values.reduce((a, b) => a + b, 0);
    };
    const a = total(now);
    const b = total(was);
    return {
      key: metric.key,
      label: metric.label,
      now: a,
      was: b,
      delta: comparable && b > 0 ? Math.round(((a - b) / b) * 100) : null,
      nowText: metric.format(a),
      wasText: comparable ? metric.format(b) : '—',
      series: now.map(metric.read),
      tone: metric.tone,
    };
  });
}

// --------------------------------------------------------------------------
// Direction
// --------------------------------------------------------------------------
export interface Direction {
  key: string;
  label: string;
  /** Change per week implied by the fitted line, in the metric's own units. */
  perWeek: number;
  /** The same as a percentage of the window's average day. */
  percent: number | null;
  heading: 'rising' | 'falling' | 'flat';
  /** 0-1. How much of the variation the line accounts for — the noise check. */
  fit: number;
  text: string;
  tone: string;
  /** The smoothed line the chart draws. */
  smoothed: number[];
}

/** Ordinary least squares through (index, value). Slope is per day. */
function fitLine(values: number[]): { slope: number; r2: number } {
  const n = values.length;
  if (n < 4) return { slope: 0, r2: 0 };
  const meanX = (n - 1) / 2;
  const meanY = mean(values);
  let top = 0;
  let bottom = 0;
  values.forEach((value, index) => {
    top += (index - meanX) * (value - meanY);
    bottom += (index - meanX) ** 2;
  });
  const slope = bottom === 0 ? 0 : top / bottom;

  let residual = 0;
  let total = 0;
  values.forEach((value, index) => {
    const predicted = meanY + slope * (index - meanX);
    residual += (value - predicted) ** 2;
    total += (value - meanY) ** 2;
  });
  return { slope, r2: total === 0 ? 0 : Math.max(0, 1 - residual / total) };
}

/** A centred moving average, so the chart shows the shape and not the noise. */
export function smooth(values: number[], window: number): number[] {
  if (values.length === 0) return [];
  const half = Math.max(1, Math.floor(window / 2));
  return values.map((_, index) => {
    const from = Math.max(0, index - half);
    const to = Math.min(values.length, index + half + 1);
    return mean(values.slice(from, to));
  });
}

/**
 * Which way each metric is heading across the whole window.
 *
 * A slope is only worth stating alongside how well the line fits: the same
 * upward slope through a tight band and through a cloud mean very different
 * things, and reporting only the first number is how a page ends up announcing
 * a trend that is one good fortnight. `fit` is that second number, printed, and
 * anything under a fifth of the variation explained is called flat regardless
 * of which way the line points.
 */
export function directions(days: GrowthDay[]): Direction[] {
  if (days.length < 14) return [];
  // The window is smoothed before fitting: a fit through raw daily values on an
  // account that works five days in seven is mostly measuring the weekend.
  const span = days.length;
  const smoothing = span >= 180 ? 14 : span >= 60 ? 7 : 3;

  return TREND_METRICS.map((metric) => {
    const raw = days.map(metric.read);
    const smoothed = smooth(raw, smoothing);
    const { slope, r2 } = fitLine(smoothed);
    const perWeek = slope * 7;
    const average = mean(raw);
    const percent = average > 0 ? Math.round((perWeek / average) * 100) : null;

    const weak = r2 < 0.2 || Math.abs(percent ?? 0) < 2;
    const heading: Direction['heading'] = weak ? 'flat' : perWeek > 0 ? 'rising' : 'falling';

    const text =
      heading === 'flat'
        ? `Holding level. ${
            r2 < 0.2
              ? 'The line through this window explains almost none of the variation, so week-to-week movement here is noise rather than direction.'
              : 'The slope is real but too small to matter over this window.'
          }`
        : `${heading === 'rising' ? 'Climbing' : 'Falling'} by about ${metric.format(
            Math.abs(perWeek),
          )} a week — ${Math.abs(percent ?? 0)}% of a typical day, every week. The fitted line accounts for ${Math.round(
            r2 * 100,
          )}% of the variation across the window.`;

    return {
      key: metric.key,
      label: metric.label,
      perWeek,
      percent,
      heading,
      fit: r2,
      text,
      tone: metric.tone,
      smoothed,
    };
  });
}

/** One sentence over the whole set, for the panel that opens the tab. */
export function trendVerdict(list: Direction[]): string {
  if (list.length === 0) {
    return 'There are not enough days in this window to fit a line through anything yet. Two weeks is the floor, and a month is where these start being worth reading.';
  }
  const rising = list.filter((entry) => entry.heading === 'rising').length;
  const falling = list.filter((entry) => entry.heading === 'falling').length;

  if (rising >= 3) {
    return 'Three or more measures are climbing together, which is the signal worth trusting. A single line rising can be a good fortnight; XP, tasks and focus moving the same way is a change in how much you are doing.';
  }
  if (falling >= 3) {
    return 'Most of these are falling together. That is worth taking at face value rather than explaining away — and the fix is almost always about how often you work rather than how hard.';
  }
  if (rising > 0 && falling > 0) {
    return 'These are pulling in different directions, which usually means the shape of the work changed rather than the amount — fewer, larger sessions, or more, smaller ones.';
  }
  return 'Nothing here has a slope worth reporting. That is a steady window rather than an empty one: your totals are being held up by a routine that is running, not by a push.';
}

// --------------------------------------------------------------------------
// Streaks of direction
// --------------------------------------------------------------------------
export interface WeekPoint {
  /** The Sunday the week opens on. */
  date: string;
  label: string;
  values: Record<string, number>;
}

/**
 * The window as whole weeks, which is the unit a trend is actually read in.
 *
 * Days are too noisy to see a direction in and months are too few to see one
 * happen. The first and last weeks are dropped when they are partial: a
 * three-day week drawn at full width is a cliff at each end of every chart.
 */
export function weeklyPoints(days: GrowthDay[]): WeekPoint[] {
  const buckets = new Map<string, GrowthDay[]>();
  days.forEach((day) => {
    const at = new Date(`${day.date}T00:00:00`);
    at.setDate(at.getDate() - at.getDay());
    const key = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(
      at.getDate(),
    ).padStart(2, '0')}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(day);
    buckets.set(key, bucket);
  });

  const keys = [...buckets.keys()].sort();
  return keys
    .filter((key, index) => {
      const rows = buckets.get(key)!;
      const edge = index === 0 || index === keys.length - 1;
      return !edge || rows.length === 7;
    })
    .map((key) => {
      const rows = buckets.get(key)!;
      const values: Record<string, number> = {};
      TREND_METRICS.forEach((metric) => {
        const list = rows.map(metric.read);
        values[metric.key] = metric.rate ? mean(list.filter((value) => value > 0)) : list.reduce((a, b) => a + b, 0);
      });
      return {
        date: key,
        label: new Date(`${key}T00:00:00`).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        values,
      };
    });
}

// --------------------------------------------------------------------------
// Placeholder data
// --------------------------------------------------------------------------
/** Same contract as the other tabs' samples — one block, one chip, no mixing. */
export const SAMPLE_DIRECTIONS: Direction[] = [
  {
    key: 'xp',
    label: 'XP earned',
    perWeek: 41,
    percent: 11,
    heading: 'rising',
    fit: 0.44,
    text: 'Climbing by about 41 a week — 11% of a typical day, every week. The fitted line accounts for 44% of the variation across the window.',
    tone: 'violet',
    smoothed: [280, 292, 301, 297, 318, 331, 327, 344, 358, 361, 379, 392, 388, 407, 421],
  },
  {
    key: 'tasks',
    label: 'Tasks finished',
    perWeek: 0.6,
    percent: 8,
    heading: 'rising',
    fit: 0.31,
    text: 'Climbing by about 1 a week — 8% of a typical day, every week. The fitted line accounts for 31% of the variation across the window.',
    tone: 'green',
    smoothed: [4.1, 4.3, 4.2, 4.6, 4.8, 4.7, 5.1, 5.0, 5.4, 5.6, 5.5, 5.9, 6.1, 6.0, 6.4],
  },
  {
    key: 'focus',
    label: 'Focus time',
    perWeek: 3,
    percent: 2,
    heading: 'flat',
    fit: 0.11,
    text: 'Holding level. The line through this window explains almost none of the variation, so week-to-week movement here is noise rather than direction.',
    tone: 'blue',
    smoothed: [44, 51, 39, 47, 52, 41, 49, 46, 53, 44, 48, 50, 45, 51, 47],
  },
  {
    key: 'active',
    label: 'Days worked',
    perWeek: 0.2,
    percent: 6,
    heading: 'rising',
    fit: 0.28,
    text: 'Climbing by about 0 a week — 6% of a typical day, every week. The fitted line accounts for 28% of the variation across the window.',
    tone: 'amber',
    smoothed: [3.4, 3.6, 3.5, 3.9, 4.0, 3.8, 4.2, 4.1, 4.4, 4.3, 4.6, 4.5, 4.8, 4.7, 5.0],
  },
  {
    key: 'quality',
    label: 'XP per task',
    perWeek: -0.4,
    percent: -4,
    heading: 'falling',
    fit: 0.24,
    text: 'Falling by about 0.4 a week — 4% of a typical day, every week. The fitted line accounts for 24% of the variation across the window.',
    tone: 'pink',
    smoothed: [78, 76, 77, 74, 75, 72, 73, 71, 72, 69, 70, 68, 69, 66, 67],
  },
];

export const SAMPLE_TREND_ROWS: TrendRow[] = [
  {
    key: 'xp',
    label: 'XP earned',
    now: 2840,
    was: 2410,
    delta: 18,
    nowText: '2,840',
    wasText: '2,410',
    series: [0, 410, 520, 380, 0, 610, 470, 450],
    tone: 'violet',
  },
  {
    key: 'tasks',
    label: 'Tasks finished',
    now: 34,
    was: 29,
    delta: 17,
    nowText: '34',
    wasText: '29',
    series: [0, 5, 6, 4, 0, 8, 6, 5],
    tone: 'green',
  },
  {
    key: 'focus',
    label: 'Focus time',
    now: 331,
    was: 344,
    delta: -4,
    nowText: '6h',
    wasText: '6h',
    series: [0, 48, 62, 41, 0, 74, 55, 51],
    tone: 'blue',
  },
  {
    key: 'active',
    label: 'Days worked',
    now: 6,
    was: 5,
    delta: 20,
    nowText: '6',
    wasText: '5',
    series: [0, 1, 1, 1, 0, 1, 1, 1],
    tone: 'amber',
  },
  {
    key: 'quality',
    label: 'XP per task',
    now: 83.5,
    was: 83.1,
    delta: 0,
    nowText: '83.5',
    wasText: '83.1',
    series: [0, 82, 87, 95, 0, 76, 78, 84],
    tone: 'pink',
  },
];
