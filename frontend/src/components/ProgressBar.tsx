/**
 * A progress bar — XP toward the next level, a goal toward its target.
 *
 * Carries real `role="progressbar"` semantics, so the number is available to a
 * screen reader and not only to the eye. The fill is clamped to 0-100 because
 * several callers pass a raw percentage that the backend has already capped at
 * the target, and one that has not would otherwise overflow its track.
 */
export interface ProgressBarProps {
  /** 0-100. Clamped. */
  value: number;
  /** Shown beside the bar, e.g. "313 / 8888 XP". */
  label?: string;
  /** Announced to assistive tech when the visible label is not enough. */
  ariaLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ProgressBar({
  value,
  label,
  ariaLabel,
  size = 'md',
  className = '',
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

  return (
    <div className={`progress progress-${size} ${className}`.trim()}>
      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel ?? label ?? 'Progress'}
      >
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      {label && <span className="progress-label">{label}</span>}
    </div>
  );
}
