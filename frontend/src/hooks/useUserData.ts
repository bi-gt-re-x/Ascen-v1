/**
 * The account's stats and tasks — for the pages whose subject is the tasks.
 *
 * A reader of <UserDataProvider>, not a fetch. It used to be a fetch, and that
 * meant one request per caller: the dashboard, the top bar and the rail mount
 * together, so the first paint asked for the app's largest response three
 * times. The state lives above them now — see context/UserDataProvider for the
 * whole argument — and this returns exactly the object it always did, so every
 * call site reads the same.
 *
 * ## Calling this is what makes the app fetch the task list
 *
 * The list is megabytes. The provider does not read it until something asks,
 * and this is the asking: mounting a component that calls `useUserData` is
 * what turns the request on, for the rest of the session.
 *
 * So do not reach for it to get a `username` or to call `reload` — `useAuth`
 * has the name, and `useStats` has a `reload` that costs six integers. Use
 * this when the thing being rendered is the tasks.
 *
 * What the provider carries is still `useApi`'s shape. `mutate` puts the
 * change a page just made onto the screen without a round trip, and `reload`
 * is what the Refresh button does; the difference is that both now move every
 * page at once rather than one caller's private copy.
 */
import { useContext, useEffect } from 'react';
import { UserDataContext } from '@/context/contexts';
import type { UserDataValue } from '@/context/contexts';

/** The account's stats and tasks. Must be inside <UserDataProvider>. */
export function useUserData(): UserDataValue {
  const value = useContext(UserDataContext);
  if (!value) {
    throw new Error('useUserData must be used inside <UserDataProvider>');
  }

  // In an effect rather than in the render, because it sets state on the
  // provider and a render must not. One render with `loading` true is the
  // cost, and every caller already has a loading state — they all had one when
  // this was a fetch.
  const { want } = value;
  useEffect(() => want(), [want]);

  return value;
}
