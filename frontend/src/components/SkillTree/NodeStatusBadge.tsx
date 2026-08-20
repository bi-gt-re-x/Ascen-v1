/**
 * The four states, as a chip.
 *
 * The icon carries the state as well as the colour does, which is the point:
 * locked, available, in progress and complete differ by hue here and by hue
 * alone on the node itself, and a badge that only recoloured would leave the
 * distinction unavailable to anybody who cannot see the difference.
 */
import type { ReactNode } from 'react';
import { STATUS_LABEL, type NodeStatus } from '@/utils/skillGraph';

const PATHS: Record<NodeStatus, ReactNode> = {
  locked: (
    <>
      <rect x="4.5" y="10" width="15" height="10.5" rx="2.2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  available: <circle cx="12" cy="12" r="7.5" />,
  progress: (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 7.5V12l3 1.8" />
    </>
  ),
  complete: <path d="m5.5 12.5 4.2 4.2L18.5 8" />,
};

export interface NodeStatusBadgeProps {
  status: NodeStatus;
  /** Drop the words and keep the mark — for a node card, where room is short. */
  compact?: boolean;
}

export function NodeStatusBadge({ status, compact = false }: NodeStatusBadgeProps) {
  return (
    <span className={`stx-badge is-${status}${compact ? ' is-compact' : ''}`}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={status === 'complete' ? 2.6 : 1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {PATHS[status]}
      </svg>
      {compact ? <span className="stx-sr">{STATUS_LABEL[status]}</span> : STATUS_LABEL[status]}
    </span>
  );
}
