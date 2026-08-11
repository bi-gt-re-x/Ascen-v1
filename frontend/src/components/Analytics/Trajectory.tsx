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
  bucketed,
  metricOption,
  type Grain,
  type MetricKey,
  type SeriesPoint,
} from './data';
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

/** Month names along the bottom, thinned to what fits. */
function axisMarks(points: SeriesPoint[], want = 8): string[] {
  if (points.length === 0) return [];
  const stride = Math.max(1, Math.round(points.length / want));
  return points
    .filter((_, index) => index % stride === 0)
    .map((point) =>
      new Date(`${point.date}T00:00:00`).toLocaleDateString('en-US', {
        month: 'short',
        year: '2-digit',
      }),
    );
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
        marks={axisMarks(now)}
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
  series: number[];
  marks: string[];
  percentile: number;
}

export function ScorePanel({ score, series, marks, percentile }: ScorePanelProps) {
  return (
    <Panel
      title="Growth Score Over Time"
      sample
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
        <div className="ax-percentile">
          <span className="ax-percentile-icon" aria-hidden="true" />
          <strong>Top {percentile}%</strong>
          <span>of Ascen users</span>
        </div>
      </div>

      <AreaChart
        id="ax-score"
        height={150}
        series={[{ values: series, tone: 'violet' }]}
        ticks={['10', '8', '6', '4', '2', '0']}
        marks={marks}
      />

      <p className="ax-panel-note ax-panel-note-foot">
        Growth Score is based on consistency, productivity, focus, and long-term progress.
      </p>
    </Panel>
  );
}
