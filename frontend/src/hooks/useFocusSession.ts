/**
 * The focus session — the port of focus.js.
 *
 * Elapsed time is **timestamp-based**, and that is the whole design. Starting
 * a session records `runningSince` (epoch ms); the focused total is
 * `accumulatedSeconds + (now - runningSince)`. Nothing counts ticks, so a
 * session keeps running while the tab is hidden, the laptop is shut or the
 * browser is closed, and a display that was not updating catches up the moment
 * anyone looks at it. Stopping banks the segment into `accumulatedSeconds` and
 * clears `runningSince`.
 *
 * State lives in localStorage under `focus:<user>:<date>` — so a session
 * started on the dashboard is visible on the calendar's Focus card without
 * either of them talking to the other.
 *
 * **`html.focus-mode` is set here**, and that is new. A running session is
 * supposed to clear the page down to the work: the dashboard folds its
 * greeting, its stat cards, its summary row and its quote away and leaves the
 * Focus panel over the task list. That clearing-away is a preference now
 * (Settings, Focus): turned off, the timer runs and the page stays where it
 * was. Every one of those rules was written and none
 * of them ever fired, because the class they hang off was set by
 * focus-theme.js — a vanilla file deleted with the rest of the old front end —
 * and what replaced it was a `focusmodechange` event dispatched to nobody.
 * Starting a session therefore did nothing but change a button's label. The
 * class is a fact about the session, so it is set by the thing that owns the
 * session.
 *
 * It is deliberately not removed on unmount. The class describes the account's
 * day and not this component's lifetime: navigating from the dashboard to the
 * calendar mid-session must not undim the app, and the next page to mount the
 * hook re-states it either way.
 *
 * The server copy is a mirror, not the truth: `syncDay` never lowers a day's
 * recorded total, so syncing too often or with a stale value is harmless.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { focus as focusService } from '@/services';
import { MAX_GOAL_HOURS, MIN_GOAL_HOURS } from '@/services/constants';

/** How often a running session mirrors itself to the server. */
const SYNC_MS = 60_000;
/** How often the display re-reads the clock while running. */
const TICK_MS = 1000;

export interface FocusState {
  /**
   * The goal this day was given, or null for one that has not been given one.
   *
   * The distinction is the whole reason it is nullable. A day with no goal of
   * its own follows the account's default, so changing that default in Settings
   * moves today as well as tomorrow — while a day the reader has actually set a
   * goal on keeps it, which is what setting it meant.
   */
  goalHours: number | null;
  accumulatedSeconds: number;
  /** Epoch ms the current segment began, or null when stopped. */
  runningSince: number | null;
}

