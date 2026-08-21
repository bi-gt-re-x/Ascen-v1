/**
 * The account's preferences, read once and shared.
 *
 * ## Why a provider and not a hook per page
 *
 * These are read in far more places than they are written — the composer wants
 * the default XP, `/calendar` wants the view to redirect to, analytics wants
 * the window to open on. A hook fetching per page would be one request each
 * and, worse, a visible flash of the built-in default before the account's own
 * answer landed.
 *
 * ## The two that are applied to the document
 *
 * `accent` and `reduce_motion` are not read by a component at all: they are
 * written to <html> as attributes, and the stylesheets do the rest. That keeps
 * them out of every component that would otherwise have to thread a class
 * down, and it means they apply to the pages still dressed by the older
 * stylesheets too. See styles/preferences.css.
 *
 * Signed out, the defaults stand and nothing is fetched. Nothing here is worth
 * showing a spinner for — a page renders with the defaults and corrects itself
 * a moment later, which is why `ready` exists for the one caller that needs to
 * wait (the calendar redirect, which cannot un-navigate).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { SettingsContext } from './contexts';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { settings as service } from '@/services';
import { DEFAULTS, type Prefs } from '@/services/settings';

/** Pull just the keyed preferences out of the wider settings object. */
function prefsOf(all: Record<string, unknown>): Prefs {
  const out = { ...DEFAULTS };
  (Object.keys(DEFAULTS) as (keyof Prefs)[]).forEach((key) => {
    if (all[key] !== undefined && all[key] !== null) {
      (out as Record<string, unknown>)[key] = all[key];
    }
  });
  return out;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { username, status } = useAuth();
  const { setTheme } = useTheme();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!username) {
      setPrefs(DEFAULTS);
      // Signed out is a finished answer, not a pending one.
      setReady(true);
      return;
    }
    const result = await service.getSettings(username);
    if (result.success) setPrefs(prefsOf(result.settings as unknown as Record<string, unknown>));
    setReady(true);
  }, [username]);

  useEffect(() => {
    if (status === 'loading') return;
    void refresh();
  }, [refresh, status]);

  /* Applied to the document rather than passed to components. `data-accent`
     repaints every page's accent token; `data-motion` is what the global
     reduce-motion rule keys off. Both are removed at their default so the
     attribute selector only exists when it is doing something. */
  useEffect(() => {
    const root = document.documentElement;
    if (prefs.accent && prefs.accent !== 'violet') root.setAttribute('data-accent', prefs.accent);
    else root.removeAttribute('data-accent');
  }, [prefs.accent]);

  useEffect(() => {
    const root = document.documentElement;
    if (prefs.reduce_motion) root.setAttribute('data-motion', 'reduced');
    else root.removeAttribute('data-motion');
  }, [prefs.reduce_motion]);

  /* 'system' is a preference about how to choose the theme, not a colour, so
     it is kept here and resolved against the device — now and whenever the
     device changes its mind. Light and dark are left alone: those are the
     reader having chosen, and following the OS over them would ignore it.

     ThemeProvider is above this one in the tree, so its setter is available
     and the account's stored colour still goes through the one place that
     writes it. */
  useEffect(() => {
    if (prefs.theme_mode !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const follow = () => setTheme(media.matches ? 'dark' : 'light');
    follow();
    media.addEventListener('change', follow);
    return () => media.removeEventListener('change', follow);
  }, [prefs.theme_mode, setTheme]);

  const update = useCallback(
    async (values: Partial<Prefs>): Promise<string | null> => {
      // Applied before the request so the control the reader just clicked
      // responds immediately; rolled back only if the server refuses.
      const previous = prefs;
      setPrefs((current) => ({ ...current, ...values }));
      if (!username) return null;
      const result = await service.saveSettings(username, { values });
      if (!result.success) {
        setPrefs(previous);
        return result.message;
      }
      setPrefs(prefsOf(result.settings as unknown as Record<string, unknown>));
      return null;
    },
    [prefs, username],
  );

  const value = useMemo(
    () => ({ prefs, ready, update, refresh }),
    [prefs, ready, update, refresh],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
