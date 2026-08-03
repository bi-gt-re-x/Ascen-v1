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
 * The first paint counts up from zero. The dashboard arrives after a loading
 * state, so there is no earlier number on screen to travel from, and a page
 * that assembles itself in the moment it appears reads as alive rather than
 * as a screenshot.
 *
 * Nothing animates at all under `prefers-reduced-motion`: the value is simply
 * the value, from the first render onwards.
 */
import { useEffect, useRef, useState } from 'react';
import { reduced } from '@/utils/homePlay';

/** Long enough to be followed, short enough not to be waited on. */
const DURATION = 650;

export function useCountUp(value: number, duration = DURATION): number {
  const [shown, setShown] = useState(() => (reduced ? value : 0));
  // What is on screen right now. A ref as well as state because a run that is
  // interrupted by a newer value has to start from where it got to, and the
  // effect that starts the new run cannot see the state from the render that
  // scheduled it.
  const current = useRef(shown);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (reduced || current.current === value) {
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
    return () => {
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
        frame.current = null;
      }
    };
  }, [value, duration]);

  return shown;
}
