/**
 * Everything the subject page states, worked out from one fetch.
 *
 * ## The rule this file exists to keep
 *
 * **Every figure here is counted off this account's own tasks.** The analytics
 * page's own note says it and it holds harder on this page than anywhere else:
 * there is no sample data and no placeholder mode. Four tabs of that page once
 * fell back to invented figures behind a small chip, and it taught readers to
 * discount the real ones when they arrived.
 *
 * That rule is what shaped the sections below, because the obvious design for
 * a subject page asks for things Ascen has never recorded. A page about
 * Mathematics wants to say "Geometry 68%, Algebra 94%" — and there is no
 * evidence anywhere in this app for either number. Tasks carry a *subject* and
 * nothing finer. The skill trees do name sub-skills, but they are authored
 * hierarchies whose node states are illustrative (see skills/subjectTrees), so
 * reading mastery off them would be reporting a designer's guess as the
 * reader's record. Likewise "47 problems attempted, 32 correct": Ascen counts
 * tasks, not questions, and has no notion of a right answer.
 *
 * So each of those questions is answered with the nearest thing the record can
 * actually support, and the panel says which:
 *
 *   the sub-skill breakdown   →  the difficulty bands, which *are* recorded
 *                                (the difficulty star on every rated task)
 *   the mistake analysis      →  the twelve reasons, which are a closed
 *                                vocabulary precisely so they can be counted
 *   solve time by difficulty  →  `completion_seconds` grouped the same way
 *   problems correct          →  nothing. It is not asked.
 *
 * The shape of the page is the one that was asked for. The numbers in it are
 * the ones that are true.
 *
 * ## Rates, and changes, are two different jobs
 *
 * The **score** is the mean of four rates that are each already 0-100 by
 * construction — a share of something out of something. Nothing is normalised
 * onto an invented scale to get there, which is what keeps the letter grade
 * checkable: `howScored` prints the four numbers it was made of.
 *
 * The **growth** figures are percentage *changes* against the window
 * immediately before, which is where a count of tasks or a mean solve time can
 * be honest without a scale. A count has no natural ceiling; its change does.
 *
 * Both use the same window and the same equal-length period before it, for the
 * reason `sliceWindow` gives in components/Analytics/data: a baseline of a
 * different length reports the difference in length as a change in behaviour.
 */
import {
  DIFFICULTY_WORDS,
  qualityOf,
  reasonOf,
  type ReasonSide,
} from '@/utils/ratings';
import { gradeFor } from '@/utils/analyticalScore';
import type { Grade } from '@/types';
import { windowOption, type WindowKey } from '@/components/Analytics/data';
import type { AnalyticsTask } from '@/services/analytics';

// --------------------------------------------------------------------------
// Days
// --------------------------------------------------------------------------

