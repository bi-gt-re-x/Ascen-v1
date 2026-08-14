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
import type { Standing, StandingKey } from '@/services/analytics';
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
/**
 * How far ahead the chart draws, in months. The figures still state five years.
 *
 * The projection runs sixty months and the three figures above the chart say
 * so, but drawing all sixty is what made this panel look broken: a window of
 * history against five years of forecast puts the real data in the bottom-left
 * sixth of the box and gives the rest to one straight diagonal, because a flat
 * XP-a-day multiplication *is* a straight diagonal. Twelve months is the
 * horizon where the two halves are comparable — the history keeps its shape,
 * the climb is still the point, and the five-year figure is a number to read
 * rather than a line to squint at.
 */
const CHART_MONTHS = 12;

export function CompoundingPanel({ data }: { data: Compounding }) {
  // One x axis, two series, each covering half of it — history to today, then
  // the forecast on from today. They meet at a single shared point: the last
  // actual bucket and the projection's first entry are both the account's
  // banked total, at the same index, so the forecast leaves the history
  // exactly where it ends.
  //
  // Where a series does not reach, it is `null` rather than a number. Both
  // halves used to be filled instead — the actual with a flat tail of its final
  // value, the projection with a flat *head* of the account's earliest one —
  // which drew a line sitting at the bottom of the chart for the whole of the
  // history and then leaping vertically at the join. That leap was the bug in
  // this panel, not a feature of the forecast.
  // `projected` is a point a quarter for sixty months; the chart draws the
  // first CHART_MONTHS of it. Sliced here rather than in `compounding` because
  // the three figures above still state the whole projection — the horizon is
  // a fact about this chart, not about the forecast.
  const ahead = data.projected.slice(0, Math.floor(CHART_MONTHS / 3) + 1);
  const actualValues = data.actual.map((point) => point.value);
  const forecast = ahead.map((point) => point.value);
  const gapBefore = Math.max(0, actualValues.length - 1);

  const actualSeries: Array<number | null> = [
    ...actualValues,
    ...Array<null>(Math.max(0, forecast.length - 1)).fill(null),
  ];
  const projectedSeries: Array<number | null> = [
    ...Array<null>(gapBefore).fill(null),
    ...forecast,
  ];
  // The same curve again, whole, with nothing left out — this is what the wash
  // under the chart is closed on. The two halves above are two lines because
  // they are drawn at different weights, and filling under each of them
  // separately is what put a vertical edge down the middle of the panel at
  // today: either a cliff to the axis, or once both halves were filled, a
  // hairline where the two areas met. One series, one path, no join. See `fill`
  // on AreaSeries.
  const wholeCurve: Array<number | null> = [...actualValues, ...forecast.slice(1)];

  // Points are placed by date rather than by index. The history is a point a
  // week and the forecast a point a quarter, so spacing them evenly handed
  // two thirds of the width to the first year of a six-year chart and made the
  // projection look like a hockey stick that the arithmetic behind it — a flat
  // XP-a-day multiplication — never produced.
  const dates = [
    ...data.actual.map((point) => point.date),
    ...ahead.slice(1).map((point) => point.date),
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
          // One wash across the whole span, then the two lines over it — the
          // lighter one marking which half is measured and which is arithmetic.
          series={[
            { values: wholeCurve, tone: 'violet', line: false, fill: true },
            { values: projectedSeries, tone: 'violet', muted: true, fill: false },
            { values: actualSeries, tone: 'violet', fill: false },
          ]}
          ticks={ticks}
          marks={marks}
          at={at}
        />
        {/* The callout annotates the line, so it states where the line
            actually ends. It used to carry the five-year figure over a chart
            that stopped somewhere else entirely — and that figure is already
            the third of the three above, where it can be read against the
            other two rather than floating over the drawing. */}
        <aside className="ax-callout">
          <span className="ax-muted ax-small">You&rsquo;re on track to earn</span>
          <strong>{compact(data.projectedYear)} XP</strong>
          <span className="ax-muted ax-small">in the next year</span>
        </aside>
      </div>

      <div className="ax-legend">
        <span className="ax-legend-item">
          <i className="ax-legend-line" style={{ background: toneVar('violet') }} />
          Actual XP
        </span>
        <span className="ax-legend-item">
          <i className="ax-legend-line ax-legend-muted" />
          Projected XP — next {CHART_MONTHS} months at this pace
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
  /** From `/api/standing`. Null while it is in flight or the call failed. */
  standing: Standing | null;
}

/**
 * Percentile bars — measured across accounts, not modelled.
 *
 * This was the one panel on the page with nothing behind it: nothing on the
 * backend aggregated across users, so the four bars were constants under a
 * Sample chip. backend/tracking/standing.py does that aggregation now, and each
 * bar is a plain rank — how many comparable accounts this one is ahead of on
 * that measure, ties split.
 *
 * **The cohort size is part of the figure, not a footnote.** "Top 25%" means
 * something different out of four hundred accounts than out of four, and a
 * panel that prints the first without the second is inviting the wrong reading
 * of a number that is otherwise perfectly honest. Under the backend's floor it
 * prints no percentages at all rather than ranking a reader against one or two
 * other people.
 */
export function StandingPanel({ standing }: StandingPanelProps) {
  if (!standing) {
    return (
      <Panel title="Where You Stand" footer={<span className="ax-link">View benchmark details →</span>}>
        <p className="ax-empty">Working out where you stand…</p>
      </Panel>
    );
  }

  if (!standing.enough) {
    return (
      <Panel
        title="Where You Stand"
        note={`Compared to ${standing.cohort.toLocaleString()} Ascen ${standing.cohort === 1 ? 'user' : 'users'}`}
        footer={<span className="ax-link">View benchmark details →</span>}
      >
        <p className="ax-empty">
          There are not enough accounts with a comparable record yet to place you against — this
          needs {standing.floor} others and there {standing.cohort - 1 === 1 ? 'is' : 'are'}{' '}
          {standing.cohort - 1}. A rank out of two or three is arithmetic rather than a comparison,
          and you would be reading it as one.
        </p>
      </Panel>
    );
  }

  return (
    <Panel
      title="Where You Stand"
      note={`Compared to ${standing.cohort.toLocaleString()} Ascen ${standing.cohort === 1 ? 'user' : 'users'} with a comparable record`}
      footer={<span className="ax-link">View benchmark details →</span>}
    >
      <ul className="ax-standing">
        {standing.rows.map((row) => {
          const measure = STANDING[row.key];
          if (!measure || row.percentile === null) return null;
          return (
            <li key={row.key}>
              <span className="ax-standing-label">{measure.label}</span>
              <span className="ax-standing-track">
                <i
                  style={{
                    width: `${100 - row.percentile}%`,
                    background: toneVar(measure.tone),
                  }}
                />
              </span>
              {/* Through the same formatter as the badge on the score panel, so
                  the two places this page states a percentile state it the same
                  way — one said "Top 17.7%" beside the other's "Top 18%". */}
              <span className="ax-standing-rank">Top {formatPercentile(row.percentile)}%</span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/** What each measure is called and painted, keyed by the backend's `MEASURES`. */
const STANDING: Record<StandingKey, { label: string; tone: string }> = {
  xp: { label: 'XP Earned', tone: 'violet' },
  focus: { label: 'Focus Time', tone: 'blue' },
  consistency: { label: 'Consistency', tone: 'green' },
  tasks: { label: 'Task Completion', tone: 'amber' },
  score: { label: 'Growth Score', tone: 'violet' },
};
