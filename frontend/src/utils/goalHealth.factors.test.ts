/**
 * Health as a diagnosis, and the whole set of goals as one answer.
 *
 * `goalHealth` has always produced a score, a state and one sentence — the
 * weakest signal, named. That is the right size for a chip on a card and the
 * wrong size on a page somebody opened specifically to ask why: "52 · At Risk"
 * over one line about the last fortnight tells a reader their goal is in
 * trouble and leaves them guessing which of four things to change.
 *
 * The blend already knew. Four signals went into the score and each of them is
 * either carrying the goal or dragging it, so `healthFactors` prints the
 * working rather than computing anything new. The tests here are mostly about
 * the sentences being true of the numbers behind them — a diagnosis that names
 * the wrong evidence is worse than a verdict that names none.
 *
 * `systemHealth` is the same idea one level up, for the top of the Stats tab.
 */
import { describe, expect, it } from 'vitest';
import { goalHealth, healthFactors, systemHealth } from './goalHealth';
import type { Goal, Task } from '@/types';

function day(offset: number): string {
  const at = new Date();
  at.setDate(at.getDate() + offset);
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
}

const stone = (id: string, status: string) =>
  ({ id, title: `Stage ${id}`, status, steps: [], completed_at: status === 'done' ? day(-5) : null }) as never;

function goal(over: Partial<Goal> = {}): Goal {
  return {
    id: 'g-1',
    title: 'Qualify for AIME',
    status: 'active',
    category: 'math',
    measure: 'number',
    unit: 'points',
    target_number: 100,
    current_value: 50,
    priority: 5,
    start_date: day(-30),
    created_at: `${day(-30)}T09:00:00`,
    deadline: day(30),
    milestones: [],
    ...over,
  } as unknown as Goal;
}

/** `n` finished tasks against the goal, one on each of the last `n` days. */
const worked = (n: number, goalId = 'g-1'): Task[] =>
  Array.from({ length: n }, (_, at) =>
    ({
      id: `t-${goalId}-${at}`,
      user_id: 'user-1',
      title: 'Practice set',
      description: '',
      priority: 'low',
      status: 'done',
      xp_value: 20,
      goal_id: goalId,
      created_at: `${day(-at - 1)}T09:00:00`,
      completed_at: `${day(-at)}T10:00:00`,
    }) as unknown as Task,
  );

const factors = (one: Goal, tasks: Task[] = []) => healthFactors(goalHealth(one, tasks));
const note = (one: Goal, tasks: Task[], key: string) =>
  factors(one, tasks).find((f) => f.key === key);

