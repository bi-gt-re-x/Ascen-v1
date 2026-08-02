/**
 * Light and dark.
 *
 * Three copies of the answer exist and they are kept in step here:
 *
 *   1. `<html data-theme="...">` — what the CSS reads. Set before React loads
 *      by the inline script in index.html, so there is no flash. The body
 *      class beside it (`dark` / `classic`) is the same answer in the older
 *      stylesheets' dialect; see the effect below.
 *   2. The `theme` cookie — what the backend reads, so a server-rendered page
 *      arrives already correct. The backend sets it; this only reads it.
 *   3. The account's stored theme — the durable copy, which follows the user
 *      to another device. Written by `setTheme`.
 *
 * The cookie wins on load because it is the one that is always present and
 * always current. Signed out, the change is still applied and still stored in
 * the cookie; it just has no account to persist to.
 *
 * The hook is in src/hooks/useTheme.ts and the context in ./contexts.ts —
 * see the note there for why this file exports only a component.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ThemeContext } from './contexts';
import { auth } from '@/services';
import type { Theme } from '@/types';

function cookieTheme(): Theme | null {
  const match = document.cookie.match(/(?:^|;\s*)theme=(light|dark)/);
  return (match?.[1] as Theme | undefined) ?? null;
}

function documentTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark'
    ? 'dark'
    : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // The cookie first, then whatever the inline script already put on <html>.
  const [theme, setThemeState] = useState<Theme>(
    () => cookieTheme() ?? documentTheme(),
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    // The second styling system. The pages ported off Jinja are dressed by the
    // stylesheets that were written for them, and those key off the body class
    // — `body.dark .grade-card` paints the report card, `body.classic .tab-btn`
    // the growth tabs — where the newer pages key off `html[data-theme]`. Both
    // are kept in step here for the same reason frontend/js/theme.js keeps both
    // in step there: a page should not care which era its CSS comes from.
    // 'classic' is the legacy name for light.
    document.body.classList.remove('classic', 'dark');
    document.body.classList.add(theme === 'dark' ? 'dark' : 'classic');
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    // Applied immediately; the request only persists it. A failure there means
    // the choice does not follow the account to another device, which is not
    // worth reverting a change the user can already see.
    setThemeState(next);
    void auth.setTheme(next);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      void auth.setTheme(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, toggle }),
    [theme, setTheme, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
