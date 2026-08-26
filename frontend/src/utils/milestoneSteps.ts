/**
 * The checklist under a checkpoint — every rule about what editing one does.
 *
 * Its own module for the reason `skillSteps` is: this is off-by-one arithmetic
 * on a short list, which is the kind of code that is correct until the
 * afternoon it is not, and wrong in a way that looks like a rounding error.
 * Keeping it out of the components means the rules can be asserted rather than
 * argued about — see scripts/check_steps.mjs.
 *
 * ## Three is a floor, not a default
 *
 * `MIN_STEPS` is enforced on both sides: the API pads whatever it is handed
 * back up to three, and every function here does the same. So there is no
 * state — not a fresh checkpoint, not one written before the column existed,
 * not the result of deleting rows — in which a checklist has fewer than three
 * entries. `removeStep` on a list of three therefore does not shorten it; it
 * empties the row, which is what "you cannot go below three" looks like to
 * somebody holding the delete button.
 *
 * A checkpoint you cannot name three pieces of is either already small enough
 * to be a task or has not been thought about yet, and the empty rows are the
 * prompt to do that thinking.
 *
 * ## Placeholders are derived, never stored
 *
 * A step is a placeholder exactly when its title is empty. Nothing carries a
 * flag that could go stale against the text beside it, and `PROMPTS` supplies
 * the greyed-out wording for the first three rows so an untouched checklist
 * reads as an invitation rather than as three blank lines.
 */
import type { MilestoneStep } from '@/types';

/** The floor. See the note above — this is not a starting count. */
export const MIN_STEPS = 3;

/** The ceiling. A checkpoint needing more than this is two checkpoints. */
export const MAX_STEPS = 8;

/** One step's title, in characters. Matches STEP_MAX in backend/api/goals.py. */
export const STEP_MAX = 120;

/** What the unwritten rows say. Prompts, not content. */
export const PROMPTS = [
  'Name the first piece of work',
  'Name the second',
  'Name what finishes it',
] as const;

/** The prompt for a row, or a generic one past the third. */
export function promptFor(index: number): string {
  return PROMPTS[index] ?? 'Name another piece of work';
}

/** Trimmed, squashed to single spaces, and cut to length. */
export function cleanStepTitle(text: string): string {
  return text.trim().replace(/\s+/g, ' ').slice(0, STEP_MAX);
}

function freshId(steps: MilestoneStep[]): string {
  const taken = new Set(steps.map((step) => step.id));
  let n = 1;
  while (taken.has(`s${n}`)) n += 1;
  return `s${n}`;
}

function blank(steps: MilestoneStep[]): MilestoneStep {
  return { id: freshId(steps), title: '', done: false, placeholder: true, task_id: null };
}

/**
 * A checklist that satisfies the rules, whatever it was handed.
 *
 * Every function here returns through this, so the floor, the ceiling and the
 * placeholder flag cannot be got wrong in one path and right in the others.
 */
export function normalise(steps: MilestoneStep[] | undefined | null): MilestoneStep[] {
  const out: MilestoneStep[] = [];
  for (const step of (steps ?? []).slice(0, MAX_STEPS)) {
    const title = cleanStepTitle(step?.title ?? '');
    out.push({
      id: step?.id || freshId(out),
      title,
      // An emptied row keeps its place and loses its tick: a step nobody has
      // written cannot be one somebody finished.
      done: title ? Boolean(step?.done) : false,
      placeholder: !title,
      // ...and loses its link for the same reason. A pointer hanging off a row
      // with no text is a task attached to nothing.
      task_id: title ? (step?.task_id ?? null) : null,
    });
  }
  while (out.length < MIN_STEPS) out.push(blank(out));
  return out;
}

/** How many of the written rows are done, and how many there are. */
export function stepProgress(steps: MilestoneStep[]): { done: number; total: number } {
  const real = steps.filter((step) => !step.placeholder);
  return { done: real.filter((step) => step.done).length, total: real.length };
}

/** A checkpoint is finishable when every written step is ticked and one exists. */
export function stepsComplete(steps: MilestoneStep[]): boolean {
  const { done, total } = stepProgress(steps);
  return total > 0 && done === total;
}

export function editStep(steps: MilestoneStep[], index: number, text: string): MilestoneStep[] {
  const next = steps.map((step, at) =>
    at === index ? { ...step, title: cleanStepTitle(text) } : step,
  );
  return normalise(next);
}

export function toggleStep(steps: MilestoneStep[], index: number): MilestoneStep[] {
  const next = steps.map((step, at) =>
    // A placeholder has nothing to tick. Without this guard the empty rows
    // that keep a short checklist at three could be marked done, and a
    // checkpoint would report progress against work nobody had named.
    at === index && !step.placeholder ? { ...step, done: !step.done } : step,
  );
  return normalise(next);
}

/** Point a step at a task, or clear it with null. */
export function linkStep(
  steps: MilestoneStep[],
  index: number,
  taskId: string | null,
): MilestoneStep[] {
  return normalise(
    steps.map((step, at) => (at === index ? { ...step, task_id: taskId } : step)),
  );
}

/** Where a task is already the execution for a step, or -1. */
export function stepForTask(steps: MilestoneStep[], taskId: string): number {
  return steps.findIndex((step) => step.task_id === taskId);
}

/** Append an empty row, up to `MAX_STEPS`. At the ceiling the list is unchanged. */
export function addStep(steps: MilestoneStep[]): MilestoneStep[] {
  if (steps.length >= MAX_STEPS) return steps;
  return normalise([...steps, blank(steps)]);
}

/**
 * The three the card shows, and where they start.
 *
 * A card is not the place for eight rows, and the three that matter are the
 * ones around whatever is unfinished — so the window opens on the first
 * undone step rather than always at the top, and slides back from the end so
 * a checklist finishing at step eight still shows three rather than one.
 */
export function stepWindow(
  steps: MilestoneStep[],
  size = MIN_STEPS,
): { from: number; shown: MilestoneStep[] } {
  if (steps.length <= size) return { from: 0, shown: steps };
  const next = steps.findIndex((step) => !step.done);
  const at = next === -1 ? steps.length - size : next;
  const from = Math.max(0, Math.min(at, steps.length - size));
  return { from, shown: steps.slice(from, from + size) };
}

/**
 * Drop a row — or, at the floor, empty it.
 *
 * The two behaviours are one rule seen from either side of `MIN_STEPS`, and
 * doing nothing at the floor would have been the worse answer: the reader
 * pressed delete on a row with text in it, and the text has to go somewhere.
 */
export function removeStep(steps: MilestoneStep[], index: number): MilestoneStep[] {
  if (steps.length <= MIN_STEPS) return editStep(steps, index, '');
  return normalise(steps.filter((_, at) => at !== index));
}
