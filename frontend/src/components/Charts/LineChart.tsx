/**
 * A line chart, drawn as inline SVG.
 *
 * No charting library. The growth page draws one shape — a series over time,
 * optionally filled — and an SVG path is a few lines of arithmetic, against a
 * dependency that would be most of the bundle. It also means the chart inherits
 * the theme from CSS rather than needing to be told about it, which is what
 * made the old Chart.js setup awkward across light and dark.
 *
 * Values are plotted against a y-axis that always includes zero, so a series
 * that barely moves reads as barely moving rather than as dramatic noise.
 */
import { useId } from 'react';

export interface LineChartProps {
  /** In order. Fewer than two points draws nothing. */
  points: Array<{ label: string; value: number }>;
  width?: number;
  height?: number;
  /** Shade the area under the line. */
  fill?: boolean;
  /** Announced to screen readers in place of the drawing. */
  ariaLabel: string;
  className?: string;
}

const PADDING = { top: 8, right: 8, bottom: 8, left: 8 };

export function LineChart({
  points,
  width = 640,
  height = 220,
  fill = true,
  ariaLabel,
  className = '',
}: LineChartProps) {
  const gradientId = useId();

  if (points.length < 2) {
    return (
      <p className={`chart-empty ${className}`.trim()}>
        Not enough data to chart yet.
      </p>
    );
  }

  const values = points.map((p) => p.value);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;

  const plotWidth = width - PADDING.left - PADDING.right;
  const plotHeight = height - PADDING.top - PADDING.bottom;

  const coords = points.map((point, index) => {
    const x = PADDING.left + (index / (points.length - 1)) * plotWidth;
    const y = PADDING.top + plotHeight - ((point.value - min) / span) * plotHeight;
    return { x, y };
  });

  const line = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(2)},${c.y.toFixed(2)}`)
    .join(' ');

  const first = coords[0];
  const last = coords[coords.length - 1];
  const base = PADDING.top + plotHeight;
  const area =
    first && last
      ? `${line} L${last.x.toFixed(2)},${base} L${first.x.toFixed(2)},${base} Z`
      : '';

  return (
    <svg
      className={`chart chart-line ${className}`.trim()}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel}
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" className="chart-fill-top" />
              <stop offset="100%" className="chart-fill-bottom" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gradientId})`} />
        </>
      )}
      <path d={line} className="chart-line-stroke" fill="none" />
    </svg>
  );
}
