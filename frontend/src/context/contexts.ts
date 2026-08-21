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
import type { Theme } from '@/types';
import type { Prefs } from '@/services/settings';

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
  /** False until the account's own answer has replaced the defaults. */
  ready: boolean;
  /** Write some preferences. Applied locally first, then persisted. */
  update: (values: Partial<Prefs>) => Promise<string | null>;
  /** Re-read from the server. */
  refresh: () => Promise<void>;
}

export const SettingsContext = createContext<SettingsValue | null>(null);
