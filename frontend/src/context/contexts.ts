/**
 * The context objects themselves, and what they carry.
 *
 * Separate from the providers on purpose. React Fast Refresh only preserves
 * state in a module that exports *nothing but components* — a file exporting a
 * provider alongside its `createContext` call or its `use…` hook falls back to
 * a full page reload on every edit, which is exactly the thing Fast Refresh
 * exists to avoid.
 *
 * So the split is: contexts here, providers in the `*.tsx` files beside this
 * one, hooks in `src/hooks/`. Nothing else about them changes.
 */
import { createContext } from 'react';
import type { Theme, UserStats } from '@/types';
import type { UseApiResult } from '@/hooks/useApi';
import type { Prefs } from '@/services/settings';
import type { UserData } from '@/services/tasks';

// --------------------------------------------------------------------------
// Theme
// --------------------------------------------------------------------------
export interface ThemeValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

export const ThemeContext = createContext<ThemeValue | null>(null);

// --------------------------------------------------------------------------
// Accounts
// --------------------------------------------------------------------------
export type AuthStatus = 'loading' | 'signed-in' | 'signed-out';

export interface AuthValue {
  status: AuthStatus;
  username: string | null;
  /** False while an account exists but has not finished Complete Profile. */
  profileComplete: boolean;
  /** The account's profile picture, as a path under /static. */
  avatar: string;
  /** Resolves to null on success, or the message to show. */
  signIn: (identifier: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  /** Re-ask the server. Call after a flow that changes the session elsewhere. */
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthValue | null>(null);

// --------------------------------------------------------------------------
// Preferences
// --------------------------------------------------------------------------
/**
 * What the account has chosen, available to every page.
 *
 * Read once near the root rather than per page, because the preferences are
 * read in many more places than they are written: the tasks composer wants
 * the default XP, the calendar redirect wants the default view, analytics
 * wants the window to open on. A page fetching them itself would be a request
 * per page and a flash of the wrong default on each one.
 */
export interface SettingsValue {
  prefs: Prefs;
  /**
   * The daily XP goal.
   *
   * Beside `prefs` rather than in it because it is stored on the user row and
   * not in the key/value table — a historical split the API explains. It is
   * carried here anyway because it comes back in the same response the
   * preferences do, and the dashboard needs it: read on its own it would be a
   * second request for one number.
   */
  dailyGoal: number;
  /**
   * What the account calls itself, or '' when it has never said.
   *
   * Here for the same reason `dailyGoal` is: it lives on the user row, it
   * arrives in the same response, and the page that shows it — the dashboard's
   * greeting — would otherwise have to ask for it separately.
   */
  displayName: string;
  /** False until the account's own answer has replaced the defaults. */
  ready: boolean;
  /** Write some preferences. Applied locally first, then persisted. */
  update: (values: Partial<Prefs>) => Promise<string | null>;
  /** Re-read from the server. */
  refresh: () => Promise<void>;
}

export const SettingsContext = createContext<SettingsValue | null>(null);

// --------------------------------------------------------------------------
// The account's stats and tasks
// --------------------------------------------------------------------------
/**
 * One `/api/get_user_data` read, shared by everything that wants it.
 *
 * This is the app's biggest response and it was being asked for once per
 * caller: the dashboard, the top bar and the rail all mount together and all
 * called `useUserData`, so landing on a page fetched the same several
 * megabytes three times over. Nothing about the data is per-caller — it is the
 * account — so the read belongs above them all, exactly like the preferences
 * next door.
 *
 * The shape is `useApi`'s, unchanged, because that is what every call site
 * already destructures. What changes is who owns the state: `mutate` now moves
 * every reader at once, so a task completed on the dashboard updates the XP in
 * the top bar without a second request, and `reload` is one request rather
 * than one per mounted caller.
 */
export interface UserDataValue extends UseApiResult<UserData> {
  /** Who the data belongs to, or null when signed out. */
  username: string | null;
  /**
   * Register that something on screen wants the task list.
   *
   * Called by `useUserData` on mount and by nothing else. The provider does
   * not fetch until this has happened at least once, which is what stops the
   * pages that never read a task from paying for one. See UserDataProvider.
   */
  want: () => void;
}

export const UserDataContext = createContext<UserDataValue | null>(null);

// --------------------------------------------------------------------------
// The account's numbers
// --------------------------------------------------------------------------
/**
 * Level, XP, task count and the two streaks — read on every page, by itself.
 *
 * These six integers used to arrive bolted to the account's entire task list,
 * because one endpoint returned both. The rail shows the level, the top bar
 * shows the XP, and both mount on every screen behind the login, so every
 * screen paid megabytes for six numbers. `/api/stats` is those numbers alone.
 *
 * **This is the only stats state in the app.** `UserDataProvider` still reads
 * `/api/get_user_data` for the pages whose subject is the task list, and that
 * response still carries a stats block — but the provider hands it here rather
 * than keeping a second copy. Two copies would be two answers, and the whole
 * reason the account read moved above the components was that the top bar and
 * the dashboard must never disagree about the XP.
 */
export interface StatsValue {
  /** The numbers, or null before the first answer. */
  stats: UserStats | null;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  /** Re-ask the server. Also re-decays the streak. */
  reload: () => void;
  /** Write the numbers a completion response just reported. */
  mutate: (update: (current: UserStats) => UserStats) => void;
  /** Who they belong to, or null when signed out. */
  username: string | null;
}

export const StatsContext = createContext<StatsValue | null>(null);
