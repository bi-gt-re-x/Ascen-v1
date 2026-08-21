/**
 * Account preferences.
 *
 * Backend: backend/api/settings.py.
 *
 * The keyed preferences travel under `values` as one object, so adding a
 * preference is a line in `Prefs` here and a line in `FIELDS` there — not a
 * new field threaded through a request model, a service function and a page.
 *
 * `save` sends only what it is given and the server writes only what it is
 * sent, which is what lets a page of independent controls be safe: changing
 * the accent cannot write back a stale copy of every other preference.
 */
import { get, post } from './api';
import type { ApiResult } from '@/types';

export type ThemeMode = 'system' | 'light' | 'dark';
export type Accent = 'violet' | 'blue' | 'green' | 'amber' | 'rose' | 'slate';
export type Priority = 'low' | 'medium' | 'high';
export type CalendarView = 'day' | 'week' | 'month';
export type AnalyticsWindow = '7d' | '30d' | '90d' | '1y' | '2y' | 'all';

/** The preferences kept as key/value. Mirrors FIELDS in the backend. */
export interface Prefs {
  theme_mode: ThemeMode;
  accent: Accent;
  reduce_motion: boolean;
  show_stats: boolean;
  show_insights: boolean;
  default_priority: Priority;
  default_xp: number;
  ask_rating: boolean;
  confirm_delete: boolean;
  calendar_view: CalendarView;
  analytics_window: AnalyticsWindow;
}

export interface Settings extends Prefs {
  /** On the user row rather than in user_settings. Historical; see the API. */
  name: string;
  theme: 'light' | 'dark';
  daily_goal: number;
  /** Read-only. */
  username: string;
  email: string;
  created_at: string;
  level: number;
  xp: number;
  avatar: string;
}

/** What a save may carry. Anything left out is left alone. */
export interface SettingsEdit {
  name?: string;
  theme?: 'light' | 'dark';
  daily_goal?: number;
  values?: Partial<Prefs>;
}

/** What the app assumes before the account's own answer has arrived. */
export const DEFAULTS: Prefs = {
  theme_mode: 'system',
  accent: 'violet',
  reduce_motion: false,
  show_stats: true,
  show_insights: true,
  default_priority: 'medium',
  default_xp: 30,
  ask_rating: true,
  confirm_delete: true,
  calendar_view: 'week',
  analytics_window: '1y',
};

export function getSettings(username: string): Promise<ApiResult<{ settings: Settings }>> {
  return get<{ settings: Settings }>('/api/settings', { username });
}

export function saveSettings(
  username: string,
  edit: SettingsEdit,
): Promise<ApiResult<{ settings: Settings }>> {
  return post<{ settings: Settings }>('/api/settings', { username, ...edit });
}

/** Where the browser should be pointed to download an export. */
export function exportUrl(username: string, table: string, format: 'json' | 'csv'): string {
  const query = new URLSearchParams({ username, table, format });
  return `/api/settings/export?${query.toString()}`;
}
