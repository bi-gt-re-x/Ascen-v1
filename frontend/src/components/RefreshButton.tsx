/**
 * Ask the server again — and the only thing on a page that does.
 *
 * Pages used to re-read the whole account after every write: a rename, a
 * resize, a drag, a completion. Each one put the view back through its loading
 * state, which cost the reader their scroll position, their open menu and
 * their place on the grid, in exchange for figures the write had already told
 * the page. Writes now change what is on screen directly (hooks/useApi's
 * `mutate`), which leaves exactly one honest reason to re-read — the reader
 * asking. This is that button.
 *
 * It spins while the request is in flight and is disabled for its duration, so
 * a second press cannot queue a second read; the page underneath keeps its
 * data throughout and never blinks.
 */
import '@/styles/refresh-button.css';

export interface RefreshButtonProps {
  onRefresh: () => void;
  /** A read is in flight. */
  busy?: boolean;
  /** Extra classes, so a page can dress it like the buttons beside it. */
  className?: string;
  /** Shown beside the icon. Left off, the button is the icon alone. */
  label?: string;
}

export function RefreshButton({
  onRefresh,
  busy = false,
  className = '',
  label,
}: RefreshButtonProps) {
  return (
    <button
      type="button"
      className={`refresh-btn${busy ? ' is-busy' : ''}${className ? ` ${className}` : ''}`}
      title={busy ? 'Refreshing…' : 'Refresh from the server'}
      aria-label={busy ? 'Refreshing' : 'Refresh'}
      aria-busy={busy}
      disabled={busy}
      onClick={onRefresh}
    >
      <svg
        className="refresh-icon"
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20 11a8 8 0 1 0-.6 4" />
        <path d="M20 4v7h-7" />
      </svg>
      {label && <span className="refresh-label">{label}</span>}
    </button>
  );
}
