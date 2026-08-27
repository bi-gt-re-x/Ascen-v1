/**
 * Formatting, at the edges where it is easy to get wrong.
 *
 * The two rules the module states about itself are the two things worth
 * asserting: never invent precision, and never print a zero where "nothing
 * yet" is the truth — which is why `duration` says "0s" and `minutes` says
 * "0m" for the same nothing, and why that difference is tested rather than
 * tidied away.
 */
import { describe, expect, it } from 'vitest';
import { LEVEL_XP_STEP } from '@/services/constants';
import { clock, duration, levelForTotalXp, minutes, number, percent } from './format';

describe('levelForTotalXp', () => {
  it('starts everyone at level 1 with nothing banked', () => {
    expect(levelForTotalXp(0)).toEqual({
      level: 1,
      xpInLevel: 0,
      xpRequired: LEVEL_XP_STEP,
      percent: 0,
    });
  });

  it('levels up on the exact cost, not one XP after it', () => {
    // Level 1 costs 100. At 99 you are still level 1; at 100 you are level 2
    // with nothing banked, and level 2 costs 200.
    expect(levelForTotalXp(99)).toMatchObject({ level: 1, xpInLevel: 99 });
    expect(levelForTotalXp(100)).toMatchObject({
      level: 2,
      xpInLevel: 0,
      xpRequired: 200,
    });
  });

  it('charges N * 100 for level N, so the ladder gets steeper', () => {
    // 100 + 200 + 300 = 600 is the entry to level 4.
    expect(levelForTotalXp(600)).toMatchObject({
      level: 4,
      xpInLevel: 0,
      xpRequired: 400,
    });
    expect(levelForTotalXp(599)).toMatchObject({ level: 3, xpInLevel: 299 });
  });

  it('reports progress through the current level, not the whole climb', () => {
    // 600 to be level 4, which costs 400; 800 is halfway through it.
    expect(levelForTotalXp(800)).toMatchObject({ xpInLevel: 200, percent: 50 });
  });

  it('treats a negative or missing total as zero rather than looping', () => {
    expect(levelForTotalXp(-500)).toMatchObject({ level: 1, xpInLevel: 0 });
    expect(levelForTotalXp(NaN)).toMatchObject({ level: 1, xpInLevel: 0 });
  });

  it('floors a fractional total instead of banking a fraction of an XP', () => {
    expect(levelForTotalXp(150.9)).toMatchObject({ level: 2, xpInLevel: 50 });
  });
});

describe('duration', () => {
  it('drops the minutes when there are none, rather than saying "1h 0m"', () => {
    expect(duration(3600)).toBe('1h');
    expect(duration(3660)).toBe('1h 1m');
  });

  it('drops the hour when there is none', () => {
    expect(duration(1500)).toBe('25m');
  });

  it('falls back to seconds under a minute, so a stopwatch is never "0m"', () => {
    expect(duration(45)).toBe('45s');
    expect(duration(0)).toBe('0s');
  });

  it('never counts backwards', () => {
    expect(duration(-90)).toBe('0s');
  });

  it('rounds to the nearest second before splitting it up', () => {
    expect(duration(59.6)).toBe('1m');
  });
});

describe('minutes', () => {
  it('says "0m" where duration would say "0s" — the unit is minutes', () => {
    expect(minutes(0)).toBe('0m');
    expect(duration(0)).toBe('0s');
  });

  it('splits into hours and keeps the remainder', () => {
    expect(minutes(80)).toBe('1h 20m');
    expect(minutes(120)).toBe('2h');
    expect(minutes(45)).toBe('45m');
  });
});

describe('clock', () => {
  it('pads both halves so the timer does not jump width', () => {
    expect(clock(63)).toBe('01:03');
    expect(clock(9)).toBe('00:09');
  });

  it('grows an hours field only once there is an hour', () => {
    expect(clock(3599)).toBe('59:59');
    expect(clock(3600)).toBe('01:00:00');
    expect(clock(5043)).toBe('01:24:03');
  });
});

describe('number and percent', () => {
  // `number` formats in the runtime's locale, so the thousands separator is
  // whatever that locale uses. The claim under test is the rounding and the
  // grouping, not the character — asserting '5,928' would pass on this machine
  // and fail on a German one for no reason anybody would want to fix.
  const digits = (value: string) => value.replace(/\D/g, '');

  it('rounds rather than truncating', () => {
    expect(digits(number(5927.6))).toBe('5928');
    expect(digits(number(5927.4))).toBe('5927');
    expect(percent(3.5)).toBe('4%');
    expect(percent(3.4)).toBe('3%');
  });

  it('groups thousands, so a five-figure XP total stays readable', () => {
    expect(number(5928).length).toBeGreaterThan(digits(number(5928)).length);
  });

  it('reads a missing value as zero', () => {
    expect(number(NaN)).toBe('0');
    expect(percent(NaN)).toBe('0%');
  });
});
