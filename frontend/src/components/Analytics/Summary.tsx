/**
 * The short version of the whole page, at the top of the Overview.
 *
 * ## Why this replaced three things rather than joining them
 *
 * The Overview used to open with three summaries stacked: a one-line strip
 * saying what the score did, then a banner carrying the score, its letter, two
 * paragraphs of derivation and five labelled bars, then five stat tiles with
 * deltas and sparklines under them. Fifteen-odd figures and two paragraphs
 * before the reader reached anything that was not a summary — and a reader who
 * does not want to read everything was being asked to read three openings to
 * find out whether they wanted to read the fourth.
 *
 * So this is not a fourth. It is those three collapsed into one, and the two
 * that had the least claim on the top of the page gave up their slots: the
 * strip's sentence is row two here, and the banner is gone (see `scoreMovement`
 * in ./Header, and the note in ./index about what happened to the banner's
 * bars). `Tiles` stays exactly where it was — it is scanned rather than read,
 * which is a different job from this one.
 *
 * ## Five rows, and what makes them readable
 *
 * One sentence each, with the figure bolded **inside** the sentence rather than
 * broken out as a tile — a number in a box is a thing to look up, a number in a
 * sentence is a thing that has already been interpreted for you. No sparkline,
 * no bar, no delta chip anywhere in here; those belong to the row of tiles
 * below, which is built for exactly that and does it better.
 *
 * **A row with nothing honest to say is dropped, not filled.** No advice yet
 * means four rows, not a fifth reading "no recommendations". That is the page's
 * standing rule against invented figures, applied to prose — see the note at
 * the top of pages/Analytics.
 *
 * **Five is the cap.** Rows one to three reorganise what the Overview already
 * said; rows four and five are the point of the thing, because "what to do" and
 * "why the record looks like this" live two tabs away and a reader who wanted
 * the short version was never going to find them. A sixth row would mean
 * something here has stopped earning its place.
 *
 * Every row links to the tab that proves it. The summary is deliberately not
 * arguable on its own: it states, and hands off to the panel that shows the
 * working.
 *
 * ## The derivation is still on the page
 *
 * The banner kept `howItIsCalculated` in open prose on the argument that a
 * grade with no stated derivation is a verdict, and a verdict from software
 * about somebody's study habits is worth very little. That argument is right
 * and the sentence is kept — one disclosure down, closed, in the footer. The
 * difference is that it is now a sentence the reader chooses, rather than the
 * second paragraph standing between them and the page.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { gradeClass } from './metrics';
import type { ScoreMovement } from './Header';
import {
  GRADE_MEANING,
  bandLabel,
  howItIsCalculated,
  type AnalyticalScore,
} from '@/utils/analyticalScore';

export interface SummaryProps {
  /** The score, its letter and its five parts. */
  score: AnalyticalScore;
  /** What the score did, or null when there is nothing honest to compare to. */
  movement: ScoreMovement | null;
  /** The highest-value recommendation's title, or null when there are none. */
  topAdvice: string | null;
  /** How many there are in total, for the row's hand-off. */
  adviceCount: number;
  /** The behavioural phase — "Building", "Dormant" — from `currentState`. */
  phase: string | null;
}

interface Row {
  key: string;
  text: ReactNode;
  /** The tab that shows the working. A hash is an anchor on this same tab. */
  href: string;
  label: string;
}

export function Summary({ score, movement, topAdvice, adviceCount, phase }: SummaryProps) {
  const { value, grade, weakest } = score;

  /* No score is not a broken panel — it is a new account, and it deserves the
     same answer the banner gave it: what the score needs before it exists.
     Kept verbatim, because it was the one thing on the old banner that spoke
     to the reader who had least to go on. */
  if (value === null || grade === null) {
    return (
      <section className="ax-panel ax-summary is-empty">
        <p className="ax-empty">
          No score yet. It is the average of five measures and each one needs a few days of
          record behind it before it means anything.
        </p>
      </section>
    );
  }

  const rows: Row[] = [];

  if (movement) {
    rows.push({
      key: 'moved',
      text:
        movement.direction === 'held' ? (
          <>
            It has held at <strong>{movement.now}</strong> for <strong>{movement.days}</strong>{' '}
            days.
          </>
        ) : (
          <>
            That is <strong>{movement.direction}</strong> from {movement.previous}
            {/* A comma, because the two figures are otherwise adjacent — "up
                from 61 12 days ago" reads as one number twice. */}
            {movement.days === 1 ? ' yesterday' : <>, {movement.days} days ago</>}.
          </>
        ),
      href: '/trends',
      label: 'See what is moving',
    });
  }

  if (weakest) {
    rows.push({
      key: 'weakest',
      text: (
        <>
          The measure holding it back is <strong>{weakest.label.toLowerCase()}</strong>, at{' '}
          <strong>{Math.round(weakest.score)}</strong> out of 100 — {weakest.raw}.
        </>
      ),
      href: '#trajectory',
      label: 'See all five',
    });
  }

  if (topAdvice) {
    rows.push({
      key: 'advice',
      text: (
        <>
          The change worth most right now is <strong>{topAdvice.toLowerCase()}</strong>
          {adviceCount > 1 ? <>, one of {adviceCount} worth making</> : null}.
        </>
      ),
      href: '/recommendations',
      label: 'See what to change',
    });
  }

  if (phase) {
    rows.push({
      key: 'phase',
      text: (
        <>
          You are working in a <strong>{phase.toLowerCase()}</strong> phase.
        </>
      ),
      href: '/insights',
      label: 'See why',
    });
  }

  return (
    <section className={`ax-panel ax-summary ${gradeClass(grade)}`}>
      <div className="ax-summary-head">
        <div className="ax-summary-grade" title={`${bandLabel(grade)} out of 100`}>
          <span aria-hidden="true">{grade}</span>
          <span className="ax-sr-only">Grade {grade}</span>
        </div>
        <p className="ax-summary-lead">
          Your analytical score is{' '}
          <strong>
            {value}
            <em>/100</em>
          </strong>{' '}
          — {GRADE_MEANING[grade].toLowerCase()}.
        </p>
      </div>

      {rows.length > 0 && (
        <ul className="ax-summary-rows">
          {rows.map((row) => (
            <li key={row.key}>
              <p>{row.text}</p>
              {/* A hash is an anchor on the tab that is already open; anything
                  else is another tab, and `Link` keeps the router in charge of
                  it. Two elements rather than one branch inside a `Link`,
                  because a router link to "#trajectory" resolves against the
                  route and navigates away from it. */}
              {row.href.startsWith('#') ? (
                <a className="ax-summary-more" href={row.href}>
                  {row.label}
                </a>
              ) : (
                <Link className="ax-summary-more" to={row.href}>
                  {row.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}

      <details className="ax-summary-how">
        <summary>How this is worked out</summary>
        <p>{howItIsCalculated(score)}</p>
      </details>
    </section>
  );
}
