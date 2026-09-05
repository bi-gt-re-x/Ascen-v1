/**
 * What has happened since the reader was last on this page.
 *
 * The seven tabs all answer questions about a *state*: how the account is
 * doing, over a window the reader picks. None of them answers the question
 * somebody actually arrives with on their fourth visit, which is what has
 * changed since the third. A reader who came back after a fortnight had to
 * work that out by remembering what the numbers said last time.
 *
 * ## There is no new storage behind this
 *
 * That is the whole reason it is worth having. The obvious way to know when
 * somebody was last here is to write a timestamp when they leave, which means
 * a preference, a write on every visit, and a figure that is wrong the first
 * time a write fails or a tab is closed early.
 *
 * The page already knows. Reading `/api/get_growth_ratings` files a dated
 * snapshot per metric (backend/tracking/analytics.py), and that read happens
 * exactly once, on opening this page — so the score log *is* a visit log, kept
 * by a mechanism that has been running since the report card existed. The last
 * point that is not today is the last day the reader opened Analytics.
 *
 * Everything else comes off the day series, which the page holds whole. So
 * this costs one pass over a slice of an array already in memory, and it
 * carries no risk of drifting out of step with the panels below it: they are
 * reading the same rows.
 *
 * ## It says nothing about the score, on purpose
 *
 * `scoreMovement` in components/Analytics/Header already answers "what moved"
 * for the grade, and `Summary` prints it on the Overview. Two statements about
 * the same number, in two places, is how they end up disagreeing — and a strip
 * that repeated it would be the second one. This answers the half nothing else
 * does: what the *record* did while the reader was away.
 *
 * It also does not judge. "You earned 400 XP" is a fact about the fortnight;
 * "you slowed down" is a claim, and the tabs below are where claims belong,
 * with their evidence attached.
 */
import type { GrowthDay } from '@/types';
import type { MetricPoint } from '@/services/analytics';

export interface SinceLastVisit {
  /** The day the reader was last here, ISO. */
  on: string;
  /** Whole days between then and today. Always at least 1. */
  daysAgo: number;
  /** XP earned, tasks finished, and days with anything on them, in between. */
  xp: number;
  tasks: number;
  activeDays: number;
}

/**
 * The reading before today's, and what the record did since.
 *
 * `null` when there is nothing true to say: a first visit, a second visit on
 * the same day as the first, or a day series that does not reach back far
 * enough to describe the gap.
 *
 * @param points  Dated score readings, oldest first. Read for their *dates*
 *                only — this is a visit log that happens to carry a score. See
 *                `MetricHistory`, and the note above about why the score in it
 *                is not printed here.
 * @param days    The whole day series, oldest first.
 * @param today   The reader's own today, as ISO. Passed in rather than read
 *                from the clock, because every stored stamp in this app is
 *                local time with no zone (backend/tracking/xp.py) and a
 *                function that decided "today" for itself would disagree with
 *                the page around it at midnight.
 */
export function sinceLastVisit(
  points: MetricPoint[],
  days: GrowthDay[],
  today: string,
): SinceLastVisit | null {
  if (points.length === 0) return null;

  /*
   * The last reading that is not today's.
   *
   * Today's own reading may or may not be in this list, and which it is
   * depends on a race the page cannot win: opening it fires the ratings read
   * (which files a snapshot) and the history read at the same time. Skipping
   * every point dated today makes the answer the same either way, which is
   * worth more than a point of precision — "since your last visit" must not
   * mean "since ten seconds ago" for whoever loses the race.
   */
  const before = points.filter((point) => day(point.date) < today);
  const last = before[before.length - 1];
  if (!last) return null;

  const on = day(last.date);
  const daysAgo = between(on, today);
  if (daysAgo < 1) return null;

  /* The days *after* the visit, up to and including today. The visit day
     itself is excluded: whatever was on it had already happened when the
     reader looked at it. */
  const span = days.filter((entry) => entry.date > on && entry.date <= today);

  return {
    on,
    daysAgo,
    xp: span.reduce((sum, entry) => sum + num(entry.xp_earned), 0),
    tasks: span.reduce((sum, entry) => sum + num(entry.tasks_completed), 0),
    activeDays: span.filter((entry) => num(entry.xp_earned) > 0 || num(entry.tasks_completed) > 0)
      .length,
  };
}

/** A stored stamp as an ISO day. They arrive both ways — see MetricPoint. */
function day(stamp: string): string {
  return String(stamp || '').slice(0, 10);
}

/** Whole days from one ISO day to another. Negative when `to` is earlier. */
function between(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`).getTime();
  const b = new Date(`${to}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

const num = (value: unknown) => Number(value) || 0;
