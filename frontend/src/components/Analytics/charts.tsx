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

/** Turns values into an SVG path, scaled into the box. `null` when too few. */
function linePath(
  values: number[],
  width: number,
  height: number,
  min: number,
  max: number,
  pad = 0,
): string | null {
  if (values.length < 2) return null;
  const span = max - min || 1;
  const inner = height - pad * 2;
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = pad + inner - ((value - min) / span) * inner;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
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
  const path = linePath(values, width, height, min, max, 2);
  if (!path) return <svg className="ax-spark" viewBox={`0 0 ${width} ${height}`} />;

  return (
    <svg
      className="ax-spark"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={`${path} L${width},${height} L0,${height} Z`} fill={toneVar(tone)} opacity="0.12" />
      <path d={path} fill="none" stroke={toneVar(tone)} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// --------------------------------------------------------------------------
// AreaChart — the trajectory, and the compounding curve
// --------------------------------------------------------------------------
export interface AreaSeries {
  values: number[];
  tone: Tone;
  /** Dashed and unfilled — the period being compared against. */
  dashed?: boolean;
}

export interface AreaChartProps {
  series: AreaSeries[];
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
 * period look identical to the one before it. The dashed series is drawn first
 * so the solid one wins where they cross.
 */
export function AreaChart({ series, ticks, marks, id, height = 200 }: AreaChartProps) {
  const width = 600;
  const all = series.flatMap((entry) => entry.values);
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
            .sort((a, b) => Number(Boolean(b.dashed)) - Number(Boolean(a.dashed)))
            .map((entry, index) => {
              const path = linePath(entry.values, width, height, min, max, 4);
              if (!path) return null;
              return (
                <g key={index}>
                  {!entry.dashed && (
                    <path
                      d={`${path} L${width},${height} L0,${height} Z`}
                      fill={`url(#${id}-fill-${index})`}
                    />
                  )}
                  <path
                    d={path}
                    fill="none"
                    stroke={toneVar(entry.tone)}
                    strokeWidth="2"
                    strokeDasharray={entry.dashed ? '5 5' : undefined}
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
export function Radar({ axes, tone = 'violet' }: { axes: RadarAxis[]; tone?: Tone }) {
  const size = 220;
  const centre = size / 2;
  const radius = size / 2 - 34;
  const rings = [0.25, 0.5, 0.75, 1];

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
    <svg viewBox={`0 0 ${size} ${size}`} className="ax-radar" role="img" aria-label="XP earned by subject">
      {rings.map((ring) => (
        <polygon key={ring} points={polygon(() => ring)} className="ax-radar-ring" />
      ))}
      {axes.map((_, index) => {
        const [x, y] = at(index, 1);
        return <line key={index} x1={centre} y1={centre} x2={x} y2={y} className="ax-radar-ring" />;
      })}
      <polygon
        points={polygon((index) => Math.max(0.04, axes[index]!.value))}
        fill={toneVar(tone)}
        fillOpacity="0.28"
        stroke={toneVar(tone)}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {axes.map((axis, index) => {
        const [x, y] = at(index, 1.2);
        return (
          <text
            key={axis.label}
            x={x}
            y={y}
            className="ax-radar-label"
            textAnchor={x > centre + 4 ? 'start' : x < centre - 4 ? 'end' : 'middle'}
            dominantBaseline="middle"
          >
            {axis.label}
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

export function Panel({ title, note, aside, sample, className, children, footer }: PanelProps) {
  return (
    <section className={`ax-panel${className ? ` ${className}` : ''}`}>
      <header className="ax-panel-head">
        <div className="ax-panel-title">
          <h2>{title}</h2>
          {sample && (
            <span className="ax-sample" title="Placeholder figures — this needs data Ascen does not collect yet">
              Sample
            </span>
          )}
        </div>
        {aside}
      </header>
      {note && <p className="ax-panel-note">{note}</p>}
      {children}
      {footer && <div className="ax-panel-foot">{footer}</div>}
    </section>
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
