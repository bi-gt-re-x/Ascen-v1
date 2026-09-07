/**
 * The pomodoro cycle: which phase, how long is left, and what to do when it ends.
 *
 * ## Timestamps, for the same reason useFocusSession uses them
 *
 * A running phase is stored as `endsAt` — the epoch millisecond it finishes —
 * and never as a number being counted down. Nothing here ticks toward
 * correctness; the interval below only re-renders, and every figure on screen
 * is derived from the clock at the moment it is read. So a tab left in the
 * background, a shut laptop or a refresh all come back to the right time
 * instead of to however many ticks the browser felt like delivering.
 *
 * Paused is the other half: `endsAt` is null and `leftMs` holds what remained.
 *
 * ## Catching up, and the limit on it
 *
 * Coming back to a phase that ended while you were away, the cycle is walked
 * forward until it lands somewhere still in the future — that is what makes
 * closing the tab mid-break harmless.
 *
 * It is walked forward at most `MAX_CATCH_UP` phases, and this is not a
 * performance guard. A pomodoro left running overnight would otherwise fast
 * forward through nine hours of alternating phases and hand the focus session
 * a night's sleep as focus time. Past that many missed phases the honest
 * reading is that nobody was here, so the timer pauses at the phase it reached
 * and waits to be told otherwise.
 *
 * ## The focus session is the record; this is the shape of it
 *
 * This hook keeps no time of its own. A running **focus** phase starts the
 * account's focus session and anything else stops it, so the hours banked here
 * are the same hours the dashboard's Focus card, the calendar and the analytics
 * pages read — a pomodoro run on this page is not a separate ledger, it is the
 * ordinary one with a structure over it. Both calls are no-ops when the session
 * is already in that state, which is what makes driving them from an effect
 * safe.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { UseFocusSession } from '@/hooks/useFocusSession';
import {
  DEFAULT_STYLE,
  lengthOf,
  next,
  styleFor,
  type Cycle,
  type Phase,
  type Style,
} from '@/components/Timer/pomodoro';

/** Phases walked through on return before the timer decides nobody is here. */
const MAX_CATCH_UP = 12;

/** How often the display re-reads the clock while running. */
const TICK_MS = 500;

interface Stored {
  styleId: string;
  phase: Phase;
  done: number;
  /** Epoch ms this phase ends, or null when paused. */
  endsAt: number | null;
  /** Milliseconds left, meaningful only while paused. */
  leftMs: number;
}

function key(user: string): string {
  return `pomodoro:${user}`;
}

function fresh(styleId: string): Stored {
  const style = styleFor(styleId);
  return {
    styleId: style.id,
    phase: 'focus',
    done: 0,
    endsAt: null,
    leftMs: style.focus * 60_000,
  };
}

function load(user: string): Stored {
  try {
    const raw = window.localStorage.getItem(key(user));
    if (!raw) return fresh(DEFAULT_STYLE);
    const saved = JSON.parse(raw) as Partial<Stored>;
    const style = styleFor(saved.styleId);
    const phase: Phase =
      saved.phase === 'break' || saved.phase === 'long' ? saved.phase : 'focus';
    return {
      styleId: style.id,
      phase,
      done: Number(saved.done) || 0,
      endsAt: typeof saved.endsAt === 'number' ? saved.endsAt : null,
      leftMs: Number(saved.leftMs) || lengthOf(style, phase) * 60_000,
    };
  } catch {
    // A private window, cleared site data, or a value from an older shape.
    return fresh(DEFAULT_STYLE);
  }
}

function save(user: string, state: Stored): void {
  try {
    window.localStorage.setItem(key(user), JSON.stringify(state));
  } catch {
    // Storage is a convenience here: the timer still runs for this visit.
  }
}

export interface UsePomodoro {
  style: Style;
  phase: Phase;
  /** Focus intervals finished in this cycle. */
  done: number;
  running: boolean;
  /** Seconds left in this phase. */
  remaining: number;
  /** How far through this phase, 0-100. */
  percent: number;
  start: () => void;
  pause: () => void;
  /** End this phase now and move to the next one, running. */
  skip: () => void;
  /** Back to the first focus interval, paused. */
  reset: () => void;
  choose: (styleId: string) => void;
}

