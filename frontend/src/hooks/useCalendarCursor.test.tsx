/**
 * The one cursor the three calendar views share.
 *
 * The bug this replaced was invisible from inside any one view: each of them
 * worked perfectly and none of them could see the others, so paging to
 * November in the Week view and pressing Month landed on this month. The fix
 * is that the day lives in the URL, and the thing worth pinning is exactly
 * that — not what the hook returns, but that what it returns *is* the URL, in
 * both directions.
 *
 * Two of these are about the defaults rather than the movement, and they earn
 * their place for the same reason: "absent means today" is what keeps a plain
 * `/calendar/week` correct tomorrow, and a hand-typed `?date=` that is not a
 * date must show today rather than an invalid grid, because a URL bar is a
 * text field anyone can edit.
 */
import { act } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { dates } from '@/utils';
import { useCalendarCursor } from './useCalendarCursor';

/** A view: prints the day it is on, and can be told to move. */
function Probe({ to }: { to?: Date }) {
  const { iso, isDefault, goTo } = useCalendarCursor();
  const { search } = useLocation();
  return (
    <>
      <div data-testid="iso">{iso}</div>
      <div data-testid="default">{String(isDefault)}</div>
      <div data-testid="search">{search}</div>
      <button type="button" onClick={() => goTo(to ?? new Date())}>
        move
      </button>
    </>
  );
}

function at(url: string, to?: Date) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Probe to={to} />
    </MemoryRouter>,
  );
}

describe('the calendar cursor', () => {
  it('is today when the URL says nothing', () => {
    at('/calendar/week');
    expect(screen.getByTestId('iso')).toHaveTextContent(dates.isoDate());
    // And says so, so a view can tell "today" from "today, asked for".
    expect(screen.getByTestId('default')).toHaveTextContent('true');
  });

  it('is the day the URL names', () => {
    at('/calendar/week?date=2026-11-03');
    expect(screen.getByTestId('iso')).toHaveTextContent('2026-11-03');
    expect(screen.getByTestId('default')).toHaveTextContent('false');
  });

  it('falls back to today when the URL names something that is not a date', () => {
    at('/calendar/month?date=the-fourteenth');
    expect(screen.getByTestId('iso')).toHaveTextContent(dates.isoDate());
  });

  it('writes the day it is moved to', async () => {
    const user = userEvent.setup();
    at('/calendar/week?date=2026-11-03', new Date(2026, 11, 25));

    await user.click(screen.getByRole('button', { name: 'move' }));

    expect(screen.getByTestId('iso')).toHaveTextContent('2026-12-25');
    expect(screen.getByTestId('search')).toHaveTextContent('date=2026-12-25');
  });

  /**
   * The Day view is reached from the top bar's search as
   * `?date=…&task=…` — the day, and which block to mark on it. Stepping a day
   * from there rebuilds the query, and an earlier draft of this rebuilt it
   * from scratch: the date survived and the task id was silently dropped, so
   * the block the reader had been sent to stopped being marked the moment
   * they moved.
   */
  it('keeps the other parameters when it moves', async () => {
    const user = userEvent.setup();
    at('/calendar/day?date=2026-11-03&task=88', new Date(2026, 10, 4));

    await user.click(screen.getByRole('button', { name: 'move' }));

    expect(screen.getByTestId('search')).toHaveTextContent('task=88');
    expect(screen.getByTestId('search')).toHaveTextContent('date=2026-11-04');
  });

  it('does not write a history entry for a move to the day it is already on', async () => {
    const user = userEvent.setup();
    at('/calendar/week?date=2026-11-03', new Date(2026, 10, 3));

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'move' }));
    });

    // Unchanged, and — the part that matters — Back still leaves the calendar
    // rather than stepping through a pile of identical entries.
    expect(screen.getByTestId('iso')).toHaveTextContent('2026-11-03');
  });
});
