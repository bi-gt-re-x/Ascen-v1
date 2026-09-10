/**
 * What a block says about itself when there is no room to say it.
 *
 * A block on a week is a seventh of the grid wide, so its name is very often
 * an ellipsis and — under half an hour, in a narrow column — its time is not
 * drawn at all. Both of those are deliberate: the name is the one fact nothing
 * else on the grid carries, and a block's position already says when it runs.
 *
 * What makes them safe rather than lossy is that the whole of it is on the
 * element, as the tooltip a pointer gets and as the name a screen reader is
 * given. That is a promise the markup has to keep, and it is invisible — a
 * screenshot cannot show a missing `title`, and nothing else in the app would
 * fail if it went.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GridBlock } from './GridBlock';
import type { Block } from '@/utils/calendarGrid';

const HANDLERS = { onEdit: vi.fn(), onDelete: vi.fn(), onComplete: vi.fn() };

function taskBlock(over: Record<string, unknown> = {}): Block {
  return {
    kind: 'task',
    id: '7',
    title: 'Morning meditation',
    xp: 30,
    done: false,
    overdue: false,
    family: 'sage',
    priority: 'medium',
    startDT: new Date(2026, 8, 10, 6, 45),
    dueDT: new Date(2026, 8, 10, 7, 10),
    top: 0,
    height: 32,
    compact: true,
    snug: false,
    ...over,
  } as unknown as Block;
}

function eventBlock(over: Record<string, unknown> = {}): Block {
  return {
    kind: 'event',
    name: 'Long run with friends',
    family: 'sage',
    startHM: '08:30',
    endHM: '10:00',
    top: 0,
    height: 129,
    compact: false,
    snug: false,
    ...over,
  } as unknown as Block;
}

/** The block element itself — the one carrying the summary. */
function block(): HTMLElement {
  const el = document.querySelector<HTMLElement>('.wk-event');
  if (!el) throw new Error('no block rendered');
  return el;
}

describe('what a task block tells you about itself', () => {
  it('carries its name, its whole span, its subject and its worth', () => {
    render(
      <GridBlock
        block={taskBlock({ subjectLabel: 'Mathematics' })}
        iso="2026-09-10"
        {...HANDLERS}
      />,
    );
    const summary = block().getAttribute('title')!;
    expect(summary).toContain('Morning meditation');
    expect(summary).toContain('6:45');
    expect(summary).toContain('7:10');
    expect(summary).toContain('Mathematics');
    expect(summary).toContain('30 XP');
  });

  /* The same string in both places on purpose: a tooltip that says more than
     the accessible name is a tooltip somebody has to notice is missing. */
  it('says the same thing to a pointer and to a screen reader', () => {
    render(<GridBlock block={taskBlock()} iso="2026-09-10" {...HANDLERS} />);
    expect(block().getAttribute('aria-label')).toBe(block().getAttribute('title'));
  });

  it('names the state only when there is one', () => {
    const { unmount } = render(<GridBlock block={taskBlock()} iso="2026-09-10" {...HANDLERS} />);
    expect(block().getAttribute('title')).not.toContain('done');
    expect(block().getAttribute('title')).not.toContain('overdue');
    unmount();

    render(<GridBlock block={taskBlock({ done: true })} iso="2026-09-10" {...HANDLERS} />);
    expect(block().getAttribute('title')).toContain('done');
  });

  it('says overdue on one that is', () => {
    render(<GridBlock block={taskBlock({ overdue: true })} iso="2026-09-10" {...HANDLERS} />);
    expect(block().getAttribute('title')).toContain('overdue');
  });

  /* The name leads, always. Most blocks have no state, and a label that opened
     with "Done," on the ones that do would put the useful half second. */
  it('leads with the name', () => {
    render(<GridBlock block={taskBlock({ done: true })} iso="2026-09-10" {...HANDLERS} />);
    expect(block().getAttribute('title')).toMatch(/^Morning meditation/);
  });
});

describe('what an event block tells you', () => {
  it('carries its name and its span', () => {
    render(<GridBlock block={eventBlock()} iso="2026-09-12" {...HANDLERS} />);
    const summary = block().getAttribute('title')!;
    expect(summary).toContain('Long run with friends');
    expect(summary).toContain('8:30');
    expect(summary).toContain('10');
  });

  /* An event has no XP and no subject, so it must not print an empty one —
     "Long run with friends · 8:30 – 10 AM · 0 XP" would be inventing a figure. */
  it('does not invent an XP it has not got', () => {
    render(<GridBlock block={eventBlock()} iso="2026-09-12" {...HANDLERS} />);
    expect(block().getAttribute('title')).not.toContain('XP');
  });
});

describe('the strip a short block becomes', () => {
  /* The time is drawn in the markup and hidden by a container query when the
     column is too narrow for both — so it has to be *there* for a wide column
     to show, and the summary has to carry it either way. */
  it('draws its range beside the name, for a column with room', () => {
    render(<GridBlock block={taskBlock()} iso="2026-09-10" {...HANDLERS} />);
    expect(document.querySelector('.wk-event-start')?.textContent).toContain('6:45');
  });

  it('gives the name a control of its own, which the block itself is not', () => {
    render(<GridBlock block={taskBlock()} iso="2026-09-10" {...HANDLERS} />);
    // The name finishes the task; the block around it is not a button.
    expect(screen.getByTitle('Click to mark complete')).toBeInTheDocument();
    expect(block().tagName).toBe('DIV');
  });
});
