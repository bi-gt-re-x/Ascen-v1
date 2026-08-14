/**
 * Analytics: the one figure on the page that needs more than one account.
 *
 * Everything else the analytics page draws is computed on the client from the
 * growth series — see `@/components/Analytics/data`. This is the exception, and
 * necessarily so: "where you stand against other Ascen users" cannot be derived
 * from the reader's own record, and the other accounts' records are not
 * something the client should ever hold.
 *
 * Backend: backend/api/analytics.py, backend/tracking/standing.py.
 */
import { get } from './api';
import type { ApiResult } from '@/types';

/** The measures, in the order the panel lists them. Matches MEASURES server-side. */
export type StandingKey = 'xp' | 'focus' | 'consistency' | 'tasks' | 'score';

export interface StandingRow {
  key: StandingKey;
  /** This account's own figure — XP, minutes, a percentage, a count, a score. */
  value: number;
  /** "Top N%", so lower is better. `null` when the cohort was too small. */
  percentile: number | null;
}

export interface Standing {
  /** The reader plus everyone they were measured against. */
  cohort: number;
  /** False when there were too few comparable accounts to place against. */
  enough: boolean;
  /** The number of *other* accounts the backend wanted before placing. */
  floor: number;
  rows: StandingRow[];
}

export function standing(username: string): Promise<ApiResult<Standing>> {
  return get<Standing>('/api/standing', { username });
}
