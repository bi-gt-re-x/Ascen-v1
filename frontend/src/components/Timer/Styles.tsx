/**
 * The ten methods, as a grid you can pick from at a glance.
 *
 * Each card carries a glyph and a tint of its own. That is not decoration: the
 * grid is the only place all ten are seen together, and somebody looking for
 * the one they used last remembers it as a colour before they remember it as a
 * name. The two numbers are set larger than the name above them for the same
 * reason — they are what actually distinguishes ten methods from each other.
 *
 * The XP chip says what a full cycle of that style is worth *toward the day's
 * focus goal*, not a payout: nothing on this page mints XP, and a method that
 * paid more for the same work would make the ledger a function of a dropdown.
 * See the note on LEVELS in ./pomodoro.
 */
import type { ReactElement } from 'react';
import { STYLES, cycleMinutes, focusShare, type IconName, type Style } from './pomodoro';

/** One path set per glyph. Small, so ten of them cost nothing. */
const ICONS: Record<IconName, ReactElement> = {
  leaf: <path d="M4 20c0-8 5-13 16-14 0 11-5 16-13 16H4Zm3-3c3-4 6-6 10-8" />,
  bolt: <path d="M13 3 5 14h6l-1 7 8-11h-6l1-7Z" />,
  rocket: (
    <>
      <path d="M12 3c4 2 6 6 6 11l-3 3H9l-3-3c0-5 2-9 6-11Z" />
      <circle cx="12" cy="10" r="2" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10 1.4 1.4m0-12.8-1.4 1.4m-10 10-1.4 1.4" />
    </>
  ),
  star: <path d="m12 4 2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.6-.8L12 4Z" />,
  book: (
    <>
      <path d="M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z" />
      <path d="M17 7h2v13H8" />
    </>
  ),
  atom: (
    <>
      <circle cx="12" cy="12" r="2" />
      <ellipse cx="12" cy="12" rx="10" ry="4.2" />
      <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(60 12 12)" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  wave: <path d="M3 14c2.5 0 2.5-5 5-5s2.5 5 5 5 2.5-5 5-5 2.5 5 3 5" />,
};

function Glyph({ name }: { name: IconName }) {
  return (
    <span className="pom-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
        strokeLinecap="round" strokeLinejoin="round">
        {ICONS[name]}
      </svg>
    </span>
  );
}

/** The two figures that define a style, sized to be read before the name. */
export function Numbers({ focus, rest }: { focus: number; rest: number }) {
  return (
    <span className="pom-nums">
      <span className="pom-num">
        <b>{focus}</b>
        <i>work</i>
      </span>
      <span className="pom-num is-rest">
        <b>{rest}</b>
        <i>break</i>
      </span>
    </span>
  );
}

export interface StyleGridProps {
  current: string;
  onPick: (styleId: string) => void;
  /** Show the first eight, with a link for the rest. */
  compact?: boolean;
  limit?: number;
}

export function StyleGrid({ current, onPick, limit }: StyleGridProps) {
  const shown: Style[] = limit ? STYLES.slice(0, limit) : STYLES;
  return (
    <ul className="pom-grid">
      {shown.map((style) => {
        const on = style.id === current;
        return (
          <li key={style.id}>
            <button
              type="button"
              className={`pom-card pom-tone-${style.tone}${on ? ' is-on' : ''}`}
              aria-pressed={on}
              onClick={() => onPick(style.id)}
            >
              <span className="pom-card-head">
                <Glyph name={style.icon} />
                <span className="pom-card-name">{style.name}</span>
              </span>
              <Numbers focus={style.focus} rest={style.rest} />
              <span className="pom-card-who">{style.who}</span>
              <span className="pom-card-foot">
                <span className="pom-chip is-xp">
                  {Math.round(cycleMinutes(style) / 15)} XP
                </span>
                <span className="pom-chip">{focusShare(style)}% work</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
