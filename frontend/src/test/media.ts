/**
 * A `matchMedia` a test can drive.
 *
 * jsdom's media queries never match and never change, so a hook built on
 * `matchMedia` is untestable against it: the interesting half of `useMediaQuery`
 * is what happens when the viewport crosses the breakpoint, and jsdom's viewport
 * never does.
 *
 * This installs a real implementation over a set of queries the test declares
 * true, and hands back a `set` that flips one and fires the `change` event the
 * browser would. Listener counts are exposed because "does it unsubscribe" is a
 * thing worth asserting and not otherwise observable.
 */
import { vi } from 'vitest';

export interface MediaControl {
  /** Flip a query and notify everyone listening to it. */
  set: (query: string, matches: boolean) => void;
  /** How many listeners are currently attached to a query. */
  listeners: (query: string) => number;
  /** How many times `window.matchMedia` has been called. */
  calls: () => number;
}

export function setMatchMedia(initial: Record<string, boolean> = {}): MediaControl {
  const state = new Map<string, boolean>(Object.entries(initial));
  const listeners = new Map<string, Set<() => void>>();
  let calls = 0;

  const listenersFor = (query: string) => {
    let set = listeners.get(query);
    if (!set) {
      set = new Set();
      listeners.set(query, set);
    }
    return set;
  };

  const matchMedia = vi.fn((query: string) => {
    calls += 1;
    return {
      media: query,
      get matches() {
        return state.get(query) ?? false;
      },
      onchange: null,
      addEventListener: (type: string, handler: () => void) => {
        if (type === 'change') listenersFor(query).add(handler);
      },
      removeEventListener: (type: string, handler: () => void) => {
        if (type === 'change') listenersFor(query).delete(handler);
      },
      addListener: (handler: () => void) => listenersFor(query).add(handler),
      removeListener: (handler: () => void) => listenersFor(query).delete(handler),
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  });

  vi.stubGlobal('matchMedia', matchMedia);

  return {
    set(query, matches) {
      state.set(query, matches);
      listenersFor(query).forEach((handler) => handler());
    },
    listeners: (query) => listenersFor(query).size,
    calls: () => calls,
  };
}
