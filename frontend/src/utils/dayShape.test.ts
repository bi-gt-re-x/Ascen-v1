/**
 * What a day comes to.
 *
 * The merge is the part worth pinning. Summing block lengths is right until
 * two blocks share an hour, and a day whose blocks overlap is exactly the day
 * where "how much of my day is left" matters — so the wrong answer would only
 * ever be wrong when somebody was relying on it.
 */
import { describe, expect, it } from 'vitest';
import { dayShape, hourLabel, spanLabel } from './dayShape';
import type { Block } from './calendarGrid';

function taskAt(start: number, end: number, over: Partial<Block> = {}): Block {
  return {
    kind: 'task',
    id: `${start}`,
    title: `task at ${start}`,
    xp: 10,
    done: false,
    priority: 'medium',
    start,
    end,
    top: 0,
    height: 0,
    compact: false,
    snug: false,
    ...over,
  } as Block;
}

function eventAt(start: number, end: number, name = 'an event'): Block {
  return {
    kind: 'event',
    name,
    startHM: '',
    endHM: '',
    family: 'blue',
    start,
    end,
    top: 0,
    height: 0,
    compact: false,
    snug: false,
  } as Block;
}

describe('dayShape', () => {
  it('says nothing about a day with nothing on it', () => {
    const shape = dayShape([], 12);
    expect(shape.bands).toEqual([]);
    expect(shape.next).toBeNull();
    expect(shape.booked).toBe(0);
    expect(shape.onTheTable).toBe(0);
  });

  it('counts an overlapped hour once', () => {
    // 9–11 and 10–12 is three hours booked, not four.
    const shape = dayShape([taskAt(9, 11), taskAt(10, 12)], null);
    expect(shape.booked).toBe(3);
    expect(shape.bands).toHaveLength(1);
    expect(shape.bands[0]).toMatchObject({ start: 9, end: 12 });
  });

  it('keeps blocks that merely touch as one run', () => {
    const shape = dayShape([taskAt(9, 10), taskAt(10, 11)], null);
    expect(shape.bands).toHaveLength(1);
    expect(shape.booked).toBe(2);
  });

  it('finds the longest clear stretch between the day’s two ends', () => {
    const shape = dayShape([taskAt(8, 9), taskAt(12, 13), taskAt(14, 15)], null);
    expect(shape.from).toBe(8);
    expect(shape.to).toBe(15);
    expect(shape.gap).toBe(3);
    expect(shape.gapAt).toBe(9);
  });

  it('has no stretch to report on a back-to-back day', () => {
    const shape = dayShape([taskAt(9, 10), taskAt(10, 11)], null);
    expect(shape.gap).toBe(0);
    expect(shape.gapAt).toBeNull();
  });

  it('marks a run done only when everything in it is', () => {
    const half = dayShape([taskAt(9, 10, { done: true }), taskAt(10, 11)], null);
    expect(half.bands[0]?.done).toBe(false);

    const whole = dayShape(
      [taskAt(9, 10, { done: true }), taskAt(10, 11, { done: true })],
      null,
    );
    expect(whole.bands[0]?.done).toBe(true);
  });

  it('an event is never "done", so a run holding one is not either', () => {
    const shape = dayShape([taskAt(9, 10, { done: true }), eventAt(10, 11)], null);
    expect(shape.bands[0]?.done).toBe(false);
  });

  describe('what is next', () => {
    it('is the block running now, not the one after it', () => {
      /* Somebody glancing at this mid-task wants to be told what they are in,
         not what follows it. */
      const shape = dayShape([taskAt(9, 11), taskAt(13, 14)], 10);
      expect(shape.next).toMatchObject({ start: 9, running: true, away: 0 });
    });

    it('counts down to one that has not started', () => {
      const shape = dayShape([taskAt(9, 10), taskAt(14, 15)], 13.5);
      expect(shape.next).toMatchObject({ start: 14, running: false });
      expect(shape.next?.away).toBeCloseTo(0.5);
    });

    it('is nothing once the day is behind you', () => {
      expect(dayShape([taskAt(9, 10)], 18).next).toBeNull();
    });

    it('is the day’s first thing on a day that is not today', () => {
      const shape = dayShape([taskAt(14, 15), taskAt(9, 10)], null);
      expect(shape.next).toMatchObject({ start: 9, running: false, away: 0 });
    });
  });

  it('adds up what the unfinished tasks are still worth', () => {
    const shape = dayShape(
      [
        taskAt(9, 10, { xp: 40, done: true }),
        taskAt(11, 12, { xp: 30 }),
        taskAt(13, 14, { xp: 95 }),
        eventAt(15, 16),
      ],
      null,
    );
    expect(shape.onTheTable).toBe(125);
    expect(shape.left).toBe(2);
  });
});

describe('labels', () => {
  it('writes a grid hour as a clock', () => {
    expect(hourLabel(9)).toBe('9 AM');
    expect(hourLabel(12)).toBe('12 PM');
    expect(hourLabel(14.5)).toBe('2:30 PM');
    expect(hourLabel(0)).toBe('12 AM');
    // Past midnight the grid keeps counting; the clock does not.
    expect(hourLabel(25)).toBe('1 AM');
  });

  it('writes a span the way the app says it', () => {
    expect(spanLabel(2)).toBe('2h');
    expect(spanLabel(2.5)).toBe('2h 30m');
    expect(spanLabel(0.75)).toBe('45m');
  });
});
