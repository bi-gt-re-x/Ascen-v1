/**
 * What the reader said about the work, once they had done it.
 *
 * Every other number in this app is measured off the record: XP is banked when
 * a task is completed, focus minutes are counted by a timer, a deadline is met
 * or it is not. Two things are not in the record and cannot be — how hard the
 * task actually was, and how well it actually went — and the prompt after a
 * completed task is the only place either one enters the system. See
 * components/Tasks/RatePrompt.
 *
 * ## Quality is the product, not the average
 *
 * `difficulty × execution`, 1 to 25. A trivial task done perfectly and a brutal
 * one botched both average to three and are not the same week; multiplied, they
 * are 5 and 5 respectively only by coincidence of the numbers — a 1×5 and a 5×1
 * — and everything either side of them separates. The scale is deliberately
 * top-heavy: 25 is a brutal task done excellently and there is no other way to
 * reach it, which is the behaviour the metric is trying to reward.
 *
 * ## Everything here is optional and none of it may pretend otherwise
 *
 * The prompt can be dismissed, and a large share of them are. That makes an
 * unrated task **missing data, not a bad score**, and the distinction runs
 * through every function in this file:
 *
 * - Unrated tasks are never counted as zero. They are not in the denominator.
 * - Coverage is reported beside every average, because "18.2 out of 25" from
 *   four ratings and from four hundred are different claims.
 * - A window with nothing rated returns `null`, not 0 — so a panel has to
 *   decide what to say about silence rather than drawing it as a bad review.
 *
 * The temptation this file exists to resist is treating rating frequency as a
 * proxy for quality. They are uncorrelated at best: the weeks somebody is too
 * busy to answer a dialog are often their best ones.
 */
import type { Task } from '@/types';

/** The best a single task can score: 5 for difficulty times 5 for execution. */
export const QUALITY_MAX = 25;

/** The five stars, in words. Shared with the prompt that collects them. */
export const DIFFICULTY_WORDS = ['Trivial', 'Easy', 'Fair', 'Hard', 'Brutal'];
export const EXECUTION_WORDS = ['Poor', 'Patchy', 'Solid', 'Strong', 'Excellent'];

/**
 * A task's quality score, or null when it was not rated on both rows.
 *
 * Both halves or neither, matching `rating_of` on the backend. The prompt lets
 * somebody answer one row and close the dialog, and that is a real answer to
 * the row they filled in — but it is not a quality score, because half the
 * product is missing and standing an average in for it would invent the exact
 * opinion the prompt exists to collect.
 */
export function qualityOf(task: Task): number | null {
  const difficulty = Number(task.difficulty);
  const execution = Number(task.execution);
  if (!Number.isFinite(difficulty) || !Number.isFinite(execution)) return null;
  if (difficulty < 1 || difficulty > 5 || execution < 1 || execution > 5) return null;
  return Math.round(difficulty) * Math.round(execution);
}

export interface RatedTask {
  id: string;
  name: string;
  difficulty: number;
  execution: number;
  /** difficulty × execution, 1-25. */
  quality: number;
  /** ISO day it was finished, for ordering and for the window filter. */
  on: string;
}

/** The rated tasks finished inside a window, oldest first. */
export function ratedTasks(tasks: Task[], fromIso: string, toIso: string): RatedTask[] {
  const out: RatedTask[] = [];
  tasks.forEach((task) => {
    const quality = qualityOf(task);
    if (quality === null) return;
    const on = String(task.completed_at || '').slice(0, 10);
    if (!on || on < fromIso || on > toIso) return;
    out.push({
      id: String(task.id),
      name: task.title,
      difficulty: Math.round(Number(task.difficulty)),
      execution: Math.round(Number(task.execution)),
      quality,
      on,
    });
  });
  return out.sort((a, b) => (a.on < b.on ? -1 : a.on > b.on ? 1 : 0));
}

export interface RatingSummary {
  /** How many finished tasks in the window carry both ratings. */
  rated: number;
  /** How many were finished at all. `rated / finished` is the coverage. */
  finished: number;
  /** Share of finished tasks that were rated, 0-100. */
  coverage: number;
  /** Mean difficulty × execution, or null when nothing is rated. */
  quality: number | null;
  difficulty: number | null;
  execution: number | null;
  /** The single best and worst rated task, or null. */
  best: RatedTask | null;
  worst: RatedTask | null;
}

