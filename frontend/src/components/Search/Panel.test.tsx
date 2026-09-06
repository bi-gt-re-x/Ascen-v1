/**
 * Where the search sends a task.
 *
 * The one rule in this panel that is a decision rather than a rendering, and
 * the one the reader notices when it is wrong: a task the calendar draws lives
 * on a day, and being taken to the tasks page instead means being taken to the
 * screen it is not on. `isCalendarPlaced` is the calendar's own test for that
 * (utils/calendarGrid) and this is the check that the panel is asking it.
 */
import { describe, expect, it } from 'vitest';
import { taskTo } from './Panel';
import { task } from '@/test/factories';

describe('taskTo', () => {
  it('sends a calendar task to the day it sits on', () => {
    const to = taskTo(task({
      id: '42',
      show_on_calendar: true,
      due_date: '2026-09-03T14:00:00',
    }));
    expect(to).toBe('/calendar/day?date=2026-09-03&task=42');
  });

  it('sends a task nobody put on the calendar to the tasks page', () => {
    expect(taskTo(task({ id: '7', show_on_calendar: false, due_date: '2026-09-03' })))
      .toBe('/tasks?task=7');
  });

  it('sends a dateless task to the tasks page, flagged or not', () => {
    /* `isCalendarPlaced` wants both, and this is why: a flag with no date is
       a task the calendar has nowhere to draw. */
    expect(taskTo(task({ id: '8', show_on_calendar: true, due_date: '' })))
      .toBe('/tasks?task=8');
  });

  it('falls back to the tasks page rather than to a broken day', () => {
    expect(taskTo(task({ id: '9', show_on_calendar: true, due_date: 'not a date' })))
      .toBe('/tasks?task=9');
  });

  it('escapes the id it puts in the query', () => {
    expect(taskTo(task({ id: 'a b&c', show_on_calendar: false })))
      .toBe('/tasks?task=a%20b%26c');
  });

  it('carries the id either way, so two matches are two places', () => {
    const onCalendar = taskTo(task({
      id: '1', show_on_calendar: true, due_date: '2026-09-03T09:00:00',
    }));
    const onList = taskTo(task({ id: '2', show_on_calendar: false }));
    expect(onCalendar).not.toBe(onList);
    expect(onCalendar).toContain('task=1');
    expect(onList).toContain('task=2');
  });
});
