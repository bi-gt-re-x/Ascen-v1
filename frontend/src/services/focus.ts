/**
 * Focus time — how long the user actually sat down and worked.
 *
 * The timer itself runs client-side; what the server keeps is each day's
 * total, so the calendar's Weekly Focus Time panel, the growth chart and
 * focus-type goals all read one number that survives a cleared browser.
 *
 * `syncDay` never lowers a day's recorded total — the backend takes the larger
 * of what it has and what it is sent. That is deliberate: an old tab whose
 * localStorage was cleared would otherwise report a smaller number and erase
 * real work. So calling it too often is harmless, and calling it with a stale
 * value is harmless too.
 *
 * Also here: the one-line note attached to a calendar day, which the Week, Day
 * and Month views all show — an edit in one view lands everywhere.
 *
 * Backend: backend/api/focus.py, backend/api/calendar.py.
 */
import { get, post } from './api';
import { MAX_FOCUS_SECONDS, MAX_GOAL_HOURS, MIN_GOAL_HOURS } from './constants';
import type { ApiResult, DayFocusNotes, FocusDay, FocusHistory } from '@/types';

/**
 * Mirror one day's focus total to the server.
 *
 * Values are clamped here as well as on the backend, so an obviously wrong
 * number is corrected before it makes a round trip rather than after.
 */
export function syncDay(
  date: string,
  focusedSeconds: number,
  goalHours: number,
): Promise<ApiResult<{ focus: FocusDay }>> {
  return post<{ focus: FocusDay }>('/api/focus_sync', {
    date,
    focused_seconds: Math.max(0, Math.min(MAX_FOCUS_SECONDS, focusedSeconds)),
    goal_hours: Math.max(MIN_GOAL_HOURS, Math.min(MAX_GOAL_HOURS, goalHours)),
  });
}

/**
 * Tracked focus for a date range, keyed by ISO date.
 *
 * Days with no record are simply absent — nothing was tracked and nothing was
 * planned — so read them with a fallback rather than expecting a full range.
 */
export function history(
  start?: string,
  end?: string,
): Promise<ApiResult<{ days: FocusHistory }>> {
  return get<{ days: FocusHistory }>('/api/focus_history', {
    start,
    end,
  });
}

// --------------------------------------------------------------------------
// The per-day focus note
// --------------------------------------------------------------------------
export function dayNotes(
): Promise<ApiResult<{ day_focus: DayFocusNotes }>> {
  return get<{ day_focus: DayFocusNotes }>('/api/day_focus');
}

/** Upsert one day's note. Empty text deletes it. Truncated to 200 chars. */
export function setDayNote(
  date: string,
  text: string,
): Promise<ApiResult<{ date: string; text: string }>> {
  return post<{ date: string; text: string }>('/api/day_focus', {
    date,
    text: text.trim().slice(0, 200),
  });
}
