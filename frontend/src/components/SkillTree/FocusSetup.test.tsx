/**
 * The one rule the first-visit chooser has: five, and not four.
 *
 * The screen stands between a new account and the whole page, so the way it
 * can go wrong is not a wrong pixel — it is letting somebody through with
 * three subjects, or refusing to let them through with five. Both are one
 * comparison, both are perfectly typed either way, and neither shows up in a
 * render test that only asks whether the heading is on screen.
 *
 * The sixth-click behaviour is here for the same reason. It is the one piece
 * of state in the file that is not a straight toggle, and "the oldest pick
 * falls off" is a decision rather than an accident — see the note in
 * ./FocusSetup.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FocusSetup } from './FocusSetup';
import { FOCUS_COUNT } from '@/utils/focusTopics';
import type { Subject } from '@/services/subjects';

function subject(id: string, group = 'Study'): Subject {
  return {
    id,
    name: id,
    abbr: null,
    label: id,
    icon: 'book.svg',
    group,
    used: 0,
    family: null,
    custom: false,
  };
}

const CATALOGUE = ['maths', 'physics', 'chemistry', 'history', 'music', 'coding'].map((id) =>
  subject(id),
);

function draw(over: Partial<React.ComponentProps<typeof FocusSetup>> = {}) {
  const onDone = vi.fn();
  render(
    <FocusSetup subjects={CATALOGUE} suggested={[]} onDone={onDone} {...over} />,
  );
  return { onDone };
}

/** A subject chip. The filled slots are labelled "Remove <name>", so a bare
 *  subject name reaches the chip and only the chip. */
function chip(name: string) {
  return screen.getByRole('button', { name });
}

describe('the first-visit chooser', () => {
  it('will not continue on four', async () => {
    const user = userEvent.setup();
    const { onDone } = draw();

    for (const id of ['maths', 'physics', 'chemistry', 'history']) {
      await user.click(chip(id));
    }

    const go = screen.getByRole('button', { name: /pick 1 more/i });
    expect(go).toBeDisabled();
    await user.click(go);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('continues on five, with what was picked', async () => {
    const user = userEvent.setup();
    const { onDone } = draw();

    const five = ['maths', 'physics', 'chemistry', 'history', 'music'];
    for (const id of five) await user.click(chip(id));

    await user.click(screen.getByRole('button', { name: /open my skill trees/i }));
    expect(onDone).toHaveBeenCalledWith(five);
  });

  it('drops the oldest pick rather than refusing a sixth', async () => {
    const user = userEvent.setup();
    const { onDone } = draw();

    for (const id of ['maths', 'physics', 'chemistry', 'history', 'music', 'coding']) {
      await user.click(chip(id));
    }

    await user.click(screen.getByRole('button', { name: /open my skill trees/i }));
    // Still five, and Maths — the first click — is the one that went.
    expect(onDone).toHaveBeenCalledWith(['physics', 'chemistry', 'history', 'music', 'coding']);
  });

  it('offers the derived five as a button, and only when there are five', async () => {
    const user = userEvent.setup();
    const suggested = ['maths', 'physics', 'chemistry', 'history', 'music'];
    const { onDone } = draw({ suggested });

    await user.click(screen.getByRole('button', { name: /work on most/i }));
    await user.click(screen.getByRole('button', { name: /open my skill trees/i }));
    expect(onDone).toHaveBeenCalledWith(suggested);
  });

  it('does not offer a suggestion that would fill three of five slots', () => {
    draw({ suggested: ['maths', 'physics', 'chemistry'] });
    expect(screen.queryByRole('button', { name: /work on most/i })).not.toBeInTheDocument();
  });

  it('says how many are still wanted', async () => {
    const user = userEvent.setup();
    draw();
    expect(screen.getByRole('status')).toHaveTextContent(`0 of ${FOCUS_COUNT} chosen`);
    await user.click(chip('maths'));
    expect(screen.getByRole('status')).toHaveTextContent(`1 of ${FOCUS_COUNT} chosen`);
  });
});