function todayStr(): string {
  const d = new Date();
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function storageKey(user: string): string {
  return `focus:${user}:${todayStr()}`;
}

function load(user: string): FocusState {
  let raw: Partial<FocusState> = {};
  try {
    raw = JSON.parse(
      localStorage.getItem(storageKey(user)) || '{}',
    ) as Partial<FocusState>;
  } catch {
    raw = {};
  }
  return {
    goalHours:
      typeof raw.goalHours === 'number' && !Number.isNaN(raw.goalHours)
        ? raw.goalHours
        : null,
    accumulatedSeconds:
      typeof raw.accumulatedSeconds === 'number' ? raw.accumulatedSeconds : 0,
    runningSince:
      typeof raw.runningSince === 'number' ? raw.runningSince : null,
  };
}

function save(user: string, state: FocusState): void {
  try {
    localStorage.setItem(storageKey(user), JSON.stringify(state));
  } catch {
    /* private mode: the session is just not remembered across reloads */
  }
}

/** Total focused seconds, banked plus whatever the running segment has run. */
export function focusedSeconds(state: FocusState): number {
  const live = state.runningSince
    ? Math.max(0, (Date.now() - state.runningSince) / 1000)
    : 0;
  return state.accumulatedSeconds + live;
}

/** "1h 30m" — the format the focus panel and the calendar both print. */
export function fmtHM(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export interface UseFocusSession {
  goalHours: number;
  focused: number;
  percent: number;
  running: boolean;
  start: () => void;
  stop: () => void;
  setGoalHours: (hours: number) => void;
}

export function useFocusSession(username: string | null): UseFocusSession {
  const user = username || 'Default';
  const { prefs } = useSettings();
  const [state, setState] = useState<FocusState>(() => load(user));
  /** This day's own goal, or the account's default for a day without one. */
  const goalHours = state.goalHours ?? prefs.focus_goal_hours;
  // Bumped on a tick so the derived figures re-read the clock. The state
  // itself does not change while running — that is the point of timestamps.
  const [, setTick] = useState(0);
  const latest = useRef(state);
  latest.current = state;

  // Re-read when the account changes, or the panel would show the last
  // account's day.
  useEffect(() => {
    setState(load(user));
  }, [user]);

  const write = useCallback(
    (next: FocusState) => {
      save(user, next);
      setState(next);
    },
    [user],
  );

  // The resolved goal, for the mirror to the server: a day following the
  // account's default still has a goal, it just does not have one of its own.
  const goal = useRef(goalHours);
  goal.current = goalHours;

  const sync = useCallback(() => {
    if (!username) return;
    const s = latest.current;
    void focusService
      .syncDay(todayStr(), Math.round(focusedSeconds(s)), goal.current)
      .catch(() => {
        /* offline — the next sync retries, and the server never lowers a total */
      });
  }, [username]);

  const running = state.runningSince !== null;

  // What every "while focusing" rule in the stylesheets keys off. See the note
  // at the top for why it is set here and why it is never cleaned up. Turning
  // the preference off has to take the class with it, which is why it is a
  // dependency and not a guard on the way in.
  useEffect(() => {
    document.documentElement.classList.toggle('focus-mode', running && prefs.focus_dim);
  }, [prefs.focus_dim, running]);

  // While running: re-render every second, and mirror to the server every minute.
  useEffect(() => {
    if (!running) return;
    const ticker = setInterval(() => setTick((n) => n + 1), TICK_MS);
    const syncer = setInterval(sync, SYNC_MS);
    return () => {
      clearInterval(ticker);
      clearInterval(syncer);
    };
  }, [running, sync]);

  // A tab coming back into view has time to catch up on, and a tab going away
  // is the last chance to bank what it knows.
  useEffect(() => {
    function onVisible() {
      if (!document.hidden) setTick((n) => n + 1);
    }
    function onLeave() {
      if (latest.current.runningSince) sync();
    }
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pagehide', onLeave);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pagehide', onLeave);
    };
  }, [sync]);

  const start = useCallback(() => {
    const s = latest.current;
    if (s.runningSince) return;
    // The `focusmodechange` event that used to be dispatched here is gone with
    // the last thing that listened for it. `running` changing is the signal,
    // and the effect above is what acts on it.
    write({ ...s, runningSince: Date.now() });
  }, [write]);

  const stop = useCallback(() => {
    const s = latest.current;
    if (!s.runningSince) return;
    const banked =
      s.accumulatedSeconds + Math.max(0, (Date.now() - s.runningSince) / 1000);
    write({ ...s, accumulatedSeconds: banked, runningSince: null });
    sync();
  }, [write, sync]);

  const setGoalHours = useCallback(
    (hours: number) => {
      const clamped = Math.max(MIN_GOAL_HOURS, Math.min(MAX_GOAL_HOURS, hours));
      write({ ...latest.current, goalHours: clamped });
    },
    [write],
  );

  const focused = focusedSeconds(state);
  const goalSec = goalHours * 3600;
  const percent =
    goalSec > 0 ? Math.min(100, Math.round((focused / goalSec) * 100)) : 0;

  return {
    goalHours,
    focused,
    percent,
    running,
    start,
    stop,
    setGoalHours,
  };
}
