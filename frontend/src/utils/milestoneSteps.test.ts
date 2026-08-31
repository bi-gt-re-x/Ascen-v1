/**
 * `fromTitles` — the model's answer, as a checklist.
 *
 * The rest of this module is exercised through the goals page; this one is
 * tested directly because it is the seam the drafted plan arrives through,
 * and everything it has to defend against is a shape a model can return.
 */
import { describe, expect, it } from 'vitest';
import { MAX_STEPS, MIN_STEPS, STEP_MAX, fromTitles } from './milestoneSteps';

describe('fromTitles', () => {
  it('turns five titles into five written steps', () => {
    const steps = fromTitles([
      'Read the knapsack chapter',
      'Do ten practice problems',
      'Redo the ones that failed',
      'Time a full contest',
      'Review the editorial',
    ]);

    expect(steps).toHaveLength(5);
    expect(steps.map((step) => step.title)).toEqual([
      'Read the knapsack chapter',
      'Do ten practice problems',
      'Redo the ones that failed',
      'Time a full contest',
      'Review the editorial',
    ]);
    expect(steps.every((step) => !step.placeholder)).toBe(true);
    expect(steps.every((step) => !step.done)).toBe(true);
  });

  it('pads up to the floor when the model was short', () => {
    const steps = fromTitles(['Only this one']);
    expect(steps).toHaveLength(MIN_STEPS);
    expect(steps[0]!.placeholder).toBe(false);
    expect(steps.slice(1).every((step) => step.placeholder)).toBe(true);
  });

  it('cuts at the ceiling when the model was long', () => {
    const steps = fromTitles(Array.from({ length: 12 }, (_, i) => `Step ${i + 1}`));
    expect(steps).toHaveLength(MAX_STEPS);
    expect(steps[MAX_STEPS - 1]!.title).toBe(`Step ${MAX_STEPS}`);
  });

  /* A row with no text cannot be ticked, and the model does return blanks. */
  it('makes an empty title a placeholder rather than a written step', () => {
    const steps = fromTitles(['Real one', '   ', 'Another real one']);
    expect(steps[1]!.placeholder).toBe(true);
    expect(steps[1]!.title).toBe('');
  });

  it('trims a title to the column width', () => {
    const steps = fromTitles(['x'.repeat(STEP_MAX + 40)]);
    expect(steps[0]!.title).toHaveLength(STEP_MAX);
  });

  it('gives every step a distinct id', () => {
    const steps = fromTitles(['One', 'Two', 'Three', 'Four', 'Five']);
    expect(new Set(steps.map((step) => step.id)).size).toBe(steps.length);
  });
});
