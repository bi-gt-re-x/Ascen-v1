/**
 * The XP bands, and the marks a cell draws from them.
 *
 * The grid's colour used to be relative — a day shaded against the busiest day
 * on screen — which meant the same Tuesday changed colour when you stepped to
 * a heavier month and the legend under it could not have existed. These
 * thresholds are the thing that makes the key possible, so the boundaries are
 * worth pinning: an off-by-one at 800 is a green day quietly becoming a blue
 * one and nothing failing anywhere.
 */
import { describe, expect, it } from 'vitest';
import { MAX_MARKS, XP_BANDS, monthDays, xpBand } from './monthSummary';
import { task } from '@/test/factories';
import type { Task } from '@/types';

function dated(day: number, xp: number, over: Partial<Task> = {}): Task {
  return task({
    id: `t${day}-${xp}-${Math.random()}`,
    xp_value: xp,
    show_on_calendar: true,
    due_date: `2026-09-${String(day).padStart(2, '0')}T10:00:00`,
    status: 'todo',
    ...over,
  });
}

describe('xpBand', () => {
  it('puts each figure in the band the legend names', () => {
    expect(xpBand(1200)).toBe('exceptional');
    expect(xpBand(650)).toBe('great');
    expect(xpBand(310)).toBe('good');
    expect(xpBand(120)).toBe('low');
    expect(xpBand(0)).toBe('none');
  });

  it('is inclusive at the bottom of every band', () => {
    expect(xpBand(800)).toBe('exceptional');
    expect(xpBand(799)).toBe('great');
    expect(xpBand(500)).toBe('great');
    expect(xpBand(499)).toBe('good');
    expect(xpBand(200)).toBe('good');
    expect(xpBand(199)).toBe('low');
    expect(xpBand(1)).toBe('low');
  });

  it('has a band for every key the legend prints, and no more', () => {
    const keys = XP_BANDS.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
    [1200, 650, 310, 120, 0].forEach((xp) => {
      expect(keys).toContain(xpBand(xp));
    });
  });
});

describe('a day’s marks', () => {
  it('is one per thing on the day, in its own band', () => {
    const [day] = monthDays(2026, 8, [dated(1, 900), dated(1, 300)], {});
    expect(day?.marks).toEqual(['exceptional', 'good']);
  });

  it('stops at the cap, because a cell is a seventh of a grid', () => {
    const many = Array.from({ length: MAX_MARKS + 4 }, () => dated(1, 300));
    const [day] = monthDays(2026, 8, many, {});
    expect(day?.events).toBe(MAX_MARKS + 4);
    expect(day?.marks).toHaveLength(MAX_MARKS);
  });

  it('counts calendar events alongside tasks', () => {
    const [day] = monthDays(2026, 8, [dated(1, 900)], {
      '2026-9-1': { timestamps: [{ startTime: '09:00', endTime: '10:00', task: 'An event', xp: 250 }] },
    });
    expect(day?.marks).toEqual(['exceptional', 'good']);
  });

  it('leaves an empty day with nothing to draw', () => {
    const [day] = monthDays(2026, 8, [], {});
    expect(day?.marks).toEqual([]);
    expect(day?.events).toBe(0);
  });
});
