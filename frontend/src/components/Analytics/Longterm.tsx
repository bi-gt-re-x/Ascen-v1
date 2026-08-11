/**
 * The bottom half: this period against the last, and where the pace leads.
 *
 * The comparison looks backwards and the projection forwards, from the same
 * daily average — so the panel that says "you did 46% more than last time" and
 * the one that says "this is 467K XP in five years" are two readings of one
 * number rather than two claims that could drift apart.
 */
import type { CSSProperties } from 'react';
import { AreaChart, GroupedBars, Panel, toneVar, type BarPair } from './charts';
import { GLYPHS, type GlyphName } from './glyphs';
import type { Compounding, ComparisonBar } from './data';
import { compact } from '@/utils/growthSummary';
import type { Insight } from '@/utils/growthSummary';

// --------------------------------------------------------------------------
// Yearly comparison
// --------------------------------------------------------------------------
export function ComparisonPanel({ bars }: { bars: ComparisonBar[] }) {
  const pairs: BarPair[] = bars.map((bar) => ({
    label: bar.label,
    current: bar.current,
    previous: bar.previous,
    currentText: bar.format(bar.current),
    previousText: bar.previous > 0 ? bar.format(bar.previous) : '—',
  }));

  return (
    <Panel
      title="Yearly Progress Comparison"
      footer={<span className="ax-link">View detailed yearly breakdown →</span>}
      aside={
        <div className="ax-legend ax-legend-tight">
          <span className="ax-legend-item">
            <i className="ax-swatch" style={{ background: toneVar('violet') }} />
            This Period
          </span>
          <span className="ax-legend-item">
            <i className="ax-swatch ax-swatch-was" />
            Previous Period
          </span>
        </div>
      }
    >
      <GroupedBars pairs={pairs} />
    </Panel>
  );
}

// --------------------------------------------------------------------------
// Compounding
// --------------------------------------------------------------------------
export function CompoundingPanel({ data }: { data: Compounding }) {
  const marks = data.projected
    .filter((_, index) => index % 4 === 0)
    .map((point) =>
      new Date(`${point.date}T00:00:00`).toLocaleDateString('en-US', {
        month: 'short',
        year: '2-digit',
      }),
    );

  // The two lines share one box and one scale: the projection continues the
  // actual rather than sitting beside it, so the join has to be seamless. The
  // actual series is padded out to the projection's length with the value it
  // ended on, which draws as a flat tail under the climbing forecast.
  const actualValues = data.actual.map((point) => point.value);
  const padded = [
    ...actualValues,
    ...Array(Math.max(0, data.projected.length - 1)).fill(
      actualValues[actualValues.length - 1] ?? 0,
    ),
  ];
  const projectedValues = [
    ...Array(Math.max(0, actualValues.length - 1)).fill(NaN),
    ...data.projected.map((point) => point.value),
  ].map((value) => (Number.isNaN(value) ? (actualValues[0] ?? 0) : value));

  const peak = Math.max(...projectedValues, ...padded, 1);
  const ticks: string[] = [];
  for (let step = 4; step >= 0; step--) ticks.push(compact((peak / 4) * step));

  return (
    <Panel
      title="Compounding Growth"
      note="See how small daily actions turn into massive long-term results."
      footer={<span className="ax-link">How projections work →</span>}
    >
      <div className="ax-figures">
        <div className="ax-figure">
          <span className="ax-muted">Daily Average XP</span>
          <strong>{data.dailyAverage.toLocaleString()}</strong>
          <span className="ax-muted ax-small">Consistent small effort</span>
        </div>
        <div className="ax-figure">
          <span className="ax-muted">Projected 1 Year</span>
          <strong>{data.projectedYear.toLocaleString()}</strong>
          <span className="ax-muted ax-small">If you continue this pace</span>
        </div>
        <div className="ax-figure">
          <span className="ax-muted">Projected 5 Years</span>
          <strong>{data.projectedFiveYear.toLocaleString()}</strong>
          <span className="ax-muted ax-small">Long-term compounding</span>
        </div>
      </div>

      <div className="ax-compound">
        <AreaChart
          id="ax-compound"
          height={170}
          series={[
            { values: projectedValues, tone: 'violet', dashed: true },
            { values: padded, tone: 'violet' },
          ]}
          ticks={ticks}
          marks={marks}
        />
        <aside className="ax-callout">
          <span className="ax-muted ax-small">You&rsquo;re on track to earn</span>
          <strong>{compact(data.projectedFiveYear)} XP</strong>
          <span className="ax-muted ax-small">in 5 years</span>
        </aside>
      </div>

      <div className="ax-legend">
        <span className="ax-legend-item">
          <i className="ax-legend-line" style={{ background: toneVar('violet') }} />
          Actual XP
        </span>
        <span className="ax-legend-item">
          <i className="ax-legend-line ax-legend-dashed" />
          Projected XP (at current pace)
        </span>
      </div>
    </Panel>
  );
}

