/**
 * The browser tab's title.
 *
 * A single-page app changes route without reloading, so nothing updates the
 * title unless something does it deliberately — and a wrong title is what
 * makes an SPA feel broken in a list of twenty tabs.
 *
 * ## A title that ticks
 *
 * Two pages pass a new title every second: the focus page and the dashboard,
 * while a session is running. See `timerTitle` below for why, and for what the
 * tab says.
 *
 * That makes the effect re-run once a second, which looks like it should break
 * the restore — `previous` is captured on every run, so surely it ends up
 * holding last second's countdown and unmount leaves "24:31 · Focus" in the
 * tab for ever. It does not, and the reason is the order React runs these in:
 * the old effect's cleanup puts `previous` back *before* the new effect reads
 * `document.title`. So every run reads the same pre-mount title, and the last
 * cleanup restores it. Nothing paints between the two writes, so there is no
 * flicker either.
 */
import { useEffect } from 'react';
import { clock } from '@/components/Timer/pomodoro';

const SUFFIX = 'Summit';

/**
 * What the tab is called while a timer is running: the clock, then what it is
 * counting.
 *
 * **The clock leads, and that is the whole point of the function.** A tab in a
 * row of twenty is perhaps twelve characters wide and the browser truncates
 * the end, so "Timer · 24:31" is a tab that says "Timer…" — which is what it
 * said before the session started. The number has to be first or it is not
 * there at all.
 *
 * `clock` is the focus page's own formatter rather than the one in
 * utils/format, because the tab and the ring on that page are showing the same
 * number and must not disagree about it: the two differ on whether the hour is
 * padded, and the longest interval this app offers is ninety minutes.
 */
export function timerTitle(seconds: number, label: string): string {
  return `${clock(seconds)} · ${label}`;
}

export function useDocumentTitle(title?: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} · ${SUFFIX}` : SUFFIX;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
