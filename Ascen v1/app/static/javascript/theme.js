// theme.js — light/dark theming across all pages.
//
// The theme is carried in a `theme` cookie. The server reads that cookie on every
// request and renders <html data-theme="..."> before any byte of the page paints,
// so the theme is correct on first paint and never depends on this script's timing.
// That means navigation can never "flash" or revert: the new page arrives already
// themed. This script only:
//   1. syncs the <body> class + dropdown to the server-rendered theme, and
//   2. on a theme change, writes the cookie (so the next navigation is server-
//      rendered in the new theme) and POSTs it for durable per-account storage.
//
// Two CSS systems coexist: modern pages (mainpage, dashboard) key off
// <html data-theme>, legacy pages (growth, goals) key off <body class="classic|dark">.
// We drive BOTH. Pages that must react (repaint charts, re-filter lists) listen for
// the 'themechange' event dispatched below.

(function () {
    'use strict';

    // Cookie lives a year; it just needs to outlive the session. Mirrors the
    // server-side THEME_COOKIE_MAX_AGE.
    var COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

    function normalize(theme) {
        return theme === 'dark' ? 'dark' : 'light';
    }

    function writeCookie(theme) {
        try {
            document.cookie = 'theme=' + theme + '; path=/; max-age=' + COOKIE_MAX_AGE + '; samesite=lax';
        } catch (e) {}
    }

    // Apply a theme to both styling systems and sync the dropdown.
    function apply(theme) {
        theme = normalize(theme);
        document.documentElement.setAttribute('data-theme', theme);
        if (document.body) {
            // 'classic' is the legacy pages' name for light.
            document.body.classList.remove('classic', 'dark');
            document.body.classList.add(theme === 'dark' ? 'dark' : 'classic');
        }
        var sel = document.getElementById('themeSelect');
        if (sel) sel.value = theme;
        document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: theme } }));
    }

    // Called by the theme dropdown (and exposed for other scripts).
    function setTheme(theme) {
        theme = normalize(theme);
        // Set the cookie synchronously first, so even if the user navigates the very
        // next instant, the next page is server-rendered in this theme.
        writeCookie(theme);
        apply(theme);
        // Durable per-account store. keepalive lets it finish across a navigation;
        // the server also mirrors the theme back into the cookie in its response.
        fetch('/api/set_theme', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ theme: theme }),
            keepalive: true
        }).catch(function (e) { console.error('Failed to save theme:', e); });
    }

    // setTheme  -> user-driven change that persists.
    // applyTheme -> apply a value without persisting (used by the auth flow after
    //              login/logout, where the cookie has already been set server-side).
    window.setTheme = setTheme;
    window.applyTheme = apply;

    document.addEventListener('DOMContentLoaded', function () {
        // Trust the server-rendered data-theme (from the cookie). Never override it.
        apply(document.documentElement.getAttribute('data-theme') || 'light');
        var sel = document.getElementById('themeSelect');
        if (sel) sel.addEventListener('change', function () { setTheme(this.value); });
    });
})();