const mean = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

/**
 * The window's ratings in one object, with the coverage that qualifies them.
 *
 * `finished` counts every completed task in the window and `rated` only the
 * ones with both stars, so a panel can always say "34 of 112" rather than
 * implying the average speaks for all the work. A window with nothing rated
 * comes back with three nulls and a coverage of 0 — the caller decides what to
 * say about that, and the honest options are all sentences rather than charts.
 */
export function summariseRatings(
  tasks: Task[],
  fromIso: string,
  toIso: string,
): RatingSummary {
  const rated = ratedTasks(tasks, fromIso, toIso);
  const finished = tasks.filter((task) => {
    const on = String(task.completed_at || '').slice(0, 10);
    return Boolean(on) && on >= fromIso && on <= toIso;
  }).length;

  let best: RatedTask | null = null;
  let worst: RatedTask | null = null;
  rated.forEach((task) => {
    if (!best || task.quality > best.quality) best = task;
    if (!worst || task.quality < worst.quality) worst = task;
  });

  return {
    rated: rated.length,
    finished,
    coverage: finished ? Math.round((rated.length / finished) * 100) : 0,
    quality: mean(rated.map((task) => task.quality)),
    difficulty: mean(rated.map((task) => task.difficulty)),
    execution: mean(rated.map((task) => task.execution)),
    best,
    worst,
  };
}

export interface QualityCell {
  difficulty: number;
  execution: number;
  count: number;
  /** difficulty × execution — what a task landing here is worth. */
  quality: number;
}

/**
 * The 5×5 grid of where rated tasks land.
 *
 * The one picture in this app that cannot be drawn from the record, and the
 * reason the prompt is worth asking at all. A cloud in the bottom-right is
 * hard work going well; one in the top-left is easy work going badly, which is
 * a different problem with a different fix and produces an identical XP total.
 * The diagonal is the interesting axis: tasks above it went better than their
 * difficulty predicted, tasks below it went worse.
 *
 * Always all 25 cells, including the empty ones. A grid drawn only where there
 * are tasks is a scatter of blocks with no frame, and the *empty* regions are
 * half the finding — an account with nothing in the right-hand columns is an
 * account that has not attempted anything hard.
 */
