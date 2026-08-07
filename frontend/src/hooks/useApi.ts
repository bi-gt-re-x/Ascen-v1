/**
 * Calling the API from a component, without writing the same five lines again.
 *
 * Every page does the same thing: fetch on mount, show a spinner, show an
 * error, re-fetch when something changes. `useApi` is that, plus the things
 * hand-written versions usually get wrong —
 *
 *   * **a late response cannot overwrite a newer one.** Switch accounts or
 *     change a date quickly and the first request may land after the second;
 *     without a guard the stale answer wins and the page shows the wrong data.
 *   * **nothing is set after unmount**, which is a warning at best and a leak
 *     at worst.
 *   * **a re-read never blanks the page.** `loading` means "there is nothing
 *     to show yet", not "a request is in flight" — a page guarding on it with
 *     `if (loading) return <Loading/>` therefore cannot throw itself away and
 *     come back as a spinner every time something is re-read. `refreshing` is
 *     the in-flight flag, for a button that wants to spin.
 *   * **a failed re-read keeps the last good answer.** Losing the whole page
 *     because the second fetch timed out is worse than showing what was there
 *     with the error beside it.
 *
 * The `success: false` envelope becomes `error`, so a component sees one error
 * channel rather than two.
 *
 * `mutate` is the other half of that promise. A page that has just written
 * something usually knows exactly what changed, and asking the server to say
 * it again is a round trip whose only visible effect is the page moving under
 * the reader. `mutate` applies the change to what is already on screen; the
 * server is re-read when the reader asks for it, and to recover when a write
 * turns out to have failed.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/types';
import type { ApiResult } from '@/types';

interface State<T> {
  data: T | null;
  error: string | null;
  /** A request is in flight — whether or not there is already data. */
  pending: boolean;
}

export interface UseApiResult<T> {
  data: T | null;
  error: string | null;
  /** Nothing to show yet, and a request is in flight. */
  loading: boolean;
  /** A request is in flight over data already on screen. */
  refreshing: boolean;
  /** Re-ask the server. What a Refresh button does. */
  reload: () => void;
  /** Change what is on screen without asking the server. */
  mutate: (update: (current: T) => T) => void;
}

/**
 * @param call  The request. Must be stable (useCallback) or wrapped in one,
 *              or this re-runs on every render.
 * @param deps  Re-fetch when these change. Defaults to just `call`.
 */
export function useApi<T>(
  call: () => Promise<ApiResult<T>>,
  deps: readonly unknown[] = [],
): UseApiResult<T> {
  const [state, setState] = useState<State<T>>({
    data: null,
    error: null,
    pending: true,
  });

  // Bumped on every run; a response whose ticket is no longer current is
  // dropped rather than applied.
  const ticket = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(() => {
    const mine = ++ticket.current;
    setState((previous) => ({ ...previous, pending: true, error: null }));

    call()
      .then((result) => {
        if (!mounted.current || mine !== ticket.current) return;
        if (result.success) {
          setState({ data: result as T, error: null, pending: false });
        } else {
          // The last good answer is kept: a page that has data is more useful
          // with a stale copy and a message than with neither.
          setState((previous) => ({
            data: previous.data,
            error: result.message,
            pending: false,
          }));
        }
      })
      .catch((cause: unknown) => {
        if (!mounted.current || mine !== ticket.current) return;
        setState((previous) => ({
          data: previous.data,
          error:
            cause instanceof ApiError || cause instanceof Error
              ? cause.message
              : 'Something went wrong.',
          pending: false,
        }));
      });
    // `call` is intentionally not a dependency: callers pass an inline arrow
    // more often than not, and `deps` is the honest list of what it closes over.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(run, [run]);

  /**
   * Apply a change locally. Ignored when there is nothing to change — a write
   * that lands before the first read is a write whose answer the read carries.
   */
  const mutate = useCallback((update: (current: T) => T) => {
    setState((previous) =>
      previous.data === null ? previous : { ...previous, data: update(previous.data) },
    );
  }, []);

  return {
    data: state.data,
    error: state.error,
    loading: state.pending && state.data === null,
    refreshing: state.pending && state.data !== null,
    reload: run,
    mutate,
  };
}