/** The ISO day a stamp falls on. Stamps arrive as dates or as date-times. */
function dayOf(stamp: string | undefined): string {
  return (stamp ?? '').slice(0, 10);
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shift(iso: string, days: number): string {
  const at = new Date(`${iso}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return isoDay(at);
}

/**
 * The window's own days and the equal-length run before it.
 *
 * All Time has no before by definition, and `previousFrom` is empty rather
 * than reaching for the account's creation date: comparing a record against
 * the void it was made out of is not a comparison.
 */
export interface Span {
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  /** Days the current window covers, for the rates that divide by it. */
  days: number;
}

export function spanFor(key: WindowKey, today: string): Span {
  const { days } = windowOption(key);
  if (days === null) {
    return { from: '', to: today, previousFrom: '', previousTo: '', days: 0 };
  }
  const from = shift(today, -(days - 1));
  return {
    from,
    to: today,
    previousFrom: shift(from, -days),
    previousTo: shift(from, -1),
    days,
  };
}

/** Whether a day falls inside a range. An empty `from` means "no floor". */
function within(day: string, from: string, to: string): boolean {
  if (!day) return false;
  if (from && day < from) return false;
  return !to || day <= to;
}

// --------------------------------------------------------------------------
// The four rates the score is made of
// --------------------------------------------------------------------------

/**
 * One 0-100 rate, with the window before it for comparison.
 *
 * `before` is null when there is nothing to compare against — All Time, or a
 * previous window in which nothing happened. A delta of zero would be a claim
 * ("no change") where the honest answer is silence.
 */
export interface Rate {
  key: string;
  label: string;
  /** 0-100. */
  now: number;
  before: number | null;
  /** Percentage points, now minus before. */
  delta: number | null;
  /** What the rate is a share of, in the reader's own words. */
  note: string;
  /** Whether this rate could be measured at all. */
  known: boolean;
}

function rate(
  key: string,
  label: string,
  note: string,
  now: number | null,
  before: number | null,
): Rate {
  const known = now !== null;
  return {
    key,
    label,
    note,
    known,
    now: now ?? 0,
    before,
    delta: now !== null && before !== null ? Math.round(now - before) : null,
  };
}

/** Mean quality as a percentage. Quality is difficulty x execution, 1-25. */
function qualityRate(tasks: AnalyticsTask[]): number | null {
  const scores = tasks.map((task) => qualityOf(task)).filter((q): q is number => q !== null);
  if (!scores.length) return null;
  return (scores.reduce((sum, q) => sum + q, 0) / scores.length / 25) * 100;
}

/** Days with a finished task, out of the days the window covers. */
function consistencyRate(tasks: AnalyticsTask[], days: number): number | null {
  if (days <= 0) return null;
  const active = new Set(tasks.map((task) => dayOf(task.completed_at)).filter(Boolean));
  return Math.min(100, (active.size / days) * 100);
}

/**
 * The share of finished work that met its deadline.
 *
 * Only tasks that *had* a deadline are counted. A subject worked without due
 * dates is not a subject that misses them, and scoring it at zero would make
 * the letter grade a report on whether the reader uses a feature.
 */
function timelinessRate(tasks: AnalyticsTask[]): number | null {
  const dated = tasks.filter((task) => task.due_date);
  if (!dated.length) return null;
  return (dated.filter((task) => task.met_deadline).length / dated.length) * 100;
}

/** Finished, out of everything filed under the subject that is old enough to judge. */
function followThroughRate(done: number, open: number): number | null {
  const all = done + open;
  return all ? (done / all) * 100 : null;
}

// --------------------------------------------------------------------------
// The breakdown that replaces sub-skills
// --------------------------------------------------------------------------

/**
 * One difficulty band, and how the account does at it.
 *
 * This is the honest form of "which parts of this subject are you weak at".
 * The difficulty star is recorded on every rated task, so a band is evidence;
 * a named sub-skill would not be. `holding` is the mean execution star as a
 * percentage — how well the work went, at that difficulty.
 */
export interface Band {
  /** The difficulty star, 1-5. */
  level: number;
  label: string;
  done: number;
  /** Mean execution at this difficulty, 0-100. Null when none were rated. */
  holding: number | null;
  /** Percentage points against the same band in the window before. */
  delta: number | null;
  /** Mean seconds a task at this difficulty took, or null. */
  seconds: number | null;
  /** Seconds against the same band before — negative is faster. */
  secondsDelta: number | null;
}

function bandsOf(now: AnalyticsTask[], before: AnalyticsTask[]): Band[] {
  const holdingOf = (list: AnalyticsTask[], level: number): number | null => {
    const rated = list.filter(
      (task) => Math.round(Number(task.difficulty)) === level && Number(task.execution) >= 1,
    );
    if (!rated.length) return null;
    return (rated.reduce((sum, task) => sum + Number(task.execution), 0) / rated.length / 5) * 100;
  };

  const paceOf = (list: AnalyticsTask[], level: number): number | null => {
    const timed = list.filter(
      (task) =>
        Math.round(Number(task.difficulty)) === level && Number(task.completion_seconds) > 0,
    );
    if (!timed.length) return null;
    return timed.reduce((sum, task) => sum + Number(task.completion_seconds), 0) / timed.length;
  };

  return [1, 2, 3, 4, 5].map((level) => {
    const holding = holdingOf(now, level);
    const was = holdingOf(before, level);
    const seconds = paceOf(now, level);
    const secondsWas = paceOf(before, level);
    return {
      level,
      label: DIFFICULTY_WORDS[level - 1] ?? `${level}`,
      done: now.filter((task) => Math.round(Number(task.difficulty)) === level).length,
      holding,
      delta: holding !== null && was !== null ? Math.round(holding - was) : null,
      seconds,
      secondsDelta:
        seconds !== null && secondsWas !== null ? Math.round(seconds - secondsWas) : null,
    };
  });
}

// --------------------------------------------------------------------------
// The counted reasons that replace a mistake taxonomy
// --------------------------------------------------------------------------

/**
 * One reason, counted.
 *
 * The twelve words are a closed vocabulary for exactly this — see the note in
 * utils/ratings. A free-text box would collect twelve spellings of "I got
 * distracted" and produce twelve findings of one task each.
 */
export interface Driver {
  key: string;
  label: string;
  phrase: string;
  side: ReasonSide;
  count: number;
  /** Share of the reasons given on this side, 0-100. */
  share: number;
}

function driversOf(tasks: AnalyticsTask[], side: ReasonSide): Driver[] {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    const found = reasonOf(task.reason);
    if (!found || found.side !== side) continue;
    counts.set(task.reason!, (counts.get(task.reason!) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  if (!total) return [];

  return [...counts.entries()]
    .map(([key, count]) => {
      const found = reasonOf(key)!;
      return {
        key,
        label: found.reason.label,
        phrase: found.reason.phrase,
        side,
        count,
        share: Math.round((count / total) * 100),
      };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

// --------------------------------------------------------------------------
// What has been done lately
// --------------------------------------------------------------------------

export interface Recent {
  id: string;
  title: string;
  on: string;
  /** difficulty x execution out of 25, or null when it was not rated on both. */
  quality: number | null;
  seconds: number | null;
  /** The one-word reading of the execution star. */
  verdict: 'went well' | 'mixed' | 'struggled' | 'not rated';
}

function verdictOf(task: AnalyticsTask): Recent['verdict'] {
  const execution = Number(task.execution);
  if (!Number.isFinite(execution) || execution < 1) return 'not rated';
  if (execution >= 4) return 'went well';
  if (execution >= 3) return 'mixed';
  return 'struggled';
}

/**
 * How the last stretch of rated work went, oldest first.
 *
 * Quality as a percentage of the 25 it is scored out of, so the row of
 * readings is on the same scale as everything else on the page.
 */
export interface Run {
  readings: Array<{ id: string; on: string; percent: number }>;
  /** The second half against the first, in percentage points. */
  trend: number | null;
}

function runOf(done: AnalyticsTask[], most: number): Run {
  const rated = done
    .map((task) => ({ task, quality: qualityOf(task) }))
    .filter((entry): entry is { task: AnalyticsTask; quality: number } => entry.quality !== null)
    .slice(-most);

  const readings = rated.map(({ task, quality }) => ({
    id: task.id,
    on: dayOf(task.completed_at),
    percent: Math.round((quality / 25) * 100),
  }));

  // Halves rather than a fitted line: with ten readings a regression is a
  // more precise answer to a question this thin cannot support, and the two
  // means are something a reader can check by looking at the row.
  if (readings.length < 4) return { readings, trend: null };
  const half = Math.floor(readings.length / 2);
  const mean = (list: typeof readings) =>
    list.reduce((sum, entry) => sum + entry.percent, 0) / list.length;
  return {
    readings,
    trend: Math.round(mean(readings.slice(half)) - mean(readings.slice(0, half))),
  };
}

// --------------------------------------------------------------------------
// What to do about it
// --------------------------------------------------------------------------

/**
 * A recommendation, with the arithmetic that produced it attached.
 *
 * `why` is not a flourish. It is the rule the Recommendations tab is built on
 * — an instruction with a number behind it, and the number shown — and a
 * subject page that said "practise more geometry" without saying what made it
 * say so would be the horoscope this app is written against.
 */
export interface Advice {
  id: string;
  title: string;
  detail: string;
  why: string;
  weight: 'first' | 'second' | 'upkeep';
}

function adviceFrom(bands: Band[], struggles: Driver[], rates: Rate[]): Advice[] {
  const out: Advice[] = [];

  // The weakest band that has enough behind it to be a finding rather than a
  // bad afternoon. Three is not a sample; it is the floor at which naming
  // something stops being noise.
  const measured = bands.filter((band) => band.holding !== null && band.done >= 3);
  const weakest = [...measured].sort((a, b) => a.holding! - b.holding!)[0];
  const strongest = [...measured].sort((a, b) => b.holding! - a.holding!)[0];

  if (weakest && strongest && weakest.level !== strongest.level) {
    out.push({
      id: 'weakest-band',
      title: `Put the next stretch into ${weakest.label.toLowerCase()} work`,
      detail:
        `Your ${weakest.label.toLowerCase()} tasks come out at ${Math.round(weakest.holding!)}% `
        + `on execution against ${Math.round(strongest.holding!)}% for ${strongest.label.toLowerCase()} `
        + 'ones. That gap is the whole of the difference in this subject.',
      why:
        `${weakest.done} ${weakest.done === 1 ? 'task' : 'tasks'} at ${weakest.label.toLowerCase()}, `
        + `mean execution ${(weakest.holding! / 20).toFixed(1)} of 5.`,
      weight: 'first',
    });
  }

  const top = struggles[0];
  if (top) {
    out.push({
      id: `reason-${top.key}`,
      title: `Deal with "${top.label.toLowerCase()}" before the next session`,
      detail:
        `It is behind ${top.share}% of the sessions you said went badly in this subject. `
        + 'It is a condition rather than a skill, which is what makes it the cheapest thing '
        + 'on this page to change.',
      why: `${top.count} of the rated tasks you struggled with ${top.phrase}.`,
      weight: 'second',
    });
  }

  const soft = rates.filter((entry) => entry.known && entry.now < 60);
  for (const entry of soft) {
    out.push({
      id: `rate-${entry.key}`,
      title: `${entry.label} is the measure holding the grade down`,
      detail: `It is at ${Math.round(entry.now)}%, which is the lowest of the four this subject is scored on.`,
      why: entry.note,
      weight: 'upkeep',
    });
  }

  return out;
}

// --------------------------------------------------------------------------
// The whole page
// --------------------------------------------------------------------------

export interface SubjectModel {
  /** Whether there is enough here to say anything at all. */
  any: boolean;
  span: Span;

  done: AnalyticsTask[];
  open: number;

  /** The four rates, and the score and letter they average to. */
  rates: Rate[];
  score: number | null;
  grade: Grade | null;
  howScored: string;

  /** Percentage change against the window before, per thing counted. */
  growth: Array<{ key: string; label: string; change: number | null; note: string }>;

  invested: number;
  streak: number;
  finished: number;
  finishedBefore: number;

  bands: Band[];
  weakest: Band | null;
  strongest: Band | null;

  struggles: Driver[];
  wentWell: Driver[];

  run: Run;
  recent: Recent[];
  goalAimed: number | null;

  advice: Advice[];
  insight: string | null;
}

/** How many finished tasks the page will draw a run of. */
const RUN_LENGTH = 10;

/** How many rows the recent-work list prints. */
const RECENT_ROWS = 6;

/**
 * The whole page, from the account's tasks.
 *
 * `today` is passed rather than read so the arithmetic is a pure function of
 * its inputs — a model that reached for the clock could not be tested, and
 * every window on this page is measured back from it.
 */
export function subjectModel(
  all: AnalyticsTask[],
  subjectId: string,
  key: WindowKey,
  today: string,
): SubjectModel {
  const mine = all.filter((task) => task.subject === subjectId);
  const span = spanFor(key, today);

  const finishedIn = (from: string, to: string) =>
    mine.filter(
      (task) => task.status === 'done' && within(dayOf(task.completed_at), from, to),
    );

  const done = finishedIn(span.from, span.to);
  const before = span.previousFrom ? finishedIn(span.previousFrom, span.previousTo) : [];
  const open = mine.filter((task) => task.status !== 'done').length;

  // ---- The four rates, and the letter they come to ------------------------
  const rates: Rate[] = [
    rate(
      'quality',
      'Quality',
      'Difficulty times execution on the tasks you rated, against the 25 it is scored out of.',
      qualityRate(done),
      qualityRate(before),
    ),
    rate(
      'consistency',
      'Consistency',
      'Days you finished something in this subject, out of the days the window covers.',
      consistencyRate(done, span.days || new Set(mine.map((t) => dayOf(t.completed_at))).size),
      span.previousFrom ? consistencyRate(before, span.days) : null,
    ),
    rate(
      'timeliness',
      'Timeliness',
      'Of the tasks here that had a due date, the share that met it.',
      timelinessRate(done),
      timelinessRate(before),
    ),
    rate(
      'follow-through',
      'Follow-through',
      'Finished, out of everything you have filed under this subject.',
      followThroughRate(mine.filter((task) => task.status === 'done').length, open),
      null,
    ),
  ];

  const measured = rates.filter((entry) => entry.known);
  const score = measured.length
    ? Math.round(measured.reduce((sum, entry) => sum + entry.now, 0) / measured.length)
    : null;

  const howScored = measured.length
    ? `${measured.map((entry) => `${entry.label} ${Math.round(entry.now)}`).join(', ')} — `
      + `the mean of ${measured.length === 1 ? 'that one' : `those ${measured.length}`}, `
      + `${score} out of 100.`
    : '';

  // ---- Change against the window before -----------------------------------
  const change = (now: number, was: number): number | null =>
    was > 0 ? Math.round(((now - was) / was) * 100) : null;

  const seconds = (list: AnalyticsTask[]) =>
    list.reduce((sum, task) => sum + Math.max(0, Number(task.completion_seconds) || 0), 0);

  const activeDays = (list: AnalyticsTask[]) =>
    new Set(list.map((task) => dayOf(task.completed_at)).filter(Boolean)).size;

  const meanPace = (list: AnalyticsTask[]) => {
    const timed = list.filter((task) => Number(task.completion_seconds) > 0);
    return timed.length ? seconds(timed) / timed.length : 0;
  };

  const growth = [
    {
      key: 'volume',
      label: 'Volume',
      change: change(done.length, before.length),
      note: `${done.length} finished against ${before.length} the window before.`,
    },
    {
      key: 'time',
      label: 'Time on it',
      change: change(seconds(done), seconds(before)),
      note: 'Logged time on the tasks you finished.',
    },
    {
      key: 'turning-up',
      label: 'Turning up',
      change: change(activeDays(done), activeDays(before)),
      note: `${activeDays(done)} days with work in them against ${activeDays(before)}.`,
    },
    {
      key: 'pace',
      /* Inverted on purpose, and the label says so. A mean solve time falling
         is an improvement, and a bare "-18%" beside three figures where up is
         good would be read as the one thing going wrong. */
      label: 'Pace (faster is up)',
      change: (() => {
        const now = meanPace(done);
        const was = meanPace(before);
        return was > 0 && now > 0 ? Math.round(((was - now) / was) * 100) : null;
      })(),
      note: 'Mean time a finished task took, against the window before.',
    },
  ];

  // ---- The streak, counted back from today --------------------------------
  const activeSet = new Set(
    mine
      .filter((task) => task.status === 'done')
      .map((task) => dayOf(task.completed_at))
      .filter(Boolean),
  );
  /* From today, or from yesterday when today has nothing in it yet. A streak
     that broke the moment the clock passed midnight would report every reader
     as having lost it every morning. */
  let cursor = activeSet.has(today) ? today : shift(today, -1);
  let streak = 0;
  while (activeSet.has(cursor)) {
    streak += 1;
    cursor = shift(cursor, -1);
  }

  // ---- The rest -----------------------------------------------------------
  const bands = bandsOf(done, before);
  const rankable = bands.filter((band) => band.holding !== null && band.done >= 3);
  const weakest = [...rankable].sort((a, b) => a.holding! - b.holding!)[0] ?? null;
  const strongest = [...rankable].sort((a, b) => b.holding! - a.holding!)[0] ?? null;

  const struggles = driversOf(done, 'struggle');
  const wentWell = driversOf(done, 'went-well');

  const byRecency = [...done].sort((a, b) =>
    dayOf(a.completed_at).localeCompare(dayOf(b.completed_at)),
  );

  const recent: Recent[] = byRecency
    .slice(-RECENT_ROWS)
    .reverse()
    .map((task) => ({
      id: task.id,
      title: task.title,
      on: dayOf(task.completed_at),
      quality: qualityOf(task),
      seconds: Number(task.completion_seconds) > 0 ? Number(task.completion_seconds) : null,
      verdict: verdictOf(task),
    }));

  const goalAimed = done.length
    ? Math.round((done.filter((task) => task.goal_id).length / done.length) * 100)
    : null;

  const advice = adviceFrom(bands, struggles, rates);

  /* The one sentence the page is for, and it is only written when the record
     supports it. A "key insight" generated whether or not there is one is the
     line that teaches a reader to skip the box it lives in. */
  const insight =
    weakest && strongest && weakest.level !== strongest.level && strongest.holding! - weakest.holding! >= 15
      ? `Your ${strongest.label.toLowerCase()} work is not the problem — it comes out at `
        + `${Math.round(strongest.holding!)}%. What is pulling this subject down is the `
        + `${weakest.label.toLowerCase()} end, at ${Math.round(weakest.holding!)}%. Closing that `
        + 'gap moves the whole subject without asking you for more hours.'
      : null;

  return {
    any: mine.length > 0,
    span,
    done,
    open,
    rates,
    score,
    grade: score === null ? null : gradeFor(score),
    howScored,
    growth,
    invested: seconds(done),
    streak,
    finished: done.length,
    finishedBefore: before.length,
    bands,
    weakest,
    strongest,
    struggles,
    wentWell,
    run: runOf(byRecency, RUN_LENGTH),
    recent,
    goalAimed,
    advice,
    insight,
  };
}
