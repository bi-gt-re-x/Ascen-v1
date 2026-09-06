/**
 * What day it is, in the evening, west of Greenwich.
 *
 * Every "today" on the tasks page came from slicing `today.toISOString()`,
 * which is the UTC date. For the last hours of each evening in a western
 * timezone that is already tomorrow, so the whole page rolled over early: the
 * Due Today group filled with tomorrow's work, everything actually due today
 * fell into Overdue, and the stat card's today count went with them. Overnight
 * it corrected itself, which is why it could sit there unnoticed.
 *
 * These fix a real instant — 8pm on a Sunday, in a UTC-5 offset — rather than
 * trusting the machine the suite happens to run on. `new Date(y, m, d, h)`
 * builds a local time, so the case only bites when the runner's own zone is
 * behind UTC; the assertions are written against the *local* day of the
 * instant, which is the right answer in every zone.
 */
import { describe, expect, it } from 'vitest';
import { bucketOf, dueLabel, taskCounts } from './board';
import { task } from '@/test/factories';

/** 8pm local on 30 August 2026 — 01:00 UTC on the 31st at UTC-5. */
const EVENING = new Date(2026, 7, 30, 20, 0, 0);

/** The local calendar day of that instant, however the runner is configured. */
const LOCAL_TODAY = '2026-08-30';
const LOCAL_TOMORROW = '2026-08-31';

describe('which day the tasks page thinks it is', () => {
  it('buckets work due today as today, not as overdue, late in the evening', () => {
    expect(bucketOf(task({ due_date: LOCAL_TODAY }), EVENING)).toBe('today');
  });

  it('still calls tomorrow tomorrow', () => {
    expect(bucketOf(task({ due_date: LOCAL_TOMORROW }), EVENING)).toBe('tomorrow');
  });

  it('still calls yesterday overdue', () => {
    expect(bucketOf(task({ due_date: '2026-08-29' }), EVENING)).toBe('overdue');
  });

  it('labels the row Today rather than a day out', () => {
    expect(dueLabel(task({ due_date: LOCAL_TODAY }), EVENING)).toBe('Today');
    expect(dueLabel(task({ due_date: LOCAL_TOMORROW }), EVENING)).toBe('Tomorrow');
  });

  it('counts today’s tasks under today', () => {
    const counts = taskCounts(
      [
        task({ due_date: LOCAL_TODAY }),
        task({ due_date: LOCAL_TODAY }),
        task({ due_date: LOCAL_TOMORROW }),
      ],
      EVENING,
    );
    expect(counts.today).toBe(2);
  });

  it('is unchanged in the middle of the day, where the two never disagreed', () => {
    const noon = new Date(2026, 7, 30, 12, 0, 0);
    expect(bucketOf(task({ due_date: LOCAL_TODAY }), noon)).toBe('today');
    expect(dueLabel(task({ due_date: LOCAL_TODAY }), noon)).toBe('Today');
  });
});
