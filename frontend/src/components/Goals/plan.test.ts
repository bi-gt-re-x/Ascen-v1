/**
 * The chain from a new goal to a plan with steps in it.
 *
 * Three things were wrong and none of them was a crash: the reader's own
 * checkpoints were overwritten by the model's, the model's checkpoints were
 * never broken into steps, and a counter goal could be handed a ladder. Each
 * is pinned here against a stand-in for the service, so what is checked is
 * which calls are made and what is written — the model itself is the server's
 * business (tests/test_planner_end_to_end.py).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Goal } from '@/types';

const service = vi.hoisted(() => ({
  getGoals: vi.fn(),
  suggestMilestones: vi.fn(),
  setMilestones: vi.fn(),
  suggestSteps: vi.fn(),
  updateMilestone: vi.fn(),
}));

vi.mock('@/services', () => ({ goals: service }));

import { fillSteps, planGoal } from './plan';

const PROMPT = { title: '', done: false, placeholder: true, task_id: null, due: null };

function stone(id: string, title: string, written: string[] = [], status = 'pending') {
  const steps = written.length
    ? written.map((text, i) => ({ id: `s${i + 1}`, title: text, done: false, placeholder: false, task_id: null, due: null }))
    : [1, 2, 3].map((n) => ({ ...PROMPT, id: `s${n}` }));
  return { id, goal_id: 'g1', title, status, position: 0, target_date: '', steps };
}

function goal(milestones: ReturnType<typeof stone>[], measure = 'milestones'): Goal {
  return { id: 'g1', title: 'Reach USACO Gold', measure, goal_type: 'xp', milestones } as unknown as Goal;
}

const STEPS = ['Read the knapsack chapter', 'Solve ten DP problems', 'Redo the misses', 'Time a contest', 'Read the editorial'];

beforeEach(() => {
  Object.values(service).forEach((fn) => fn.mockReset());
  service.suggestSteps.mockResolvedValue({ success: true, steps: STEPS });
  service.updateMilestone.mockResolvedValue({ success: true });
  service.setMilestones.mockResolvedValue({ success: true });
});

describe('planning a new goal', () => {
  it('keeps the checkpoints the reader wrote, and breaks each into steps', async () => {
    service.getGoals.mockResolvedValue({
      success: true,
      goals: [goal([stone('m1', 'Bronze solved unaided'), stone('m2', 'Silver DP unassisted')])],
    });

    const result = await planGoal('g1');

    // Theirs stand. This used to be where the model's five replaced them.
    expect(service.suggestMilestones).not.toHaveBeenCalled();
    expect(service.setMilestones).not.toHaveBeenCalled();
    expect(service.suggestSteps.mock.calls.map(([arg]) => arg)).toEqual([
      { milestoneId: 'm1' },
      { milestoneId: 'm2' },
    ]);
    const written = service.updateMilestone.mock.calls[0]![1].steps;
    expect(written.map((step: { title: string }) => step.title)).toEqual(STEPS);
    expect(result).toEqual({ milestones: 0, checklists: 2, problem: null });
  });

  it('drafts checkpoints when there are none, then steps under every one of them', async () => {
    const drafted = ['Bronze solved unaided', 'Silver greedy fluent', 'Silver DP unassisted',
      'Gold graph theory solid', 'Gold division reached'];
    service.getGoals
      .mockResolvedValueOnce({ success: true, goals: [goal([])] })
      .mockResolvedValue({
        success: true,
        goals: [goal(drafted.map((title, i) => stone(`m${i + 1}`, title)))],
      });
    service.suggestMilestones.mockResolvedValue({ success: true, milestones: drafted });

    const result = await planGoal('g1');

    expect(service.setMilestones).toHaveBeenCalledWith('g1', drafted);
    // The step that was missing: a drafted ladder with nothing under its rungs.
    expect(service.suggestSteps).toHaveBeenCalledTimes(5);
    expect(result).toEqual({ milestones: 5, checklists: 5, problem: null });
  });

  it('never plans a counter goal', async () => {
    service.getGoals.mockResolvedValue({ success: true, goals: [goal([], 'xp')] });

    const result = await planGoal('g1');

    expect(service.suggestMilestones).not.toHaveBeenCalled();
    expect(service.suggestSteps).not.toHaveBeenCalled();
    expect(result.problem).toBeNull();
  });

  it('says why when the model cannot be asked, and writes nothing', async () => {
    service.getGoals.mockResolvedValue({ success: true, goals: [goal([])] });
    service.suggestMilestones.mockResolvedValue({
      success: false,
      message: 'Milestone suggestions need a model key in the environment.',
    });

    const result = await planGoal('g1');

    expect(result.problem).toMatch(/model key/);
    expect(service.setMilestones).not.toHaveBeenCalled();
    expect(service.updateMilestone).not.toHaveBeenCalled();
  });
});

describe('filling in the steps', () => {
  it('leaves a checklist somebody wrote alone, and one already reached', async () => {
    service.getGoals.mockResolvedValue({
      success: true,
      goals: [goal([
        stone('m1', 'Bronze solved unaided', ['My own first step']),
        stone('m2', 'Silver greedy fluent', [], 'done'),
        stone('m3', 'Silver DP unassisted'),
      ])],
    });

    const result = await fillSteps('g1');

    expect(service.suggestSteps.mock.calls.map(([arg]) => arg)).toEqual([{ milestoneId: 'm3' }]);
    expect(result).toEqual({ checklists: 1, problem: null });
  });

  it('reports a failed checkpoint without losing the ones that worked', async () => {
    service.getGoals.mockResolvedValue({
      success: true,
      goals: [goal([stone('m1', 'Bronze solved unaided'), stone('m2', 'Silver DP unassisted')])],
    });
    service.suggestSteps
      .mockResolvedValueOnce({ success: true, steps: STEPS })
      .mockResolvedValueOnce({ success: false, message: 'The model returned 3 steps instead of 5. Try again.' });

    const result = await fillSteps('g1');

    expect(service.updateMilestone).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ checklists: 1, problem: 'The model returned 3 steps instead of 5. Try again.' });
  });
});
