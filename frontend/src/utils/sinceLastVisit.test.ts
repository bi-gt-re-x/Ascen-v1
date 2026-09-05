/**
 * The visit gap, and the three ways of having nothing to say about it.
 *
 * The interesting cases here are all absences. A line that appears on a first
 * visit is a line about a fortnight that did not happen; one that appears
 * twice in a day is a line about ten seconds; and both are worse than no line,
 * because this sits above the tab bar where the reader cannot avoid it.
 */
import { describe, expect, it } from 'vitest';
import { sinceLastVisit } from './sinceLastVisit';
import { days } from '@/test/factories';
import type { MetricPoint } from '@/services/analytics';

const point = (date: string, score: number): MetricPoint => ({ date, score, grade: 'B' });

/** A run of days with the same numbers on each, so a sum is easy to predict. */
const run = (from: string, count: number, xp: number, tasks: number) =>
  days(from, count, { xp_earned: xp, tasks_completed: tasks });

describe('sinceLastVisit', () => {
  it('sums the days after the last visit, up to and including today', () => {
    const out = sinceLastVisit(
      [point('2026-08-28', 61), point('2026-09-01', 66)],
      run('2026-08-28', 8, 50, 2),
      '2026-09-04',
    );

    expect(out?.on).toBe('2026-09-01');
    expect(out?.daysAgo).toBe(3);
    // The 2nd, 3rd and 4th. Not the 1st — that day had already happened when
    // the reader looked at it.
    expect(out?.xp).toBe(150);
    expect(out?.tasks).toBe(6);
    expect(out?.activeDays).toBe(3);
  });

  it('says nothing on a first visit', () => {
    expect(sinceLastVisit([], run('2026-09-01', 4, 10, 1), '2026-09-04')).toBeNull();
  });

  it("says nothing when the only reading is today's", () => {
    // The reader has been here before, but not before today — so there is no
    // gap to describe.
    expect(
      sinceLastVisit([point('2026-09-04', 70)], run('2026-09-01', 4, 10, 1), '2026-09-04'),
    ).toBeNull();
  });

  it("ignores today's reading whether or not it has landed yet", () => {
    /* Opening the page files a snapshot and reads the history at the same
       time, so today's point is in this list for some visits and not others.
       Both have to give the same answer. */
    const history = [point('2026-09-01', 61)];
    const series = run('2026-09-01', 4, 20, 1);

    const withoutToday = sinceLastVisit(history, series, '2026-09-04');
    const withToday = sinceLastVisit([...history, point('2026-09-04', 66)], series, '2026-09-04');

    expect(withoutToday?.on).toBe('2026-09-01');
    expect(withToday?.on).toBe('2026-09-01');
    expect(withToday?.xp).toBe(withoutToday?.xp);
    expect(withToday?.daysAgo).toBe(withoutToday?.daysAgo);
  });

  it('reports a gap with nothing in it rather than hiding it', () => {
    // Coming back after a week off is exactly when a reader wants to be told
    // it was a week off. Zero is the finding.
    const out = sinceLastVisit(
      [point('2026-08-28', 61)],
      days('2026-08-28', 8, { xp_earned: 0, tasks_completed: 0 }),
      '2026-09-04',
    );
    expect(out?.daysAgo).toBe(7);
    expect(out?.xp).toBe(0);
    expect(out?.activeDays).toBe(0);
  });

  it('handles a stamp carrying a time as well as a day', () => {
    const out = sinceLastVisit(
      [{ date: '2026-09-01T09:14:00', score: 61, grade: 'B' }],
      run('2026-09-01', 4, 10, 1),
      '2026-09-04',
    );
    expect(out?.on).toBe('2026-09-01');
    expect(out?.daysAgo).toBe(3);
  });

  it('counts only the days the series actually has', () => {
    // A visit older than the series can describe. The gap is still true; the
    // totals are only over what is on the books.
    const out = sinceLastVisit(
      [point('2026-01-01', 40)],
      run('2026-09-01', 4, 10, 1),
      '2026-09-04',
    );
    expect(out?.daysAgo).toBe(246);
    expect(out?.xp).toBe(40);
  });
});
