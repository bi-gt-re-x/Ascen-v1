/**
 * The Trends tab — what is moving, and whether the movement is real.
 *
 * The fourth tab and the shortest, because it answers one question and should
 * not pretend to answer more. Habits says what happens, Insights says why,
 * Recommendations says what to change; this says *which way* — and the only
 * honest way to say that is to put a comparison and a slope side by side and
 * let them disagree when they disagree.
 *
 * Two panels carry the tab. The comparison is exact arithmetic over two equal
 * stretches. The direction is a line fitted through the whole window, printed
 * with how much of the variation it accounts for, because a slope quoted
 * without its fit is the single easiest way to announce a trend that is really
 * one good fortnight.
 */
import { AreaChart, Panel, Sparkline, asTone, toneVar } from './charts';
import {
  COMPARISONS,
  type ComparisonKey,
  type Direction,
  type TrendRow,
  type WeekPoint,
} from '@/utils/trends';
import { compact } from '@/utils/growthSummary';

const HEADING_MARK: Record<Direction['heading'], string> = {
  rising: '↑',
  falling: '↓',
  flat: '→',
};

// --------------------------------------------------------------------------
// The comparison
// --------------------------------------------------------------------------
export interface ComparePanelProps {
  rows: TrendRow[];
  chosen: ComparisonKey;
  onChoose: (key: ComparisonKey) => void;
  /** How many days into an unfinished calendar period the reader is. */
  partial: number | null;
}

/**
 * One stretch against the equivalent one before it, metric by metric.
 *
 * A calendar comparison is nearly always cut short — Wednesday's "this week" is
 * three days against seven — and the honest options are to pad, to hide, or to
 * say so. It says so: the note names how far into the period the reader is, and
 * `trendRows` returns a null delta rather than a percentage that would read as
 * a collapse. The rolling comparison has no such problem and is the one to
 * reach for when the question is "am I improving".
 */
