/**
 * Which days the mini-month marks.
 *
 * Three of the rules here are the kind that look obvious and are wrong the
 * first time somebody writes them: a day is settled only when *everything* on
 * it is, both sources have to be folded into one answer rather than one
 * overwriting the other, and a to-do that was never put on a day must not put
 * a dot on one. Each of those is a mark appearing where the reader can see it
 * and nothing to explain why.
 */
import { describe, expect, it } from 'vitest';
import { busyDays } from './calendarBusy';
import type { CalendarData } from './calendarStore';
import type { Task } from '@/types';

/** A calendar task: dated, and told to show on the calendar. */
function task(id: string, due: string, done = false): Task {
  return {
    id,
    title: `Task ${id}`,
    status: done ? 'done' : 'pending',
    due_date: `${due}T10:00:00`,
    created_at: `${due}T09:00:00`,
    show_on_calendar: true,
    xp_value: 30,
    priority: 'medium',
  } as unknown as Task;
}

function store(day: string, sections: { completed?: boolean; isDashboardTask?: boolean }[]): CalendarData {
  return {
    [day]: {
      timestamps: sections.map((s, n) => ({
        task: `Event ${n}`,
        startTime: '09:00',
        endTime: '10:00',
        ...s,
      })),
    },
  } as unknown as CalendarData;
}

describe('the days a mini-month marks', () => {
  it('marks a day with an unfinished task as open', () => {
    const load = busyDays([task('1', '2026-09-10')], {} as CalendarData);
    expect(load.get('2026-09-10')).toBe(false);
  });

  it('marks a day whose only task is done as settled', () => {
    const load = busyDays([task('1', '2026-09-10', true)], {} as CalendarData);
    expect(load.get('2026-09-10')).toBe(true);
  });

  it('leaves a day with nothing on it unmarked', () => {
    const load = busyDays([task('1', '2026-09-10')], {} as CalendarData);
    expect(load.has('2026-09-11')).toBe(false);
  });

  /* The whole point of the two states: one loose end is enough to keep a day
     open, however much else on it is finished. A day that showed as settled
     with something still to do on it would be worse than no mark at all. */
  it('keeps a day open while any one thing on it is', () => {
    const load = busyDays(
      [task('1', '2026-09-10', true), task('2', '2026-09-10', false), task('3', '2026-09-10', true)],
      {} as CalendarData,
    );
    expect(load.get('2026-09-10')).toBe(false);
  });

  it('folds the two sources into one answer rather than letting one win', () => {
    // A finished task and an unfinished event, on the same day, from the
    // account and from the browser's store respectively.
    const load = busyDays([task('1', '2026-09-10', true)], store('2026-9-10', [{ completed: false }]));
    expect(load.get('2026-09-10')).toBe(false);

    const other = busyDays([task('1', '2026-09-10', false)], store('2026-9-10', [{ completed: true }]));
    expect(other.get('2026-09-10')).toBe(false);
  });

  it('marks a day whose event is done and has no task', () => {
    const load = busyDays([], store('2026-9-10', [{ completed: true }]));
    expect(load.get('2026-09-10')).toBe(true);
  });

  /* A dashboard to-do was mirrored into the store by the old calendar and was
     never a thing scheduled on a day — components/Calendar/entries.ts drops
     them for the same reason. */
  it('ignores a to-do the old calendar mirrored into the store', () => {
    const load = busyDays([], store('2026-9-10', [{ isDashboardTask: true }]));
    expect(load.has('2026-09-10')).toBe(false);
  });

  it('ignores a task that was never put on the calendar', () => {
    const loose = { ...task('1', '2026-09-10'), show_on_calendar: false } as Task;
    expect(busyDays([loose], {} as CalendarData).size).toBe(0);
  });

  /* The store keys days unpadded — "2026-9-10" — and the mini-month asks in
     ISO. A mismatch here is the failure that puts every event's dot on no day
     at all, silently. */
  it('answers in ISO, whatever the store keys days as', () => {
    const load = busyDays([], store('2026-9-3', [{ completed: false }]));
    expect([...load.keys()]).toEqual(['2026-09-03']);
  });
});
