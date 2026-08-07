/**
 * Open the time grid on the hour it actually is.
 *
 * The Week and Day views draw a 23-hour day at 72px an hour and a window shows
 * perhaps eight of them, so where the grid starts is a real choice — and 6 AM
 * is the wrong one. A reader arriving at four in the afternoon got the morning
 * they had already had and had to scroll to find themselves; the now line is
 * what they came for. Both views therefore land on it, and both put it in the
 * middle rather than at the top, so the next hour or two is on screen as well
 * as the last one.
 *
 * **Once**, on arrival. After that the scroll belongs to the reader and nothing
 * here takes it back. That used to be impossible to promise: every write
 * re-read the account, the view went back through its loading state, and a
 * fresh scroller started wherever it liked — which is why the Week view used to
 * carry a scroll position across the remount by hand. Writes no longer re-read
 * (hooks/useCalendarTasks), so there is no remount to survive, and this fires
 * on entry and then leaves the grid alone. `center` is returned so "Today" can
 * ask for the same landing on purpose.
 *
 * ## Why the frame wait
 *
 * The scroller is sized by the layout around it, and that is not resolved on
 * the commit that mounts it: measured on that tick the window is a few pixels
 * tall, so "the middle of it" comes out as the top and the now line opens flush
 * against the ceiling with nothing above it. `place` therefore waits for a
 * frame in which the box has a real height before it does the arithmetic, and
 * gives up after a few rather than looping forever on a view that is never
 * going to be laid out.
 */
import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { HOUR_H, nowOffset } from '@/utils/calendarGrid';

/** Frames to wait for a laid-out scroller before giving up. */
const MAX_FRAMES = 10;

export function useNowScroll(
  scroller: RefObject<HTMLElement | null>,
  /** True once the grid is on the page and the day it shows is today. */
  ready: boolean,
): () => void {
  const center = useCallback(() => {
    let frames = 0;
    const place = () => {
      const box = scroller.current;
      const top = nowOffset(new Date());
      // Between 5 and 6 in the morning "now" is off both ends of the window,
      // and the top of the grid is already the nearest thing to it.
      if (!box || top === null) return;
      if (box.clientHeight < HOUR_H && frames < MAX_FRAMES) {
        frames += 1;
        requestAnimationFrame(place);
        return;
      }
      box.scrollTop = Math.max(0, top - box.clientHeight / 2);
    };
    requestAnimationFrame(place);
  }, [scroller]);

  const landed = useRef(false);
  useEffect(() => {
    if (landed.current || !ready) return;
    landed.current = true;
    center();
  }, [center, ready]);

  return center;
}
