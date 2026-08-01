/**
 * The account's stats and tasks — the call most pages start with.
 *
 * Wrapped rather than left to each page because reading it has a side effect
 * worth being deliberate about: the backend decays a streak that went stale
 * overnight while answering. So this is the call that makes every page agree
 * on the streak, and `reload()` after a completion is how the number moves.
 */
import { useCallback } from 'react';
import { useApi } from './useApi';
import { useAuth } from './useAuth';
import { tasks } from '@/services';
import type { UserData } from '@/services/tasks';
import type { UseApiResult } from './useApi';

export function useUserData(): UseApiResult<UserData> & { username: string | null } {
  const { username } = useAuth();

  const call = useCallback(
    () =>
      username
        ? tasks.getUserData(username)
        : Promise.resolve({
            success: false as const,
            message: 'Sign in to see your dashboard.',
          }),
    [username],
  );

  return { ...useApi(call, [username]), username };
}
