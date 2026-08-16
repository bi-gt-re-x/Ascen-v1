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
import { get, post } from './api';
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

/** One dated reading of a graded metric. Scores are out of 100. */
export interface MetricPoint {
  date: string;
  score: number;
  grade: string;
}

export interface MetricHistory {
  metric: string;
  /** Oldest first. */
  points: MetricPoint[];
}

/**
 * Past grades for one metric.
 *
 * The snapshots have been accumulating since the report card existed — reading
 * `/api/get_growth_ratings` files a dated row per metric — and nothing read
 * them back until now. The page drew its "score over time" line from a
 * generated shape with the real score pinned on the end.
 */
export function metricHistory(
  username: string,
  metric = 'overall',
): Promise<ApiResult<MetricHistory>> {
  return get<MetricHistory>('/api/metric_history', { username, metric });
}

/**
 * What the account said it was aiming at.
 *
 * The one thing on the analytics page that is stated rather than measured, and
 * the only reason a brand-new account has anything to do there. Everything else
 * the page draws needs a fortnight to three weeks of record first.
 */
export interface Baseline {
  /** Days a week they mean to work, 1-7. */
  active_days: number;
  /** What they consider a normal sitting, in minutes. */
  session_minutes: number;
  /** The subject id this is mostly for, or '' for no one subject. */
  focus_subject: string;
  /** The day it was set, ISO. What makes a stale baseline legible as stale. */
  set_on: string;
}

/** `baseline: null` means this account has never set one — a real answer. */
export interface BaselineResult {
  baseline: Baseline | null;
}

export function baseline(username: string): Promise<ApiResult<BaselineResult>> {
  return get<BaselineResult>('/api/baseline', { username });
}

export function setBaseline(
  username: string,
  values: Pick<Baseline, 'active_days' | 'session_minutes' | 'focus_subject'>,
): Promise<ApiResult<BaselineResult>> {
  return post<BaselineResult>('/api/baseline', { username, ...values });
}
