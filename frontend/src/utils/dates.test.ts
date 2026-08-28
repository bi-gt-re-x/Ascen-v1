/**
 * Local dates, and the UTC bug the module exists to prevent.
 *
 * The file's own header names the failure: `toISOString()` is UTC, so west of
 * Greenwich a task finished at 8pm is filed under tomorrow — wrong square,
 * broken streak. That is the first thing tested here, and it is tested by
 * pinning the process to a timezone where the two answers actually differ.
 * Run in UTC, every assertion below would pass against the broken
 * implementation, which would make the suite worse than no suite.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  addDays,
  endOfMonth,
  formatDate,
  formatDayLabel,
  fromIsoDate,
  greeting,
  isSameDay,
  isToday,
  isoDate,
  startOfMonth,
  startOfWeek,
} from './dates';

/**
 * New York, deliberately: it is UTC-4/-5, so any local time after 7pm falls on
 * the next UTC day and `toISOString().slice(0, 10)` disagrees with `isoDate`.
 */
const ZONE = 'America/New_York';
const original = process.env.TZ;

beforeAll(() => {
  process.env.TZ = ZONE;
});

afterAll(() => {
  process.env.TZ = original;
});

describe('isoDate', () => {
  it('reports the local day for an evening that is already tomorrow in UTC', () => {
    const evening = new Date(2026, 6, 30, 20, 30); // 30 July, 8:30pm local
    expect(isoDate(evening)).toBe('2026-07-30');
    // The bug this guards against, stated outright: the UTC answer is the
    // next day, and it is the one a naive implementation would file under.
    expect(evening.toISOString().slice(0, 10)).toBe('2026-07-31');
  });

  it('reports the local day for a morning that is still yesterday in UTC', () => {
    // 1 January, 00:30 local is 05:30 UTC on the same date here, so the
    // interesting direction is the other one: pick a zone-independent check
    // that the parts come from the local getters.
    const justPastMidnight = new Date(2026, 0, 1, 0, 30);
    expect(isoDate(justPastMidnight)).toBe('2026-01-01');
  });

  it('pads single-digit months and days to a sortable key', () => {
    expect(isoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('defaults to now', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 9, 23, 59));
    expect(isoDate()).toBe('2026-03-09');
    vi.useRealTimers();
  });
});

describe('fromIsoDate', () => {
  it('parses to local midnight, not UTC midnight', () => {
    const parsed = fromIsoDate('2026-07-30');
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(6);
    expect(parsed.getDate()).toBe(30);
    expect(parsed.getHours()).toBe(0);
    // `new Date('2026-07-30')` is UTC midnight, which in New York is the 29th
    // at 8pm — the reason this function exists rather than the built-in.
    expect(new Date('2026-07-30').getDate()).toBe(29);
  });

  it('round-trips with isoDate', () => {
    expect(isoDate(fromIsoDate('2026-11-02'))).toBe('2026-11-02');
  });
});

describe('addDays', () => {
  it('does not mutate the date it was given', () => {
    const start = new Date(2026, 6, 30);
    addDays(start, 5);
    expect(start.getDate()).toBe(30);
  });

  it('rolls over a month boundary', () => {
    expect(isoDate(addDays(new Date(2026, 6, 30), 3))).toBe('2026-08-02');
  });

  it('goes backwards', () => {
    expect(isoDate(addDays(new Date(2026, 0, 1), -1))).toBe('2025-12-31');
  });

  it('keeps the calendar day across a DST spring-forward', () => {
    // 8 March 2026 is when the US clocks go forward. Adding a day by hours
    // would land at 11pm on the 8th; setDate lands on the 9th, which is what
    // "tomorrow" means to a reader.
    expect(isoDate(addDays(new Date(2026, 2, 7, 12), 2))).toBe('2026-03-09');
  });
});

