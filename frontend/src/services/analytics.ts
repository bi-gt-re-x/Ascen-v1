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

export function standing(): Promise<ApiResult<Standing>> {
  return get<Standing>('/api/standing');
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
  metric = 'overall',
): Promise<ApiResult<MetricHistory>> {
  return get<MetricHistory>('/api/metric_history', { metric });
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

export function baseline(): Promise<ApiResult<BaselineResult>> {
  return get<BaselineResult>('/api/baseline');
}

export function setBaseline(
  values: Pick<Baseline, 'active_days' | 'session_minutes' | 'focus_subject'>,
): Promise<ApiResult<BaselineResult>> {
  return post<BaselineResult>('/api/baseline', { ...values });
}

/** Every graded metric's readings, keyed by metric name. */
export interface MetricHistories {
  series: Record<string, MetricPoint[]>;
}

/**
 * All five metrics' histories in one call.
 *
 * `metricHistory` above answers about one metric and is what the score panel
 * reads. This is for the follow-up on Recommendations, which needs whichever
 * metric the reader happened to adopt a recommendation about.
 */
export function metricHistories(): Promise<ApiResult<MetricHistories>> {
  return get<MetricHistories>('/api/metric_histories');
}

/**
 * A recommendation the reader said they would act on, and when.
 *
 * Two fields and a date is the whole record. The "did it work" comparison that
 * hangs off it is recomputed from the day series every time — see
 * utils/followup for why nothing is snapshotted here.
 */
export interface AdoptedAdvice {
  id: string;
  /** What the rule was called on the day it was adopted. */
  title: string;
  /** ISO date. */
  on: string;
}

export interface AdoptedResult {
  /** Oldest first, as the backend returns them. */
  adopted: AdoptedAdvice[];
}

export function adoptedAdvice(): Promise<ApiResult<AdoptedResult>> {
  return get<AdoptedResult>('/api/adopted_advice');
}

/** Records the decision. Re-adopting keeps the original date. */
export function adoptAdvice(
  id: string,
  title: string,
): Promise<ApiResult<AdoptedResult>> {
  return post<AdoptedResult>('/api/adopt_advice', { id, title });
}

/** Forgets the decision. Any task it created is left alone. */
export function dropAdvice(id: string): Promise<ApiResult<AdoptedResult>> {
  return post<AdoptedResult>('/api/drop_advice', { id });
}

// --------------------------------------------------------------------------
// Periods — the Growth tab's whole data source
// --------------------------------------------------------------------------
/**
 * The windows the Growth tab offers. Mirrors `PERIODS` in
 * backend/tracking/analytics.py, which is where the day counts live.
 */
export type PeriodKey = '7d' | '30d' | '90d' | '180d' | '365d' | 'all';

/** The five graded measures, in the order the tab lists them. */
export const PERIOD_METRICS = [
  'productivity',
  'quality',
  'consistency',
  'efficiency',
  'focus',
] as const;

export type PeriodMetric = (typeof PERIOD_METRICS)[number];

/** Every metric's 0-100 score for one window. */
export type MetricScores = Record<PeriodMetric, number>;

/** One window, scored, with the measured figures the scores came from. */
export interface PeriodSide {
  /** The mean of the five, 0-100. */
  overall: number;
  grade: string;
  parts: MetricScores;
  grades: Record<PeriodMetric, string>;
  /** The quantities behind each score, in their own units. Shapes vary. */
  figures: Record<PeriodMetric, Record<string, unknown>>;
  /** Only on `previous`: which days it covered. */
  start?: string;
  end?: string;
}

/** A point on the growth line — the five metrics over the days behind it. */
export interface PeriodPoint extends MetricScores {
  date: string;
  overall: number;
}

/** One card in the "growth by period" row. */
export interface PeriodCard {
  key: PeriodKey;
  label: string;
  days: number;
  overall: number;
  /** The equivalent stretch before it, or null when there was not one. */
  previous: number | null;
  /** Percentage movement against that, or null. */
  change: number | null;
  /** True when the account is younger than the window the label names. */
  partial: boolean;
}

export interface GrowthPeriods {
  period: PeriodKey;
  label: string;
  start: string;
  end: string;
  days: number;
  /** How many days each point on the line was scored over. */
  trend_window: number;
  current: PeriodSide;
  /** Null when the account has no equal stretch before this one. */
  previous: PeriodSide | null;
  /** Percentage movement per metric, and overall. Null where there is no base. */
  change: { overall: number | null } & Record<PeriodMetric, number | null>;
  series: PeriodPoint[];
  periods: PeriodCard[];
}

/**
 * The five metrics over a period, the period before it, and a line.
 *
 * The one call the Growth tab makes, and the page's one deliberate exception to
 * "a tab costs no request" — see the endpoint in backend/api/analytics.py for
 * why this cannot be arithmetic in the browser like everything else here. In
 * short: focus needs each day's goal, which the growth series does not send,
 * and mirroring the five formulas in TypeScript would create the second scoring
 * implementation this codebase has one rule against.
 */
export function growthPeriods(period: PeriodKey = '30d'): Promise<ApiResult<GrowthPeriods>> {
  return get<GrowthPeriods>('/api/growth_periods', { period });
}
