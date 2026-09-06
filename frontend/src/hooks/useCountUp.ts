/**
 * A number that travels to its new value instead of jumping to it.
 *
 * The dashboard re-reads everything from the server after a task is completed,
 * so its figures do not creep — they are replaced. Tasks 3/7 becomes 4/7 and
 * 43% becomes 57% between one frame and the next, which is fast enough to be
 * missed entirely: the reader looks up, the page is already different, and
 * nothing tells them which number moved. Tweening the last leg is what turns a
 * replacement into a change they can see happen.
 *
 * Feed it the value **at the precision it is displayed**, not the raw one —
 * `Math.round(hours * 10) / 10` for a figure shown to one decimal. The hook
 * animates whenever its input changes, so a raw value that ticks every second
 * behind a display that only moves every six minutes would keep it running for
 * nothing.
 *
 * ## The first paint does not animate, and that is the point
 *
 * It used to count up from zero, on the reasoning that there was no earlier
 * number on screen to travel from. There is not — but zero is not "no number",
 * it is a *wrong* number, and for the six hundred milliseconds of the tween it
 * is the only one the reader has. Caught mid-flight on this dashboard:
 *
 *     Current Streak   0 days     (5)
 *     Best Streak      8 days     (152)
 *     Today's Progress 1%         (30%)
 *     Overdue          1          (26)
 *     Open             305        (5,441)
 *
 * "Current Streak: 0 days" is the single worst sentence a streak app can show
 * somebody who has a streak, and it is what this app said to every returning
 * user for the first half-second of every visit. A figure that is briefly
 * wrong is worse than a figure that does not move, because the reader cannot
 * tell which one they are looking at.
 *
 * So: land on the value the first time, and tween every change after it. That
 * keeps the thing the tween was actually for — a task completed, 3/7 becoming
 * 4/7 while you watch — and drops the part that was only decoration. The page
 * still assembles itself on arrival; `pg-enter` does that, and it does it
 * without asserting anything false about the numbers.
 *
 * Nothing animates at all under `prefers-reduced-motion`: the value is simply
 * the value, from the first render onwards.
 *
 * ## Nor on a page nobody is looking at
 *
 * The tween is a `requestAnimationFrame` loop, and a browser does not run one
 * for a hidden tab. A figure that changed while the tab was in the background
 * therefore never travelled — the loop was scheduled and never called — and
 * the reader came back to a number frozen wherever it had got to, which on
 * this dashboard meant "Completed 2" over a list with four ticks in it.
 *
 * That is exactly the failure the note above is about: a figure that is wrong
 * is worse than one that does not move. So a change that arrives while the
 * page is hidden lands rather than travels, and coming back to the tab is
 * checked as well — a tween interrupted halfway by the tab being hidden
 * finishes the moment it is looked at again, instead of waiting for the next
 * change to correct it.
 */
import { useEffect, useRef, useState } from 'react';
import { reduced } from '@/utils/homePlay';

/** Long enough to be followed, short enough not to be waited on. */
const DURATION = 650;

export function useCountUp(value: number, duration = DURATION): number {
  const [shown, setShown] = useState(value);
  // What is on screen right now. A ref as well as state because a run that is
  // interrupted by a newer value has to start from where it got to, and the
  // effect that starts the new run cannot see the state from the render that
  // scheduled it.
  const current = useRef(shown);
  const frame = useRef<number | null>(null);
  // The first value this hook is given is the truth arriving, not a change to
  // it. See the note above.
  const arrived = useRef(false);

  useEffect(() => {
    // Nothing to travel from, nothing to travel for, or nobody watching.
    if (reduced || !arrived.current || current.current === value || document.hidden) {
      arrived.current = true;
      current.current = value;
      setShown(value);
      return;
    }

    const from = current.current;
    const distance = value - from;
    let started: number | null = null;

    function step(now: number) {
      if (started === null) started = now;
      const progress = Math.min(1, (now - started) / duration);
      // Decelerating, so the figure arrives at its new value rather than
      // stopping at it.
      const eased = 1 - Math.pow(1 - progress, 3);

      current.current = progress === 1 ? value : from + distance * eased;
      setShown(current.current);
      frame.current = progress < 1 ? requestAnimationFrame(step) : null;
    }

    frame.current = requestAnimationFrame(step);

    /* A tab hidden mid-flight pauses the loop wherever it was. Landing on
       `visibilitychange` means the reader never finds a half-travelled figure
       waiting for them — and it is a no-op in the normal case, because a
       finished run has already set `current` to `value`. */
    const land = () => {
      if (!document.hidden || current.current === value) return;
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
        frame.current = null;
      }
      current.current = value;
      setShown(value);
    };
    document.addEventListener('visibilitychange', land);

    return () => {
      document.removeEventListener('visibilitychange', land);
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
        frame.current = null;
      }
    };
  }, [value, duration]);

  return shown;
}
