/**
 * Analytics — the Growth Score, the five measures under it, and the seven tabs.
 *
 * The one section on this page with no home-*.js behind it: the analytics page
 * post-dates the landing page, so there was nothing to port. It is written to
 * the same rules as the demos that were — a panel that sits still until it is
 * scrolled to, plays once, and holds its finished state.
 *
 * ## Nothing here is a second implementation
 *
 * The temptation in a landing-page mock is to type "8.3" and "Top 2%" into the
 * markup and move on. Both are derived instead:
 *
 *   * the score is `mean(FACTORS) / 10`, computed from the same five bars the
 *     panel draws. That is the rule `components/Analytics/score` is built
 *     around — a panel that prints five factors and a total the reader cannot
 *     add up is a panel nobody trusts — and it matters more here than there,
 *     because this is the version a stranger sees first. Edit a factor and the
 *     score follows; it cannot drift.
 *   * the standing is `percentileLabel`, the real placement model, imported
 *     rather than guessed. A hardcoded "Top 2%" beside a score that no longer
 *     implies it is exactly the unmodelled figure that function replaced.
 *
 * It is imported from `components/Analytics/score` directly and not from the
 * folder's index, which is the deliberate part: the index pulls the whole
 * analytics page in behind it, and this route is its own chunk. `score` imports
 * nothing but types, so the landing bundle gains an arithmetic function and no
 * components.
 *
 * The five names and the seven tabs are the real ones — `backend/tracking/analytics.py`
 * scores those five metrics, and `pages/Analytics.tsx` has those seven tabs in
 * that order. A tour of features the app does not have is worse than no tour.
 *
 * ## The motion
 *
 * Three things play, on one timeline, in the order a reader's eye wants them:
 * the bars grow, the score counts up alongside them, and the tab strip lights
 * up left to right once the numbers have settled.
 *
 * The bars are CSS transitions armed by a class, like the charts and the tech
 * grid: `styles/home-motion.css` writes the finished panel as the plain rule
 * and the empty one under `.ax-armed`. The markup ships armed, the way the task
 * and dashboard demos do, because the alternative is a panel that paints itself
 * full and then blanks when the observer first fires. The score is
 * `countThrough`, which is a text node being rewritten and cannot be a
 * transition. The two start together on the same duration, so the number lands
 * as the last bar does.
 *
 * The two cards themselves are not animated here. `.lp-ax` is named in the
 * reveal hook's grid list, so they slide in from the sides with every other
 * pair on the page — the section arrives the way the rest of the page arrives,
 * and only what is inside it belongs to this file.
 */
import { useCallback, useRef } from 'react';
import { percentileLabel } from '@/components/Analytics/score';
import {
  afterPaint,
  countThrough,
  timeline,
  useInViewPlay,
  type Counter,
  type Timeline,
} from '@/utils/homePlay';
import type { CSSProperties } from 'react';

/**
 * The five metrics the report card scores, and a plausible reading of each.
 *
 * Equally weighted, because the backend weights them equally — so the score
 * below is their flat mean and nothing here needs to know a weight.
 */
const FACTORS = [
  { name: 'Productivity', to: 92 },
  { name: 'Consistency', to: 78 },
  { name: 'Quality', to: 85 },
  { name: 'Efficiency', to: 71 },
  { name: 'Focus', to: 88 },
] as const;

/** The report card is out of a hundred; the score it becomes is out of ten. */
const SCORE_SCALE = 10;

/** The mean of the five, out of ten — the parts by construction. */
const SCORE =
  FACTORS.reduce((sum, factor) => sum + factor.to, 0) / FACTORS.length / SCORE_SCALE;

/** One decimal, the way the analytics page states it. */
const scoreText = (value: number) => value.toFixed(1);

/** Where that score places, by the same model the real badge uses. */
const STANDING = percentileLabel(SCORE);

/** The seven tabs, in the order the analytics page's bar puts them. */
const TABS = [
  'Recommendations',
  'Overview',
  'Trends',
  'Habits',
  'Insights',
  'Subjects',
  'Records',
] as const;

/** Long enough to read as counting rather than snapping; the bars' own time. */
const RUN_MS = 1400;
/** Each bar waits on the one above it. */
const BAR_STAGGER_MS = 90;
/** The strip starts lighting once the numbers are essentially done. */
const TABS_AT_MS = 900;
const TAB_STAGGER_MS = 70;

export function Analytics() {
  const root = useRef<HTMLDivElement>(null);
  const num = useRef<HTMLElement>(null);

  const tl = useRef<Timeline | null>(null);
  const counter = useRef<Counter | null>(null);
  const armed = useRef<(() => void) | null>(null);

  /** Back to the opening frame: bars at nothing, score at nothing, strip dark. */
  const reset = useCallback(() => {
    tl.current?.cancel();
    counter.current?.cancel();
    armed.current?.();
    armed.current = null;
    root.current?.classList.add('ax-armed');
    if (num.current) num.current.textContent = scoreText(0);
  }, []);

  const play = useCallback(() => {
    const host = root.current;
    if (!host) return;

    const t = timeline();
    tl.current = t;

    // Armed, painted, then unarmed — the bars need a width to travel from.
    armed.current = afterPaint(() => host.classList.remove('ax-armed'));

    counter.current = countThrough(num.current, [0, SCORE], {
      duration: RUN_MS,
      format: scoreText,
    });

    t.at(TABS_AT_MS, () => host.classList.add('ax-lit'));
  }, []);

  /** For `prefers-reduced-motion`: the finished panel, at once. */
  const still = useCallback(() => {
    const host = root.current;
    if (!host) return;
    host.classList.remove('ax-armed');
    host.classList.add('ax-lit');
    if (num.current) num.current.textContent = scoreText(SCORE);
  }, []);

  useInViewPlay(root, { play, reset, still, threshold: 0.4 });

  return (
    <div className="lp-ax ax-armed" ref={root}>
      <div className="lp-card lp-ax-score">
        <div className="lp-card-top">
          <span className="lp-metric-label">Growth Score</span>
          {STANDING ? <span className="lp-pill-mini">{STANDING}</span> : null}
        </div>

        <strong className="lp-ax-num">
          <em ref={num as React.RefObject<HTMLElement>}>{scoreText(SCORE)}</em>
          <small>/{SCORE_SCALE}</small>
        </strong>
        <span className="lp-metric-note">
          The mean of the five measures beside it — add them up yourself.
        </span>

        <ul className="lp-ax-tabs">
          {TABS.map((tab, i) => (
            <li
              key={tab}
              className={`lp-ax-tab${i === 0 ? ' is-lead' : ''}`}
              style={{ transitionDelay: `${i * TAB_STAGGER_MS}ms` } as CSSProperties}
            >
              {tab}
            </li>
          ))}
        </ul>
      </div>

      <div className="lp-card lp-ax-factors">
        <div className="lp-card-top">
          <span className="lp-metric-label">What it is made of</span>
          <span className="lp-pill-mini">A fifth each</span>
        </div>

        <ul className="lp-ax-list">
          {FACTORS.map((factor, i) => (
            <li className="lp-ax-row" key={factor.name}>
              <span className="lp-ax-name">{factor.name}</span>
              <span className="lp-ax-track">
                <i
                  style={
                    {
                      '--ax-to': `${factor.to}%`,
                      transitionDelay: `${i * BAR_STAGGER_MS}ms`,
                    } as CSSProperties
                  }
                />
              </span>
              <b className="lp-ax-val">{factor.to}</b>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
