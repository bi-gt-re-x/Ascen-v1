/**
 * The small charts — the ones that are not the canvas.
 *
 * The page's main chart is a canvas renderer (utils/growthChart) because it is
 * interactive: it hit-tests the pointer, draws a crosshair and a tooltip, and
 * repaints on every move. Nothing here does any of that. These are three
 * static shapes — a sparkline under a tile, the trend curve in the summary
 * panel, the four running totals along the bottom — and a static shape is an
 * SVG. It scales with its box for free, it takes its colours from CSS so both
 * themes are a stylesheet problem rather than a `chartColors()` branch, and it
 * needs no ref, no resize listener and no device-pixel-ratio arithmetic.
 *
 * **Text is not in the SVG.** Every one of these stretches to fill a panel
 * whose height the grid decides, which means `preserveAspectRatio="none"` —
 * and that would squash any glyph inside it. So the drawing is lines and the
 * labels are HTML positioned over them, which also lets them inherit the
 * page's font. `vector-effect="non-scaling-stroke"` is the other half of the
 * same deal: it keeps a 2px line 2px wide however far the box is stretched.
 *
 * None of them compute anything. utils/growthSummary works out the numbers and
 * these turn them into coordinates — the same split the rest of the page
 * follows, so no panel can quote a figure the page did not give it.
 */
import type { GrowthTrend, LongTermProgress } from '@/utils/growthSummary';
import { compact } from '@/utils/growthSummary';

/** The box every one of these draws into. Arbitrary; only ratios survive. */
const W = 100;
const H = 100;

/**
 * `values` as an SVG path, scaled to fill the box.
 *
 * The floor is zero rather than the smallest value, deliberately: a run of
 * 380, 390, 400 rescaled to its own range is a dramatic climb, and it is a
 * flat week. `top` overrides the ceiling so several lines can share one.
 */
function pathOf(values: number[], top?: number): string {
  if (values.length === 0) return '';
  const ceiling = Math.max(1e-6, top ?? Math.max(...values));
  const step = values.length > 1 ? W / (values.length - 1) : 0;
  return values
    .map((value, index) => {
      const x = values.length > 1 ? index * step : W / 2;
      const y = H - Math.min(1, Math.max(0, value / ceiling)) * H;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

// --------------------------------------------------------------------------
// Sparkline
// --------------------------------------------------------------------------
export interface SparklineProps {
  values: number[];
  /** Which of the tile colours it is drawn in — see styles/growth.css. */
  tone: string;
}

/**
 * A tile's own days, under the figure they add up to.
 *
 * No axis, no scale, no numbers: the tile already states the total, and this
 * says whether it arrived steadily or all at once. Below two points there is
 * no shape to show and it draws nothing rather than a misleading flat line.
 */
export function Sparkline({ values, tone }: SparklineProps) {
  if (values.length < 2) return null;
  const line = pathOf(values);

  return (
    <svg
      className={`gr-spark tone-${tone}`}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path className="gr-spark-fill" d={`${line} L${W} ${H} L0 ${H} Z`} />
      <path className="gr-spark-line" d={line} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// --------------------------------------------------------------------------
// Growth trend
// --------------------------------------------------------------------------
export interface TrendChartProps {
  trend: GrowthTrend;
}

/**
 * The pace curve in the summary panel.
 *
 * Both lines run 0% to 100% — the share of the range banked by each day — so
 * the axis is fixed and the only thing that moves is the path. A straight
 * diagonal is an even fortnight; a curve that hugs the floor and then leaps is
 * a month where nothing happened until the last week. See `growthTrend`.
 */
export function TrendChart({ trend }: TrendChartProps) {
  if (trend.lines.length === 0) return null;
  const top = trend.ticks[trend.ticks.length - 1] || 100;

  return (
    <div className="gr-trend-plot">
      <div className="gr-trend-ticks" aria-hidden="true">
        {[...trend.ticks].reverse().map((tick) => (
          <span key={tick}>{tick}%</span>
        ))}
      </div>

      <div className="gr-trend-box">
        <svg
          className="gr-trend-svg"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Share of the range's XP and tasks banked over time, ${trend.lines.length} lines.`}
        >
          {trend.ticks.map((tick) => (
            <line
              key={tick}
              className="gr-trend-grid"
              x1="0"
              x2={W}
              y1={H - (tick / top) * H}
              y2={H - (tick / top) * H}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {trend.lines.map((line) => (
            <path
              key={line.key}
              className={`gr-trend-line tone-${line.key}`}
              d={pathOf(line.points, top)}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>

        <div className="gr-trend-marks" aria-hidden="true">
          {trend.marks.map((mark) => (
            <span
              key={`${mark.label}-${mark.at}`}
              style={{ left: `${mark.at * 100}%` }}
            >
              {mark.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Long term progress
// --------------------------------------------------------------------------
export interface LongTermChartProps {
  data: LongTermProgress;
}

/**
 * Four running totals over months.
 *
 * The four share one box and only XP owns the axis — see `longTermProgress`
 * for why, and for why every line carries its own total in the legend instead.
 * The dots are per bucket and are the reason the panel reads as monthly rather
 * than as four smooth curves over an unmarked span.
 */
export function LongTermChart({ data }: LongTermChartProps) {
  if (data.lines.length === 0 || data.labels.length === 0) return null;
  const top = data.ticks[data.ticks.length - 1] || 1;
  const count = data.labels.length;
  const step = count > 1 ? W / (count - 1) : 0;

  // A label every nth bucket, so a five-year account does not stack sixty of
  // them into a grey bar. Six across is about what the panel has room for.
  const every = Math.max(1, Math.ceil(count / 6));

  return (
    <div className="gr-lt-plot">
      <div className="gr-lt-ticks" aria-hidden="true">
        {[...data.ticks].reverse().map((tick) => (
          <span key={tick}>{compact(tick)}</span>
        ))}
      </div>

      <div className="gr-lt-box">
        <svg
          className="gr-lt-svg"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Long term progress: ${data.lines
            .map((line) => `${line.label} ${line.total}`)
            .join(', ')}.`}
        >
          {data.ticks.map((tick) => (
            <line
              key={tick}
              className="gr-lt-grid"
              x1="0"
              x2={W}
              y1={H - (tick / top) * H}
              y2={H - (tick / top) * H}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {data.lines.map((line) => (
            <path
              key={line.key}
              className={`gr-lt-line tone-${line.key}`}
              d={pathOf(line.points, top)}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>

        {/* Dots are their own layer so they can stay round: the svg above is
            stretched, and a <circle> inside it would come out an ellipse. */}
        <div className="gr-lt-dots" aria-hidden="true">
          {data.lines.map((line) =>
            line.points.map((value, index) => (
              <i
                key={`${line.key}-${index}`}
                className={`gr-lt-dot tone-${line.key}`}
                style={{
                  left: `${(count > 1 ? index * step : W / 2)}%`,
                  bottom: `${Math.min(100, Math.max(0, (value / top) * 100))}%`,
                }}
              />
            )),
          )}
        </div>

        <div className="gr-lt-marks" aria-hidden="true">
          {data.labels.map((label, index) =>
            index % every === 0 || index === count - 1 ? (
              <span
                key={`${label}-${index}`}
                style={{ left: `${count > 1 ? index * step : 50}%` }}
              >
                {label}
              </span>
            ) : null,
          )}
        </div>
      </div>
    </div>
  );
}
