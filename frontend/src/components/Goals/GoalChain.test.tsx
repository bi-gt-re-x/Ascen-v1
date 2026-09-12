/**
 * A goal's checkpoints, in the order they are meant to happen.
 *
 *     Foundation → Algebra → Geometry → Counting → Full tests → AIME
 *
 * The rail this replaced was a timeline: rows sorted by date, a "Today"
 * marker between past and future, "in 12d" and "3d late" on every row, and a
 * date picker. There is a milestone calendar directly underneath it on the
 * same tab, so the tab answered the same question twice and the worse shape
 * for it won the top of the page.
 *
 * What a goal's own rail can say that a calendar cannot is the *order*. So the
 * tests here are almost all about order being preserved and dates being
 * irrelevant — which is the property most at risk, because sorting a list of
 * checkpoints by their target date is the obvious thing to do and is wrong
 * here: the reader arranged them by hand, and a plan whose steps rearrange
 * themselves when stage four gets an earlier date than stage three has stopped
 * being a sequence.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GoalChain } from './Outcome';
import type { Goal, Milestone } from '@/types';

const stone = (title: string, status: string, over: Record<string, unknown> = {}): Milestone =>
  ({
    id: `m-${title}`,
    goal_id: 'g-1',
    title,
    status,
    steps: [],
    completed_at: status === 'done' ? '2026-08-02T10:00:00' : null,
    ...over,
  }) as unknown as Milestone;

function goal(milestones: Milestone[]): Goal {
  return {
    id: 'g-1',
    title: 'Qualify for AIME',
    status: 'active',
    category: 'math',
    measure: 'milestones',
    subject_ids: 'algebra',
    milestones,
  } as unknown as Goal;
}

const PLAN = [
  stone('Foundation', 'done'),
  stone('Algebra', 'done'),
  stone('Geometry', 'todo'),
  stone('Counting', 'todo'),
  stone('Full tests', 'todo'),
];

/** The links, in the order they are drawn. */
const links = () => screen.getAllByRole('listitem').map((li) => li.textContent?.replace('✓', '').trim());

describe('the order the chain draws', () => {
  it('draws every checkpoint in the order the goal holds them', () => {
    render(<GoalChain goal={goal(PLAN)} onOpen={vi.fn()} />);

    expect(links()).toEqual(['Foundation', 'Algebra', 'Geometry', 'Counting', 'Full tests']);
  });

  /* The property the old rail could not have had, because its whole job was to
     sort by date. Stage five here is due before stage three, and the plan is
     still the plan. */
  it('does not re-sort when a later checkpoint has an earlier date', () => {
    render(
      <GoalChain
        goal={goal([
          stone('Foundation', 'done', { target_date: '2026-12-01' }),
          stone('Algebra', 'todo', { target_date: '2026-11-01' }),
          stone('Geometry', 'todo', { target_date: '2026-09-01' }),
        ])}
        onOpen={vi.fn()}
      />,
    );

    expect(links()).toEqual(['Foundation', 'Algebra', 'Geometry']);
  });

  it('collapses the tail rather than growing without limit', () => {
    render(
      <GoalChain
        goal={goal(Array.from({ length: 9 }, (_, at) => stone(`Stage ${at + 1}`, 'todo')))}
        onOpen={vi.fn()}
        limit={4}
      />,
    );

    const drawn = links();
    expect(drawn.slice(0, 4)).toEqual(['Stage 1', 'Stage 2', 'Stage 3', 'Stage 4']);
    expect(drawn[4]).toBe('+5 more');
  });

  it('asks for checkpoints when a goal has none', () => {
    render(<GoalChain goal={goal([])} onOpen={vi.fn()} />);

    expect(screen.getByText(/Break this goal into stages/)).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });
});

describe('where you are on it', () => {
  it('marks the reached ones and emphasises the one in hand', () => {
    render(<GoalChain goal={goal(PLAN)} onOpen={vi.fn()} />);
    const rows = screen.getAllByRole('listitem');

    expect(rows[0]).toHaveClass('is-done');
    expect(rows[1]).toHaveClass('is-done');
    // The first that is not done, and only that one.
    expect(rows[2]).toHaveClass('is-now');
    expect(rows[3]).not.toHaveClass('is-now');
  });

  /* The same rule the goal card uses for its focus checkpoint. If the two
     disagreed the page would say a goal is on two different stages at once. */
  it('follows an explicitly chosen checkpoint over the first unfinished one', () => {
    render(
      <GoalChain
        goal={goal([
          stone('Foundation', 'done'),
          stone('Algebra', 'todo'),
          stone('Geometry', 'active'),
        ])}
        onOpen={vi.fn()}
      />,
    );
    const rows = screen.getAllByRole('listitem');

    expect(rows[1]).not.toHaveClass('is-now');
    expect(rows[2]).toHaveClass('is-now');
  });

  it('emphasises nothing once every checkpoint is reached', () => {
    render(<GoalChain goal={goal([stone('Foundation', 'done'), stone('Algebra', 'done')])} onOpen={vi.fn()} />);

    expect(screen.queryByRole('listitem', { name: /is-now/ })).not.toBeInTheDocument();
    screen.getAllByRole('listitem').forEach((row) => expect(row).not.toHaveClass('is-now'));
  });
});

describe('what the chain is not', () => {
  /* Dates went to the calendar underneath, which is what a calendar is for.
     A rail carrying "in 12d" on every link is the calendar again, in a worse
     shape, above the real one. */
  it('says nothing about when', () => {
    render(
      <GoalChain
        goal={goal([stone('Geometry', 'todo', { target_date: '2026-09-01' })])}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.queryByText(/in \d+d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/late/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Set a date/)).not.toBeInTheDocument();
  });

  /* Setting one lives in the detail view, which is where the rest of planning
     already happens — so the rail has no date input to leave behind. */
  it('offers no way to edit a date', () => {
    const { container } = render(<GoalChain goal={goal(PLAN)} onOpen={vi.fn()} />);

    expect(container.querySelector('input[type="date"]')).toBeNull();
  });

  it('opens the goal from any link on it', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<GoalChain goal={goal(PLAN)} onOpen={onOpen} />);

    await user.click(within(screen.getAllByRole('listitem')[3]!).getByRole('button'));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen.mock.calls[0]![0].id).toBe('g-1');
  });
});
