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
    function save(s) {
        try { localStorage.setItem(key(), JSON.stringify(s)); } catch (e) { /* ignore */ }
        scheduleSync();
    }

    // --- Server sync -------------------------------------------------------
    // Mirror today's focus state to the backend (/api/focus_sync) so the growth
    // page can chart focus history and grade it. Debounced so rapid goal-stepper
    // clicks send one request; a slow interval keeps a running session current.
    var syncTimer = null;
    function syncToServer() {
        var s = load();
        try {
            fetch('/api/focus_sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: user(),
                    date: todayStr(),
                    focused_seconds: Math.round(focusedSeconds(s)),
                    goal_hours: s.goalHours
                }),
                keepalive: true
            }).catch(function () { /* offline — the next sync retries */ });
        } catch (e) { /* ignore */ }
    }
    function scheduleSync() {
        clearTimeout(syncTimer);
        syncTimer = setTimeout(syncToServer, 1500);
    }
    // Keep the server roughly current while a session ticks, and flush the
    // final total when the page is left mid-session (keepalive survives unload).
    setInterval(function () { if (load().runningSince) syncToServer(); }, 60000);
    window.addEventListener('pagehide', function () {
        if (load().runningSince) syncToServer();
    });

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

    // --- "Really stop?" confirmation popup ---------------------------------
    // Shared by the dashboard Focus panel and the calendar Day view's Focus
    // button, so stopping a session always asks first. Styles are injected once;
    // colors follow the html[data-theme="dark"] attribute theme.js maintains.
    function ensureConfirmStyles() {
        if (document.getElementById('focusConfirmStyles')) return;
        var css = [
            '.focus-confirm-overlay{position:fixed;inset:0;background:rgba(20,22,26,.45);display:flex;align-items:center;justify-content:center;z-index:100000;opacity:0;transition:opacity .15s ease;}',
            '.focus-confirm-overlay.show{opacity:1;}',
            '.focus-confirm-box{background:#fff;color:#2c302e;border-radius:14px;padding:26px 28px;max-width:340px;width:calc(100vw - 48px);box-shadow:0 18px 50px rgba(0,0,0,.25);text-align:center;font-family:inherit;transform:scale(.92);transition:transform .15s ease;}',
            '.focus-confirm-overlay.show .focus-confirm-box{transform:scale(1);}',
            '.focus-confirm-title{font-size:17px;font-weight:700;margin:0 0 6px;}',
            '.focus-confirm-msg{font-size:14px;color:#6c757d;margin:0 0 18px;}',
            '.focus-confirm-actions{display:flex;gap:10px;justify-content:center;}',
            '.focus-confirm-btn{font:inherit;font-size:14px;font-weight:600;border-radius:10px;padding:9px 18px;cursor:pointer;border:1px solid #e5e8ee;background:#fff;color:#2c302e;}',
            '.focus-confirm-btn:hover{background:#f6f7f9;}',
            '.focus-confirm-btn.danger{background:#d9534f;border-color:#d9534f;color:#fff;}',
            '.focus-confirm-btn.danger:hover{background:#c9453f;}',
            'html[data-theme="dark"] .focus-confirm-box{background:#161b22;color:#e6e9f0;}',
            'html[data-theme="dark"] .focus-confirm-msg{color:#9aa4b2;}',
            'html[data-theme="dark"] .focus-confirm-btn{background:#161b22;border-color:#2b3242;color:#e6e9f0;}',
            'html[data-theme="dark"] .focus-confirm-btn:hover{background:#1c222c;}',
            'html[data-theme="dark"] .focus-confirm-btn.danger{background:#d9534f;border-color:#d9534f;color:#fff;}'
        ].join('\n');
        var style = document.createElement('style');
        style.id = 'focusConfirmStyles';
        style.textContent = css;
        document.head.appendChild(style);
    }

    function confirmStop(onConfirm) {
        ensureConfirmStyles();
        var overlay = document.createElement('div');
        overlay.className = 'focus-confirm-overlay';
        overlay.innerHTML =
            '<div class="focus-confirm-box" role="dialog" aria-modal="true" aria-label="Stop focus session">' +
                '<p class="focus-confirm-title">Stop focusing?</p>' +
                '<p class="focus-confirm-msg">Your time so far is saved — but are you sure you want to quit this session?</p>' +
                '<div class="focus-confirm-actions">' +
                    '<button type="button" class="focus-confirm-btn" data-act="cancel">Keep Going</button>' +
                    '<button type="button" class="focus-confirm-btn danger" data-act="stop">Stop Focus</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(overlay);
        requestAnimationFrame(function () { overlay.classList.add('show'); });

        function close() {
            overlay.classList.remove('show');
            setTimeout(function () { overlay.remove(); }, 160);
            document.removeEventListener('keydown', onKey);
        }
        function onKey(e) { if (e.key === 'Escape') close(); }
        document.addEventListener('keydown', onKey);

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) { close(); return; } // click outside = cancel
            var btn = e.target.closest ? e.target.closest('.focus-confirm-btn') : null;
            if (!btn) return;
            close();
            if (btn.getAttribute('data-act') === 'stop' && typeof onConfirm === 'function') onConfirm();
        });
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
            if (!s.runningSince) {
                s.runningSince = Date.now();
                save(s);
                // Let the focus theme (focus-theme.js) react on this page instantly.
                document.dispatchEvent(new CustomEvent('focusmodechange', { detail: { running: true } }));
            }
            return s;
        },
        stop: function () {
            var s = load();
            if (s.runningSince) {
                s.accumulatedSeconds += Math.max(0, (Date.now() - s.runningSince) / 1000);
                s.runningSince = null;
                save(s);
                document.dispatchEvent(new CustomEvent('focusmodechange', { detail: { running: false } }));
            }
            return s;
        },
        fmtHM: fmtHM,
        confirmStop: confirmStop
    };
})();
