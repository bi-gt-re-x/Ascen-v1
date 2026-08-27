/**
 * Rendering a component with the app's providers around it.
 *
 * Real context objects filled with plain values, rather than mocked hooks.
 * Mocking `useAuth` and friends would mean the test passes when the component
 * reads a context that is no longer there — the exact failure the providers
 * throw on. Filling the real ones keeps that check alive and keeps the shape
 * of `AuthValue` honest: change a field and this stops compiling, which is
 * where a type wants to be caught.
 *
 * The router is a MemoryRouter, so a test can start on any path and `NavLink`
 * resolves its active state the same way it does in the app.
 */
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import { AuthContext, SettingsContext, UserDataContext } from '@/context/contexts';
import { DEFAULTS, DEFAULT_DAILY_GOAL } from '@/services/settings';
import { stats } from './factories';
import type { AuthValue, SettingsValue, UserDataValue } from '@/context/contexts';
import type { Prefs } from '@/services/settings';
import type { UserData } from '@/services/tasks';

/**
 * `prefs` is loosened to a partial: there are twenty-three preferences and a
 * test that cares about one of them should not have to restate the other
 * twenty-two. Everything else stays `Partial<…>` of the real context value, so
 * a field renamed in `contexts.ts` still breaks this file.
 */
export interface Options {
  /** Where the router starts. */
  route?: string;
  auth?: Partial<AuthValue>;
  settings?: Partial<Omit<SettingsValue, 'prefs'>> & { prefs?: Partial<Prefs> };
  userData?: Partial<UserDataValue>;
}

export function authValue(overrides: Partial<AuthValue> = {}): AuthValue {
  return {
    status: 'signed-in',
    username: 'myles',
    profileComplete: true,
    avatar: '/static/images/avatars/star.svg',
    signIn: vi.fn(async () => null),
    signOut: vi.fn(async () => {}),
    refresh: vi.fn(async () => {}),
    ...overrides,
  };
}

export function settingsValue(overrides: Options['settings'] = {}): SettingsValue {
  // `prefs` is pulled out and merged over the defaults rather than spread with
  // the rest, so passing one preference leaves the other twenty-two at theirs.
  const { prefs, ...rest } = overrides;
  return {
    dailyGoal: DEFAULT_DAILY_GOAL,
    displayName: 'Myles',
    ready: true,
    update: vi.fn(async () => null),
    refresh: vi.fn(async () => {}),
    ...rest,
    prefs: { ...DEFAULTS, ...prefs },
  };
}

export function userDataValue(overrides: Partial<UserDataValue> = {}): UserDataValue {
  const data: UserData = { stats: stats(), tasks: [] };
  return {
    data,
    error: null,
    loading: false,
    refreshing: false,
    reload: vi.fn(),
    mutate: vi.fn(),
    username: 'myles',
    ...overrides,
  };
}

export function renderWithProviders(ui: ReactElement, options: Options = {}) {
  const { route = '/dashboard', auth, settings, userData } = options;

  function Providers({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[route]}>
        <AuthContext.Provider value={authValue(auth)}>
          <SettingsContext.Provider value={settingsValue(settings)}>
            <UserDataContext.Provider value={userDataValue(userData)}>
              {children}
            </UserDataContext.Provider>
          </SettingsContext.Provider>
        </AuthContext.Provider>
      </MemoryRouter>
    );
  }

  return render(ui, { wrapper: Providers });
}
