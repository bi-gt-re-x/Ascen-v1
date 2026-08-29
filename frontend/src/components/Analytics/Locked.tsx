/**
 * What a tab shows when this account cannot fill it yet.
 *
 * This replaces the sample data. Four tabs used to fall back to invented
 * figures behind a small chip, which was the wrong trade twice over: a new
 * account's first impression of the analysis was a screen of numbers that were
 * not about them, and the chip was a footnote against a full page of confident
 * charts. The lesson a reader took from it was that the figures here are set
 * dressing — and that lesson stuck to the real ones later.
 *
 * So a tab that cannot be filled says so, and says exactly what it is waiting
 * for. That is strictly more useful than a fake chart: a countdown is a reason
 * to come back on a named day, where a placeholder is a reason to discount
 * everything on the page.
 *
 * Two states, because there are two ways to have nothing to show and telling
 * them apart is the whole value:
 *
 * - **Waiting** (`remaining` > 0). The record is too short. Show the count and
 *   what will be here — a promise, and the condition that meets it. Not a
 *   date: the count is in days with work on them, and how soon that is
 *   depends on how often the reader turns up.
 * - **Nothing found** (`remaining` = 0). The record is long enough and the
 *   analysis genuinely produced nothing. That is a real result and gets said
 *   plainly rather than dressed as a wait: an account with an even week and no
 *   gaps has nothing to fix on those counts, and deserves to hear it.
 */
import type { ReactNode } from 'react';

export interface LockedProps {
  /** The tab's own name, as the reader sees it in the bar. */
  title: string;
  /**
   * Days of history still needed, or 0 when the record is long enough and the
   * analysis simply found nothing. See the note above.
   */
  remaining: number;
  /** How many days this tab needs in total — printed as the bar's end. */
  need: number;
  /** How many the account has. */
  have: number;
  /** A short clause on why the wait is this long. Kept to one line. */
  promise: string;
  /** What will appear, three or four words each — a list, not sentences. */
  brings: string[];
  /**
   * What to say when there are enough days and still no findings. Required for
   * the second state, because the honest sentence is different every time and a
   * generic one would be the placeholder problem again in one line.
   */
  emptyMessage?: string;
  /** A way out of the dead end — usually a link to something to go do. */
  action?: ReactNode;
}

export function Locked({
  title,
  remaining,
  need,
  have,
  promise,
  brings,
  emptyMessage,
  action,
}: LockedProps) {
  // Enough history, nothing found. Not a wait — a result.
  if (remaining <= 0) {
    return (
      <section className="ax-locked ax-locked-empty">
        <div className="ax-locked-body">
          <h2>Nothing to report.</h2>
          <p className="ax-locked-lead">{emptyMessage ?? 'Your record is long enough. Nothing in it stands out.'}</p>
          {action && <div className="ax-locked-action">{action}</div>}
        </div>
      </section>
    );
  }

  const pct = Math.max(0, Math.min(100, Math.round((have / need) * 100)));

  return (
    <section className="ax-locked">
      <div className="ax-locked-body">
        <p className="ax-locked-eyebrow">{title}</p>
        {/* The number is the message. It used to open with a sentence of
            justification and put the count in the middle of it. */}
        <h2>
          <strong>{remaining}</strong> more {remaining === 1 ? 'day' : 'days'}
        </h2>
        {/* No date. This used to read "Opens November 3", computed as today
            plus `remaining` — which was only ever right for somebody who works
            every single day, and told everybody else a date that came and went
            with the tab still shut. `remaining` counts days with work on them
            now (see utils/dataMaturity), so the honest sentence is the one
            that names the condition instead of guessing when it is met. */}
        <p className="ax-locked-lead">
          {remaining === 1 ? 'One more day' : `${remaining} more days`} with work on{' '}
          {remaining === 1 ? 'it' : 'them'}, whenever you do them. {promise}
        </p>

        <div
          className="ax-locked-meter"
          role="img"
          aria-label={`${have} of ${need} days with work on them`}
        >
          <span className="ax-locked-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="ax-locked-count">
          {have} / {need} days with work on them
        </p>

        {brings.length > 0 && (
          <ul className="ax-locked-list">
            {brings.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}

        {action && <div className="ax-locked-action">{action}</div>}
      </div>
    </section>
  );
}
