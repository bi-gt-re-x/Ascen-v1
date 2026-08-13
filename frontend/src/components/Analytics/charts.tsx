/**
 * The page's drawing kit — small SVG pieces, no library.
 *
 * SVG rather than the canvas renderer the growth page uses (utils/growthChart),
 * and the reason is theming: every colour here is a CSS custom property read by
 * the cascade, so the light and dark palettes are two blocks of CSS and a chart
 * repaints itself on a theme change with no listener, no MutationObserver and
 * no repaint on the JS side at all. The canvas renderer has to watch
 * `data-theme` and redraw by hand — worth it for a chart with wheel-zoom and a
 * hover crosshair, and pure cost for fourteen static panels.
 *
 * Every component here takes a `viewBox` and no width or height: the CSS sizes
 * the box and `preserveAspectRatio` does the rest, so a panel that changes
 * width at a breakpoint needs no JS to stay drawn correctly.
 */
import type { CSSProperties, ReactNode } from 'react';

/** The series colours, as the CSS variable each panel paints with. */
export type Tone = 'violet' | 'blue' | 'green' | 'amber' | 'pink';

export const TONES: Tone[] = ['violet', 'blue', 'green', 'amber', 'pink'];

export function toneVar(tone: string): string {
  return `var(--ax-${tone})`;
}

/**
 * A tone name from somewhere that does not know about `Tone`, made safe.
 *
 * The behavioural modules under utils/ carry a tone on every finding, and they
 * deliberately do not import from a component file to get the type — the
 * arithmetic has no business knowing what draws it. This is the one boundary
 * where the loose string becomes the narrow one.
 */
export function asTone(name: string): Tone {
  return (TONES as string[]).includes(name) ? (name as Tone) : 'violet';
}

/**
 * One point of a series, or `null` for "this series is not drawn here".
 *
 * A gap is not a zero. The compounding chart is two series over one x axis
 * where each covers half of it — history to today, forecast from today — and
 * filling the other half with a number puts a line on the chart claiming
 * something was measured, or projected, when it was not. Nulls hold the
 * position without drawing it, which is what lets the forecast begin exactly
 * where the history ends instead of running flat beneath it and then leaping.
 */
export type AreaValue = number | null;

interface Drawn {
  /** The path, `M`-restarted across every gap. */
  d: string;
  /** Where the drawn part begins and ends, for closing an area under it. */
  fromX: number;
  toX: number;
}

/**
 * Turns values into an SVG path, scaled into the box. `null` when too few.
 *
 * `at` is where each point sits across the width, 0 to 1. Without it the
 * points are spaced evenly, which is right when the x axis is *positions* —
 * the trajectory chart draws two equal-length periods over each other so that
 * the same distance into each lands at the same x, and dates would pull them
 * apart. It is wrong when the x axis is time: the compounding chart carries a
 * year of weekly history and five years of quarterly forecast, and spacing
 * those evenly gives sixty per cent of the width to the first sixth of the
 * span and bends the forecast upward for no reason but the spacing.
 */
function linePath(
  values: AreaValue[],
  width: number,
  height: number,
  min: number,
  max: number,
  pad = 0,
  at?: number[],
): Drawn | null {
  if (values.length < 2) return null;
  const span = max - min || 1;
  const inner = height - pad * 2;
  const steps = values.length - 1;

  const parts: string[] = [];
  let fromX: number | null = null;
  let toX = 0;
  let drawn = 0;
  // `open` tracks whether the previous point was drawn: the first point after a
  // gap has to start a new subpath rather than draw a line across it.
  let open = false;

  values.forEach((value, index) => {
    if (value === null || Number.isNaN(value)) {
      open = false;
      return;
    }
    const x = (at?.[index] ?? index / steps) * width;
    const y = pad + inner - ((value - min) / span) * inner;
    parts.push(`${open ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`);
    if (fromX === null) fromX = x;
    toX = x;
    drawn += 1;
    open = true;
  });

  if (drawn < 2 || fromX === null) return null;
  return { d: parts.join(' '), fromX, toX };
}

// --------------------------------------------------------------------------
// Sparkline — the line under a KPI tile
// --------------------------------------------------------------------------
export interface SparklineProps {
  values: number[];
  tone: Tone;
}

