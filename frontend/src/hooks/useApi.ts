/**
 * Calling the API from a component, without writing the same five lines again.
 *
 * Every page does the same thing: fetch on mount, show a spinner, show an
 * error, re-fetch when something changes. `useApi` is that, plus the two
 * things hand-written versions usually get wrong —
 *
 *   * **a late response cannot overwrite a newer one.** Switch accounts or
 *     change a date quickly and the first request may land after the second;
 *     without a guard the stale answer wins and the page shows the wrong data.
 *   * **nothing is set after unmount**, which is a warning at best and a leak
 *     at worst.
 *
 * The `success: false` envelope becomes `error`, so a component sees one error
 * channel rather than two.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/types';
import type { ApiResult } from '@/types';

interface State<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

export interface UseApiResult<T> extends State<T> {
  /** Run it again — after a write, or on a manual refresh. */
  reload: () => void;
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
    loading: true,
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
    setState((previous) => ({ ...previous, loading: true, error: null }));

    call()
      .then((result) => {
        if (!mounted.current || mine !== ticket.current) return;
        if (result.success) {
          setState({ data: result as T, error: null, loading: false });
        } else {
          setState({ data: null, error: result.message, loading: false });
        }
      })
      .catch((cause: unknown) => {
        if (!mounted.current || mine !== ticket.current) return;
        setState({
          data: null,
          error:
            cause instanceof ApiError || cause instanceof Error
              ? cause.message
              : 'Something went wrong.',
          loading: false,
        });
      });
    // `call` is intentionally not a dependency: callers pass an inline arrow
    // more often than not, and `deps` is the honest list of what it closes over.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(run, [run]);

  return { ...state, reload: run };
}
