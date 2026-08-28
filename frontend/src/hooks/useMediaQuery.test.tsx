/**
 * The breakpoint hook, and the flicker it exists to prevent.
 *
 * `useSyncExternalStore` was chosen over `useState` + effect for one reason:
 * the effect version renders once with the wrong answer. That is the first
 * test here, and it is written as "the very first render is already right"
 * rather than as "it eventually settles" — the settled answer is the same
 * either way, so only the first frame distinguishes the two implementations.
 */
import { render, renderHook, screen } from '@testing-library/react';
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { setMatchMedia } from '@/test/media';
import { useMediaQuery } from './useMediaQuery';

const PHONE = '(max-width: 640px)';

describe('useMediaQuery', () => {
  it('reports a matching query as true', () => {
    setMatchMedia({ [PHONE]: true });
    const { result } = renderHook(() => useMediaQuery(PHONE));
    expect(result.current).toBe(true);
  });

  it('reports a query that does not match as false', () => {
    setMatchMedia({ [PHONE]: false });
    const { result } = renderHook(() => useMediaQuery(PHONE));
    expect(result.current).toBe(false);
  });

  it('is right on the very first render, with no corrected second one', () => {
    // The flicker: on a phone the rail would paint ten desktop tabs and then
    // replace them with four. An effect-based hook fails this and passes
    // every other test in this file.
    setMatchMedia({ [PHONE]: true });

    const seen: boolean[] = [];
    function Probe() {
      seen.push(useMediaQuery(PHONE));
      return null;
    }
    render(<Probe />);

    expect(seen[0]).toBe(true);
    expect(seen).not.toContain(false);
  });

  it('re-renders when the viewport crosses the breakpoint', () => {
    const media = setMatchMedia({ [PHONE]: false });
    const { result } = renderHook(() => useMediaQuery(PHONE));

    expect(result.current).toBe(false);
    act(() => media.set(PHONE, true));
    expect(result.current).toBe(true);
    act(() => media.set(PHONE, false));
    expect(result.current).toBe(false);
  });

  it('unsubscribes on unmount rather than leaving a listener behind', () => {
    const media = setMatchMedia({ [PHONE]: false });
    const { unmount } = renderHook(() => useMediaQuery(PHONE));

    expect(media.listeners(PHONE)).toBe(1);
    unmount();
    expect(media.listeners(PHONE)).toBe(0);
  });

  it('stays subscribed across re-renders with the same query', () => {
    // The module's own warning: a new query string on every render
    // resubscribes on every render. A constant one must not.
    const media = setMatchMedia({ [PHONE]: false });
    const { rerender } = renderHook(() => useMediaQuery(PHONE));

    const after = media.listeners(PHONE);
    rerender();
    rerender();
    expect(media.listeners(PHONE)).toBe(after);
  });

  it('moves its subscription when the query changes', () => {
    const wide = '(min-width: 1200px)';
    const media = setMatchMedia({ [PHONE]: true, [wide]: false });
    const { result, rerender } = renderHook(({ query }) => useMediaQuery(query), {
      initialProps: { query: PHONE },
    });

    expect(result.current).toBe(true);
    expect(media.listeners(PHONE)).toBe(1);

    rerender({ query: wide });
    expect(result.current).toBe(false);
    expect(media.listeners(PHONE)).toBe(0);
    expect(media.listeners(wide)).toBe(1);
  });

  it('two readers of one query agree', () => {
    const media = setMatchMedia({ [PHONE]: false });
    const { result: a } = renderHook(() => useMediaQuery(PHONE));
    const { result: b } = renderHook(() => useMediaQuery(PHONE));

    act(() => media.set(PHONE, true));
    expect([a.current, b.current]).toEqual([true, true]);
  });

  it('answers false where there is no matchMedia at all', () => {
    // Not a theoretical branch: it is what the hook returns during any render
    // without a DOM, and returning `undefined` there would render "undefined".
    const { matchMedia } = window;
    // @ts-expect-error deliberately removing the API to exercise the guard
    delete window.matchMedia;
    try {
      const { result } = renderHook(() => useMediaQuery(PHONE));
      expect(result.current).toBe(false);
    } finally {
      window.matchMedia = matchMedia;
    }
  });

  it('renders one component or the other, which is what it is for', () => {
    // Layout belongs in CSS; this hook is for the cases where the two sizes
    // are genuinely different trees.
    const media = setMatchMedia({ [PHONE]: false });
    function Nav() {
      return useMediaQuery(PHONE) ? <nav>Four tabs and a sheet</nav> : <nav>Ten links</nav>;
    }

    render(<Nav />);
    expect(screen.getByText('Ten links')).toBeInTheDocument();

    act(() => media.set(PHONE, true));
    expect(screen.getByText('Four tabs and a sheet')).toBeInTheDocument();
    expect(screen.queryByText('Ten links')).not.toBeInTheDocument();
  });
});
