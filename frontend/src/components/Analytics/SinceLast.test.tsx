/**
 * The visit strip, which is mostly a test of what it refuses to say.
 *
 * It sits above the tab bar on all seven tabs, so it is the one line on this
 * page a reader cannot scroll past or switch away from. Everything it prints is
 * therefore printed seven times as often as anything in a panel, and the two
 * ways it could be wrong — appearing when there is nothing to report, and
 * disappearing when the news is bad — are both worse here than anywhere else.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SinceLast } from './Header';
import type { SinceLastVisit } from '@/utils/sinceLastVisit';

const visit = (over: Partial<SinceLastVisit> = {}): SinceLastVisit => ({
  on: '2026-09-01',
  daysAgo: 3,
  xp: 420,
  tasks: 12,
  activeDays: 2,
  ...over,
});

describe('SinceLast', () => {
  it('renders nothing at all when there is no previous visit', () => {
    const { container } = render(<SinceLast since={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('states the gap and what filled it', () => {
    render(<SinceLast since={visit()} />);
    const line = screen.getByText(/You were last here/).closest('p')!;
    expect(line).toHaveTextContent('You were last here 3 days ago.');
    expect(line).toHaveTextContent('12 tasks and 420 XP across 2 of 3 days');
  });

  it('still shows up when nothing happened', () => {
    // The visit a reader most needs telling about is the one after a week off.
    render(<SinceLast since={visit({ daysAgo: 7, xp: 0, tasks: 0, activeDays: 0 })} />);
    expect(screen.getByText(/Nothing has been recorded since/)).toBeInTheDocument();
    expect(screen.getByText(/7 days ago/)).toBeInTheDocument();
  });

  it('counts in weeks once days stop being readable', () => {
    render(<SinceLast since={visit({ daysAgo: 21 })} />);
    expect(screen.getByText(/3 weeks ago/)).toBeInTheDocument();
  });

  it('says yesterday rather than 1 days ago', () => {
    render(<SinceLast since={visit({ daysAgo: 1, tasks: 1 })} />);
    expect(screen.getByText(/yesterday/)).toBeInTheDocument();
    expect(screen.queryByText(/1 days/)).toBeNull();
  });

  it('never mentions the score, which Summary owns', () => {
    const { container } = render(<SinceLast since={visit()} />);
    expect(container.textContent).not.toMatch(/score|grade|out of/i);
  });
});
