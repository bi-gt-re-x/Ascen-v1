/* focus-theme.js — the exclusive "Focus Mode" look, on every page.
 *
 * While a focus session is running (started from the dashboard's Focus panel
 * or the calendar Day view's Focus button), every page slips into a cinematic
 * focus theme: a dark sweep plays, then the whole UI settles into a dimmer,
 * desaturated, more minimal look with a soft vignette. The theme selector is
 * locked for the duration — Focus Mode is its own theme. Stopping the session
 * fades everything back to normal.
 *
 * Reads the same localStorage state focus.js writes ('focus:<user>:<date>' →
 * runningSince), so it works standalone on pages that don't load focus.js
 * (goals, growth, home). Reacts instantly on the page where the session is
 * toggled (focus.js dispatches 'focusmodechange'), via the 'storage' event on
 * other open tabs, and by a 1s poll as the safety net.
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
    function isRunning() {
        try {
            var s = JSON.parse(localStorage.getItem('focus:' + user() + ':' + todayStr()) || '{}');
            return !!(s && s.runningSince);
        } catch (e) { return false; }
    }

    // --- The focus theme itself (injected once) ----------------------------
    function ensureStyles() {
        if (document.getElementById('focusThemeStyles')) return;
        var css = [
            /* Dim + desaturate the whole page — calm, cinematic, minimal. */
            'html.focus-mode body {',
            '    filter: saturate(0.7) brightness(0.84) contrast(0.98);',
            '}',
            'body { transition: filter 1.1s ease; }',
            /* Minimal: decorative shadows disappear for the duration. */
            'html.focus-mode body * { box-shadow: none !important; text-shadow: none !important; }',
            /* Soft vignette pulls the eye to the middle of the screen. */
            '#focusVignette {',
            '    position: fixed; inset: 0; pointer-events: none; z-index: 99990;',
            '    background: radial-gradient(ellipse at center, transparent 52%, rgba(6, 8, 12, 0.55) 100%);',
            '    opacity: 0; transition: opacity 1.4s ease;',
            '}',
            'html.focus-mode #focusVignette { opacity: 1; }',
            /* Entry sweep: a quick dip to near-black that lifts into the dim. */
            '#focusCine {',
            '    position: fixed; inset: 0; pointer-events: none; z-index: 99991;',
            '    background: #05070b; opacity: 0;',
            '}',
            '#focusCine.play { animation: focusCineSweep 1.6s ease-out forwards; }',
            '@keyframes focusCineSweep {',
            '    0%   { opacity: 0; }',
            '    28%  { opacity: 0.88; }',
            '    100% { opacity: 0; }',
            '}',
            /* Locked theme selector reads as locked. */
            'html.focus-mode #themeSelect { opacity: 0.45; cursor: not-allowed; }'
        ].join('\n');
        var style = document.createElement('style');
        style.id = 'focusThemeStyles';
        style.textContent = css;
        document.head.appendChild(style);

        var vignette = document.createElement('div');
        vignette.id = 'focusVignette';
        vignette.setAttribute('aria-hidden', 'true');
        document.body.appendChild(vignette);
    }

    function lockTheme(lock) {
        document.querySelectorAll('#themeSelect').forEach(function (sel) {
            sel.disabled = lock;
            sel.title = lock ? 'Theme is locked during Focus Mode' : '';
        });
    }

    function playEntrySweep() {
        var cine = document.getElementById('focusCine');
        if (!cine) {
            cine = document.createElement('div');
            cine.id = 'focusCine';
            cine.setAttribute('aria-hidden', 'true');
            document.body.appendChild(cine);
        }
        cine.classList.remove('play');
        void cine.offsetWidth;                 // restart the animation
        cine.classList.add('play');
    }

    var active = null; // unknown until first apply
    function apply(withCinematic) {
        ensureStyles();
        var running = isRunning();
        if (running === active) return;
        active = running;
        if (running) {
            if (withCinematic) playEntrySweep();
            document.documentElement.classList.add('focus-mode');
            lockTheme(true);
        } else {
            document.documentElement.classList.remove('focus-mode');
            lockTheme(false);
        }
    }

    function init() {
        apply(false);                                        // arriving mid-session: no sweep, just the theme
        document.addEventListener('focusmodechange', function () { apply(true); });
        window.addEventListener('storage', function () { apply(true); });
        setInterval(function () { apply(true); }, 1000);     // safety net
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
