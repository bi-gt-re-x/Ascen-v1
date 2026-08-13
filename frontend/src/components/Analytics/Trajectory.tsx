/**
 * The big chart, and the score panel beside it.
 *
 * Two panels rather than one because they answer different questions with
 * different confidence: the trajectory is the account's own arithmetic and can
 * be trusted to the point, while the score panel's *shape* is generated (see
 * SAMPLE in ./data) and only its final figure is real. Keeping them apart is
 * what lets one carry a Sample chip and the other not.
 */
import { AreaChart, Delta, Panel, toneVar } from './charts';
import {
  METRICS,
  GRAINS,
  axisMarks,
  bucketed,
  metricOption,
  type Grain,
  type MetricKey,
} from './data';
import { percentileLabel, type ScoreFactor } from './score';
import { compact } from '@/utils/growthSummary';
import type { GrowthDay } from '@/types';

// --------------------------------------------------------------------------
// Trajectory
// --------------------------------------------------------------------------
export interface TrajectoryProps {
  current: GrowthDay[];
  previous: GrowthDay[];
  metric: MetricKey;
  onMetric: (key: MetricKey) => void;
  grain: Grain;
  onGrain: (grain: Grain) => void;
  /** "Jul 3, 2024 – Jul 3, 2026", for the legend under the chart. */
  spanLabel: string;
  previousSpanLabel: string;
}

/** Five evenly-spaced labels down the axis, largest first. */
function axisTicks(max: number, format: (value: number) => string): string[] {
  const out: string[] = [];
  for (let step = 5; step >= 0; step--) out.push(format((max / 5) * step));
  return out;
}

export function Trajectory({
  current,
  previous,
  metric,
  onMetric,
  grain,
  onGrain,
  spanLabel,
  previousSpanLabel,
}: TrajectoryProps) {
  const option = metricOption(metric);
  const now = bucketed(current, option, grain);
  const before = bucketed(previous, option, grain);
  const peak = Math.max(...now.map((p) => p.value), ...before.map((p) => p.value), 1);

  return (
    <Panel
      title="Growth Trajectory Over Time"
      aside={
        <label className="ax-select-wrap">
          <span className="ax-sr">Chart grain</span>
          <select
            className="ax-select"
            value={grain}
            onChange={(event) => onGrain(event.target.value as Grain)}
          >
            {GRAINS.map((entry) => (
              <option key={entry.key} value={entry.key}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
      }
    >
      <div className="ax-chips ax-chips-inline" role="tablist" aria-label="Chart series">
        {METRICS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            role="tab"
            aria-selected={entry.key === metric}
            className={`ax-chip${entry.key === metric ? ' is-on' : ''}`}
            onClick={() => onMetric(entry.key)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <AreaChart
        id="ax-traj"
        height={220}
        series={[
          { values: now.map((point) => point.value), tone: 'violet' },
          ...(before.length > 1
            ? [{ values: before.map((point) => point.value), tone: 'violet' as const, dashed: true }]
            : []),
        ]}
        ticks={axisTicks(peak, (value) =>
          option.key === 'quality' ? value.toFixed(1) : compact(value),
        )}
        marks={axisMarks(now.map((point) => point.date), 8)}
      />

      <div className="ax-legend">
        <span className="ax-legend-item">
          <i className="ax-legend-line" style={{ background: toneVar('violet') }} />
          This Period ({spanLabel})
        </span>
        {before.length > 1 && (
          <span className="ax-legend-item">
            <i className="ax-legend-line ax-legend-dashed" />
            Previous Period ({previousSpanLabel})
          </span>
        )}
      </div>
    </Panel>
  );
}

// --------------------------------------------------------------------------
// Growth score
// --------------------------------------------------------------------------
export interface ScorePanelProps {
  score: number | null;
  /** The five metrics the score is the mean of. See ./score. */
  factors: ScoreFactor[];
  series: number[];
  marks: string[];
}

/**
 * The score, the five parts it is made of, and where it places.
 *
 * The parts are on the panel rather than behind the "how it's calculated" link
 * because a single figure out of ten is not actionable: 6.5 says nothing about
 * *which* of the five is holding it there, and the reader's next question is
 * always which one to go and work on. Printed with the measured quantity beside
 * each — "22/30 days active", not "Consistency 73" — since the score is the
 * abstraction and the measurement is the thing they can change.
 *
 * The band under the score is computed from the score itself (`percentileFor`),
 * so it moves when the score does. It is a placement against a stated
 * distribution rather than a count of other people's accounts, and the panel
 * says exactly that under the badge rather than leaving "Top 8%" to be read as
 * a headcount.
 */
export function ScorePanel({ score, factors, series, marks }: ScorePanelProps) {
  const band = percentileLabel(score);

  return (
    <Panel
      title="Growth Score Over Time"
      sample
      sampleNote="Only the line's shape is a placeholder — no endpoint reads the score's history back yet. The score, its five factors and the band are your own."
      footer={<span className="ax-link">How it&rsquo;s calculated →</span>}
    >
      <div className="ax-score-head">
        <div>
          <strong className="ax-score-value">
            {score === null ? '—' : score.toFixed(1)}
            <em className="ax-tile-unit">/10</em>
          </strong>
          <p className="ax-muted">Your current growth score</p>
          <Delta value={null} suffix="" />
        </div>
        {band && (
          <div
            className="ax-percentile"
            title="Where this score sits in the modelled distribution of Ascen growth scores — 5.0 is the middle, and the scale runs from top 99.9% to top 0.1%."
          >
            <span className="ax-percentile-icon" aria-hidden="true" />
            <strong>{band}</strong>
            <span>of Ascen users</span>
          </div>
        )}
      </div>

      {factors.length > 0 && (
        <ul className="ax-factors">
          {factors.map((factor) => (
            <li className="ax-factor" key={factor.name}>
              <span className="ax-factor-label">{factor.label}</span>
              <span className="ax-factor-track">
                <i style={{ width: `${Math.max(0, Math.min(100, factor.score))}%` }} />
              </span>
              <span className="ax-factor-raw">{factor.raw}</span>
              <span className="ax-factor-score">
                +{factor.contribution.toFixed(1)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <AreaChart
        id="ax-score"
        height={130}
        series={[{ values: series, tone: 'violet' }]}
        ticks={['10', '8', '6', '4', '2', '0']}
        marks={marks}
      />

      <p className="ax-panel-note ax-panel-note-foot">
        The mean of the five report-card metrics — productivity, quality, consistency, efficiency
        and focus — each worth up to 2.0 of the ten.
      </p>
    </Panel>
  );
}
