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

/**
 * The analytics preferences the setup questions write, and the settings page
 * edits afterwards. What each one actually changes is in
 * utils/analyticsPrefs — this file only says what the values are.
 *
 * `AnalyticsHomeTab` is the same seven keys as `ViewKey` in
 * components/Analytics/Header. Written out rather than imported for the reason
 * the four task unions below are: a service reaching into a component is the
 * dependency the wrong way round. The page assigns one to the other, so a key
 * added on one side and not the other fails to compile.
 */
export type AnalyticsHomeTab =
  | 'recommendations'
  | 'overview'
  | 'goals'
  | 'habits'
  | 'insights'
  | 'subjects'
  | 'records';
export type LogStyle = 'tasks' | 'sessions' | 'both';
export type AnalyticsTone = 'gentle' | 'balanced' | 'harsh';
export type AnalyticsDetail = 'essentials' | 'standard' | 'everything';
/** Where signing in lands, and where `/` sends an account that is already in. */
export type HomePage = 'dashboard' | 'tasks' | 'calendar' | 'goals' | 'analytics' | 'notes';
export type WeekStart = 'monday' | 'sunday';

/* The four below are the tasks page's own controls, named here so a preference
   can hold one. They are written out rather than imported from
   components/Tasks/board: a service that reaches into a component is the
   dependency the wrong way round. They are the same unions, and the tasks page
   assigns one to the other, so a value added on one side and not the other
   fails to compile rather than failing quietly. */
export type TaskStatus = 'open' | 'done' | 'all';
export type TaskSort = 'due' | 'priority' | 'xp' | 'created' | 'title';
export type TaskGroup = 'due' | 'priority' | 'band' | 'subject' | 'status' | 'none';
export type TaskHorizon = 'week' | 'all';

/**
 * How much the app asks after a task is finished.
 *
 * Three levels, and each one changes what analytics is able to say:
 *
 *   none      nothing is asked. Quality is scored from the XP-per-task proxy
 *             rather than from ratings, and the quality panels say so.
 *   ratings   the two star rows — difficulty and execution. The default, and
 *             what the app has always done.
 *   reasons   the two rows plus one more: what made the difference. Adds the
 *             reasons panel, which nothing else on the page can produce.
 */
export type RatingDepth = 'none' | 'ratings' | 'reasons';

/** The preferences kept as key/value. Mirrors FIELDS in the backend. */
export interface Prefs {
  theme_mode: ThemeMode;
  accent: Accent;
  reduce_motion: boolean;
  show_ambient: boolean;
  nav_collapsed: boolean;
  home_page: HomePage;
  show_stats: boolean;
  show_insights: boolean;
  show_focus: boolean;
  show_quote: boolean;
  default_priority: Priority;
  default_xp: number;
  rating_depth: RatingDepth;
  confirm_delete: boolean;
  task_status: TaskStatus;
  task_sort: TaskSort;
  task_group: TaskGroup;
  task_horizon: TaskHorizon;
  calendar_view: CalendarView;
  week_starts_on: WeekStart;
  focus_goal_hours: number;
  focus_dim: boolean;
  /**
   * Whether the dashboard asks, once a day, about the days since the last
   * visit — work that was done and never tracked. Off removes the prompt
   * entirely; see components/Dashboard/CatchUp.
   */
  catchup_prompt: boolean;
  /**
   * The last day the prompt was put, ISO, or '' for never.
   *
   * State rather than taste — nothing in Settings edits it — and it is what
   * makes the prompt once a day rather than once a page load, as well as what
   * defines the stretch of days it asks about.
   */
  catchup_seen_on: string;
  analytics_window: AnalyticsWindow;
  analytics_setup_done: boolean;
  analytics_home_tab: AnalyticsHomeTab;
  analytics_log_style: LogStyle;
  analytics_tone: AnalyticsTone;
  analytics_detail: AnalyticsDetail;
  analytics_standing: boolean;
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
  show_ambient: true,
  nav_collapsed: false,
  home_page: 'dashboard',
  show_stats: true,
  show_insights: true,
  show_focus: true,
  show_quote: true,
  default_priority: 'medium',
  default_xp: 30,
  rating_depth: 'ratings',
  confirm_delete: true,
  task_status: 'open',
  task_sort: 'due',
  task_group: 'due',
  task_horizon: 'week',
  calendar_view: 'week',
  week_starts_on: 'monday',
  focus_goal_hours: 2,
  focus_dim: true,
  catchup_prompt: true,
  /* Empty is a real state: an account with no recorded visit is not one with
     a week of unlogged days, it is one the prompt has never met. The first
     visit records the day and asks nothing. */
  catchup_seen_on: '',
  analytics_window: '1y',
  /* False is the first-run state, and it is what puts the question phase in
     front of the page. An account that already set a baseline is treated as
     having answered — see `firstRun` in pages/Analytics. */
  analytics_setup_done: false,
  analytics_home_tab: 'overview',
  analytics_log_style: 'both',
  analytics_tone: 'balanced',
  analytics_detail: 'standard',
  analytics_standing: true,
};

/** What the API gives an account that has never set one. */
export const DEFAULT_DAILY_GOAL = 100;

/** `startOfWeek` takes a day number; the preference is a word. */
export function weekStartDay(prefs: Pick<Prefs, 'week_starts_on'>): 0 | 1 {
  return prefs.week_starts_on === 'sunday' ? 0 : 1;
}

export function getSettings(): Promise<ApiResult<{ settings: Settings }>> {
  return get<{ settings: Settings }>('/api/settings');
}

export function saveSettings(
  edit: SettingsEdit,
): Promise<ApiResult<{ settings: Settings }>> {
  return post<{ settings: Settings }>('/api/settings', { ...edit });
}

/**
 * Removing something, on purpose.
 *
 * One endpoint and a scope rather than six endpoints, because they are one
 * decision — how much to take away — and the server declares the list (RESETS
 * in backend/api/settings.py). `confirm` is the account's own username typed
 * back, and the four scopes that need it are refused without it by the server
 * as well as by the dialog.
 */
export type ResetScope =
  | 'preferences'
  | 'completed'
  | 'tasks'
  | 'progress'
  | 'content'
  | 'account';

export interface ResetResult {
  message: string;
  /** What went, by table. Shown back so the reader can see it happened. */
  removed: Record<string, number>;
  /** The account's settings afterwards. Absent when the account itself went. */
  settings?: Settings;
  /** Set when the session was ended because the account no longer exists. */
  signed_out?: boolean;
}

export function resetData(
  scope: ResetScope,
  confirm?: string,
): Promise<ApiResult<ResetResult>> {
  return post<ResetResult>('/api/settings/reset', { scope, confirm });
}

/** Where the browser should be pointed to download an export. */
export function exportUrl(table: string, format: 'json' | 'csv'): string {
  const query = new URLSearchParams({ table, format });
  return `/api/settings/export?${query.toString()}`;
}
