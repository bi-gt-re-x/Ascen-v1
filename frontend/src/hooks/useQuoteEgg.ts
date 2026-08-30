/**
 * The hidden quote — ten clicks on the line at the foot of the dashboard.
 *
 * Click the day's quote ten times in the dark and it slips away, replaced for
 * the rest of the day by a cryptic clue. The swap is sleek: the old line
 * glides out, the new one rises in with an ominous glow, the rest of the
 * screen goes dark for a beat, and the whole page shakes. Each of the nine
 * clicks before it answers on its own — the line pops, and the screen wobbles
 * a little harder each time — so the tenth is plainly the end of something
 * that has been building.
 *
 * ## Why the quote, and not the logo
 *
 * It used to be the nav logo, in frontend/secret/easter-egg.js, which this
 * replaces. That had a cost the clue was not worth: the logo is the link home,
 * so counting clicks on it meant cancelling the navigation the reader asked
 * for, and the dark-mode gate existed mainly to keep that hijack out of the
 * light. The quote is not a link and never was, so the clicks cost nothing —
 * and the landing page's own way in (frontend/secret/quote-egg.js) is ten
 * clicks on a quote too, which makes the two doors one idea instead of two.
 *
 * The dark-mode gate stays regardless, because the whole hidden chain lives in
 * the dark: frontend/secret/pentagon-egg.js checks the same thing before the
 * next clue will wake up.
 *
 * ## Where the theatre lives
 *
 * The animation classes go on the element by hand rather than through
 * `className`, and that is deliberate on both counts. Restarting a CSS
 * animation needs the class removed, the layout flushed and the class added
 * again — `void el.offsetWidth` between the two — which is not something a
 * render pass can express. And because React is given no `className` for the
 * quote element at all (see components/Dashboard/DailyQuote.tsx), it never
 * touches the class attribute, so the two never fight over it. What React does
 * own is the text and the container's classes, which change once and stay.
 *
 * The styles are the HIDDEN QUOTE EASTER EGG block in styles/dashboard.css.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { earnedTitle, markUnlockedToday, unlockedToday } from '@/utils/easterEgg';

/** What the day's quote is replaced by. The pentagon is on the landing page. */
const CLUE = '"The pentagon is the key, find it" -Mysterious,,';

/** Clicks to unlock. */
const NEEDED = 10;

/* The reveal's beats, in ms. SLIDE_OUT matches the transition on #dailyQuote
   in styles/dashboard.css; the rest are measured from the swap. */
const SLIDE_OUT = 560;
const SHAKE_ENDS = 900;
const RISE_ENDS = 1050;
const SCRIM_LIFTS = 2400;
const SPOTLIGHT_ENDS = 3350;

/** How long a per-click wobble runs before the page is let still again. */
const WOBBLE = 340;

export interface UseQuoteEgg {
  /** The clue, once the egg owns the line; null while the daily quote does. */
  clue: string | null;
  /** Classes for `.quote-container` — the ominous dress, and the spotlight. */
  containerClass: string;
  /** Put this on the quote element; the egg drives its classes directly. */
  quoteRef: React.RefObject<HTMLParagraphElement | null>;
  /** The ten clicks land here. */
  onQuoteClick: () => void;
}

