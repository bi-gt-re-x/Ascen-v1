/**
 * The account's stats and tasks, read once for the whole app.
 *
 * ## Why this moved out of the hook
 *
 * `useUserData` used to be a hook that fetched. Every caller of it therefore
 * had its own copy of the state and its own request, and the callers are not
 * rare: the dashboard, the top bar and the rail all mount together on the
 * first paint, so arriving at `/dashboard` asked the server for the same
 * `/api/get_user_data` response three times. That response is the largest one
 * the app has — every task and every stat the account owns — so this was three
 * copies of megabytes, decoded three times, to render one screen.
 *
 * Nothing in it is per-caller. It is the account, and the account is the same
 * for everyone reading it, which makes it a provider — the same argument
 * SettingsProvider makes next door, with more bytes riding on it.
 *
 * ## What callers see
 *
 * The same object as before, `useApi`'s, so no call site changed. Two things
 * are better than they were:
 *
 *   * **`mutate` moves the whole app.** It used to write to one caller's
 *     private copy, so completing a task on the dashboard left the top bar
 *     showing the XP from before until something re-fetched. One state means
 *     one answer, everywhere, immediately.
 *   * **`reload` is one request.** The Refresh button used to re-ask per
 *     mounted caller.
 *
 * Signed out nothing is fetched: the call resolves to the same
 * `success: false` envelope it always did, which surfaces as `error` and lets
 * a page say "sign in" rather than spin.
 *
 * The read has a side effect worth knowing about — the backend decays a streak
 * that went stale overnight while answering — so doing it once rather than
 * three times is also one less way for the pages to disagree about it.
 */
import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { UserDataContext } from './contexts';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { tasks } from '@/services';

export function UserDataProvider({ children }: { children: ReactNode }) {
  const { username } = useAuth();

  const call = useCallback(
    () =>
      username
        ? tasks.getUserData()
        : Promise.resolve({
            success: false as const,
            message: 'Sign in to see your dashboard.',
          }),
    [username],
  );

  const { data, error, loading, refreshing, reload, mutate } = useApi(call, [username]);

  // Spread into a memo rather than passed straight through: `useApi` returns a
  // fresh object every render, and this provider sits above the entire app, so
  // an unmemoised value would re-render every consumer on every render of
  // anything above it.
  const value = useMemo(
    () => ({ data, error, loading, refreshing, reload, mutate, username }),
    [data, error, loading, refreshing, reload, mutate, username],
  );

  return <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>;
}
