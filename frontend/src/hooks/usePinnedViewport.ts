/**
 * Whether this route pins the viewport or lets the page scroll.
 *
 * An app page fills the screen exactly once and scrolls inside its own panels
 * — the dashboard's task list, the goals column, the calendar card — so the
 * top bar and the page's own chrome stay put while you work. A document does
 * the ordinary thing and scrolls.
 *
 * The class only does anything on a screen big enough to hold a whole page;
 * `body.pins-viewport` in src/styles/rail.css is where that is decided and
 * why.
 */
import { useEffect } from 'react';

export function usePinnedViewport(pinned: boolean): void {
  useEffect(() => {
    document.body.classList.toggle('pins-viewport', pinned);
    // Off on the way out, so a route that never asks for it cannot inherit it
    // from the one before.
    return () => document.body.classList.remove('pins-viewport');
  }, [pinned]);
}
