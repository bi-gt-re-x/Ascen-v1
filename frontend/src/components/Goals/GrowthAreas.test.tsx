/**
 * Where the work you have left is, and the goals that make it up.
 *
 * Two things changed and the second only works because of the first.
 *
 * **It was a mean, and a mean is the wrong shape for this question.** Each row
 * showed the weighted *progress* of a category — "Math 62%" — which tells you
 * how a group is doing on average and says nothing about what to work on: a
 * category holding one finished goal and one abandoned one reads 50% and looks
 * unremarkable. The figure is each subject's share of everything still
 * outstanding now, so the rows sum to 100 and can be compared. "32% of what is
 * left is geometry" is actionable in a way "geometry is 62% done" is not.
 *
 * **And the grouping was almost tautological.** Clicking "Math" to be shown
 * your maths goals is not a finding — the category *is* the grouping. Subjects
 * are the dimension the rest of the app analyses against, and they are what
 * makes the connection below each row worth opening.
 *
 * The shares summing to 100 is the property most at risk here, because the
 * obvious implementation counts a two-subject goal whole in both rows.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GrowthAreas, growthAreas } from './NextMoves';
import type { Goal } from '@/types';

function goal(id: string, over: Partial<Goal> = {}): Goal {
  return {
    id,
    title: `Goal ${id}`,
    status: 'active',
    category: 'math',
    measure: 'number',
    unit: 'points',
    target_number: 100,
    current_value: 0,
    priority: 5,
    subject_ids: 'geometry',
    milestones: [],
    ...over,
  } as unknown as Goal;
}

const nameOf = (id: string) => ({ geometry: 'Geometry', algebra: 'Algebra', counting: 'Counting' }[id] ?? id);

const areas = (goals: Goal[]) => growthAreas(goals, nameOf);
const share = (goals: Goal[], label: string) =>
  Math.round(areas(goals).find((one) => one.label === label)?.share ?? 0);

describe('where the outstanding work sits', () => {
  it('splits the shortfall between subjects, in shares that sum to a whole', () => {
    const found = areas([
      goal('a', { subject_ids: 'geometry' }),
      goal('b', { subject_ids: 'algebra' }),
      goal('c', { subject_ids: 'algebra' }),
    ]);

    expect(found.map((one) => one.label)).toEqual(['Algebra', 'Geometry']);
    expect(Math.round(found.reduce((sum, one) => sum + one.share, 0))).toBe(100);
    expect(share([], 'Algebra')).toBe(0);
  });

  /* The one the obvious implementation gets wrong. A goal filed under two
     subjects counted whole in both pushes the shares past 100 and quietly
     makes multi-subject goals the biggest problem in every area they touch. */
  it('does not count a two-subject goal twice', () => {
    const found = areas([goal('a', { subject_ids: 'geometry, algebra' })]);

    expect(found).toHaveLength(2);
    expect(found.map((one) => Math.round(one.share))).toEqual([50, 50]);
  });

  /* What is *left*, not what is done. A goal at 90% contributes a tenth of
     what an untouched one of the same priority does. */
  it('weighs a goal by how much of it is outstanding', () => {
    const found = areas([
      goal('a', { subject_ids: 'geometry', current_value: 90 }),
      goal('b', { subject_ids: 'algebra', current_value: 0 }),
    ]);

    expect(Math.round(found[0]!.share)).toBe(91);
    expect(found[0]!.label).toBe('Algebra');
  });

  it('weighs it by the priority the reader gave it', () => {
    const found = areas([
      goal('a', { subject_ids: 'geometry', priority: 9 }),
      goal('b', { subject_ids: 'algebra', priority: 1 }),
    ]);

    expect(Math.round(found[0]!.share)).toBe(90);
    expect(found[0]!.label).toBe('Geometry');
  });

  it('drops a goal with nothing left in it, and a completed one', () => {
    expect(
      areas([
        goal('a', { subject_ids: 'geometry', current_value: 100 }),
        goal('b', { subject_ids: 'algebra', status: 'completed' }),
      ]),
    ).toEqual([]);
  });

  /* Not invisible work. It is also the only row a reader can fix by filing
     it, which is worth saying rather than hiding. */
  it('keeps a goal filed under no subject, under its own row', () => {
    const found = areas([goal('a', { subject_ids: '' })]);

    expect(found).toHaveLength(1);
    expect(found[0]!.label).toBe('No subject');
  });
});

describe('the connection back to the goals', () => {
  const GOALS = [
    goal('g-1', { title: 'Qualify for AIME', subject_ids: 'geometry', priority: 9 }),
    goal('g-2', { title: 'AMC 10 performance', subject_ids: 'geometry', priority: 4 }),
    goal('g-3', { title: 'Ship the parser', subject_ids: 'algebra' }),
  ];

  it('says how many goals are behind each area', () => {
    render(<GrowthAreas goals={GOALS} nameOf={nameOf} />);

    const row = screen.getByText('Geometry').closest('li')!;
    expect(row).toHaveTextContent('2 goals');
  });

  /* The panel existed without this: a reader could see that a third of what
     they had left was geometry and had no way to reach the goals that made it
     so. */
  it('opens onto the goals it is made of, worst first', async () => {
    const user = userEvent.setup();
    render(<GrowthAreas goals={GOALS} nameOf={nameOf} onOpen={vi.fn()} />);

    const row = screen.getByText('Geometry').closest('li')!;
    expect(within(row).queryByText('Qualify for AIME')).not.toBeInTheDocument();

    await user.click(within(row).getByRole('button', { name: /Geometry/ }));

    const names = within(row)
      .getAllByRole('listitem')
      .map((one) => one.textContent);
    expect(names[0]).toContain('Qualify for AIME');
    expect(names[1]).toContain('AMC 10 performance');
  });

  it('opens the goal that was clicked', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<GrowthAreas goals={GOALS} nameOf={nameOf} onOpen={onOpen} />);

    await user.click(screen.getByRole('button', { name: /Geometry/ }));
    await user.click(screen.getByRole('button', { name: /Qualify for AIME/ }));

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen.mock.calls[0]![0].id).toBe('g-1');
  });

  it('closes the one already open rather than stacking them', async () => {
    const user = userEvent.setup();
    render(<GrowthAreas goals={GOALS} nameOf={nameOf} onOpen={vi.fn()} />);

    const geometry = screen.getByRole('button', { name: /Geometry/ });
    await user.click(geometry);
    expect(screen.getByText('Qualify for AIME')).toBeInTheDocument();

    await user.click(geometry);
    expect(screen.queryByText('Qualify for AIME')).not.toBeInTheDocument();
  });

  it('says so when every goal is finished', () => {
    render(<GrowthAreas goals={[goal('a', { current_value: 100 })]} nameOf={nameOf} />);
    expect(screen.getByText(/Every active goal is finished/)).toBeInTheDocument();
  });
});
