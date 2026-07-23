/* day-focus.js — one shared per-day "Focus" note for every calendar view.
 *
 * The Week view's per-day Focus row, the Day view's Focus field and the Month
 * view's "Today's focus…" input all read and write through window.DayFocus, so
 * an edit in any of them shows up in the others immediately (via the
 * 'dayfocuschange' DOM event) and persists to the backend (/api/day_focus,
 * app/routes/calendar.py) so it also follows the account across browsers.
 *
 * localStorage (key 'wkDayFocus:<user>:<iso>' — the Week view's historic
 * format) stays as the synchronous read cache; the server is hydrated from on
 * load and debounce-written to on change.
 */
(function () {
    'use strict';

    function user() {
        return (window.localStorage && localStorage.getItem('currentUser')) || 'Default';
    }
    function key(iso) { return 'wkDayFocus:' + user() + ':' + iso; }

    var pushTimers = {};

    function get(iso) {
        try { return localStorage.getItem(key(iso)) || ''; } catch (e) { return ''; }
    }

    function set(iso, text) {
        text = String(text == null ? '' : text);
        try {
            if (text) localStorage.setItem(key(iso), text);
            else localStorage.removeItem(key(iso));
        } catch (e) { /* ignore */ }
        announce(iso, text);
        clearTimeout(pushTimers[iso]);
        pushTimers[iso] = setTimeout(function () { push(iso, text); }, 800);
    }

    function announce(iso, text) {
        document.dispatchEvent(new CustomEvent('dayfocuschange', {
            detail: { iso: iso, text: text }
        }));
    }

    function push(iso, text) {
        try {
            fetch('/api/day_focus', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: user(), date: iso, text: text.trim() }),
                keepalive: true
            }).catch(function () { /* offline — localStorage still has it */ });
        } catch (e) { /* ignore */ }
    }

    // Pull the account's saved notes into the local cache, then let every
    // mounted view refresh itself.
    function hydrate() {
        fetch('/api/day_focus?username=' + encodeURIComponent(user()))
            .then(function (r) { return r.json(); })
            .then(function (d) {
                if (!d || !d.success) return;
                var map = d.day_focus || {};
                Object.keys(map).forEach(function (iso) {
                    try { localStorage.setItem(key(iso), map[iso]); } catch (e) { /* ignore */ }
                });
                announce(null, null); // null iso = "refresh everything"
            })
            .catch(function () { /* offline — cache only */ });
    }

    window.DayFocus = { get: get, set: set, hydrate: hydrate };
    document.addEventListener('DOMContentLoaded', hydrate);
})();
