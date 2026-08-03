/**
 * The states a page renders instead of itself.
 *
 * Not in the original component list, but every page that fetches needs all of
 * these and writing them per page is how they drift — one says "Loading...",
 * the next shows a blank screen, a third renders an empty list that looks like
 * a bug.
 *
 * `NotBuilt` is the one that matters most right now: eight routes exist with no
 * feature behind them, and a placeholder that says so plainly is more honest
 * than a page that looks broken. pages/Unbuilt.tsx is the table of them.
 *
 * The stylesheet is imported here rather than by the pages that show a state,
 * because for most of this file's life none of them did and none of these
 * classes had any rules at all — see the note at the top of page-state.css.
 *
 * `EmptyState` used to live here and was never rendered by anything: the two
 * places with an empty list (the task panel, the activity feed) each say
 * something specific to that list, which is better than a shared component
 * saying nothing in particular. Git history has it.
 */
import '@/styles/page-state.css';

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="page-state page-state-loading" role="status" aria-live="polite">
      <span className="page-spinner" aria-hidden="true" />
      <p>{label}…</p>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="page-state page-state-error" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

/**
 * A page that is routed but not built.
 *
 * Says what it will be rather than pretending to be it, and names the files it
 * will be built from — so the placeholder doubles as the note for whoever
 * picks it up.
 */
export function NotBuilt({
  name,
  description,
  files,
}: {
  name: string;
  description: string;
  files?: string[];
}) {
  return (
    <div className="page-state page-state-unbuilt">
      <h1 className="page-state-title">{name}</h1>
      <p>{description}</p>
      <p className="page-state-note">This page isn’t built yet.</p>
      {files && files.length > 0 && (
        <ul className="page-state-files">
          {files.map((file) => (
            <li key={file}>
              <code>{file}</code>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
