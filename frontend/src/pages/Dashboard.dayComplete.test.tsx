/**
 * Finishing the day from the dashboard's Tasks card.
 *
 * The card's Today tab is the plate rather than the due date — `bucketTasks`
 * puts overdue and undated work in it too — and the button under it has to mean
 * the same thing the rows above it do. That is the one behaviour here that
 * differs from the tasks page's copy, so it is the one worth pinning down: the
 * page test next door asserts the narrower reading, and this asserts the wider
 * one, so neither can drift into the other.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { stats, task } from '@/test/factories';
import type { Task } from '@/types';

const completeTask = vi.fn();

vi.mock('@/services', async (original) => {
  const real = await original<Record<string, unknown>>();
  return {
    ...real,
    tasks: {
      completeTask: (...args: unknown[]) => completeTask(...args),
      rateTask: () => Promise.resolve({ success: true }),
      updateTask: () => Promise.resolve({ success: true }),
      createTask: () => Promise.resolve({ success: true }),
    },
  };
});

vi.mock('@/hooks/useSubjects', () => ({
  useSubjectIndex: () => new Map(),
  useSubjects: () => [],
  subjectOf: () => null,
}));

import Dashboard from './Dashboard';

/**
 * A `YYYY-MM-DD` a given number of days from today, local.
 *
 * Built from the local date parts, not `toISOString`, which is UTC and is a day
 * ahead for the last hours of every evening west of Greenwich — the same trap
 * `midnight` in components/Tasks/board.ts documents.
 */
function dayFromNow(offset: number): string {
  const at = new Date();
  at.setDate(at.getDate() + offset);
  const month = String(at.getMonth() + 1).padStart(2, '0');
  const day = String(at.getDate()).padStart(2, '0');
  return `${at.getFullYear()}-${month}-${day}`;
}

const TODAY = dayFromNow(0);

function show(tasks: Task[], depth: 'none' | 'ratings' = 'ratings') {
  return renderWithProviders(<Dashboard />, {
    route: '/dashboard',
    settings: { prefs: { rating_depth: depth } },
    userData: { data: { stats: stats(), tasks }, username: 'myles' },
  });
}

beforeEach(() => {
  completeTask.mockResolvedValue({
    success: true,
    xp_earned: 20,
    new_level: 4,
    new_tasks_completed: 1,
    current_streak: 2,
    best_streak: 5,
  });
});

describe('finishing the day from the dashboard', () => {
  it('puts the button under the Tasks card', async () => {
    show([
      task({ id: 'a', title: 'Due today', due_date: TODAY }),
      task({ id: 'b', title: 'Also today', due_date: TODAY }),
    ]);
    expect(
      await screen.findByRole('button', { name: "Complete all 2 of today's tasks" }),
    ).toBeInTheDocument();
  });

  it("counts the plate — overdue and undated included, which is what the card's Today tab shows", async () => {
    show([
      task({ id: 'a', title: 'Due today', due_date: TODAY }),
      task({ id: 'b', title: 'Nine days late', due_date: dayFromNow(-9) }),
      task({ id: 'c', title: 'No date at all' }),
      task({ id: 'd', title: 'Next week', due_date: dayFromNow(7) }),
      task({ id: 'e', title: 'Finished', due_date: TODAY, status: 'done' }),
    ]);
    // a, b and c are the plate. d is upcoming, e is done.
    expect(
      await screen.findByRole('button', { name: "Complete all 3 of today's tasks" }),
    ).toBeInTheDocument();
  });

  it('completes the whole plate once confirmed, and not before', async () => {
    const user = userEvent.setup();
    show([
      task({ id: 'a', title: 'Today one', due_date: TODAY }),
      task({ id: 'b', title: 'Overdue one', due_date: dayFromNow(-2) }),
    ]);

    await user.click(await screen.findByRole('button', { name: /today's tasks/ }));
    expect(completeTask).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Complete 2' }));
    await waitFor(() => expect(completeTask).toHaveBeenCalledTimes(2));
    expect(completeTask.mock.calls.map((c) => c[0]).sort()).toEqual(['a', 'b']);
  });

  it('then asks about each one in turn', async () => {
    const user = userEvent.setup();
    show([
      task({ id: 'a', title: 'Alpha task', due_date: dayFromNow(-1) }),
      task({ id: 'b', title: 'Beta task', due_date: TODAY }),
    ]);

    await user.click(await screen.findByRole('button', { name: /today's tasks/ }));
    await user.click(screen.getByRole('button', { name: 'Complete 2' }));

    const first = await screen.findByRole('dialog');
    expect(within(first).getByText('Alpha task')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Skip' }));

    await waitFor(() =>
      expect(within(screen.getByRole('dialog')).getByText('Beta task')).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: 'Skip' }));

    await waitFor(() =>
      expect(screen.queryByText('Rate your performance on this task')).not.toBeInTheDocument(),
    );
  });

  it('asks nothing when the reader declines the reviews', async () => {
    const user = userEvent.setup();
    show([task({ id: 'a', title: 'Only one', due_date: TODAY })]);

    await user.click(await screen.findByRole('button', { name: /today's task/ }));
    await user.click(within(screen.getByRole('dialog')).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Complete it' }));

    await waitFor(() => expect(completeTask).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Rate your performance on this task')).not.toBeInTheDocument();
  });

  it('never offers the reviews when the account has ratings switched off', async () => {
    const user = userEvent.setup();
    show([task({ id: 'a', title: 'Only one', due_date: TODAY })], 'none');

    await user.click(await screen.findByRole('button', { name: /today's task/ }));
    expect(within(screen.getByRole('dialog')).queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('is absent on the Upcoming and Completed tabs, which have nothing to finish', async () => {
    const user = userEvent.setup();
    show([
      task({ id: 'a', title: 'Due today', due_date: TODAY }),
      task({ id: 'd', title: 'Next week', due_date: dayFromNow(7) }),
    ]);

    await screen.findByRole('button', { name: /today's task/ });
    await user.click(screen.getByRole('tab', { name: 'Upcoming' }));
    expect(screen.queryByRole('button', { name: /today's task/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Completed' }));
    expect(screen.queryByRole('button', { name: /today's task/ })).not.toBeInTheDocument();
  });
});
