/**
 * The calendar's move from localStorage to the server.
 *
 * These tests are about data loss, not about features. Every event any user of
 * this app had ever made lived in their own browser and nowhere else, so the
 * migration runs against accounts whose only copy is local — and the ways that
 * can go wrong are all silent:
 *
 *   * an empty server answer read as "this calendar is empty" rather than
 *     "never uploaded", wiping the local copy;
 *   * an upload fired before the first read, pushing a browser that has never
 *     opened this account over a good server copy;
 *   * an edit made and navigated away from inside the debounce window, leaving
 *     the server permanently a version behind.
 *
 * One test each, because each is a calendar somebody loses.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCalendarStore } from './useCalendarStore';
import { loadCalendarData, saveCalendarData } from '@/utils/calendarStore';
import type { CalendarData } from '@/utils/calendarStore';

vi.mock('@/services', () => ({
  events: { calendarStore: vi.fn(), saveCalendarStore: vi.fn() },
}));

vi.mock('@/utils/colorRegistry', () => ({
  claimFamily: () => 'sky',
  primeColorRegistry: vi.fn(async () => {}),
  reserveFamilies: vi.fn(),
  resetLiveColors: vi.fn(),
}));

const { events: eventService } = await import('@/services');
const calendarStore = vi.mocked(eventService.calendarStore);
const saveCalendarStore = vi.mocked(eventService.saveCalendarStore);

/**
 * A successful reply from an endpoint that returns no payload.
 *
 * Cast, because `ApiResult<Record<string, never>>` — the services' convention
 * for exactly that, used fifteen times — cannot actually be constructed: the
 * `never` index signature and `success: true` contradict each other. Nothing
 * had noticed because no test had built one before. Left as a cast rather than
 * fixed here; changing the convention is a change to fifteen call sites and
 * does not belong in a commit about calendar data loss.
 */
const VOID_OK = { success: true } as unknown as Awaited<
  ReturnType<typeof eventService.saveCalendarStore>
>;

/** Mirrors SAVE_DEBOUNCE_MS in the hook. */
const SAVE_DEBOUNCE = 700;

const LOCAL: CalendarData = {
  '2026-7-4': {
    timestamps: [{ startTime: '09:00', endTime: '10:00', task: 'Written in the browser' }],
  },
};

const REMOTE: CalendarData = {
  '2026-8-1': {
    timestamps: [{ startTime: '14:00', endTime: '15:00', task: 'Written on the server' }],
  },
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  saveCalendarStore.mockResolvedValue(VOID_OK);
});

describe('the first read', () => {
  it('uploads the local calendar when the server has never seen one', async () => {
    // Every account that predates the endpoint is this case. An empty answer
    // means "never uploaded", and reading it as "empty" would delete a
    // calendar somebody spent two years building.
    saveCalendarData('myles', LOCAL);
    calendarStore.mockResolvedValue({ success: true, data: {} });

    const { result } = renderHook(() => useCalendarStore('myles'));

    await waitFor(() => expect(saveCalendarStore).toHaveBeenCalledTimes(1));
    expect(saveCalendarStore).toHaveBeenCalledWith(LOCAL);
    // And it is still on screen, and still local.
    expect(result.current.data).toEqual(LOCAL);
    expect(loadCalendarData('myles')).toEqual(LOCAL);
  });

  it('takes the server copy when there is one, and mirrors it locally', async () => {
    saveCalendarData('myles', LOCAL);
    calendarStore.mockResolvedValue({ success: true, data: REMOTE });

    const { result } = renderHook(() => useCalendarStore('myles'));

    await waitFor(() => expect(result.current.data).toEqual(REMOTE));
    // Mirrored, so the next first frame paints the right calendar before any
    // request has landed.
    expect(loadCalendarData('myles')).toEqual(REMOTE);
    expect(saveCalendarStore).not.toHaveBeenCalled();
  });

  it('never wipes a local calendar because the read failed', async () => {
    saveCalendarData('myles', LOCAL);
    calendarStore.mockResolvedValue({ success: false, message: 'offline' });

    const { result } = renderHook(() => useCalendarStore('myles'));

    await Promise.resolve();
    expect(result.current.data).toEqual(LOCAL);
    expect(loadCalendarData('myles')).toEqual(LOCAL);
    expect(saveCalendarStore).not.toHaveBeenCalled();
  });
});

describe('uploads', () => {
  it('sends nothing before the first read has come back', async () => {
    // A browser that has never opened this account holds an empty calendar. An
    // edit landing before the read would push that over the real one.
    //
    // The debounce is run out deliberately: without advancing the timers this
    // would pass whether the guard existed or not, which is a test that proves
    // only that 700ms had not elapsed.
    vi.useFakeTimers();
    calendarStore.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useCalendarStore('myles'));

    act(() => {
      result.current.addEvent('2026-7-9', {
        name: 'Too early',
        startTime: '11:00',
        endTime: '12:00',
        recurrence: 'none',
        recurrenceDays: [],
      });
    });

    act(() => {
      vi.advanceTimersByTime(SAVE_DEBOUNCE * 3);
    });

    expect(saveCalendarStore).not.toHaveBeenCalled();
    // The edit is still on screen and still saved locally — held back from the
    // server is not the same as dropped.
    expect(result.current.data['2026-7-9']?.timestamps).toHaveLength(1);
    vi.useRealTimers();
  });

  it('flushes a pending write when the calendar goes away', async () => {
    // Cancelling the debounce timer would not lose data — localStorage is
    // written synchronously — but it would leave the server a version behind
    // until the next edit, which is the state this change exists to end.
    vi.useFakeTimers();
    calendarStore.mockResolvedValue({ success: true, data: {} });

    const { result, unmount } = renderHook(() => useCalendarStore('myles'));
    await act(async () => {});

    saveCalendarStore.mockClear();
    act(() => {
      result.current.addEvent('2026-7-9', {
        name: 'Edited then left',
        startTime: '11:00',
        endTime: '12:00',
        recurrence: 'none',
        recurrenceDays: [],
      });
    });

    // Still inside the debounce window: nothing sent yet.
    expect(saveCalendarStore).not.toHaveBeenCalled();

    unmount();
    expect(saveCalendarStore).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