/** The whole hidden chain only lives in the dark. */
function isDark(): boolean {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

export function useQuoteEgg(): UseQuoteEgg {
  const quoteRef = useRef<HTMLParagraphElement>(null);
  const [clue, setClue] = useState<string | null>(null);
  const [spotlight, setSpotlight] = useState(false);

  /* Not state: the count is read and written inside one click and never
     rendered, so putting it in state would re-render the dashboard nine times
     to show nothing. */
  const clicks = useRef(0);

  /* Every timer this hook starts, so unmounting mid-reveal does not leave
     callbacks writing classes onto a page that has navigated away. */
  const timers = useRef<number[]>([]);
  const after = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  useEffect(() => {
    const started = timers.current;
    return () => {
      started.forEach(window.clearTimeout);
      /* The body and root carry the shake. They outlive this component, so
         anything left on them would follow the reader to the next page. */
      document.body.classList.remove('easter-wobble', 'easter-shake');
      document.documentElement.classList.remove('easter-shake-clip');
      document.getElementById('easterDark')?.remove();
    };
  }, []);

  /* On arrival: the clue is retired once the chain has paid out, and shown
     straight away — no theatrics — if it was already found today. */
  useEffect(() => {
    if (earnedTitle()) return;
    if (unlockedToday()) setClue(CLUE);
  }, []);

  /** The line's own answer to a click: a bounce that grows with the count. */
  const pop = useCallback((n: number) => {
    const el = quoteRef.current;
    if (!el) return;
    el.style.setProperty('--pop', (1.06 + n * 0.02).toFixed(2));
    el.classList.remove('easter-pop');
    void el.offsetWidth; // restart the animation
    el.classList.add('easter-pop');
  }, []);

  /**
   * A per-click wobble whose amplitude climbs with the count — click 1 is a
   * faint nudge, click 9 a hard shake. The root is clipped while it plays so
   * the offsets never surface a scrollbar.
   */
  const wobble = useCallback(
    (n: number) => {
      const root = document.documentElement;
      root.style.setProperty('--wob', `${n * 2.5}px`);
      root.style.setProperty('--wob-rot', `${n * 0.28}deg`);
      root.classList.add('easter-shake-clip');
      document.body.classList.remove('easter-wobble');
      void document.body.offsetWidth; // restart the animation
      document.body.classList.add('easter-wobble');
      after(WOBBLE, () => {
        document.body.classList.remove('easter-wobble');
        root.classList.remove('easter-shake-clip');
      });
    },
    [after],
  );

  /** The tenth click: out with the day's quote, in with the clue. */
  const reveal = useCallback(() => {
    markUnlockedToday();

    /* A full-viewport scrim, so the rest of the page can go dark while the
       quote stays lit. It is appended to the body rather than rendered because
       it covers the whole document, not the dashboard's corner of it. */
    let dark = document.getElementById('easterDark');
    if (!dark) {
      dark = document.createElement('div');
      dark.id = 'easterDark';
      dark.setAttribute('aria-hidden', 'true');
      document.body.appendChild(dark);
    }
    const scrim = dark;

    // 1) Sleek slide-out of the current quote.
    document.body.classList.remove('easter-wobble');
    quoteRef.current?.classList.add('quote-slide-out');

    after(SLIDE_OUT, () => {
      const el = quoteRef.current;

      /* 2) Swap in the clue, dressed ominously and lifted above the scrim.
            `flushSync` because the next three lines are animation restarts
            that have to run against the *new* text: left to batch, React would
            paint the rise-in on the old line and swap it a frame later. */
      flushSync(() => {
        setClue(CLUE);
        setSpotlight(true);
      });
      el?.classList.remove('quote-slide-out');

      // 3) The rest of the screen turns dark.
      void scrim.offsetWidth;
      scrim.classList.add('show');

      // 4) The biggest shake yet, and the ominous rise-in.
      if (el) {
        void el.offsetWidth;
        el.classList.add('quote-slide-in');
      }
      document.documentElement.classList.add('easter-shake-clip');
      document.body.classList.remove('easter-wobble');
      void document.body.offsetWidth;
      document.body.classList.add('easter-shake');

      after(SHAKE_ENDS, () => {
        document.body.classList.remove('easter-shake');
        document.documentElement.classList.remove('easter-shake-clip');
      });
      after(RISE_ENDS, () => quoteRef.current?.classList.remove('quote-slide-in'));

      /* 5) Hold the darkness a beat, then lift it — leaving the clue glowing
            in the restored dashboard. */
      after(SCRIM_LIFTS, () => scrim.classList.remove('show'));
      after(SPOTLIGHT_ENDS, () => {
        setSpotlight(false);
        scrim.remove();
      });
    });
  }, [after]);

  const onQuoteClick = useCallback(() => {
    /* Nothing to find: the clue is out for today, or the chain has already
       paid out its title. Either way the line is just a line. */
    if (clue || earnedTitle()) return;
    // In the light it is a line too. The count does not survive the trip.
    if (!isDark()) {
      clicks.current = 0;
      return;
    }
    clicks.current += 1;
    if (clicks.current >= NEEDED) {
      clicks.current = 0;
      reveal();
    } else {
      pop(clicks.current); // the line bounces…
      wobble(clicks.current); // …and the screen shakes harder each time
    }
  }, [clue, pop, reveal, wobble]);

  const containerClass =
    (clue ? ' quote-ominous' : '') + (spotlight ? ' quote-spotlight' : '');

  return { clue, containerClass, quoteRef, onQuoteClick };
}
