/**
 * What every demo on the landing page needs — the port of frontend/js/home-play.js.
 *
 * The demos (the dashboard mock, the task list, the calendar, the charts) all
 * work the same way: they sit still until the reader scrolls to them, run once,
 * and hold their finished state. Scroll away and back and they run again, from
 * the beginning.
 *
 * Everything here is cancellable, and that is the point. A reader who scrolls
 * past a half-played demo and comes back must see it start cleanly, not catch
 * the tail of the last run.
 *
 * The original hung this off `window.HomePlay` because the landing page had no
 * module system. It is a module now, and `useInViewPlay` below is the piece
 * that changed shape: an IntersectionObserver wired to an element ref, torn
 * down with the component rather than living as long as the page.
 */
import { useEffect, useRef, type RefObject } from 'react';

/** Whether the reader has asked for less motion. Read once, like the original. */
export const reduced =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface Timeline {
  at(ms: number, fn: () => void): Timeline;
  cancel(): void;
}

/**
 * A list of callbacks at millisecond offsets, all of which can be called off at
 * once. `at(0, fn)` still defers by a tick, so a timeline is always
 * asynchronous whatever offsets it is given — a demo that ran its first step
 * synchronously and the rest later would be hard to reason about.
 */
export function timeline(): Timeline {
  let timers: ReturnType<typeof setTimeout>[] = [];
  const api: Timeline = {
    at(ms, fn) {
      timers.push(setTimeout(fn, ms));
      return api;
    },
    cancel() {
      timers.forEach(clearTimeout);
      timers = [];
    },
  };
  return api;
}

export interface Counter {
  cancel(): void;
  finish(): void;
}

interface CountOptions {
  duration?: number;
  format?: (value: number) => string;
}

/**
 * Climbs a number through a series of waypoints — 0 → 75 → 220 → 500 — easing
 * into and out of each one, so it reads as a figure being counted up in stages
 * rather than a single sweep. Each leg gets an equal share of the time
 * regardless of how far it travels, which is what makes the small early steps
 * feel deliberate.
 */
export function countThrough(
  el: HTMLElement | null,
  stops: number[],
  options: CountOptions = {},
): Counter {
  const noop = { cancel() {}, finish() {} };
  if (!el) return noop;

  const total = options.duration ?? 1600;
  const format = options.format ?? ((v: number) => String(Math.round(v)));
  const set = (v: number) => {
    el.textContent = format(v);
  };

  // `stops` comes from the caller, so both ends are proved once here rather
  // than re-asserted at every index below.
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (first === undefined || last === undefined) return noop;

  if (reduced || stops.length < 2) {
    set(last);
    return noop;
  }

  const legs = stops.length - 1;
  const legMs = total / legs;
  let frame: number | null = null;
  let t0: number | null = null;

  function step(now: number) {
    if (t0 === null) t0 = now;
    const elapsed = now - t0;
    if (elapsed >= total) {
      set(last as number);
      frame = null;
      return;
    }
    const leg = Math.min(legs - 1, Math.floor(elapsed / legMs));
    const p = (elapsed - leg * legMs) / legMs;
    const from = stops[leg] ?? (last as number);
    const to = stops[leg + 1] ?? (last as number);
    // Ease in and out of every waypoint, so each one is a beat.
    const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    set(from + (to - from) * eased);
    frame = requestAnimationFrame(step);
  }

  set(first);
  frame = requestAnimationFrame(step);

  return {
    cancel() {
      if (frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
      }
    },
    finish() {
      this.cancel();
      set(last);
    },
  };
}

/**
 * Two frames of breathing room.
 *
 * Every demo arms itself with a class, paints, and only then unarms so the CSS
 * transitions have something to move from. One frame is not enough — the paint
 * has been scheduled but not done — which is why the original nests two
 * requestAnimationFrame calls everywhere and why this exists rather than being
 * written out eight times.
 */
export function afterPaint(fn: () => void): () => void {
  let inner = 0;
  const outer = requestAnimationFrame(() => {
    inner = requestAnimationFrame(fn);
  });
  return () => {
    cancelAnimationFrame(outer);
    if (inner) cancelAnimationFrame(inner);
  };
}

export interface PlaySpec {
  /** Run the demo forward. */
  play?: () => void;
  /** Put it back to its opening frame. */
  reset?: () => void;
  /** The finished state, painted at once, for `prefers-reduced-motion`. */
  still?: () => void;
  threshold?: number;
}

/**
 * Runs `spec.play` when the element scrolls into view and `spec.reset` when it
 * leaves, so the demo is always either playing forward or back at its start —
 * never stuck halfway.
 *
 * `spec` is read through a ref rather than being a dependency, so a demo whose
 * callbacks close over fresh state does not tear down and rebuild its observer
 * on every render. The observer's lifetime is the element's.
 */
export function useInViewPlay(
  ref: RefObject<HTMLElement | null>,
  spec: PlaySpec,
): void {
  const latest = useRef(spec);
  latest.current = spec;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Called through the ref, never destructured: the observer outlives the
    // render that created it, and the callbacks it fires must be the current
    // ones, not the first ones.
    if (reduced || !('IntersectionObserver' in window)) {
      if (latest.current.still) latest.current.still();
      else latest.current.play?.();
      return;
    }

    let playing = false;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (playing) return;
            playing = true;
            latest.current.reset?.();
            latest.current.play?.();
          } else if (playing) {
            playing = false;
            latest.current.reset?.();
          }
        });
      },
      { threshold: latest.current.threshold ?? 0.35 },
    );

    io.observe(el);
    return () => {
      io.disconnect();
      // Leaving the page mid-run must not leave timers behind: the demo's own
      // reset is what owns them, so it runs on unmount too.
      latest.current.reset?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);
}
