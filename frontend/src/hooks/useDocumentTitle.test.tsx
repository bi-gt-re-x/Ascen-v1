/**
 * The tab's title, and the countdown that runs in it.
 *
 * Two of these are about the ticking title specifically, because that is the
 * part that looks like it should be broken. `useDocumentTitle` restores what
 * was there before it — and the focus page now hands it a new string every
 * second, so the effect re-runs every second and captures `previous` every
 * time. The obvious reading is that unmounting after a minute leaves last
 * second's countdown in the tab for ever. It does not, because React runs the
 * old cleanup before the new effect, and that is worth a test rather than a
 * comment: it is a property of the ordering, and orderings change.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { timerTitle, useDocumentTitle } from './useDocumentTitle';

function Page({ title }: { title?: string }) {
  useDocumentTitle(title);
  return null;
}

describe('useDocumentTitle', () => {
  it('names the tab for the page, under the app', () => {
    render(<Page title="Timer" />);
    expect(document.title).toBe('Timer · Summit');
  });

  it('falls back to the app alone', () => {
    render(<Page />);
    expect(document.title).toBe('Summit');
  });

  it('puts back what was there when the page goes', () => {
    document.title = 'Recommendations · Summit';
    const view = render(<Page title="Timer" />);
    view.unmount();
    expect(document.title).toBe('Recommendations · Summit');
  });

  it('puts back the pre-mount title after a title that ticked', () => {
    document.title = 'Recommendations · Summit';
    const view = render(<Page title={timerTitle(1500, 'Focus')} />);
    expect(document.title).toBe('25:00 · Focus · Summit');

    // A minute of a running session, one re-render per second.
    for (let left = 1499; left > 1440; left -= 1) {
      view.rerender(<Page title={timerTitle(left, 'Focus')} />);
    }
    expect(document.title).toBe('24:01 · Focus · Summit');

    view.unmount();
    expect(document.title).toBe('Recommendations · Summit');
  });
});

describe('timerTitle', () => {
  it('leads with the clock, because a narrow tab keeps only the front', () => {
    // "Focus · 24:31" in a twelve-character tab is "Focus…", which is what it
    // said before the session started.
    expect(timerTitle(1471, 'Focus')).toBe('24:31 · Focus');
    expect(timerTitle(1471, 'Focus').indexOf('24:31')).toBe(0);
  });

  it('names the phase, so a break does not read as an interval', () => {
    expect(timerTitle(300, 'Break')).toBe('05:00 · Break');
    expect(timerTitle(900, 'Long break')).toBe('15:00 · Long break');
  });

  it('grows an hours field for the sittings that need one', () => {
    // The longest interval this app offers is ninety minutes, and the
    // dashboard's session counts a whole day up.
    expect(timerTitle(5400, 'Focus')).toBe('1:30:00 · Focus');
    expect(timerTitle(9045, 'Focus')).toBe('2:30:45 · Focus');
  });

  it('does not print a negative clock', () => {
    // `remaining` is derived from a timestamp, so a tab that was asleep across
    // the end of a phase can ask for this before the phase has been rolled.
    expect(timerTitle(-3, 'Focus')).toBe('00:00 · Focus');
  });
});