export function ComparePanel({ rows, chosen, onChoose, partial }: ComparePanelProps) {
  const option = COMPARISONS.find((entry) => entry.key === chosen) ?? COMPARISONS[0]!;

  return (
    <Panel
      title="Now against then"
      note={
        partial
          ? `${option.nowLabel} is only ${partial} ${partial === 1 ? 'day' : 'days'} old, so the two stretches are not the same length and no percentage is shown.`
          : `${option.nowLabel} against ${option.wasLabel.toLowerCase()}, day for day.`
      }
      aside={
        <div className="ax-chips ax-chips-sm" role="group" aria-label="Comparison">
          {COMPARISONS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              className={`ax-chip${entry.key === chosen ? ' is-on' : ''}`}
              aria-pressed={entry.key === chosen}
              onClick={() => onChoose(entry.key)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      }
    >
      <ul className="ax-compare-rows">
        {rows.map((row) => (
          <li key={row.key}>
            <span className="ax-dot" style={{ background: toneVar(row.tone) }} />
            <span className="ax-compare-label">{row.label}</span>
            <span className="ax-compare-spark">
              {row.series.length > 1 && <Sparkline values={row.series} tone={asTone(row.tone)} />}
            </span>
            <span className="ax-compare-now">{row.nowText}</span>
            {row.delta === null ? (
              <span className="ax-delta ax-delta-none">not comparable</span>
            ) : (
              <span
                className={`ax-delta ax-delta-${row.delta > 0 ? 'up' : row.delta < 0 ? 'down' : 'flat'}`}
              >
                {row.delta > 0 ? '↑' : row.delta < 0 ? '↓' : '→'} {Math.abs(row.delta)}%
              </span>
            )}
            <span className="ax-compare-was">
              {row.delta === null ? '—' : `was ${row.wasText}`}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// --------------------------------------------------------------------------
// Direction
// --------------------------------------------------------------------------
/**
 * The slope of each metric across the whole window, with its fit printed.
 *
 * The fit bar is the part that matters and the part a chart like this usually
 * leaves out. Two metrics can climb at identical rates with one running through
 * a tight band and the other through a cloud, and only the second number tells
 * a reader which of those they are looking at.
 */
export function DirectionPanel({
  directions,
  verdict,
}: {
  directions: Direction[];
  verdict: string;
}) {
  return (
    <Panel
      title="Which way each measure is heading"
      note="Fitted line, with how much it explains"
    >
      {directions.length === 0 ? (
        <p className="ax-empty">{verdict}</p>
      ) : (
        <>
          <ul className="ax-directions">
            {directions.map((entry) => (
              <li key={entry.key}>
                <header>
                  <span className="ax-dot" style={{ background: toneVar(entry.tone) }} />
                  <strong>{entry.label}</strong>
                  <span className={`ax-delta ax-delta-${entry.heading === 'rising' ? 'up' : entry.heading === 'falling' ? 'down' : 'flat'}`}>
                    {HEADING_MARK[entry.heading]}{' '}
                    {entry.percent === null ? '—' : `${Math.abs(entry.percent)}% / week`}
                  </span>
                </header>
                <div className="ax-fit" title={`Fit: ${Math.round(entry.fit * 100)}% of variation explained`}>
                  <i style={{ width: `${Math.round(entry.fit * 100)}%`, background: toneVar(entry.tone) }} />
                  <span className="ax-muted ax-small">{Math.round(entry.fit * 100)}% fit</span>
                </div>
                <p className="ax-prose ax-prose-tight">{entry.text}</p>
              </li>
            ))}
          </ul>
          <p className="ax-prose ax-prose-lead">{verdict}</p>
        </>
      )}
    </Panel>
  );
}

// --------------------------------------------------------------------------
// The shape of it
// --------------------------------------------------------------------------
export interface TrendChartProps {
  weeks: WeekPoint[];
  metricKey: string;
  metricLabel: string;
  tone: string;
  options: Array<{ key: string; label: string }>;
  onMetric: (key: string) => void;
}

/**
 * One metric, week by week, over the whole window.
 *
 * Weeks rather than days: a daily line on an account that works five days in
 * seven is mostly a picture of the weekend, and the trend underneath it is
 * invisible. Partial weeks at either end are dropped by `weeklyPoints` for the
 * same reason — a three-day week drawn at full width is a cliff at each end of
 * every chart on the tab.
 */
export function TrendChart({
  weeks,
  metricKey,
  metricLabel,
  tone,
  options,
  onMetric,
}: TrendChartProps) {
  const values = weeks.map((week) => week.values[metricKey] ?? 0);
  const peak = Math.max(...values, 1);
  const ticks: string[] = [];
  for (let step = 4; step >= 0; step--) ticks.push(compact((peak / 4) * step));

  const marks = weeks.length
    ? [0, 0.25, 0.5, 0.75, 1].map((ratio) => weeks[Math.round(ratio * (weeks.length - 1))]?.label ?? '')
    : [];

  return (
    <Panel
      title="The shape of the window"
      note={`${metricLabel}, one point a week across ${weeks.length} whole weeks.`}
      aside={
        <div className="ax-chips ax-chips-sm" role="group" aria-label="Metric">
          {options.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`ax-chip${option.key === metricKey ? ' is-on' : ''}`}
              aria-pressed={option.key === metricKey}
              onClick={() => onMetric(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      }
    >
      {weeks.length < 3 ? (
        /* The chart's own height, so the panel is the same panel whether or
           not the window has three weeks in it. See `.ax-empty-chart`. */
        <p className="ax-empty ax-empty-chart">
          Three whole weeks is the floor for a line worth drawing. Widen the window, or come back
          once the account has a month of history in it.
        </p>
      ) : (
        <AreaChart
          id={`ax-trend-${metricKey}`}
          height={220}
          series={[{ values, tone: asTone(tone) }]}
          ticks={ticks}
          marks={marks}
        />
      )}
    </Panel>
  );
}

// --------------------------------------------------------------------------
// The tiles
// --------------------------------------------------------------------------
export function TrendTiles({ rows, label }: { rows: TrendRow[]; label: string }) {
  return (
    <div className="ax-tiles ax-tiles-five">
      {rows.map((row) => (
        <article className="ax-tile" key={row.key}>
          <header>
            <span className="ax-tile-dot" style={{ background: toneVar(row.tone) }} aria-hidden="true" />
            <span className="ax-tile-label">{row.label}</span>
          </header>
          <strong className="ax-tile-value">{row.nowText}</strong>
          {row.delta === null ? (
            <span className="ax-delta ax-delta-none">no baseline</span>
          ) : (
            <span className={`ax-delta ax-delta-${row.delta > 0 ? 'up' : row.delta < 0 ? 'down' : 'flat'}`}>
              {row.delta > 0 ? '↑' : row.delta < 0 ? '↓' : '→'} {Math.abs(row.delta)}% vs {label}
            </span>
          )}
          {row.series.length > 1 && <Sparkline values={row.series} tone={asTone(row.tone)} />}
        </article>
      ))}
    </div>
  );
}
