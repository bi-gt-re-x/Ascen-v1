/**
 * Which days the dashboard is allowed to ask about.
 *
 * The four rules in utils/catchUp interact, and three of the four are about
 * *not* asking — which is the half that has no visible symptom when it breaks.
 * A prompt that asks one day too many looks exactly like a prompt that is
 * working, right up until it asks somebody about a Tuesday they spent two
 * hours timing.
 */
import { describe, expect, it } from 'vitest';
import { CATCHUP_WINDOW_DAYS, agoLabel, catchUpDays } from './catchUp';

const none = new Set<string>();

describe('the days the catch-up prompt asks about', () => {
  it('asks about the gap, most recent first, and never about today', () => {
    const days = catchUpDays({ today: '2026-08-29', seenOn: '2026-08-27', logged: none });
    expect(days.map((day) => day.iso)).toEqual(['2026-08-28', '2026-08-27']);
    expect(days[0]).toMatchObject({ ago: 1, weekday: 'Friday', date: 'August 28' });
  });

  it('says nothing on an account it has never met', () => {
    // '' is a real state and not a missing one: the first visit records the
    // day and asks nothing, because an account with no recorded visit is not
    // one with a week of unlogged days.
    expect(catchUpDays({ today: '2026-08-29', seenOn: '', logged: none })).toEqual([]);
  });

  it('says nothing on a second load of the same day', () => {
    expect(catchUpDays({ today: '2026-08-29', seenOn: '2026-08-29', logged: none })).toEqual([]);
  });

  it('says nothing when the stored day is in the future', () => {
    // A clock that has gone backwards. Days that have not happened are not a
    // gap, and treating the comparison as a plain "not equal" would ask about
    // them.
    expect(catchUpDays({ today: '2026-08-29', seenOn: '2026-09-02', logged: none })).toEqual([]);
  });

  it('skips a day that already has focus on it', () => {
    const days = catchUpDays({
      today: '2026-08-29',
      seenOn: '2026-08-26',
      logged: new Set(['2026-08-27']),
    });
    expect(days.map((day) => day.iso)).toEqual(['2026-08-28', '2026-08-26']);
  });

  it('goes no further back than the window, however long the absence', () => {
    // Somebody returning after three months gets a week, not ninety rows —
    // and would not remember ninety honestly if they did.
    const days = catchUpDays({ today: '2026-08-29', seenOn: '2026-05-01', logged: none });
    expect(days).toHaveLength(CATCHUP_WINDOW_DAYS);
    expect(days[days.length - 1]!.iso).toBe('2026-08-22');
  });

  it('refuses to reason about a date it cannot read', () => {
    expect(catchUpDays({ today: 'nonsense', seenOn: '2026-08-27', logged: none })).toEqual([]);
    expect(catchUpDays({ today: '2026-08-29', seenOn: 'nonsense', logged: none })).toEqual([]);
  });
});

describe('how a day is named', () => {
  it('says yesterday rather than one day ago', () => {
    expect(agoLabel(1)).toBe('Yesterday');
    expect(agoLabel(3)).toBe('3 days ago');
  });
});
