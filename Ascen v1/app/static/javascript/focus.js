/* focus.js — shared "focus session" state for the dashboard + calendar.
 *
 * The focus goal and the time focused today are stored in localStorage, keyed by
 * user + date, so both pages read/show the same numbers and they survive reloads.
 *
 * Elapsed time is timestamp-based: starting a session records `runningSince` (an
 * epoch ms), and the focused total is `accumulatedSeconds + (now - runningSince)`.
 * Because it's derived from the wall clock, the meter keeps counting while the
 * user is away — on another tab, another page, or with the browser closed — and
 * shows the correct total the moment they come back. Stopping banks the elapsed
 * segment into `accumulatedSeconds` and clears `runningSince`.
 */
(function () {
    'use strict';

    function user() {
        return (window.localStorage && localStorage.getItem('currentUser')) || 'Default';
    }
    function todayStr() {
        var d = new Date();
        var p = function (n) { return n < 10 ? '0' + n : '' + n; };
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    }
    function key() { return 'focus:' + user() + ':' + todayStr(); }

    function load() {
        var s = {};
        try { s = JSON.parse(localStorage.getItem(key()) || '{}') || {}; } catch (e) { s = {}; }
        if (typeof s.goalHours !== 'number' || isNaN(s.goalHours)) s.goalHours = 2.0;
        if (typeof s.accumulatedSeconds !== 'number' || isNaN(s.accumulatedSeconds)) s.accumulatedSeconds = 0;
        if (typeof s.runningSince !== 'number') s.runningSince = null;
        return s;
    }
    function save(s) { try { localStorage.setItem(key(), JSON.stringify(s)); } catch (e) { /* ignore */ } }

    function focusedSeconds(s) {
        s = s || load();
        var live = s.runningSince ? Math.max(0, (Date.now() - s.runningSince) / 1000) : 0;
        return s.accumulatedSeconds + live;
    }

    // "1h 30m" / "45m" / "2h" — compact hours+minutes.
    function fmtHM(sec) {
        var m = Math.round(sec / 60);
        var h = Math.floor(m / 60); m = m % 60;
        if (h && m) return h + 'h ' + m + 'm';
        if (h) return h + 'h';
        return m + 'm';
    }

    window.Focus = {
        get: load,
        goalHours: function () { return load().goalHours; },
        setGoalHours: function (h) {
            var s = load();
            s.goalHours = Math.min(12, Math.max(0.5, Math.round(h * 2) / 2));
            save(s);
            return s.goalHours;
        },
        focusedSeconds: function () { return focusedSeconds(); },
        // Progress toward the goal, 0–100 (integer).
        percent: function () {
            var s = load();
            var goalSec = s.goalHours * 3600;
            return goalSec > 0 ? Math.min(100, Math.round(focusedSeconds(s) / goalSec * 100)) : 0;
        },
        isRunning: function () { return !!load().runningSince; },
        start: function () {
            var s = load();
            if (!s.runningSince) { s.runningSince = Date.now(); save(s); }
            return s;
        },
        stop: function () {
            var s = load();
            if (s.runningSince) {
                s.accumulatedSeconds += Math.max(0, (Date.now() - s.runningSince) / 1000);
                s.runningSince = null;
                save(s);
            }
            return s;
        },
        fmtHM: fmtHM
    };
})();
