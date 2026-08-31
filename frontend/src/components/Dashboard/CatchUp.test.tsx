/**
 * The catch-up dialog's two promises.
 *
 * **Only what was filled in is sent.** A day left blank is a day the reader
 * said nothing about, and sending a zero for it would write a focus record
 * claiming they sat down for no time at all — which counts as a day that was
 * measured and missed rather than a day that was not asked about. That is the
 * difference between a gap in the record and a lie in it.
 *
 * **Hours and minutes are one answer.** They are two boxes because that is how
 * the figure exists in somebody's head, and one number by the time it leaves.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CatchUp } from './CatchUp';
import type { CatchUpDay } from '@/utils/catchUp';

const DAYS: CatchUpDay[] = [
  { iso: '2026-08-28', ago: 1, weekday: 'Friday', date: 'August 28' },
  { iso: '2026-08-27', ago: 2, weekday: 'Thursday', date: 'August 27' },
];

function draw() {
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  render(<CatchUp days={DAYS} onSubmit={onSubmit} onClose={onClose} />);
  return { onSubmit, onClose };
}

describe('the catch-up prompt', () => {
  it('names each day three ways', () => {
    draw();
    expect(screen.getByText('Yesterday')).toBeInTheDocument();
    expect(screen.getByText('Friday · August 28')).toBeInTheDocument();
    expect(screen.getByText('2 days ago')).toBeInTheDocument();
  });

  it('adds the hours and the minutes into one figure', async () => {
    const user = userEvent.setup();
    const { onSubmit } = draw();

    await user.type(screen.getByLabelText('Hours worked on Friday August 28'), '1');
    await user.type(screen.getByLabelText('Minutes worked on Friday August 28'), '30');

    // Said back before it is sent, beside the button that sends it.
    expect(screen.getByText('1h 30m across 1 day')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Log it' }));
    expect(onSubmit).toHaveBeenCalledWith([{ iso: '2026-08-28', minutes: 90 }]);
  });

  it('sends nothing for a day left blank', async () => {
    const user = userEvent.setup();
    const { onSubmit } = draw();

    await user.type(screen.getByLabelText('Hours worked on Thursday August 27'), '2');
    await user.click(screen.getByRole('button', { name: 'Log it' }));

    expect(onSubmit).toHaveBeenCalledWith([{ iso: '2026-08-27', minutes: 120 }]);
  });

  it('will not send an empty answer at all', () => {
    draw();
    expect(screen.getByRole('button', { name: 'Log it' })).toBeDisabled();
  });

  it('can be left without answering', async () => {
    const user = userEvent.setup();
    const { onClose, onSubmit } = draw();

    await user.click(screen.getByRole('button', { name: 'Not now' }));
    expect(onClose).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('takes digits and nothing else', async () => {
    const user = userEvent.setup();
    draw();

    const field = screen.getByLabelText('Hours worked on Friday August 28');
    await user.type(field, '1e-9');
    expect(field).toHaveValue('19');
  });
});
