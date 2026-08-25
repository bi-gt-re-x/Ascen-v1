/**
 * The calendar: what is on it and when.
 *
 * Two kinds of row, and the difference matters:
 *
 *   * **entries** — a task placed on a day, so the calendar shows work that
 *     also exists on the dashboard. Scoped to an account.
 *   * **events** — a standalone block created on the calendar itself, with
 *     optional weekly/monthly recurrence. `is_default` marks the built-in ones,
 *     which cannot be deleted.
 *
 * Colours are tracked separately: every hex colour handed out so far, so a new
 * event can be given one that is visibly different from the rest.
 *
 * Backend: backend/api/calendar.py.
 */
import { del, get, post, put } from './api';
import type {
  ApiResult,
  CalendarEntry,
  CalendarEvent,
} from '@/types';

// --------------------------------------------------------------------------
// Entries: a task on a day
// --------------------------------------------------------------------------
export function listEntries(
): Promise<ApiResult<{ entries: CalendarEntry[] }>> {
  return get<{ entries: CalendarEntry[] }>('/api/calendar');
}

export interface NewEntry {
  date: string;
  time_block: string;
  task_id?: string | null;
  id?: string;
}

export function createEntry(
  entry: NewEntry,
): Promise<ApiResult<{ entry_id: string }>> {
  return post<{ entry_id: string }>('/api/calendar', { ...entry });
}

export function updateEntry(
  entryId: string,
  edit: Partial<NewEntry>,
): Promise<ApiResult<Record<string, never>>> {
  return put(`/api/calendar/${encodeURIComponent(entryId)}`, {
    ...edit,
  });
}

export function deleteEntry(
  entryId: string,
): Promise<ApiResult<Record<string, never>>> {
  return del(`/api/calendar/${encodeURIComponent(entryId)}`);
}

// --------------------------------------------------------------------------
// Events: standalone blocks
// --------------------------------------------------------------------------
/**
 * The recurrence fields are hyphenated on the wire.
 *
 * That spelling is already in the database and in every calendar script, so it
 * is kept rather than translated — a rename here would be a migration there.
 */
export interface NewEvent {
  name: string;
  date: string;
  time_block: string;
  'recurrence-month'?: string | null;
  'recurrence-week'?: string | null;
  end_date?: string | null;
}

export function createEvent(
  event: NewEvent,
): Promise<ApiResult<{ entry_id: string; message: string }>> {
  return post('/api/create_calendar_event', event);
}

/** Delete a custom event. Built-in (default) events are protected. */
export function deleteEvent(
  eventId: string,
): Promise<ApiResult<{ message: string }>> {
  return del(`/api/delete_calendar_event/${encodeURIComponent(eventId)}`);
}

export function defaultEvents(): Promise<ApiResult<{ events: CalendarEvent[] }>> {
  return get<{ events: CalendarEvent[] }>('/api/get_default_events');
}

export function customEvents(): Promise<ApiResult<{ events: CalendarEvent[] }>> {
  return get<{ events: CalendarEvent[] }>('/api/get_custom_events');
}

/** Put an existing task on the calendar as an event block. */
export function syncTaskToCalendar(
  taskId: string,
  date: string,
  options: Omit<Partial<NewEvent>, 'date'> = {},
): Promise<ApiResult<{ entry_id: string; message: string }>> {
  return post('/api/sync_task_to_calendar', {
    task_id: taskId,
    date,
    ...options,
  });
}

/** Complete a task and tick off every calendar entry pointing at it. */
export function markTaskCompleted(
  taskId: string,
): Promise<ApiResult<{ message: string }>> {
  return post('/api/mark_task_completed_in_calendar', {
    task_id: taskId,
  });
}

export interface CalendarProgress {
  total_entries: number;
  completed_entries: number;
  completion_rate: number;
  entries_by_date: Record<string, CalendarEntry[]>;
  entries: CalendarEntry[];
}

export function progress(
): Promise<ApiResult<CalendarProgress>> {
  return get<CalendarProgress>('/api/get_calendar_progress');
}

// --------------------------------------------------------------------------
// Colours
// --------------------------------------------------------------------------
/** Every colour already handed out, in the order it was assigned. */
export function eventColors(): Promise<ApiResult<{ colors: string[] }>> {
  return get<{ colors: string[] }>('/api/get_event_colors');
}

/** Track a newly-assigned colour. Must be `#rrggbb`, lowercase. */
export function addEventColor(
  color: string,
): Promise<ApiResult<{ colors: string[] }>> {
  return post<{ colors: string[] }>('/api/add_event_color', {
    color: color.trim().toLowerCase(),
  });
}

// --------------------------------------------------------------------------
// What a day amounted to
// --------------------------------------------------------------------------
/**
 * XP earned on one calendar day, straight from the ledger.
 *
 * Midnight to midnight, which is why the calendar's "XP Earned" always means
 * "since 12 AM today" and not "since the last time anything was recomputed".
 */
export function xpEarnedOn(
  date: string,
): Promise<ApiResult<{ date: string; xp_earned: number; tasks_completed: number }>> {
  return get('/api/xp_earned_on', { date });
}
