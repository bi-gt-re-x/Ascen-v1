/**
 * Growth: the day-by-day series, the report card, and the XP ledger rolled up.
 *
 * Not in the original services list because the growth page had no service of
 * its own — it called the endpoints directly. It has one now for the same
 * reason the others do: the shapes are fiddly and worth naming once.
 *
 * `ratings()` is not a pure read. Asking for the report card files a dated
 * snapshot per metric into the database, which is how the grades build up a
 * history — so it is worth calling when a page opens and not on a timer.
 *
 * Backend: backend/api/growth.py, backend/tracking/analytics.py.
 */
import { get } from './api';
import type { ApiResult, GrowthDay, Ratings } from '@/types';

export interface GrowthSeries {
  created_date: string;
  days_since_creation: number;
  /** The last 30 days, one row per day including days with nothing on them. */
  growth_data: GrowthDay[];
}

export function series(username: string): Promise<ApiResult<GrowthSeries>> {
  return get<GrowthSeries>('/api/get_growth_data', { username });
}

/** The five-metric graded report card. Files a snapshot as a side effect. */
export function ratings(username: string): Promise<ApiResult<Ratings>> {
  return get<Ratings>('/api/get_growth_ratings', { username });
}

export interface XpSnapshot {
  user: {
    username: string;
    created_date: string;
    days_active: number;
  };
  stats: {
    level: number;
    /** XP within the current level. */
    current_xp: number;
    total_xp: number;
    xp_required: number;
    tasks_completed: number;
  };
  /** Every day since the account was created, not just the last 30. */
  growth_data: Array<
    Pick<
      GrowthDay,
      'date' | 'day_number' | 'xp_earned' | 'tasks_completed' | 'cumulative_xp' | 'avg_task_xp'
    >
  >;
  summary: {
    total_days: number;
    total_xp: number;
    average_xp_per_day: number;
    most_productive_day: GrowthDay | null;
  };
}

export function xpSnapshot(username: string): Promise<ApiResult<XpSnapshot>> {
  return get<XpSnapshot>('/api/get_xp_data', { username });
}
