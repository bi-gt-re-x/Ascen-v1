/**
 * The Growth Score: what it is made of, and where it sits among other accounts.
 *
 * ## The score is the report card, restated
 *
 * There is no separate growth-score computation anywhere in this app and there
 * must not be one. `backend/tracking/analytics.py` scores five metrics 0-100 —
 * productivity, quality, consistency, efficiency, focus — and takes their mean
 * for `overall`. This file divides that mean by ten and shows the five parts it
 * came from, which is the whole of the arithmetic:
 *
 *     score = mean(productivity, quality, consistency, efficiency, focus) / 10
 *
 * Recomputing the mean here rather than reading `overall.score` is deliberate:
 * a panel that prints five factors and a total the reader cannot add up is a
 * panel nobody trusts. Adding them up locally means the total is the parts by
 * construction. `assertsOverall` exists so the two can be checked against each
 * other in a test if the backend's weighting ever stops being a flat mean.
 *
 * The five are equally weighted because the backend weights them equally. If a
 * weighting lands there, `WEIGHT` is the one line here that changes.
 *
 * ## The percentile is a model, and says so
 *
 * Nothing on the backend aggregates across accounts, so "top 8% of Ascen users"
 * cannot be measured — it is *placed*, against a stated distribution of what
 * growth scores look like, and `percentileFor` is that placement. The
 * distribution is normal, centred on 5/10, with a spread chosen so that the two
 * ends of the 0-10 scale land on the two ends of the reportable range: a score
 * of 0 is top 99.9% and a perfect 10 is top 0.1%. Every score in between gets
 * its own band rather than one of five hardcoded tiers.
 *
 * This replaced a fixed "Top 12%" that was the same for every account and every
 * score, which is the one thing worse than a modelled figure: an unmodelled one.
 */
import type { MetricName, Ratings } from '@/types';

/** The score is stated out of ten; the report card is scored out of a hundred. */
export const SCORE_SCALE = 10;

/**
 * How much of the score each metric is worth, as a share of 1.
 *
 * A flat fifth each, mirroring `sum(parts.values()) / len(parts)` in
 * backend/tracking/analytics.py. Written as a table anyway so the panel can
 * print the share, and so a change to the backend's weighting has an obvious
 * home rather than being spread through the component that draws it.
 */
export const WEIGHT = 1 / 5;

export interface ScoreFactor {
  name: MetricName;
  label: string;
  /** The backend's 0-100 score for this metric. */
  score: number;
  /** What it contributes to the score out of ten — `score * WEIGHT / 10`. */
  contribution: number;
  /** The measured quantity behind the score, in its own units. */
  raw: string;
}

export interface GrowthScore {
  /** Out of ten, or null while the report card has not answered. */
  value: number | null;
  factors: ScoreFactor[];
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * The score and its five parts, read off the report card.
 *
 * The raw column is the same one the growth page's table prints (see
 * ./metrics), stated in the units the metric is actually measured in, because
 * "Focus 34" tells a reader nothing they can act on and "2h 10m of a 6h goal"
 * tells them everything.
 */
export function growthScore(ratings: Ratings | null): GrowthScore {
  if (!ratings) return { value: null, factors: [] };
  const m = ratings.metrics;

  const measured: Array<Omit<ScoreFactor, 'contribution'>> = [
    {
      name: 'productivity',
      label: 'Productivity',
      score: m.productivity.score,
      raw: `${Math.round(m.productivity.avg_daily_xp).toLocaleString()} XP/day`,
    },
    {
      name: 'quality',
      label: 'Quality',
      score: m.quality.score,
      // Difficulty × execution, or the XP proxy while nothing is rated. Same
      // rule as ./metrics: the basis is printed, never assumed.
      raw:
        m.quality.basis === 'ratings'
          ? `${m.quality.avg_quality.toFixed(1)}/${m.quality.max_quality} rated`
          : 'no ratings yet',
    },
    {
      name: 'consistency',
      label: 'Consistency',
      score: m.consistency.score,
      raw: `${m.consistency.active_days}/${m.consistency.total_days} days active`,
    },
    {
      name: 'efficiency',
      label: 'Efficiency',
      score: m.efficiency.score,
      raw: m.efficiency.has_timing
        ? `${m.efficiency.on_time_pct}% on time`
        : 'no timed tasks yet',
    },
    {
      name: 'focus',
      label: 'Focus',
      score: m.focus.score,
      raw: `${m.focus.pct_of_goal}% of focus goal`,
    },
  ];

  const factors: ScoreFactor[] = measured.map((factor) => ({
    ...factor,
    contribution: (factor.score * WEIGHT) / SCORE_SCALE,
  }));

  const total = factors.reduce((sum, factor) => sum + factor.contribution, 0);
  return { value: round1(total), factors };
}

/**
 * Whether the parts still add up to the backend's own total.
 *
 * Exported for tests and for the panel to fall back on rather than argue with
 * the server: if the backend ever stops taking a flat mean, this goes false and
 * the fix is `WEIGHT`, not a fudge in the component.
 */
export function agreesWithOverall(ratings: Ratings | null): boolean {
  if (!ratings) return true;
  const local = growthScore(ratings).value ?? 0;
  return Math.abs(local - ratings.overall.score / SCORE_SCALE) < 0.05;
}

// --------------------------------------------------------------------------
// Where the score sits
// --------------------------------------------------------------------------
/** The middle of the modelled distribution — a score of 5.0 is top 50%. */
const MEAN = 5;

/**
 * The spread, in points of the ten-point scale.
 *
 * 3.09 standard deviations is the 99.9th percentile of a normal, so putting
 * that many between the centre and each end of the scale is what makes 0 read
 * "top 99.9%" and 10 read "top 0.1%" — the full reportable range, exactly
 * spanned, with no clamping doing the work at either end.
 */
const SPREAD = MEAN / 3.09;

/** Φ(z), by Abramowitz & Stegun 26.2.17 — good to about 7.5e-8. */
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const density = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const tail =
    density *
    t *
    (0.31938153 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z > 0 ? 1 - tail : tail;
}

/**
 * The share of accounts a score is at or above, as "top N%".
 *
 * Continuous, so a score of 6.4 and a score of 6.6 are different bands rather
 * than both landing in a tier. Bounded to [0.1, 99.9]: claiming "top 0%" would
 * be claiming the reader is beyond every possible account, and "top 100%" is
 * not a compliment anybody has ever wanted to read.
 */
export function percentileFor(score: number): number {
  const share = (1 - normalCdf((score - MEAN) / SPREAD)) * 100;
  return Math.min(99.9, Math.max(0.1, round1(share)));
}

/**
 * "8", "0.4", "99.9" — the figure as it is printed after the word "Top".
 *
 * A decimal at both ends and a whole number through the middle: the difference
 * between top 3.2% and top 3.8% is worth a reader's attention and the
 * difference between top 47% and top 48% is not. Both tails keep their decimal
 * because rounding them is how "top 99.9%" becomes the impossible "top 100%".
 */
export function formatPercentile(percentile: number): string {
  const value = Math.min(99.9, Math.max(0.1, percentile));
  return value < 10 || value > 99 ? value.toFixed(1) : String(Math.round(value));
}

/** "Top 8% of Ascen users" — the badge's whole line, in one place. */
export function percentileLabel(score: number | null): string | null {
  if (score === null) return null;
  return `Top ${formatPercentile(percentileFor(score))}%`;
}