describe('what is helping and what is holding it back', () => {
  it('reads pace against the calendar, in both directions', () => {
    // 90% done at the halfway point of the window.
    const ahead = note(goal({ current_value: 90 }), worked(1), 'pace');
    expect(ahead?.good).toBe(true);
    expect(ahead?.note).toMatch(/points ahead of where the calendar says/);

    // 5% done at the same point.
    const behind = note(goal({ current_value: 5 }), worked(1), 'pace');
    expect(behind?.good).toBe(false);
    expect(behind?.note).toMatch(/points behind where the calendar says/);
  });

  it('says how long it has been, rather than that it has been a while', () => {
    const cold = note(goal(), worked(1).map((task) => ({ ...task, completed_at: `${day(-19)}T10:00:00` })), 'recency');

    expect(cold?.good).toBe(false);
    expect(cold?.note).toBe('Nothing done toward this in 19 days.');
  });

  it('counts the days work actually landed on', () => {
    const steady = note(goal(), worked(10), 'consistency');

    expect(steady?.good).toBe(true);
    expect(steady?.note).toBe('Work landed on 10 of the last 14 days.');
  });

  /* `depth` falls back to progress for a goal with no checkpoints, which is
     the right number and the wrong words — "0 of 0 checkpoints reached" over a
     goal measured by a figure is a sentence about something that does not
     exist. */
  it('talks about checkpoints only when the goal has some', () => {
    const withStones = note(
      goal({ measure: 'milestones', milestones: [stone('a', 'done'), stone('b', 'todo'), stone('c', 'todo')] }),
      worked(1),
      'depth',
    );
    expect(withStones?.note).toBe('Only 1 of 3 checkpoints reached.');

    const withFigure = note(goal({ current_value: 90 }), worked(1), 'depth');
    expect(withFigure?.note).toMatch(/90% of the way to the figure you set/);
    expect(withFigure?.note).not.toMatch(/checkpoint/);
  });

  /* "Behind schedule" about a goal with no schedule is the page inventing a
     problem. The blend drops pace's weight for these; so does the diagnosis. */
  it('says nothing about pace when there is no deadline', () => {
    expect(note(goal({ deadline: undefined }), worked(3), 'pace')).toBeUndefined();
  });

  it('says outright when nothing has ever been linked', () => {
    const never = note(goal(), [], 'recency');

    expect(never?.good).toBe(false);
    expect(never?.note).toBe('No finished task has ever been linked to this goal.');
  });

  /* A signal in the middle is not the story, and listing it under "helping"
     because it scraped over a half would be padding a diagnosis with filler. */
  it('leaves out a signal that is doing nothing in particular', () => {
    // Seven of fourteen days is 0.5 — between the two bands.
    expect(note(goal(), worked(7), 'consistency')).toBeUndefined();
  });

  it('puts the heaviest signal first, because it is the biggest lever', () => {
    const all = factors(goal({ current_value: 5 }), []);
    expect(all.length).toBeGreaterThan(1);
    expect(all[0]!.key).toBe('pace');
    // Pace 0.42, recency 0.26, consistency 0.16, depth 0.16.
    expect(all.map((f) => f.weight)).toEqual([...all.map((f) => f.weight)].sort((a, b) => b - a));
  });
});

describe('the whole set of goals as one answer', () => {
  const fine = (id: string) => goal({ id, current_value: 90 });
  const sunk = (id: string) => goal({ id, current_value: 2, start_date: day(-50), deadline: day(5) });

  it('averages the goals own scores rather than inventing a measure', () => {
    const goals = [fine('a'), fine('b')];
    const tasks = [...worked(10, 'a'), ...worked(10, 'b')];
    const view = systemHealth(goals, tasks);

    const each = goals.map((one) => goalHealth(one, tasks).score);
    expect(view.score).toBe(Math.round((each[0]! + each[1]!) / 2));
    expect(view.state).toBe('on-track');
    expect(view.progressing).toBe(2);
    expect(view.needsAttention).toBe(0);
  });

  /* The sentence this exists to make impossible to miss. Weighting by priority
     would let one important goal going well hide three neglected ones. */
  it('does not let one healthy goal hide three stalled ones', () => {
    const goals = [
      { ...fine('a'), priority: 10 } as Goal,
      sunk('b'),
      sunk('c'),
      sunk('d'),
    ];
    const view = systemHealth(goals, worked(10, 'a'));

    expect(view.progressing).toBe(1);
    expect(view.needsAttention).toBe(3);
    expect(view.state).not.toBe('on-track');
  });

  it('counts a completed goal out of the active set entirely', () => {
    const view = systemHealth([fine('a'), { ...fine('b'), status: 'completed' } as Goal], worked(10, 'a'));

    expect(view.active).toBe(1);
    expect(view.progressing).toBe(1);
  });

  /* Nothing has gone wrong; nothing has begun. Colouring that red is how a
     reader learns to ignore the colour. */
  it('reads a set nobody has started as not started, not as failing', () => {
    const view = systemHealth([goal({ id: 'a', current_value: 0 }), goal({ id: 'b', current_value: 0 })], []);

    expect(view.state).toBe('not-started');
    expect(view.notStarted).toBe(2);
  });

  it('has an answer for an account with no goals at all', () => {
    const view = systemHealth([], []);
    expect(view.active).toBe(0);
    expect(view.state).toBe('not-started');
    expect(view.score).toBe(0);
  });
});
