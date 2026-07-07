// theme.js — single source of truth for light/dark theming across all pages.
//
// Persistence model:
//   * Logged in  -> the account's theme lives in users.json. The server injects it
//                   into <html data-theme="..."> at render time (paint-safe), and
//                   changes are POSTed to /api/set_theme.
//   * Logged out -> theme is device-only (localStorage 'guestTheme'), defaulting to
//                   light. Guests can still toggle; it just never leaves the device.
//
// Two CSS systems coexist in this app: modern pages (mainpage, dashboard) key off
// <html data-theme>, while legacy pages (growth, goals) key off
// <body class="classic|dark">. We drive BOTH so every page responds to the same
// light/dark value. Pages that need to react (repaint charts, re-filter lists) can
// listen for the 'themechange' event dispatched below.

(function () {
    'use strict';

    var GUEST_KEY = 'guestTheme';

    function isLoggedIn() {
        try { return !!localStorage.getItem('currentUser'); } catch (e) { return false; }
    }

    function normalize(theme) {
        return theme === 'dark' ? 'dark' : 'light';
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

    // The theme the page should show right now.
    function effectiveTheme() {
        if (isLoggedIn()) {
            // The server already injected the account's theme onto <html>.
            return normalize(document.documentElement.getAttribute('data-theme'));
        }
        try { return normalize(localStorage.getItem(GUEST_KEY) || 'light'); } catch (e) { return 'light'; }
    }

    // Called by the theme dropdown (and exposed for other scripts).
    function setTheme(theme) {
        theme = normalize(theme);
        apply(theme);
        if (isLoggedIn()) {
            fetch('/api/set_theme', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ theme: theme })
            }).catch(function (e) { console.error('Failed to save theme:', e); });
        } else {
            try { localStorage.setItem(GUEST_KEY, theme); } catch (e) {}
        }
    }

    // setTheme  -> user-driven change that persists.
    // applyTheme -> apply a value without persisting (used by the auth flow after
    //              login/logout, where the source of truth already changed).
    window.setTheme = setTheme;
    window.applyTheme = apply;

    document.addEventListener('DOMContentLoaded', function () {
        apply(effectiveTheme());
        var sel = document.getElementById('themeSelect');
        if (sel) sel.addEventListener('change', function () { setTheme(this.value); });
    });
})();
