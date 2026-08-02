/**
 * The focus session — the port of frontend/js/focus.js.
 *
 * Elapsed time is **timestamp-based**, and that is the whole design. Starting
 * a session records `runningSince` (epoch ms); the focused total is
 * `accumulatedSeconds + (now - runningSince)`. Nothing counts ticks, so a
 * session keeps running while the tab is hidden, the laptop is shut or the
 * browser is closed, and a display that was not updating catches up the moment
 * anyone looks at it. Stopping banks the segment into `accumulatedSeconds` and
 * clears `runningSince`.
 *
 * State lives in localStorage under `focus:<user>:<date>`, which is the same
 * key the calendar's Focus card and focus-theme.js read — so a session started
 * on the dashboard is visible on the calendar and dims the whole app, without
 * any of them talking to each other.
 *
 * The server copy is a mirror, not the truth: `syncDay` never lowers a day's
 * recorded total, so syncing too often or with a stale value is harmless.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { focus as focusService } from '@/services';
import { MAX_GOAL_HOURS, MIN_GOAL_HOURS } from '@/services/constants';

const DEFAULT_GOAL_HOURS = 2.0;
/** How often a running session mirrors itself to the server. */
const SYNC_MS = 60_000;
/** How often the display re-reads the clock while running. */
const TICK_MS = 1000;

export interface FocusState {
  goalHours: number;
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
        : DEFAULT_GOAL_HOURS,
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
  const [state, setState] = useState<FocusState>(() => load(user));
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

  const sync = useCallback(() => {
    if (!username) return;
    const s = latest.current;
    void focusService
      .syncDay(username, todayStr(), Math.round(focusedSeconds(s)), s.goalHours)
      .catch(() => {
        /* offline — the next sync retries, and the server never lowers a total */
      });
  }, [username]);

  const running = state.runningSince !== null;

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
    write({ ...s, runningSince: Date.now() });
    // focus-theme.js listens for this and dims the whole app.
    document.dispatchEvent(
      new CustomEvent('focusmodechange', { detail: { running: true } }),
    );
  }, [write]);

  const stop = useCallback(() => {
    const s = latest.current;
    if (!s.runningSince) return;
    const banked =
      s.accumulatedSeconds + Math.max(0, (Date.now() - s.runningSince) / 1000);
    write({ ...s, accumulatedSeconds: banked, runningSince: null });
    document.dispatchEvent(
      new CustomEvent('focusmodechange', { detail: { running: false } }),
    );
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
  const goalSec = state.goalHours * 3600;
  const percent =
    goalSec > 0 ? Math.min(100, Math.round((focused / goalSec) * 100)) : 0;

  return {
    goalHours: state.goalHours,
    focused,
    percent,
    running,
    start,
    stop,
    setGoalHours,
  };
}
