/**
 * Account preferences.
 *
 * Backend: backend/api/settings.py.
 *
 * Two calls over what are really three stores — the user row, the theme
 * cookie, and the key/value table — because the page setting three
 * preferences should make one request. The server flattens them; nothing here
 * needs to know which value lives where.
 *
 * `save` sends only the fields it is given, and the server writes only the
 * fields it is sent. That is what makes a page of independent controls safe:
 * changing the theme cannot overwrite a name the reader was midway through
 * typing in another field.
 */
import { get, post } from './api';
import type { ApiResult } from '@/types';

export type Theme = 'light' | 'dark';
export type WeekStart = 'monday' | 'sunday';

export interface Settings {
  /** Editable. */
  name: string;
  theme: Theme;
  daily_goal: number;
  week_start: WeekStart;
  confirm_delete: boolean;
  /** Read-only, so the page can show whose account it is editing. */
  username: string;
  email: string;
  created_at: string;
  level: number;
  xp: number;
  avatar: string;
}

/** The subset a save may carry. Anything left out is left alone. */
export type SettingsEdit = Partial<
  Pick<Settings, 'name' | 'theme' | 'daily_goal' | 'week_start' | 'confirm_delete'>
>;

export function getSettings(username: string): Promise<ApiResult<{ settings: Settings }>> {
  return get<{ settings: Settings }>('/api/settings', { username });
}

export function saveSettings(
  username: string,
  edit: SettingsEdit,
): Promise<ApiResult<{ settings: Settings }>> {
  return post<{ settings: Settings }>('/api/settings', { username, ...edit });
}