describe('startOfWeek', () => {
  it('defaults to Monday', () => {
    // 30 July 2026 is a Thursday.
    expect(isoDate(startOfWeek(new Date(2026, 6, 30)))).toBe('2026-07-27');
  });

  it('leaves a Monday where it is rather than going back a week', () => {
    expect(isoDate(startOfWeek(new Date(2026, 6, 27)))).toBe('2026-07-27');
  });

  it('sends a Sunday back six days, not forward one', () => {
    // The `+ 7) % 7` in the shift is what makes this work; without it a Sunday
    // would compute a negative shift and jump into the following week.
    expect(isoDate(startOfWeek(new Date(2026, 6, 26)))).toBe('2026-07-20');
  });

  it('honours a Sunday start when asked for one', () => {
    expect(isoDate(startOfWeek(new Date(2026, 6, 30), 0))).toBe('2026-07-26');
  });

  it('zeroes the clock, so the result is a day and not a moment', () => {
    const start = startOfWeek(new Date(2026, 6, 30, 17, 45, 12));
    expect([start.getHours(), start.getMinutes(), start.getSeconds()]).toEqual([0, 0, 0]);
  });
});

describe('startOfMonth and endOfMonth', () => {
  it('bound the month a date is in', () => {
    const mid = new Date(2026, 6, 15);
    expect(isoDate(startOfMonth(mid))).toBe('2026-07-01');
    expect(isoDate(endOfMonth(mid))).toBe('2026-07-31');
  });

  it('gets February right in a leap year and out of one', () => {
    expect(isoDate(endOfMonth(new Date(2024, 1, 10)))).toBe('2024-02-29');
    expect(isoDate(endOfMonth(new Date(2026, 1, 10)))).toBe('2026-02-28');
  });
});

describe('isSameDay and isToday', () => {
  it('compares the day and ignores the time', () => {
    expect(isSameDay(new Date(2026, 6, 30, 1), new Date(2026, 6, 30, 23))).toBe(true);
    expect(isSameDay(new Date(2026, 6, 30, 23, 59), new Date(2026, 6, 31, 0, 1))).toBe(
      false,
    );
  });

  it('calls late evening today, not tomorrow', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 30, 22, 0));
    expect(isToday(new Date(2026, 6, 30, 8, 0))).toBe(true);
    expect(isToday(new Date(2026, 6, 31, 8, 0))).toBe(false);
    vi.useRealTimers();
  });
});

describe('formatDate', () => {
  // Assertions compare two formatter outputs rather than a literal string, so
  // they say what they mean on a machine whose locale is not en-US.
  const DAY = { year: 'numeric', month: '2-digit', day: '2-digit' } as const;

  it('formats a Date', () => {
    expect(formatDate(new Date(2026, 6, 30), DAY)).toBe(
      new Intl.DateTimeFormat(undefined, DAY).format(new Date(2026, 6, 30)),
    );
  });

  it('formats a stored timestamp as its local day, not the UTC one', () => {
    // '2026-07-30T23:30:00' is the 31st in UTC. Handing the whole string to
    // `new Date` would print the 31st here, which is the calendar's oldest bug.
    expect(formatDate('2026-07-30T23:30:00', DAY)).toBe(
      formatDate(new Date(2026, 6, 30), DAY),
    );
    expect(formatDate('2026-07-30T23:30:00', DAY)).not.toBe(
      formatDate(new Date(2026, 6, 31), DAY),
    );
  });

  it('formats a plain ISO day without shifting it', () => {
    expect(formatDate('2026-01-01', DAY)).toBe(formatDate(new Date(2026, 0, 1), DAY));
  });

  it('defaults to a medium date rather than the raw string', () => {
    expect(formatDate('2026-07-30')).toBe(
      new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
        new Date(2026, 6, 30),
      ),
    );
  });
});

describe('formatDayLabel', () => {
  it('names the weekday alongside the date', () => {
    // 30 July 2026 is a Thursday. Asserted through the formatter so the test
    // does not depend on the locale spelling it "Thu".
    expect(formatDayLabel(new Date(2026, 6, 30))).toBe(
      new Intl.DateTimeFormat(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }).format(new Date(2026, 6, 30)),
    );
  });
});

describe('greeting', () => {
  it('turns over at noon and at six', () => {
    expect(greeting(new Date(2026, 6, 30, 11, 59))).toBe('Good morning');
    expect(greeting(new Date(2026, 6, 30, 12, 0))).toBe('Good afternoon');
    expect(greeting(new Date(2026, 6, 30, 17, 59))).toBe('Good afternoon');
    expect(greeting(new Date(2026, 6, 30, 18, 0))).toBe('Good evening');
  });

  it('calls the small hours morning', () => {
    expect(greeting(new Date(2026, 6, 30, 0, 5))).toBe('Good morning');
  });
});
