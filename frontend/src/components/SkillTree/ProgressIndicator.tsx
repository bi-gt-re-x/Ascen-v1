/**
 * A percentage, as a ring or as a bar.
 *
 * One component for both because they are the same reading in two sizes: the
 * ring goes where there is room for a figure to be looked at (a header stat, a
 * node in progress), the bar goes where a row needs a length rather than a
 * shape. Two components would be two roundings and two ideas about what an
 * out-of-range value does.
 */
export interface ProgressIndicatorProps {
  /** 0-100. Clamped rather than trusted — a feed can hand over anything. */
  percent: number;
  shape?: 'ring' | 'bar';
  /** Ring diameter in px. Ignored by the bar. */
  size?: number;
  /** Print the rounded figure inside the ring. */
  label?: boolean;
  /** Overrides the colour, which otherwise comes from the surrounding state. */
  tone?: string;
}

export function ProgressIndicator({
  percent,
  shape = 'bar',
  size = 44,
  label = false,
  tone,
}: ProgressIndicatorProps) {
  const value = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));

  if (shape === 'bar') {
    return (
      <span
        className="stx-bar"
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <i style={{ width: `${value}%`, ...(tone ? { background: tone } : {}) }} />
      </span>
    );
  }

  // Stroke width and radius are derived from `size` so one number scales the
  // whole thing; the dash array is the arc length rather than a percentage,
  // because a percentage of a circumference is what a browser will not accept.
  const stroke = Math.max(3, size * 0.09);
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = (value / 100) * circumference;

  return (
    <span className="stx-ring-wrap" style={{ width: size, height: size }}>
      <svg
        className="stx-ring"
        viewBox={`0 0 ${size} ${size}`}
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <circle cx={size / 2} cy={size / 2} r={r} className="stx-ring-track" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="stx-ring-arc"
          strokeWidth={stroke}
          strokeDasharray={`${filled} ${circumference - filled}`}
          // Twelve o'clock, not three — where a reader expects a ring to start.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          {...(tone ? { stroke: tone } : {})}
        />
      </svg>
      {label && <b className="stx-ring-label">{Math.round(value)}%</b>}
    </span>
  );
}
