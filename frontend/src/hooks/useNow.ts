/**
 * The clock, re-read on an interval.
 *
 * The calendar's now line has to move without anything else changing, and it
 * only ever needs to be right to the minute — so this is a tick, not a
 * subscription to time. A hidden tab still ticks, which is fine: the line is
 * re-placed from the clock rather than advanced by a step, so a tab that was
 * asleep catches up in one render rather than drifting.
 */
import { useEffect, useState } from 'react';

export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
