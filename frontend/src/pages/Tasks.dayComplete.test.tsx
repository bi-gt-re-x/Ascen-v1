/**
 * Finishing the day, from the page's side.
 *
 * DayComplete's own test covers the dialog. This covers the three things only
 * the page can get wrong: which tasks "today" means, that every one of them is
 * actually completed, and that the reviews are asked once each afterwards
 * rather than a dozen dialogs overwriting one another — which is what the
 * single `rating` slot this replaced would have done.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { stats, task } from '@/test/factories';
import type { Task } from '@/types';

const completeTask = vi.fn();
const rateTask = vi.fn();

vi.mock('@/services', async (original) => {
  const real = await original<Record<string, unknown>>();
  return {
    ...real,
    goals: { getGoals: () => Promise.resolve({ success: true, goals: [] }) },
    tasks: {
      completeTask: (...args: unknown[]) => completeTask(...args),
      rateTask: (...args: unknown[]) => rateTask(...args),
      updateTask: () => Promise.resolve({ success: true }),
      deleteTask: () => Promise.resolve({ success: true }),
      createTask: () => Promise.resolve({ success: true }),
    },
  };
});

vi.mock('@/hooks/useSubjects', () => ({ useSubjects: () => [] }));

import Tasks from './Tasks';

/** A `YYYY-MM-DD` a given number of days from today, local. */
function dayFromNow(offset: number): string {
  const at = new Date();
  at.setDate(at.getDate() + offset);
  return at.toISOString().slice(0, 10);
}

const TODAY = dayFromNow(0);

function show(tasks: Task[], depth: 'none' | 'ratings' = 'ratings') {
  return renderWithProviders(<Tasks />, {
    route: '/tasks',
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
  rateTask.mockResolvedValue({ success: true });
});

describe('finishing the day from the tasks page', () => {
  it('offers the button for tasks due today', async () => {
    show([
      task({ id: 'a', title: 'Due today', due_date: TODAY }),
      task({ id: 'b', title: 'Due today too', due_date: TODAY }),
    ]);
    expect(
      await screen.findByRole('button', { name: "Complete all 2 of today's tasks" }),
    ).toBeInTheDocument();
  });

  it('counts only today — not tomorrow, not overdue, not what is already done', async () => {
    show([
      task({ id: 'a', title: 'Today', due_date: TODAY }),
      task({ id: 'b', title: 'Tomorrow', due_date: dayFromNow(1) }),
      task({ id: 'c', title: 'Late', due_date: dayFromNow(-3) }),
      task({ id: 'd', title: 'Undated' }),
      task({ id: 'e', title: 'Already done', due_date: TODAY, status: 'done' }),
    ]);
    expect(
      await screen.findByRole('button', { name: "Complete today's task" }),
    ).toBeInTheDocument();
  });

  it('is absent when today holds nothing', async () => {
    show([task({ id: 'b', title: 'A job for later', due_date: dayFromNow(1) })]);
    // Twice over: the row, and the rail's "what is coming" panel beside it.
    await screen.findAllByText('A job for later');
    expect(screen.queryByRole('button', { name: /today's task/ })).not.toBeInTheDocument();
  });

  it('completes every one of the day once confirmed, and not before', async () => {
    const user = userEvent.setup();
    show([
      task({ id: 'a', title: 'One', due_date: TODAY }),
      task({ id: 'b', title: 'Two', due_date: TODAY }),
      task({ id: 'c', title: 'Three', due_date: TODAY }),
    ]);

    await user.click(await screen.findByRole('button', { name: /today's tasks/ }));
    expect(completeTask).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Complete 3' }));
    await waitFor(() => expect(completeTask).toHaveBeenCalledTimes(3));
    expect(completeTask.mock.calls.map((call) => call[0])).toEqual(['a', 'b', 'c']);
  });

  it('then asks about each one in turn, not just the last', async () => {
    const user = userEvent.setup();
    show([
      task({ id: 'a', title: 'First task', due_date: TODAY }),
      task({ id: 'b', title: 'Second task', due_date: TODAY }),
    ]);

    await user.click(await screen.findByRole('button', { name: /today's tasks/ }));
    await user.click(screen.getByRole('button', { name: 'Complete 2' }));

    // The first prompt names the first task.
    const first = await screen.findByRole('dialog');
    expect(within(first).getByText('First task')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Skip' }));

    // Skipping it brings up the second rather than closing the queue.
    await waitFor(() =>
      expect(within(screen.getByRole('dialog')).getByText('Second task')).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: 'Skip' }));

    await waitFor(() =>
      expect(screen.queryByText('Rate your performance on this task')).not.toBeInTheDocument(),
    );
  });

  it('asks nothing when the reader declines the reviews', async () => {
    const user = userEvent.setup();
    show([task({ id: 'a', title: 'Only task', due_date: TODAY })]);

    await user.click(await screen.findByRole('button', { name: /today's task/ }));
    await user.click(within(screen.getByRole('dialog')).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Complete it' }));

    await waitFor(() => expect(completeTask).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Rate your performance on this task')).not.toBeInTheDocument();
  });

  it('never offers the reviews when the account has ratings switched off', async () => {
    const user = userEvent.setup();
    show([task({ id: 'a', title: 'Only task', due_date: TODAY })], 'none');

    await user.click(await screen.findByRole('button', { name: /today's task/ }));
    expect(within(screen.getByRole('dialog')).queryByRole('checkbox')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Complete it' }));

    await waitFor(() => expect(completeTask).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Rate your performance on this task')).not.toBeInTheDocument();
  });

  it('does not queue a review for a task the server refused to complete', async () => {
    const user = userEvent.setup();
    completeTask.mockImplementation((id: string) =>
      Promise.resolve(
        id === 'b'
          ? { success: false, message: 'No.' }
          : { success: true, xp_earned: 20, new_level: 4, new_tasks_completed: 1, current_streak: 1, best_streak: 1 },
      ),
    );
    show([
      task({ id: 'a', title: 'Landed fine', due_date: TODAY }),
      task({ id: 'b', title: 'Server refused', due_date: TODAY }),
    ]);

    await user.click(await screen.findByRole('button', { name: /today's tasks/ }));
    await user.click(screen.getByRole('button', { name: 'Complete 2' }));

    const only = await screen.findByRole('dialog');
    expect(within(only).getByText('Landed fine')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Skip' }));
    await waitFor(() =>
      expect(screen.queryByText('Rate your performance on this task')).not.toBeInTheDocument(),
    );
  });
});
