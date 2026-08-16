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
/**
 * How a metric's days are collapsed into one figure for a stretch.
 *
 * Three, not two, and the third is the one that used to be missing. `sum` is a
 * total. `mean` averages over every day in the stretch, which is what a rate
 * like productivity means — the empty days are part of the average and dropping
 * them is how "XP per day" quietly becomes "XP per day I felt like it". Only
 * `meanActive` skips the blanks, and only for quality, where a day that
 * finished nothing has no XP-per-task to contribute rather than a zero.
 */
export type TrendAgg = 'sum' | 'mean' | 'meanActive';

export interface TrendMetric {
  key: string;
  label: string;
  read: (day: GrowthDay) => number;
  format: (value: number) => string;
  /** Defaults to `sum`. See `TrendAgg`. */
  agg?: TrendAgg;
  tone: string;
}

/**
 * What the tab tracks, the three that matter first.
 *
 * This was five totals-and-counts: XP earned, tasks, focus minutes, days
 * worked, XP per task. Four of them measured the same thing — how much happened
 * — and all four move together with the length of the window, so the tab could
 * report four rising measures on a stretch where nothing about the work had
 * changed except that there was more calendar in it.
 *
 * Productivity, consistency and quality are three genuinely different questions
 * that can disagree with each other: doing more per day, doing it on more days,
 * and each piece being worth more. A tab about direction earns its keep exactly
 * where those three point different ways, and it could not show that before.
 * Tasks and focus stay on as the volume behind them.
 */
export const TREND_METRICS: TrendMetric[] = [
  {
    key: 'productivity',
    label: 'Productivity',
    read: (day) => num(day.xp_earned),
    format: (value) => `${Math.round(value).toLocaleString()} XP/day`,
    agg: 'mean',
    tone: 'violet',
  },
  {
    key: 'consistency',
    label: 'Consistency',
    read: (day) => (num(day.xp_earned) > 0 ? 100 : 0),
    format: (value) => `${Math.round(value)}%`,
    agg: 'mean',
    tone: 'amber',
  },
  {
    key: 'quality',
    label: 'Quality',
    read: (day) => num(day.avg_task_xp),
    format: (value) => `${value.toFixed(1)} XP/task`,
    agg: 'meanActive',
    tone: 'pink',
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
];

/** One stretch's figure for one metric, by whichever rule the metric states. */
function collapse(metric: TrendMetric, days: GrowthDay[]): number {
  const values = days.map(metric.read);
  if (metric.agg === 'mean') return mean(values);
  if (metric.agg === 'meanActive') return mean(values.filter((value) => value > 0));
  return values.reduce((a, b) => a + b, 0);
}

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
    const a = collapse(metric, now);
    const b = collapse(metric, was);
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
/**
 * A metric's daily series, with days that have no reading carried forward.
 *
 * Only for `meanActive` metrics, and quality is the one. Its raw series is
 * XP-per-task on the days that finished a task and a zero on every other day,
 * and those zeros are not low quality — they are no measurement. Fitting
 * through them makes the line a picture of attendance: an account whose work
 * got steadily harder while it showed up less would be reported as quality
 * *falling*, which is the opposite of what happened, and with a confident fit,
 * because attendance is the strongest signal in the series.
 *
 * Carrying the last reading forward keeps one value per day — so the slope is
 * still per day and `perWeek` still means a week — while letting the fit see
 * only the readings. Leading blanks take the first real reading, since there is
 * nothing behind them to carry.
 */
function carried(days: GrowthDay[], read: (day: GrowthDay) => number): number[] {
  const raw = days.map(read);
  const first = raw.find((value) => value > 0) ?? 0;
  let last = first;
  return raw.map((value) => {
    if (value > 0) last = value;
    return last;
  });
}

export function directions(days: GrowthDay[]): Direction[] {
  if (days.length < 14) return [];
  // The window is smoothed before fitting: a fit through raw daily values on an
  // account that works five days in seven is mostly measuring the weekend.
  const span = days.length;
  const smoothing = span >= 180 ? 14 : span >= 60 ? 7 : 3;

  return TREND_METRICS.map((metric) => {
    const raw =
      metric.agg === 'meanActive' ? carried(days, metric.read) : days.map(metric.read);
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
          )} a week — ${Math.abs(percent ?? 0)}% of this window's own average, every week. The fitted line accounts for ${Math.round(
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
  const up = list.filter((entry) => entry.heading === 'rising');
  const down = list.filter((entry) => entry.heading === 'falling');
  // Labels verbatim, not lowercased: these sentences open with one, and "XP
  // earned" is an acronym that does not survive being downcased for grammar.
  const names = (rows: Direction[]) =>
    rows.length === 1
      ? rows[0]!.label
      : `${rows.slice(0, -1).map((row) => row.label).join(', ')} and ${rows[rows.length - 1]!.label}`;

  // Disagreement is checked before either landslide, and that ordering is the
  // point of the sentence. It used to run the other way: "most of these are
  // falling together" fired on three fallers and said nothing about the fourth
  // measure climbing steeply, which is precisely the finding a reader needed —
  // an account showing up less often while the work it does gets harder is not
  // an account in decline, and the old wording told it that it was.
  if (up.length > 0 && down.length > 0) {
    return `${names(up)} ${up.length === 1 ? 'is' : 'are'} climbing while ${names(down)} ${down.length === 1 ? 'is' : 'are'} falling. That disagreement is the finding: productivity up against consistency down means fewer, bigger days; quality up against consistency down means the work got harder rather than more frequent. Read the split, not the average of it.`;
  }
  if (up.length >= 3) {
    return 'Three or more measures are climbing together, which is the signal worth trusting. A single line rising can be a good fortnight; productivity, consistency and quality moving the same way is a change in how you work rather than a change in the calendar.';
  }
  if (down.length >= 3) {
    return 'Most of these are falling together, and none is climbing against them. That is worth taking at face value rather than explaining away — and the fix is almost always consistency rather than intensity, because showing up on more days lifts the other two and grinding harder on the same days does not.';
  }
  // One or two moving and the rest flat. Naming them matters: the sentence used
  // to fall through to "nothing has a slope worth reporting" here, which
  // directly contradicted the row above it saying XP was climbing at 82% fit.
  if (up.length > 0) {
    return `${names(up)} ${up.length === 1 ? 'is' : 'are'} climbing while the rest hold level — a change in one measure rather than across the board, which usually means the work got bigger rather than more frequent.`;
  }
  if (down.length > 0) {
    return `${names(down)} ${down.length === 1 ? 'is' : 'are'} falling while the rest hold level. One measure sliding on its own is worth catching early, because it is the stage at which it is still about one habit rather than the whole routine.`;
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
        values[metric.key] = collapse(metric, rows);
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
