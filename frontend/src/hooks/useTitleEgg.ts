/**
 * The hidden chain's front door — ten clicks on the title in the rail's foot.
 *
 * Nothing at all for the first three, so a reader who taps their own rank
 * twice out of idleness never learns there is anything there. From the fourth
 * the title trembles, and the screen trembles with it, both harder each time.
 * The tenth marks the day unlocked and sends the reader to the dashboard,
 * where the quote does the rest — see hooks/useQuoteEgg.ts.
 *
 * ## Why the door and the room are in different components
 *
 * The rail is mounted outside the router and never unmounts, so it is the one
 * thing on screen wherever you are; the quote it replaces is on the dashboard
 * only. That gap is the whole design of this file. The tenth click cannot
 * assume the quote is mounted, so it does not: it writes the unlock, arms the
 * latch in utils/easterEgg.ts, navigates, and announces itself for the case
 * where the reader was already looking at the dashboard. Whichever of the two
 * arrives first, exactly one reveal plays.
 *
 * The dark-mode gate is the chain's, not this file's: the pentagon in
 * frontend/secret/pentagon-egg.js checks the same thing before the next clue
 * will wake up, so a chain half-open in the light would dead-end.
 *
 * The tremble itself is `.rail-rank-title.title-tremble` in styles/rail.css;
 * the screen's is the wobble the quote's reveal uses, in styles/dashboard.css.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  EGG_UNLOCKED,
  armReveal,
  earnedTitle,
  markUnlockedToday,
  unlockedToday,
} from '@/utils/easterEgg';

/** Clicks to unlock. */
const NEEDED = 10;

/**
 * Clicks that do nothing at all.
 *
 * Three, because two is inside the range of an accidental double-click and
 * four is enough clicks that somebody who meant them has already stopped. The
 * silence is the point: a secret that answers the first click is a button.
 */
const SILENT = 3;

/** How long a tremble runs before the page is let still again. */
const TREMBLE = 340;

export interface UseTitleEgg {
  /** Put this on the rail's title. */
  titleRef: React.RefObject<HTMLSpanElement | null>;
  /** The ten clicks land here. */
  onTitleClick: () => void;
}

/** The whole hidden chain only lives in the dark. */
function isDark(): boolean {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

export function useTitleEgg(): UseTitleEgg {
  const titleRef = useRef<HTMLSpanElement>(null);
  const navigate = useNavigate();

  /* Not state: the count is read and written inside one click and never
     rendered, so putting it in state would re-render the whole rail nine
     times to show nothing. */
  const clicks = useRef(0);

  const timers = useRef<number[]>([]);
  useEffect(() => {
    const started = timers.current;
    return () => {
      started.forEach(window.clearTimeout);
      document.body.classList.remove('easter-wobble');
      document.documentElement.classList.remove('easter-shake-clip');
    };
  }, []);

  /**
   * Click n of ten, from the fourth. Both amplitudes are measured from the
   * first click that shows anything, so the fourth is a twitch rather than
   * arriving already a third of the way up the scale.
   */
  const tremble = useCallback((n: number) => {
    const felt = n - SILENT;

    const title = titleRef.current;
    if (title) {
      title.style.setProperty('--tremble', `${(felt * 0.6).toFixed(2)}px`);
      title.classList.remove('title-tremble');
      void title.offsetWidth; // restart the animation
      title.classList.add('title-tremble');
    }

    const root = document.documentElement;
    root.style.setProperty('--wob', `${(felt * 2.2).toFixed(2)}px`);
    root.style.setProperty('--wob-rot', `${(felt * 0.24).toFixed(2)}deg`);
    root.classList.add('easter-shake-clip');
    document.body.classList.remove('easter-wobble');
    void document.body.offsetWidth; // restart the animation
    document.body.classList.add('easter-wobble');

    timers.current.push(
      window.setTimeout(() => {
        document.body.classList.remove('easter-wobble');
        root.classList.remove('easter-shake-clip');
        title?.classList.remove('title-tremble');
      }, TREMBLE),
    );
  }, []);

  const onTitleClick = useCallback(() => {
    /* Nothing to find: the clue is out for today, or the chain has already
       paid out its title. Either way the rank is just a rank. */
    if (unlockedToday() || earnedTitle()) return;
    // In the light it is a rank too. The count does not survive the trip.
    if (!isDark()) {
      clicks.current = 0;
      return;
    }

    clicks.current += 1;
    if (clicks.current < NEEDED) {
      if (clicks.current > SILENT) tremble(clicks.current);
      return;
    }

    clicks.current = 0;
    markUnlockedToday();
    armReveal();
    /* The order matters. Navigating first means a dashboard that has to mount
       finds the latch already armed; announcing after means a dashboard that
       was already open — where the navigation is a no-op and nothing
       remounts — hears about it. Exactly one of the two claims the latch. */
    navigate('/dashboard');
    window.dispatchEvent(new CustomEvent(EGG_UNLOCKED));
  }, [navigate, tremble]);

  return { titleRef, onTitleClick };
}
