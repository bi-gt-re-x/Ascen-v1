/**
 * The account's stats and tasks — the call most pages start with.
 *
 * A reader of <UserDataProvider>, not a fetch. It used to be a fetch, and that
 * meant one request per caller: the dashboard, the top bar and the rail mount
 * together, so the first paint asked for the app's largest response three
 * times. The state lives above them now — see context/UserDataProvider for the
 * whole argument — and this returns exactly the object it always did, so every
 * call site reads the same.
 *
 * What the provider carries is still `useApi`'s shape. `mutate` puts the
 * change a page just made onto the screen without a round trip, and `reload`
 * is what the Refresh button does; the difference is that both now move every
 * page at once rather than one caller's private copy.
 */
import { useContext } from 'react';
import { UserDataContext } from '@/context/contexts';
import type { UserDataValue } from '@/context/contexts';

/** The account's stats and tasks. Must be inside <UserDataProvider>. */
export function useUserData(): UserDataValue {
  const value = useContext(UserDataContext);
  if (!value) {
    throw new Error('useUserData must be used inside <UserDataProvider>');
  }
  return value;
}