// --------------------------------------------------------------------------
// Streaks
// --------------------------------------------------------------------------
export interface StreaksPanelProps {
  current: number;
  best: number;
  bestMonth: { label: string; rate: number } | null;
}

export function StreaksPanel({ current, best, bestMonth }: StreaksPanelProps) {
  return (
    <Panel title="Longest Streaks" footer={<span className="ax-link">View streak history →</span>}>
      <div className="ax-streaks">
        <div className="ax-streak">
          <span className="ax-streak-icon" aria-hidden="true">
            🔥
          </span>
          <span className="ax-muted">Current Streak</span>
          <strong>{current} days</strong>
        </div>
        <div className="ax-streak">
          <span className="ax-streak-icon" aria-hidden="true">
            🏆
          </span>
          <span className="ax-muted">Longest Streak</span>
          <strong>{best} days</strong>
        </div>
      </div>
      {bestMonth && (
        <div className="ax-best-month">
          <span className="ax-muted">Most Consistent Month</span>
          <strong>{bestMonth.label}</strong>
          <span className="ax-muted ax-small">{bestMonth.rate}% consistency</span>
        </div>
      )}
    </Panel>
  );
}

// --------------------------------------------------------------------------
// Insights
// --------------------------------------------------------------------------
/** One drawing per tone — a finding, something to watch, and a plain note. */
const INSIGHT_GLYPH: Record<Insight['tone'], GlyphName> = {
  good: 'trend',
  watch: 'target',
  note: 'clock',
};

export function InsightsPanel({ insights }: { insights: Insight[] }) {
  return (
    <Panel title="Key Growth Insights" footer={<span className="ax-link">View all insights →</span>}>
      {insights.length === 0 ? (
        <p className="ax-empty">Not enough history in this window to find a pattern yet.</p>
      ) : (
        <ul className="ax-insights">
          {insights.map((insight) => (
            <li key={insight.headline} className={`ax-insight ax-insight-${insight.tone}`}>
              <span
                className="ax-insight-icon"
                style={{ '--ico': GLYPHS[INSIGHT_GLYPH[insight.tone]] } as CSSProperties}
                aria-hidden="true"
              />
              <div>
                <strong>{insight.headline}</strong>
                <span className="ax-muted">{insight.hint}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// --------------------------------------------------------------------------
// Where you stand
// --------------------------------------------------------------------------
export interface StandingPanelProps {
  rows: Array<{ label: string; percentile: number; tone: string }>;
}

/**
 * Percentile bars — the one panel on this page with no account behind it.
 *
 * Nothing on the backend aggregates across users, so these figures are
 * placeholders and the panel says so with the Sample chip rather than quietly
 * passing them off as measurements. See SAMPLE in ./data.
 */
export function StandingPanel({ rows }: StandingPanelProps) {
  return (
    <Panel
      title="Where You Stand"
      note="Compared to Ascen users"
      sample
      footer={<span className="ax-link">View benchmark details →</span>}
    >
      <ul className="ax-standing">
        {rows.map((row) => (
          <li key={row.label}>
            <span className="ax-standing-label">{row.label}</span>
            <span className="ax-standing-track">
              <i
                style={{
                  width: `${100 - row.percentile}%`,
                  background: toneVar(row.tone),
                }}
              />
            </span>
            <span className="ax-standing-rank">Top {row.percentile}%</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