/**
 * A tile's own days, with no axis and no scale.
 *
 * The tile states one figure for the whole window, which cannot tell a period
 * that climbed steadily from one that did everything in its last fortnight.
 * This is the shape of the arriving, and it is deliberately unlabelled — a
 * sparkline that invites a reading off its y-axis has stopped being one.
 */
export function Sparkline({ values, tone }: SparklineProps) {
  const width = 100;
  const height = 26;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const drawn = linePath(values, width, height, min, max, 2);
  if (!drawn) return <svg className="ax-spark" viewBox={`0 0 ${width} ${height}`} />;
  const path = drawn.d;

  return (
    <svg
      className="ax-spark"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        className="ax-spark-area"
        d={`${path} L${width},${height} L0,${height} Z`}
        fill={toneVar(tone)}
        opacity="0.12"
      />
      {/* `pathLength={1}` normalises the line's length to 1 whatever its shape,
          which is what lets one CSS rule draw every line on the page with
          `stroke-dasharray: 1` and no measuring in JS. See `ax-draw` in
          styles/analytics.css. */}
      <path
        className="ax-spark-line"
        d={path}
        pathLength={1}
        fill="none"
        stroke={toneVar(tone)}
        strokeWidth="1.4"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// --------------------------------------------------------------------------
// AreaChart — the trajectory, and the compounding curve
// --------------------------------------------------------------------------
export interface AreaSeries {
  /** `null` anywhere this series does not reach. See `AreaValue`. */
  values: AreaValue[];
  tone: Tone;
  /**
   * The second line — the period being compared against, or the forecast.
   *
   * Drawn solid like the first, in the same colour, at a lighter weight. It
   * used to be dashed, and a dash is the wrong tool at these sizes: sixty
   * points across six hundred units makes a five-unit dash about the length of
   * one segment, so a line that changes direction often came out as a scatter
   * of ticks rather than a line, and one that climbs steeply came out solid
   * anyway. Weight separates the two everywhere; the pattern only did so on
   * the flat parts.
   */
  muted?: boolean;
}

export interface AreaChartProps {
  series: AreaSeries[];
  /**
   * Where each index sits across the width, 0 to 1, when even spacing would
   * misplace it. One array for every series — they share an x axis, which is
   * the only reason they can be read against each other at all.
   */
  at?: number[];
  /** Printed up the left edge, top value first. */
  ticks: string[];
  /** Printed along the bottom, evenly spaced. */
  marks: string[];
  /** A unique prefix for this chart's gradient ids. Two charts on one page
   *  sharing an id is how one of them ends up unfilled. */
  id: string;
  height?: number;
}

/**
 * Two lines over one box, the second one dashed.
 *
 * Both series are scaled to the same extent — that is the entire point of
 * drawing them together, and scaling each to its own peak would make every
 * period look identical to the one before it. The second series is drawn first
 * so the headline one wins where they cross.
 */
export function AreaChart({ series, ticks, marks, id, at, height = 200 }: AreaChartProps) {
  const width = 600;
  const all = series
    .flatMap((entry) => entry.values)
    .filter((value): value is number => value !== null && !Number.isNaN(value));
  const min = 0;
  const max = Math.max(...all, 1);

  return (
    <div className="ax-chart" style={{ '--ax-chart-h': `${height}px` } as CSSProperties}>
      <div className="ax-chart-y">
        {ticks.map((tick, index) => (
          <span key={`${tick}-${index}`}>{tick}</span>
        ))}
      </div>
      <div className="ax-chart-box">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="ax-chart-svg"
          role="img"
          aria-label="Growth over the selected period"
        >
          <defs>
            {series.map((entry, index) => (
              <linearGradient key={index} id={`${id}-fill-${index}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={toneVar(entry.tone)} stopOpacity="0.32" />
                <stop offset="100%" stopColor={toneVar(entry.tone)} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {ticks.map((_, index) => {
            const y = (index / Math.max(1, ticks.length - 1)) * height;
            return (
              <line
                key={index}
                x1="0"
                y1={y}
                x2={width}
                y2={y}
                className="ax-gridline"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {[...series]
            .sort((a, b) => Number(Boolean(b.muted)) - Number(Boolean(a.muted)))
            .map((entry, index) => {
              const drawn = linePath(entry.values, width, height, min, max, 4, at);
              if (!drawn) return null;
              return (
                <g key={index}>
                  {/* The area closes on the extent the line actually covers,
                      not on the box: a series that stops halfway across — the
                      history under a forecast — would otherwise be filled with
                      a diagonal running off to the far corner. */}
                  {!entry.muted && (
                    <path
                      className="ax-chart-area"
                      d={`${drawn.d} L${drawn.toX.toFixed(2)},${height} L${drawn.fromX.toFixed(2)},${height} Z`}
                      fill={`url(#${id}-fill-${index})`}
                    />
                  )}
                  {/* Both lines draw the same way — `stroke-dasharray` is the
                      entrance animation's property now that no series is drawn
                      as a pattern, so every line on the page sweeps in solid
                      and stays solid. */}
                  <path
                    className={`ax-chart-line${entry.muted ? ' is-muted' : ''}`}
                    d={drawn.d}
                    pathLength={1}
                    fill="none"
                    stroke={toneVar(entry.tone)}
                    strokeWidth={entry.muted ? 1.5 : 2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            })}
        </svg>
        <div className="ax-chart-x">
          {marks.map((mark, index) => (
            <span key={`${mark}-${index}`}>{mark}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Radar — subject growth
// --------------------------------------------------------------------------
export interface RadarAxis {
  label: string;
  /** 0-1, already scaled against the largest value on the chart. */
  value: number;
}

/**
 * One polygon per period over a labelled web.
 *
 * A radar is the right shape here and the wrong one almost everywhere else: it
 * is readable only when the axes are few, named, and genuinely comparable, and
 * "XP earned per subject" is all three. The axes are scaled against the largest
 * single value rather than each against its own maximum, so a subject that
 * dwarfs the others looks like it dwarfs the others.
 */
/** Longest axis name drawn before it is cut. "Computer Science" is 16. */
const RADAR_LABEL = 13;

export function Radar({ axes, tone = 'violet' }: { axes: RadarAxis[]; tone?: Tone }) {
  const size = 220;
  const centre = size / 2;
  const radius = size / 2 - 34;
  const rings = [0.25, 0.5, 0.75, 1];

  /**
   * Room either side of the square the web is drawn in, for the axis names.
   *
   * The names sit outside the outer ring, so on a square box they were drawn
   * outside the viewBox and — with `overflow: visible` on the SVG — landed on
   * whatever was next to the chart. In the subject panel that is the legend,
   * so "Computer Science" was printed straight through it. Padding the box
   * horizontally is what makes a label part of the chart rather than something
   * escaping from it; the names run left and right, which is why there is no
   * vertical equivalent.
   */
  const padX = 48;

  if (axes.length < 3) return <div className="ax-radar-empty">Not enough subjects yet</div>;

  // Typed as a tuple rather than number[]: the callers destructure it, and
  // under noUncheckedIndexedAccess an array's members are possibly undefined.
  const at = (index: number, scale: number): [number, number] => {
    // Start at twelve o'clock and go clockwise, which is where a reader's eye
    // starts on a dial.
    const angle = (Math.PI * 2 * index) / axes.length - Math.PI / 2;
    return [centre + Math.cos(angle) * radius * scale, centre + Math.sin(angle) * radius * scale];
  };

  const polygon = (scale: (index: number) => number) =>
    axes.map((_, index) => at(index, scale(index)).map((n) => n.toFixed(1)).join(',')).join(' ');

  return (
    <svg
      viewBox={`${-padX} 0 ${size + padX * 2} ${size}`}
      className="ax-radar"
      role="img"
      aria-label="XP earned by subject"
    >
      {rings.map((ring) => (
        <polygon key={ring} points={polygon(() => ring)} className="ax-radar-ring" />
      ))}
      {axes.map((_, index) => {
        const [x, y] = at(index, 1);
        return <line key={index} x1={centre} y1={centre} x2={x} y2={y} className="ax-radar-ring" />;
      })}
      <polygon
        className="ax-radar-shape"
        points={polygon((index) => Math.max(0.04, axes[index]!.value))}
        fill={toneVar(tone)}
        fillOpacity="0.28"
        stroke={toneVar(tone)}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {axes.map((axis, index) => {
        const [x, y] = at(index, 1.2);
        // Cut rather than wrapped: a two-line axis name on a web this size
        // collides with the name of the axis next to it, and the panel's
        // legend beside the chart prints every name in full anyway.
        const short =
          axis.label.length > RADAR_LABEL ? `${axis.label.slice(0, RADAR_LABEL - 1)}…` : axis.label;
        return (
          <text
            key={axis.label}
            x={x}
            y={y}
            className="ax-radar-label"
            textAnchor={x > centre + 4 ? 'start' : x < centre - 4 ? 'end' : 'middle'}
            dominantBaseline="middle"
          >
            <title>{axis.label}</title>
            {short}
          </text>
        );
      })}
    </svg>
  );
}

// --------------------------------------------------------------------------
// Grouped bars — the period comparison
// --------------------------------------------------------------------------
export interface BarPair {
  label: string;
  current: number;
  previous: number;
  currentText: string;
  previousText: string;
}

/**
 * Five pairs of bars, each pair scaled to itself.
 *
 * Five metrics in different units — XP in the tens of thousands, a score out of
 * ten — cannot share a y-axis without four of them becoming a flat line along
 * the floor. So each pair is scaled to its own larger member and the figures
 * are printed on the bars. The comparison a reader makes is *within* a pair,
 * which is the comparison the panel is for.
 */
export function GroupedBars({ pairs }: { pairs: BarPair[] }) {
  return (
    <div className="ax-bars">
      {pairs.map((pair) => {
        const peak = Math.max(pair.current, pair.previous, 1);
        return (
          <div className="ax-bar-group" key={pair.label}>
            <div className="ax-bar-pair">
              <div className="ax-bar-col">
                <span className="ax-bar-value">{pair.currentText}</span>
                <div
                  className="ax-bar ax-bar-now"
                  style={{ height: `${(pair.current / peak) * 100}%` }}
                />
              </div>
              <div className="ax-bar-col">
                <span className="ax-bar-value ax-bar-value-was">{pair.previousText}</span>
                <div
                  className="ax-bar ax-bar-was"
                  style={{ height: `${(pair.previous / peak) * 100}%` }}
                />
              </div>
            </div>
            <span className="ax-bar-label">{pair.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// --------------------------------------------------------------------------
// Columns — one series of labelled bars
// --------------------------------------------------------------------------
export interface Column {
  label: string;
  value: number;
  /** Printed above the bar. The unit is the caller's business. */
  text: string;
  /** Drawn in the accent rather than the base — the best day, the peak hour. */
  peak?: boolean;
}

/**
 * A distribution, as bars sharing one scale.
 *
 * Unlike `GroupedBars` these are all the same measurement, so they share a
 * scale and the comparison between any two of them is real — that is the whole
 * point of the panel, and scaling each to itself would flatten exactly the
 * difference the reader is looking for. The tallest is marked so the answer to
 * "when" is visible before any of the numbers are read.
 */
export function Columns({ columns, tone = 'violet' }: { columns: Column[]; tone?: Tone }) {
  const peak = Math.max(...columns.map((column) => column.value), 1);
  return (
    <div className="ax-columns">
      {columns.map((column) => (
        <div className="ax-column" key={column.label}>
          <span className="ax-column-value">{column.text}</span>
          <div className="ax-column-track">
            <div
              className={`ax-column-bar${column.peak ? ' is-peak' : ''}`}
              style={{
                height: `${(column.value / peak) * 100}%`,
                background: column.peak ? toneVar(tone) : undefined,
              }}
            />
          </div>
          <span className="ax-column-label">{column.label}</span>
        </div>
      ))}
    </div>
  );
}

// --------------------------------------------------------------------------
// Panel furniture
// --------------------------------------------------------------------------
export interface PanelProps {
  title: string;
  /** A line under the title, when the panel needs one. */
  note?: string;
  /** Pushed to the right of the title row — a picker, usually. */
  aside?: ReactNode;
  /** Marks a panel drawn from invented figures. See SAMPLE in ./data. */
  sample?: boolean;
  className?: string;
  children: ReactNode;
  /** The link row along the bottom. */
  footer?: ReactNode;
}

/**
 * A panel, and the one place the Sample chip is drawn.
 *
 * **The chip sits in the top right, opposite the title.** It used to sit beside
 * the heading, which read as part of the heading — "Where You Stand Sample" —
 * and put the least important word on a panel in the position the eye lands on
 * first. Top right is where a provenance mark belongs and where every panel on
 * the page has one in the same place, so a reader scanning a tab can tell at a
 * glance which figures are theirs without reading a single heading.
 *
 * When a panel has both a chip and an `aside` control, the chip goes first: a
 * picker acts on the panel and the chip describes it, and the description is
 * the thing that must not be missed.
 */
export function Panel({ title, note, aside, sample, className, children, footer }: PanelProps) {
  return (
    <section className={`ax-panel${className ? ` ${className}` : ''}`}>
      <header className="ax-panel-head">
        <div className="ax-panel-title">
          <h2>{title}</h2>
        </div>
        {(sample || aside) && (
          <div className="ax-panel-aside">
            {sample && (
              <span
                className="ax-sample"
                title="Placeholder figures — your own record cannot fill this panel yet"
              >
                Sample
              </span>
            )}
            {aside}
          </div>
        )}
      </header>
      {note && <p className="ax-panel-note">{note}</p>}
      {children}
      {footer && <div className="ax-panel-foot">{footer}</div>}
    </section>
  );
}

// --------------------------------------------------------------------------
// Scatter — a relationship, drawn as the observations and nothing else
// --------------------------------------------------------------------------
export interface ScatterProps {
  /** Already normalised to 0-1 on both axes by the caller. */
  points: Array<[number, number]>;
  tone: Tone;
  xLabel: string;
  yLabel: string;
  /** Drawn only when the caller says the correlation is worth a line. */
  trend?: boolean;
}

/**
 * A cloud of dots, with a line of fit only when one is earned.
 *
 * The default is no line, and that is the point. A line of best fit asserts a
 * model; a cloud asserts nothing beyond the observations it is made of. On a
 * relationship the page has already labelled "possible, not established", a
 * confident diagonal through the middle of the smear would contradict the
 * label right next to it — so the caller passes `trend` only where the evidence
 * carries it, and everywhere else the reader gets to see the scatter for what
 * it is.
 */
export function Scatter({ points, tone, xLabel, yLabel, trend }: ScatterProps) {
  const width = 300;
  const height = 150;
  const pad = 6;

  const at = (point: [number, number]): [number, number] => [
    pad + point[0] * (width - pad * 2),
    height - pad - point[1] * (height - pad * 2),
  ];

  // Least squares in the normalised space — the same fit the coefficient came
  // from, so the line and the number beside it cannot disagree.
  let line: string | null = null;
  if (trend && points.length >= 3) {
    const n = points.length;
    const meanX = points.reduce((sum, [x]) => sum + x, 0) / n;
    const meanY = points.reduce((sum, [, y]) => sum + y, 0) / n;
    let top = 0;
    let bottom = 0;
    points.forEach(([x, y]) => {
      top += (x - meanX) * (y - meanY);
      bottom += (x - meanX) ** 2;
    });
    if (bottom > 0) {
      const slope = top / bottom;
      const from = at([0, Math.max(0, Math.min(1, meanY + slope * (0 - meanX)))]);
      const to = at([1, Math.max(0, Math.min(1, meanY + slope * (1 - meanX)))]);
      line = `M${from[0].toFixed(1)},${from[1].toFixed(1)} L${to[0].toFixed(1)},${to[1].toFixed(1)}`;
    }
  }

  return (
    <div className="ax-scatter">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${xLabel} against ${yLabel}`}>
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1="0"
            x2={width}
            y1={height * ratio}
            y2={height * ratio}
            className="ax-gridline"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {line && (
          <path
            d={line}
            className="ax-scatter-fit"
            stroke={toneVar(tone)}
            vectorEffect="non-scaling-stroke"
          />
        )}
        {points.map((point, index) => {
          const [x, y] = at(point);
          return <circle key={index} cx={x} cy={y} r="2.6" fill={toneVar(tone)} fillOpacity="0.55" />;
        })}
      </svg>
      <div className="ax-scatter-axes">
        <span>{xLabel} →</span>
        <span>↑ {yLabel}</span>
      </div>
    </div>
  );
}

/** The "↑ 46% vs previous 2 years" line, or nothing when there is no baseline. */
export function Delta({ value, suffix }: { value: number | null; suffix: string }) {
  if (value === null) return <span className="ax-delta ax-delta-none">No earlier period</span>;
  const direction = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
  return (
    <span className={`ax-delta ax-delta-${direction}`}>
      {direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→'} {Math.abs(value)}% {suffix}
    </span>
  );
}
