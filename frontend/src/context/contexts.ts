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
