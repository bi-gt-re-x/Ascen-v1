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
import { axisSpan, datePositions } from './data';
import { formatPercentile } from './score';
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
      {/* The bars are a fixed height in a panel that is as tall as whatever
          sits beside it in the row, so on a wide screen the leftover space all
          fell below them and the chart hung off the top edge with a third of
          the panel empty underneath. The wrapper takes the slack and centres
          the bars in it. */}
      <div className="ax-bars-fill">
        <GroupedBars pairs={pairs} />
      </div>
    </Panel>
  );
}

// --------------------------------------------------------------------------
// Compounding
// --------------------------------------------------------------------------
export function CompoundingPanel({ data }: { data: Compounding }) {
  // One x axis, two series, each covering half of it — history to today, then
  // the forecast on from today. They meet at a single shared point: the last
  // actual bucket and the projection's first entry are both the account's
  // banked total, at the same index, so the dashed line leaves the solid one
  // exactly where it ends.
  //
  // Where a series does not reach, it is `null` rather than a number. Both
  // halves used to be filled instead — the actual with a flat tail of its final
  // value, the projection with a flat *head* of the account's earliest one —
  // which drew a line sitting at the bottom of the chart for the whole of the
  // history and then leaping vertically at the join. That leap was the bug in
  // this panel, not a feature of the forecast.
  const actualValues = data.actual.map((point) => point.value);
  const forecast = data.projected.map((point) => point.value);
  const gapBefore = Math.max(0, actualValues.length - 1);

  const actualSeries: Array<number | null> = [
    ...actualValues,
    ...Array<null>(Math.max(0, forecast.length - 1)).fill(null),
  ];
  const projectedSeries: Array<number | null> = [
    ...Array<null>(gapBefore).fill(null),
    ...forecast,
  ];

  // Points are placed by date rather than by index. The history is a point a
  // week and the forecast a point a quarter, so spacing them evenly handed
  // two thirds of the width to the first year of a six-year chart and made the
  // projection look like a hockey stick that the arithmetic behind it — a flat
  // XP-a-day multiplication — never produced.
  const dates = [
    ...data.actual.map((point) => point.date),
    ...data.projected.slice(1).map((point) => point.date),
  ];
  const at = datePositions(dates);
  const marks = axisSpan(dates[0] ?? '', dates[dates.length - 1] ?? '', 6);

  const peak = Math.max(...forecast, ...actualValues, 1);
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
            { values: projectedSeries, tone: 'violet', dashed: true },
            { values: actualSeries, tone: 'violet' },
          ]}
          ticks={ticks}
          marks={marks}
          at={at}
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

/**
 * The findings, most important first.
 *
 * `limit` is how many of them a panel has room to mean. `growthInsights` emits
 * in priority order — the patterns and the movement first, then the single
 * facts (best day, longest run, task and focus totals) that are true but are
 * not findings — so the top of the list is the important end of it and taking
 * the first four is taking the four that matter. The overview does exactly
 * that; the Insights tab, whose whole job is the long read, takes them all.
 */
export function InsightsPanel({ insights, limit }: { insights: Insight[]; limit?: number }) {
  const shown = limit ? insights.slice(0, limit) : insights;

  return (
    <Panel title="Key Growth Insights" footer={<span className="ax-link">View all insights →</span>}>
      {shown.length === 0 ? (
        <p className="ax-empty">Not enough history in this window to find a pattern yet.</p>
      ) : (
        <ul className="ax-insights">
          {shown.map((insight) => (
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
            {/* Through the same formatter as the badge on the score panel, so
                the two places this page states a percentile state it the same
                way — one said "Top 17.7%" beside the other's "Top 18%". */}
            <span className="ax-standing-rank">Top {formatPercentile(row.percentile)}%</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
