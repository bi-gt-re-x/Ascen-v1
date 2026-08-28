/**
 * The account's six numbers, read once for the whole app.
 *
 * ## Why this exists
 *
 * `UserDataProvider` next door already fixed the *three requests per page*
 * problem: the dashboard, the top bar and the rail share one read instead of
 * making three. What it could not fix is what that one read costs. It calls
 * `/api/get_user_data`, which returns the stats block *and every task the
 * account has ever created* — 2.9 MB of JSON for the largest account in this
 * database (9,547 tasks), on every page load.
 *
 * Most of what is on screen does not want the tasks. The rail shows a level.
 * The top bar shows XP and a bell — and used to filter the whole list to count
 * three things a `COUNT(*)` answers. Settings and achievements held the read
 * for a username. Those first two mount on every screen behind the login, so
 * every screen paid for a task list in order to render six integers.
 *
 * The pages that really do want the list are the ones whose subject it is:
 * dashboard, tasks, calendar, goals, records, and analytics — which reads
 * individual task rows for its subject breakdown. They still get it.
 *
 * So the read is split by what the caller actually reads, and this is the
 * cheap half: `/api/stats`, six integers, about 200 bytes.
 *
 * ## This is the only stats state
 *
 * `UserDataProvider` still reads `/api/get_user_data` for the pages whose
 * subject *is* the task list, and that response still carries a stats block.
 * It hands that block here rather than keeping its own copy, and its `mutate`
 * writes the stats half here too — it nests inside this provider precisely so
 * that it can.
 *
 * That matters more than the bytes. The argument for moving the account read
 * above the components in the first place was that completing a task on the
 * dashboard used to leave the top bar showing the XP from before. Two stats
 * states would put that bug straight back — the dashboard would update its
 * copy and the bar would keep showing the other one. One state, one answer.
 *
 * ## It also owns the streak decay
 *
 * Reading the account decays a streak that went stale overnight, and exactly
 * one endpoint may do that (see backend/api/dashboard.py). It is this one,
 * because this is the read every page makes: the rail mounts outside the
 * router and never unmounts, so `/api/stats` is fetched once per session at
 * the moment `/api/get_user_data` used to be. The decay did not move in time,
 * only in which endpoint carries it.
 */
import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { StatsContext } from './contexts';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { tasks } from '@/services';
import type { UserStats } from '@/types';

export function StatsProvider({ children }: { children: ReactNode }) {
  const { username } = useAuth();

  const call = useCallback(
    () =>
      username
        ? tasks.getStats()
        : Promise.resolve({
            success: false as const,
            message: 'Sign in to see your dashboard.',
          }),
    [username],
  );

  const { data, error, loading, refreshing, reload, mutate } = useApi(call, [username]);

  // `useApi` holds the whole `{ stats }` envelope; callers here want the block
  // inside it. Unwrapped in one place rather than at every `data?.stats`.
  const write = useCallback(
    (update: (current: UserStats) => UserStats) => {
      mutate((current) => ({ ...current, stats: update(current.stats) }));
    },
    [mutate],
  );

  // Spread into a memo rather than passed straight through: `useApi` returns a
  // fresh object every render, and this provider sits above the entire app, so
  // an unmemoised value would re-render every consumer on every render of
  // anything above it. Same argument UserDataProvider makes next door.
  const value = useMemo(
    () => ({
      stats: data?.stats ?? null,
      error,
      loading,
      refreshing,
      reload,
      mutate: write,
      username,
    }),
    [data, error, loading, refreshing, reload, write, username],
  );

  return <StatsContext.Provider value={value}>{children}</StatsContext.Provider>;
}
