/**
 * The account's level, XP, task count and streaks.
 *
 * A reader of <StatsProvider>, not a fetch. Reach for this rather than
 * `useUserData` unless the thing being rendered is the task list itself:
 * `useUserData` pulls every task the account owns, and asking for it is what
 * makes the app pay for it.
 */
import { useContext } from 'react';
import { StatsContext } from '@/context/contexts';
import type { StatsValue } from '@/context/contexts';

/** The account's numbers. Must be inside <StatsProvider>. */
export function useStats(): StatsValue {
  const value = useContext(StatsContext);
  if (!value) {
    throw new Error('useStats must be used inside <StatsProvider>');
  }
  return value;
}
