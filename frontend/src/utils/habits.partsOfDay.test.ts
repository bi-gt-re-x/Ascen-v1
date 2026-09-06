/**
 * When the work happened — the tally the Day 4-7 page prints.
 *
 * The interesting cases are all about what is *not* counted. A task with no
 * clock on its stamp, a task outside the window, an unfinished task: each of
 * them would land in a bucket if the filter were sloppy, and every one of them
 * would be this page inventing a time of day it was never told.
 */
import { describe, expect, it } from 'vitest';
import { partsOfDay } from './habits';
import type { Task } from '@/types';

function task(over: Partial<Task>): Task {
  return {
    id: 't', user_id: 'u', title: 'x', description: '',
    priority: 'medium', status: 'done', xp_value: 10,
    created_at: '2026-01-01T09:00:00',
    ...over,
  } as Task;
}

const FROM = '2026-01-01';
const TO = '2026-01-31';
const countOf = (parts: ReturnType<typeof partsOfDay>, label: string) =>
  parts.find((part) => part.label === label)?.count ?? 0;

describe('partsOfDay', () => {
  it('buckets by the hour on the stamp', () => {
    const parts = partsOfDay(
      [
        task({ completed_at: '2026-01-05T08:30:00' }),
        task({ completed_at: '2026-01-05T14:00:00' }),
        task({ completed_at: '2026-01-06T19:15:00' }),
        task({ completed_at: '2026-01-06T23:40:00' }),
      ],
      FROM,
      TO,
    );
    expect(countOf(parts, 'the morning')).toBe(1);
    expect(countOf(parts, 'the afternoon')).toBe(1);
    expect(countOf(parts, 'the evening')).toBe(1);
    expect(countOf(parts, 'the late hours')).toBe(1);
  });

  it('always returns all four buckets, so an empty one is drawn as empty', () => {
    const parts = partsOfDay([task({ completed_at: '2026-01-05T08:30:00' })], FROM, TO);
    expect(parts).toHaveLength(4);
    expect(countOf(parts, 'the evening')).toBe(0);
  });

  it('skips a stamp with no clock on it rather than calling it morning', () => {
    expect(partsOfDay([task({ completed_at: '2026-01-05' })], FROM, TO)).toEqual([]);
  });

  it('skips tasks that are not finished', () => {
    expect(partsOfDay([task({ status: 'todo', completed_at: '2026-01-05T08:00:00' })], FROM, TO)).toEqual([]);
  });

  it('skips tasks outside the window', () => {
    expect(partsOfDay([task({ completed_at: '2025-12-30T08:00:00' })], FROM, TO)).toEqual([]);
  });

  it('says nothing at all when nothing qualifies', () => {
    // An empty array, not four zeroes: the panel needs to tell "no times
    // recorded" apart from "no work in any bucket", and they read differently.
    expect(partsOfDay([], FROM, TO)).toEqual([]);
  });

  it('puts the small hours in the late bucket, not the morning', () => {
    const parts = partsOfDay([task({ completed_at: '2026-01-05T01:20:00' })], FROM, TO);
    expect(countOf(parts, 'the late hours')).toBe(1);
    expect(countOf(parts, 'the morning')).toBe(0);
  });
});
