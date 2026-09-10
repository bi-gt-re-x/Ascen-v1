/**
 * The calendar's keyboard shortcuts, and the four times they must not fire.
 *
 * The shortcuts themselves are three lines and would not be worth a test. The
 * guards are the whole file: a letter bound at the window steps the week from
 * anywhere on the page, and the calendar is full of places a letter means
 * something else — a day's focus line, a block's name, the task and event
 * modals. `j` typed into "just the notes" moving the reader to next week is
 * not a shortcut, it is a fault, and it is the kind that only shows up when
 * somebody is actually typing.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useCalendarKeys } from './useCalendarKeys';

function Probe({
  onStep,
  onToday,
  enabled = true,
}: {
  onStep: (delta: number) => void;
  onToday: () => void;
  enabled?: boolean;
}) {
  useCalendarKeys({ onStep, onToday, enabled });
  return (
    <>
      <input aria-label="a name" />
      <textarea aria-label="a note" />
      <div aria-label="a rich field" contentEditable role="textbox" tabIndex={0} />
      <button type="button">somewhere else</button>
    </>
  );
}

function keys(enabled = true) {
  const onStep = vi.fn();
  const onToday = vi.fn();
  render(<Probe onStep={onStep} onToday={onToday} enabled={enabled} />);
  return { onStep, onToday, user: userEvent.setup() };
}

describe('the calendar shortcuts', () => {
  it('steps forward on j and n', async () => {
    const { onStep, user } = keys();
    await user.keyboard('j');
    await user.keyboard('n');
    expect(onStep.mock.calls).toEqual([[1], [1]]);
  });

  it('steps back on k and p', async () => {
    const { onStep, user } = keys();
    await user.keyboard('k');
    await user.keyboard('p');
    expect(onStep.mock.calls).toEqual([[-1], [-1]]);
  });

  it('goes to today on t', async () => {
    const { onToday, user } = keys();
    await user.keyboard('t');
    expect(onToday).toHaveBeenCalledTimes(1);
  });

  it('answers to a capital as well as a lower case', async () => {
    const { onStep, user } = keys();
    await user.keyboard('{Shift>}J{/Shift}');
    expect(onStep).toHaveBeenLastCalledWith(1);
  });

  it('stands down while something is being typed into', async () => {
    const { onStep, onToday, user } = keys();

    await user.click(screen.getByLabelText('a name'));
    await user.keyboard('jkt');
    await user.click(screen.getByLabelText('a note'));
    await user.keyboard('jkt');
    await user.click(screen.getByLabelText('a rich field'));
    await user.keyboard('jkt');

    expect(onStep).not.toHaveBeenCalled();
    expect(onToday).not.toHaveBeenCalled();
    expect(screen.getByLabelText('a name')).toHaveValue('jkt');
  });

  /* ⌘T is a new tab and ⌘K is the browser's search bar. A shortcut that takes
     one of those is not a shortcut, it is a page breaking the browser. */
  it('leaves the key alone when it is part of a browser or OS chord', async () => {
    const { onStep, onToday, user } = keys();
    await user.keyboard('{Meta>}t{/Meta}');
    await user.keyboard('{Control>}k{/Control}');
    await user.keyboard('{Alt>}j{/Alt}');
    expect(onStep).not.toHaveBeenCalled();
    expect(onToday).not.toHaveBeenCalled();
  });

  it('stands down while a dialog is up', async () => {
    const { onStep, onToday, user } = keys(false);
    await user.keyboard('jkt');
    expect(onStep).not.toHaveBeenCalled();
    expect(onToday).not.toHaveBeenCalled();
  });

  it('leaves every other key to the page', async () => {
    const { onStep, onToday, user } = keys();
    await user.keyboard('{PageDown}{ArrowRight}{Enter} abc');
    expect(onStep).not.toHaveBeenCalled();
    expect(onToday).not.toHaveBeenCalled();
  });
});