export function qualityGrid(rated: RatedTask[]): QualityCell[] {
  const counts = new Map<string, number>();
  rated.forEach((task) => {
    const key = `${task.difficulty}:${task.execution}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  const cells: QualityCell[] = [];
  // Execution descends so the strongest row is at the top, the way a reader
  // expects a y-axis to run; difficulty ascends left to right.
  for (let execution = 5; execution >= 1; execution--) {
    for (let difficulty = 1; difficulty <= 5; difficulty++) {
      cells.push({
        difficulty,
        execution,
        count: counts.get(`${difficulty}:${execution}`) ?? 0,
        quality: difficulty * execution,
      });
    }
  }
  return cells;
}

export interface QualityBand {
  label: string;
  hint: string;
  count: number;
  share: number;
  tone: string;
}

/**
 * The four quadrants of that grid, counted.
 *
 * The grid shows where the work landed and refuses to say what that means; this
 * says it. Three-and-up counts as "hard" and as "well" — the midpoint of a
 * five-star row is 3, and putting the cut anywhere else would be choosing a
 * conclusion before counting.
 */
export function qualityBands(rated: RatedTask[]): QualityBand[] {
  const total = rated.length;
  const count = (test: (task: RatedTask) => boolean) => rated.filter(test).length;
  const band = (label: string, hint: string, tone: string, n: number): QualityBand => ({
    label,
    hint,
    count: n,
    share: total ? Math.round((n / total) * 100) : 0,
    tone,
  });

  return [
    band(
      'Hard, done well',
      'Difficulty 3+ and execution 3+. The work worth having a record of.',
      'green',
      count((task) => task.difficulty >= 3 && task.execution >= 3),
    ),
    band(
      'Hard, went badly',
      'Difficulty 3+, execution below 3. Worth knowing what these had in common.',
      'amber',
      count((task) => task.difficulty >= 3 && task.execution < 3),
    ),
    band(
      'Easy, done well',
      'Difficulty below 3, execution 3+. Real work, but it is not stretching you.',
      'blue',
      count((task) => task.difficulty < 3 && task.execution >= 3),
    ),
    band(
      'Easy, went badly',
      'Difficulty below 3, execution below 3. Usually a day thing rather than a task thing.',
      'pink',
      count((task) => task.difficulty < 3 && task.execution < 3),
    ),
  ];
}

export interface RatingFinding {
  headline: string;
  hint: string;
  tone: 'good' | 'watch' | 'note';
}

/**
 * What the ratings support saying, and nothing beyond it.
 *
 * Every rule here is guarded on a count as well as a figure, because these are
 * self-reported numbers on an opt-in prompt and the samples are small. Under
 * `FLOOR` ratings the function returns a single row saying so — an account that
 * rated three tasks does not have a pattern, and a panel that announces one
 * from three is teaching the reader to discount the rows that arrive later.
 */
const FLOOR = 8;

export function ratingFindings(summary: RatingSummary, rated: RatedTask[]): RatingFinding[] {
  if (summary.rated < FLOOR) {
    return [
      {
        tone: 'note',
        headline: `${summary.rated} rated ${summary.rated === 1 ? 'task' : 'tasks'} in this window.`,
        hint: `Findings need ${FLOOR}. Rating is optional.`,
      },
    ];
  }

  const out: RatingFinding[] = [];
  const difficulty = summary.difficulty ?? 0;
  const execution = summary.execution ?? 0;

  // The gap between how hard the work is and how well it goes. Both are on the
  // same 1-5 scale, which is the only reason subtracting them means anything.
  const gap = execution - difficulty;
  if (Math.abs(gap) >= 0.6) {
    out.push(
      gap > 0
        ? {
            tone: 'watch',
            headline: 'You are executing well above the difficulty you take on.',
            hint: `Execution ${execution.toFixed(1)} against difficulty ${difficulty.toFixed(1)}. The work has stopped stretching you — take harder tasks, not better ones.`,
          }
        : {
            tone: 'watch',
            headline: 'You are taking on more than is going well.',
            hint: `Difficulty ${difficulty.toFixed(1)} against execution ${execution.toFixed(1)}. Fine as a phase — worth watching that it stays one.`,
          },
    );
  } else {
    out.push({
      tone: 'good',
      headline: 'Difficulty and execution are well matched.',
      hint: `${difficulty.toFixed(1)} against ${execution.toFixed(1)} — you are working at roughly the hardest level you can still do well, which is where the learning is.`,
    });
  }

  // Whether the hard work is actually going anywhere.
  const hard = rated.filter((task) => task.difficulty >= 4);
  if (hard.length >= 3) {
    const hardWell = hard.filter((task) => task.execution >= 3).length;
    const share = Math.round((hardWell / hard.length) * 100);
    out.push({
      tone: share >= 60 ? 'good' : 'watch',
      headline: `${share}% of your hardest tasks went well.`,
      hint: `${hardWell} of ${hard.length} tasks you rated 4 or 5 for difficulty came out at 3 or better for execution.`,
    });
  }

  // Movement across the window, second half against the first. Only when both
  // halves have enough in them to be halves.
  const half = Math.floor(rated.length / 2);
  const early = rated.slice(0, half);
  const late = rated.slice(rated.length - half);
  if (half >= 4) {
    const avg = (list: RatedTask[]) =>
      list.reduce((sum, task) => sum + task.quality, 0) / list.length;
    const change = avg(late) - avg(early);
    if (Math.abs(change) >= 1.5) {
      out.push({
        tone: change > 0 ? 'good' : 'watch',
        headline: `Quality has ${change > 0 ? 'risen' : 'fallen'} ${Math.abs(change).toFixed(1)} points across this window.`,
        hint: `${avg(early).toFixed(1)} over the first ${early.length} rated tasks against ${avg(late).toFixed(1)} over the last ${late.length}.`,
      });
    }
  }

  // The coverage caveat, always last and always present. Everything above is
  // drawn from a self-selected sample, and the reader should be told how large
  // it is even when — especially when — the findings sound confident.
  out.push({
    tone: 'note',
    headline: `These read ${summary.rated} of the ${summary.finished} tasks you finished.`,
    hint:
      summary.coverage >= 60
        ? 'A high enough share that the sample is unlikely to be flattering you.'
        : 'A minority of your work, and one you chose. An impression, not a measurement.',
  });

  return out;
}
