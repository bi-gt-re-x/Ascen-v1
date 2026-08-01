/**
 * The browser tab's title.
 *
 * A single-page app changes route without reloading, so nothing updates the
 * title unless something does it deliberately — and a wrong title is what
 * makes an SPA feel broken in a list of twenty tabs.
 */
import { useEffect } from 'react';

const SUFFIX = 'Ascen';

export function useDocumentTitle(title?: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} · ${SUFFIX}` : SUFFIX;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
