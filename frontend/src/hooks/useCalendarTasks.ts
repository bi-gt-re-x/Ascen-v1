/**
 * The tasks the calendar draws, and finishing one from it.
 *
 * All three views read the same call the dashboard does, so the streak, the
 * XP and the task list are the same numbers in both places — and completing a
 * task from a grid block goes through the same endpoint as ticking it off on
 * the dashboard, which is what awards the XP, stamps `completed_at`, extends
 * the streak and advances any "complete N tasks" goal. The calendar does not
 * do half of that itself.
 *
 * One in-flight guard per id, so a double click cannot award the XP twice.
 */
import { useCallback, useState } from 'react';
import { useUserData } from './useUserData';
import { tasks as taskService } from '@/services';
import type { Task, UserStats } from '@/types';

const NO_STATS: UserStats = {
  level: 1,
  xp: 0,
  tasks_completed: 0,
  current_streak: 0,
  best_streak: 0,
  charge: 0,
};

export interface UseCalendarTasks {
  tasks: Task[];
  stats: UserStats;
  username: string | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** The id being completed right now, so its block can say so. */
  completing: string | null;
  complete: (taskId: string) => void;
}

export function useCalendarTasks(): UseCalendarTasks {
  const { data, error, loading, reload, username } = useUserData();
  const [completing, setCompleting] = useState<string | null>(null);

  const complete = useCallback(
    (taskId: string) => {
      if (!username || completing) return;
      setCompleting(taskId);
      void taskService
        .completeTask(username, taskId)
        .then((result) => {
          // A failed completion leaves the task exactly as it was; re-reading
          // is what puts the view back in step either way.
          if (!result.success) {
            console.error(`Calendar: completing task ${taskId} failed`, result.message);
          }
          reload();
        })
        .catch((cause: unknown) => {
          console.error(`Calendar: completing task ${taskId} failed`, cause);
        })
        .finally(() => setCompleting(null));
    },
    [completing, reload, username],
  );

  return {
    tasks: data?.tasks ?? [],
    stats: data?.stats ?? NO_STATS,
    username,
    loading,
    error,
    reload,
    completing,
    complete,
  };
}
