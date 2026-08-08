/**
 * What the growth page says about a stretch of days.
 *
 * The charts have always been the page; everything around them — the summary
 * tiles, the heatmap, the milestones and the insights — is new, and all of it
 * is arithmetic over the one series the backend already builds
 * (`/api/get_growth_data`). Nothing here fetches, holds state or knows about
 * React, which is what lets the page choose a range and recompute every panel
 * from the same rows rather than asking six questions of the server.
 *
 * Two rules run through it and are the ones to argue with if a figure looks
 * wrong:
 *
 * - **A range is a slice of the tail.** "Last 30 days" is the last 30 rows,
 *   not the last 30 days that had something on them — a fortnight off is part
 *   of the story a growth page is telling, and dropping empty days would make
 *   every gap invisible and every average flattering.
 * - **A comparison is against the slice before it, and only a whole one.** The
 *   tiles say "vs the previous 30 days" and mean exactly that: the 30 rows
 *   before the 30 on screen. A range with nothing before it — All time, or an
 *   account younger than the window — shows no comparison rather than
 *   inventing a baseline, and, less obviously, nor does one with a *partial*
 *   baseline. A 56-day-old account asked for the last 30 days has 26 days
 *   behind them, and "30 days' XP against 26 days' XP, down 47%" is a sentence
 *   about the calendar rather than about the reader. Either the previous
 *   window is the same length as the current one or there is no percentage to
 *   quote.
 */
import type { GrowthDay } from '@/types';

// --------------------------------------------------------------------------
// Ranges
// --------------------------------------------------------------------------
export type RangeKey = '7' | '30' | '90' | 'all';

export interface RangeOption {
  key: RangeKey;
  label: string;
  /** How many days it covers, or null for the whole account. */
  days: number | null;
}

export const RANGES: RangeOption[] = [
  { key: '7', label: 'Last 7 days', days: 7 },
  { key: '30', label: 'Last 30 days', days: 30 },
  { key: '90', label: 'Last 90 days', days: 90 },
  { key: 'all', label: 'All time', days: null },
];

export interface RangeSlice {
  /** The days on screen. */
  current: GrowthDay[];
  /** The same number of days immediately before them. Empty when there are none. */
  previous: GrowthDay[];
}

/**
 * The rows a range covers, and the rows it is compared against.
 *
 * All time has no "before", by definition. A window longer than the account
 * takes what there is and compares against nothing, rather than against a
 * padded run of zeroes that would make any activity at all look like infinite
 * growth.
 */
export function sliceRange(all: GrowthDay[], range: RangeKey): RangeSlice {
  const option = RANGES.find((entry) => entry.key === range) ?? RANGES[1]!;
  if (option.days === null) return { current: all, previous: [] };

  const size = option.days;
  const start = Math.max(0, all.length - size);
  return {
    current: all.slice(start),
    previous: all.slice(Math.max(0, start - size), start),
  };
}