export function usePomodoro(
  username: string | null,
  focus: UseFocusSession,
): UsePomodoro {
  const user = username || 'Default';
  const [state, setState] = useState<Stored>(() => load(user));
  const [, setTick] = useState(0);
  const latest = useRef(state);
  latest.current = state;

  const write = useCallback(
    (nextState: Stored) => {
      latest.current = nextState;
      setState(nextState);
      save(user, nextState);
    },
    [user],
  );

  // Re-read when the account changes, or this shows the last one's cycle.
  useEffect(() => {
    setState(load(user));
  }, [user]);

  /** Walk a finished phase forward. Returns the state to store. */
  const advance = useCallback((from: Stored, at: number): Stored => {
    const style = styleFor(from.styleId);
    let cycle: Cycle = { phase: from.phase, done: from.done };
    let endsAt = from.endsAt ?? at;
    let walked = 0;

    while (endsAt <= at && walked < MAX_CATCH_UP) {
      cycle = next(style, cycle);
      endsAt += lengthOf(style, cycle.phase) * 60_000;
      walked += 1;
    }

    if (endsAt <= at) {
      // Too much missed to believe anyone was here. See the note above.
      return {
        styleId: style.id,
        phase: cycle.phase,
        done: cycle.done,
        endsAt: null,
        leftMs: lengthOf(style, cycle.phase) * 60_000,
      };
    }
    return {
      styleId: style.id,
      phase: cycle.phase,
      done: cycle.done,
      endsAt,
      leftMs: endsAt - at,
    };
  }, []);

  // The clock. Re-renders while running, and rolls the phase over when one
  // ends — including the several that may have ended while the tab was away.
  useEffect(() => {
    if (!state.endsAt) return undefined;
    const id = window.setInterval(() => {
      const now = Date.now();
      const current = latest.current;
      if (current.endsAt && now >= current.endsAt) {
        write(advance(current, now));
      } else {
        setTick((n) => n + 1);
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [state.endsAt, advance, write]);

  // Catch up once on mount too, so a phase that ended while the page was
  // closed has already rolled over by the time anything is drawn.
  useEffect(() => {
    const current = latest.current;
    if (current.endsAt && Date.now() >= current.endsAt) {
      write(advance(current, Date.now()));
    }
    // Once, for the state this mounted with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const running = state.endsAt !== null;

  // The focus session follows the phase. Work runs it; a break and a pause
  // stop it, which banks the segment — see the note at the top.
  useEffect(() => {
    if (running && state.phase === 'focus') focus.start();
    else focus.stop();
  }, [running, state.phase, focus]);

  const style = styleFor(state.styleId);
  const total = lengthOf(style, state.phase) * 60_000;
  const leftMs = running
    ? Math.max(0, (state.endsAt as number) - Date.now())
    : state.leftMs;

  const start = useCallback(() => {
    const current = latest.current;
    if (current.endsAt) return;
    write({ ...current, endsAt: Date.now() + current.leftMs });
  }, [write]);

  const pause = useCallback(() => {
    const current = latest.current;
    if (!current.endsAt) return;
    write({
      ...current,
      endsAt: null,
      leftMs: Math.max(0, current.endsAt - Date.now()),
    });
  }, [write]);

  const skip = useCallback(() => {
    const current = latest.current;
    const now = Date.now();
    // Treated as a phase that has just ended, so one path decides what comes
    // next whether the clock got there or the reader did.
    write(advance({ ...current, endsAt: now }, now));
  }, [advance, write]);

  const reset = useCallback(() => {
    write(fresh(latest.current.styleId));
  }, [write]);

  const choose = useCallback(
    (styleId: string) => {
      // A new style is a new cycle: keeping the phase would leave somebody
      // three rounds into a method they have just stopped using.
      write(fresh(styleId));
    },
    [write],
  );

  return {
    style,
    phase: state.phase,
    done: state.done,
    running,
    remaining: leftMs / 1000,
    percent: total > 0 ? Math.min(100, Math.round(((total - leftMs) / total) * 100)) : 0,
    start,
    pause,
    skip,
    reset,
    choose,
  };
}
