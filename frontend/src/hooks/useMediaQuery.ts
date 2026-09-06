/**
 * Whether a CSS media query currently matches, as a piece of React state.
 *
 * For the cases where a breakpoint changes *what is rendered* rather than how
 * it looks. Layout belongs in CSS and stays there; this is for the handful of
 * places where the two sizes are genuinely different components — the rail
 * being ten links on a desktop and four plus a sheet on a phone, where the
 * sheet does not exist at all above the breakpoint.
 *
 * `useSyncExternalStore` rather than an effect and a `useState`, because the
 * effect version renders once with the wrong answer before correcting itself:
 * on a phone the rail would paint ten tabs and then replace them, which is the
 * flicker this hook exists to avoid.
 *
 * Keep the query string a module constant at the call site. A new string on
 * every render resubscribes on every render.
 */
import { useCallback, useSyncExternalStore } from 'react';

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    [query],
  );

  const get = useCallback(
    () =>
      typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia(query).matches
        : false,
    [query],
  );

  // The server snapshot is `false`: there is no server render in this app, and
  // a hook that guesses "phone" for a machine it cannot measure would be
  // guessing wrong for most of them.
  return useSyncExternalStore(subscribe, get, () => false);
}