/** "Jul 3 – Jul 31, 2026", or the account's whole span. */
export function rangeLabel(days: GrowthDay[]): string {
  const first = days[0]?.date;
  const last = days[days.length - 1]?.date;
  if (!first || !last) return '—';

  const at = (iso: string) => new Date(`${iso}T00:00:00`);
  const short = (iso: string) =>
    at(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const year = at(last).getFullYear();
  return first === last
    ? `${short(first)}, ${year}`
    : `${short(first)} – ${short(last)}, ${year}`;
}

// --------------------------------------------------------------------------
// The four summary tiles
// --------------------------------------------------------------------------
export interface SummaryFigure {
  /** Already rounded for display. */
  value: number;
  /**
   * Percentage change against the previous slice, or null when there is
   * nothing to compare with — a fresh account, All time, or a previous window
   * that earned nothing at all. A rise from zero is not a percentage.
   */
  delta: number | null;
}

export interface GrowthSummaryFigures {
  xp: SummaryFigure;
  tasks: SummaryFigure;
  xpPerDay: SummaryFigure;
  focusHours: SummaryFigure;
  /** How many days the comparison covers, for the tiles' own wording. */
  comparedDays: number;
}

function total(days: GrowthDay[], read: (day: GrowthDay) => number): number {
  return days.reduce((sum, day) => sum + (Number(read(day)) || 0), 0);
}

function change(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function figure(current: number, previous: number, decimals = 0): SummaryFigure {
  const factor = 10 ** decimals;
  return {
    value: Math.round(current * factor) / factor,
    delta: change(current, previous),
  };
}

export function summaryFigures(slice: RangeSlice): GrowthSummaryFigures {
  const { current, previous } = slice;

  // Only a baseline as long as the window on screen can carry a percentage.
  // See the note at the top: a short one compares different lengths of time
  // and reports the difference as if it were a change in behaviour.
  const comparable = previous.length > 0 && previous.length === current.length;
  const before = comparable ? previous : [];

  const xpNow = total(current, (day) => day.xp_earned);
  const xpWas = total(before, (day) => day.xp_earned);
  const tasksNow = total(current, (day) => day.tasks_completed);
  const tasksWas = total(before, (day) => day.tasks_completed);
  const focusNow = total(current, (day) => day.focus_minutes) / 60;
  const focusWas = total(before, (day) => day.focus_minutes) / 60;

  // Per *day of the range*, not per day something happened: a week with one
  // heroic Tuesday and six blank days averaged over one day would read as the
  // best week on record.
  const perDayNow = current.length ? xpNow / current.length : 0;
  const perDayWas = before.length ? xpWas / before.length : 0;

  return {
    xp: figure(xpNow, xpWas),
    tasks: figure(tasksNow, tasksWas),
    xpPerDay: figure(perDayNow, perDayWas, 1),
    focusHours: figure(focusNow, focusWas, 1),
    comparedDays: before.length,
  };
}

// --------------------------------------------------------------------------
// The heatmap
// --------------------------------------------------------------------------
export interface HeatCell {
  /** ISO date, or null for a square with no day behind it — padding at either
   *  end of the month, or a day the account has no row for. */
  date: string | null;
  xp: number;
  /** 0…4 — how dark the square is. 0 is a day with nothing on it. */
  level: number;
}

export interface HeatWeek {
  /** "Jul 5" — the Sunday the row starts on. */
  label: string;
  days: HeatCell[];
}

/** Sunday-first, like the mockup's S M T W T F S. */
const WEEK_START = 0;

/**
 * A calendar month as a grid of weeks.
 *
 * **It is always a whole month, whichever month the range ends in.** It used
 * to be the range itself, which meant the panel was one row of squares at 7
 * days and thirteen at 90 — a heatmap that changed shape every time the reader
 * changed the range, and the reason the row it sits in could not be given a
 * height. A month is the unit the squares are actually legible at, it is five
 * or six rows whatever the range says, and "which month" is still the range's
 * answer: the month the last day on screen falls in.
 *
 * Because the month reaches past the range at both ends, the shading is read
 * from the whole series rather than the slice — a day inside the month that
 * the range does not cover is still a day the account had, and drawing it
 * empty would be a lie about the reader rather than a gap in the data. Days
 * with no row at all — before the account existed, or still ahead — carry no
 * date and are drawn as nothing.
 *
 * Levels are quartiles of the month's own busiest day rather than a fixed XP
 * scale, so the map is readable whether the reader earns 20 XP a day or 2,000.
 * A day with nothing is level 0 and drawn as an empty square — the absence is
 * the information.
 *
 * @param all    every day the account has, for the shading.
 * @param anchor an ISO date in the month to draw; the last day of the range.
 */
export function heatmapWeeks(all: GrowthDay[], anchor: string): HeatWeek[] {
  if (!anchor) return [];
  const at = (iso: string) => new Date(`${iso}T00:00:00`);
  const iso = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`;

  const start = at(anchor);
  if (Number.isNaN(start.getTime())) return [];
  const year = start.getFullYear();
  const month = start.getMonth();

  const earned = new Map<string, number>();
  all.forEach((day) => earned.set(day.date, Number(day.xp_earned) || 0));

  // The month's days, and the busiest of them to scale the four bands against.
  const days: string[] = [];
  for (let d = new Date(year, month, 1); d.getMonth() === month; d.setDate(d.getDate() + 1)) {
    days.push(iso(d));
  }
  const peak = Math.max(0, ...days.map((date) => earned.get(date) ?? 0));

  const blank = (): HeatCell => ({ date: null, xp: 0, level: 0 });
  const cellFor = (date: string): HeatCell => {
    if (!earned.has(date)) return blank();
    const xp = earned.get(date)!;
    // Anything above zero gets at least the faintest band, so a 5 XP day is
    // never indistinguishable from a day off.
    const level = xp <= 0 || peak <= 0 ? 0 : Math.max(1, Math.ceil((xp / peak) * 4));
    return { date, xp, level };
  };

  const cells: HeatCell[] = [];
  const lead = (at(days[0]!).getDay() - WEEK_START + 7) % 7;
  for (let i = 0; i < lead; i++) cells.push(blank());
  days.forEach((date) => cells.push(cellFor(date)));
  while (cells.length % 7 !== 0) cells.push(blank());

  const weeks: HeatWeek[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    const row = cells.slice(i, i + 7);
    // The row is labelled by the day it starts on in the month, whether or not
    // that day has a series row — a week of blanks in a month the account was
    // not around for still belongs to a date.
    const day = Math.max(1, i - lead + 1);
    weeks.push({
      label: at(iso(new Date(year, month, day))).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      days: row,
    });
  }
  return weeks;
}

// --------------------------------------------------------------------------
// Milestones
// --------------------------------------------------------------------------
export interface Milestone {
  /** The lifetime XP total it asks for. */
  target: number;
  /** The badge beside it. A label on the tier, not XP anything awards. */
  reward: number;
  /** The day the account crossed it, ISO, or null while it is still ahead. */
  reachedOn: string | null;
  /** Lifetime XP now, for the bar under an unreached tier. */
  progress: number;
}

/** The ladder. Each tier is worth a little more to reach than the last. */
const TIERS: Array<[target: number, reward: number]> = [
  [1_000, 50],
  [5_000, 100],
  [10_000, 200],
  [25_000, 350],
  [50_000, 500],
  [100_000, 1_000],
];

/** How many rows the panel shows: the last few cleared, and the next one. */
const MILESTONES_SHOWN = 3;

/**
 * Where the account is on the ladder.
 *
 * The date a tier was cleared is the first day the running total reached it,
 * read off the series — so it is a fact about the account rather than
 * something that had to be recorded at the time. That only works on the whole
 * history: `all` must be every day since the account was created, which is why
 * the page asks the endpoint for all of them.
 *
 * The list is trimmed to the interesting end. Six tiers with the first five
 * ticked is a list nobody reads; the last couple cleared and the one still
 * ahead is the same information about where the reader actually is.
 */
export function milestones(all: GrowthDay[]): Milestone[] {
  const lifetime = all.length ? Number(all[all.length - 1]!.cumulative_xp) || 0 : 0;

  const rows: Milestone[] = TIERS.map(([target, reward]) => ({
    target,
    reward,
    reachedOn:
      all.find((day) => (Number(day.cumulative_xp) || 0) >= target)?.date ?? null,
    progress: lifetime,
  }));

  const next = rows.findIndex((row) => row.reachedOn === null);
  if (next === -1) return rows.slice(-MILESTONES_SHOWN);
  return rows.slice(Math.max(0, next - (MILESTONES_SHOWN - 1)), next + 1);
}

// --------------------------------------------------------------------------
// Insights
// --------------------------------------------------------------------------
export interface Insight {
  /** `strong` is the finding; `hint` is what to do about it. */
  headline: string;
  hint: string;
}

const WEEKDAYS = [
  'Sundays',
  'Mondays',
  'Tuesdays',
  'Wednesdays',
  'Thursdays',
  'Fridays',
  'Saturdays',
];

/** "Tuesdays and Thursdays", "Mondays, Tuesdays and Fridays". */
function listOf(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Two things worth saying about the range, chosen from what the figures show.
 *
 * Which pair comes out depends only on the numbers, so the panel cannot
 * congratulate a month that went backwards — the failure mode of every
 * "insights" box that ships a fixed string. When there is genuinely nothing to
 * say, it says that instead of reaching for the next rule down.
 */
export function growthInsights(slice: RangeSlice): Insight[] {
  const { current } = slice;
  // The same rule the tiles follow: a baseline shorter than the window on
  // screen is not one. See `summaryFigures`.
  const previous =
    slice.previous.length === current.length ? slice.previous : [];
  const out: Insight[] = [];

  // Which days of the week the work actually happens on. Averaged per weekday
  // rather than totalled, because a 90-day range holds thirteen Mondays and
  // twelve Sundays and the extra Monday is not a finding.
  const byWeekday = Array.from({ length: 7 }, () => ({ xp: 0, days: 0 }));
  current.forEach((day) => {
    const at = new Date(`${day.date}T00:00:00`).getDay();
    const bucket = byWeekday[at]!;
    bucket.xp += Number(day.xp_earned) || 0;
    bucket.days += 1;
  });

  const averages = byWeekday.map((bucket) =>
    bucket.days ? bucket.xp / bucket.days : 0,
  );
  const best = Math.max(...averages);
  if (best > 0) {
    // Anything within a tenth of the best counts as tied with it: naming one
    // day out of two that are level is a claim the figures do not support.
    const names = averages
      .map((value, index) => ({ value, index }))
      .filter((entry) => entry.value >= best * 0.9)
      .map((entry) => WEEKDAYS[entry.index]!);
    if (names.length <= 3) {
      out.push({
        headline: `You're most productive on ${listOf(names)}.`,
        hint:
          names.length === 1
            ? 'Worth protecting that day from everything else.'
            : 'Keep up the great work!',
      });
    }
  }

  const perDayNow = current.length
    ? total(current, (day) => day.xp_earned) / current.length
    : 0;
  const perDayWas = previous.length
    ? total(previous, (day) => day.xp_earned) / previous.length
    : 0;
  const swing = change(perDayNow, perDayWas);

  if (swing !== null && swing !== 0) {
    const up = swing > 0;
    out.push({
      headline: `Your average XP per day has ${up ? 'increased' : 'fallen'} by ${Math.abs(swing)}%`,
      hint: `compared to the previous ${previous.length} days.`,
    });
  } else {
    // No baseline to compare against — All time, or an account younger than
    // the range. Say something the rows can support instead.
    const active = current.filter((day) => (Number(day.xp_earned) || 0) > 0).length;
    if (active > 0) {
      out.push({
        headline: `You earned XP on ${active} of these ${current.length} days.`,
        hint:
          active === current.length
            ? 'Not one day missed — that is the whole game.'
            : 'Consistency moves the line more than any single big day.',
      });
    }
  }

  if (!out.length) {
    out.push({
      headline: 'Nothing has happened here yet.',
      hint: 'Finish a task and this panel will have something to say.',
    });
  }

  return out.slice(0, 2);
}
