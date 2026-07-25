/* easter-egg.js — the hidden quote.
 *
 * Click the app icon (the nav logo) 10 times in a row and the day's quote
 * slips away, replaced — for the rest of the day — by a cryptic clue. The
 * swap is sleek: the old quote glides out, the new one rises in with an
 * ominous glow while the whole screen shakes. The unlock is remembered per
 * user per day (localStorage), so a reload keeps the mysterious quote (and
 * dashboard.js is told to stop overwriting it via window.__mysteriousQuoteActive).
 */
(function () {
    'use strict';

    var QUOTE = '"Hmmmm, what if you clicked a 2 dimensional 5 sided shape on a certain page that is scrollable?" -Mysterious,,';
    var NEEDED = 10;        // clicks to unlock
    var RESET_MS = 1500;    // gap that breaks the "in a row" streak

    function user() {
        return (window.localStorage && localStorage.getItem('currentUser')) || 'Default';
    }
    function todayStr() {
        var d = new Date();
        var p = function (n) { return n < 10 ? '0' + n : '' + n; };
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    }
    function key() { return 'easterEgg:' + user() + ':' + todayStr(); }
    function isUnlocked() {
        try { return localStorage.getItem(key()) === '1'; } catch (e) { return false; }
    }
    // The whole hidden chain only lives in the dark.
    function isDark() {
        return document.documentElement.getAttribute('data-theme') === 'dark';
    }
    function markUnlocked() {
        try { localStorage.setItem(key(), '1'); } catch (e) {}
    }

    // The Admin title earned in the hidden ADMIN ROOM shows as green hacker text
    // before the username on the dashboard.
    function applyAdminTitle() {
        var t; try { t = localStorage.getItem('ascenTitle:' + user()); } catch (e) { return; }
        if (!t) return;   // no earned title
        var nameEl = document.getElementById('userNameDisplay');
        if (!nameEl || document.querySelector('.admin-tag')) return;
        if (!document.getElementById('adminTagStyle')) {
            var st = document.createElement('style');
            st.id = 'adminTagStyle';
            st.textContent =
                '.admin-tag{color:#2bff88;font-family:"Courier New",monospace;font-weight:700;' +
                'letter-spacing:1px;margin-right:7px;text-shadow:0 0 8px rgba(43,255,136,.65);' +
                'animation:adminTagFlicker 3.2s infinite;}' +
                '@keyframes adminTagFlicker{0%,100%{opacity:1}92%{opacity:1}94%{opacity:.55}96%{opacity:1}}';
            document.head.appendChild(st);
        }
        var tag = document.createElement('span');
        tag.className = 'admin-tag';
        tag.textContent = t;   // 'Admin' or any custom title set in the ASCEN CORE
        tag.style.cursor = 'pointer';
        tag.title = '';
        // Clicking your title drops you straight back into the Ascen Engine.
        tag.addEventListener('click', function () { window.location.href = '/engine'; });
        nameEl.parentNode.insertBefore(tag, nameEl);
    }

    function init() {
        applyAdminTitle();

        var quoteEl = document.getElementById('dailyQuote');
        if (!quoteEl) return;
        var container = quoteEl.closest('.quote-container') || quoteEl.parentElement;

        // Already unlocked today: show it straight away, no theatrics, and claim
        // the quote line so the async daily-quote fetch leaves it alone.
        if (isUnlocked()) {
            window.__mysteriousQuoteActive = true;
            quoteEl.textContent = QUOTE;
            if (container) container.classList.add('quote-ominous');
        }

        var icon = document.querySelector('.logo');
        if (!icon) return;
        icon.style.cursor = 'pointer';
        icon.setAttribute('title', '');   // no tooltip hint — it's a secret

        var clicks = 0;
        var resetTimer = null;

        icon.addEventListener('click', function () {
            if (isUnlocked()) return;     // one reveal per day
            if (!isDark()) { clicks = 0; return; }   // only reachable in dark mode
            clicks++;
            if (resetTimer) clearTimeout(resetTimer);
            resetTimer = setTimeout(function () { clicks = 0; }, RESET_MS);
            if (clicks >= NEEDED) {
                clicks = 0;
                if (resetTimer) clearTimeout(resetTimer);
                reveal(quoteEl, container);
            } else {
                wobble(clicks);   // little wobble that grows bigger each click
            }
        });
    }

    // A per-click wobble whose amplitude climbs with the streak (click 1 = a
    // faint nudge, click 9 = a hard shake), building tension toward the reveal.
    var wobbleClipTimer = null;
    function wobble(n) {
        var root = document.documentElement;
        root.style.setProperty('--wob', (n * 2.5) + 'px');
        root.style.setProperty('--wob-rot', (n * 0.28) + 'deg');
        root.classList.add('easter-shake-clip');
        document.body.classList.remove('easter-wobble');
        void document.body.offsetWidth;               // restart animation
        document.body.classList.add('easter-wobble');
        if (wobbleClipTimer) clearTimeout(wobbleClipTimer);
        wobbleClipTimer = setTimeout(function () {
            document.body.classList.remove('easter-wobble');
            root.classList.remove('easter-shake-clip');
        }, 340);
    }

    function reveal(quoteEl, container) {
        markUnlocked();
        window.__mysteriousQuoteActive = true;

        // A full-viewport scrim, spotlighting the quote when the rest goes dark.
        var dark = document.getElementById('easterDark');
        if (!dark) {
            dark = document.createElement('div');
            dark.id = 'easterDark';
            dark.setAttribute('aria-hidden', 'true');
            document.body.appendChild(dark);
        }

        // 1) Sleek slide-out of the current quote.
        if (wobbleClipTimer) clearTimeout(wobbleClipTimer);
        document.body.classList.remove('easter-wobble');
        quoteEl.classList.add('quote-slide-out');

        setTimeout(function () {
            // 2) Swap in the mysterious text, dressed ominously.
            quoteEl.textContent = QUOTE;
            if (container) {
                container.classList.add('quote-ominous');
                container.classList.add('quote-spotlight');   // lift above the scrim
            }
            quoteEl.classList.remove('quote-slide-out');

            // 3) The rest of the screen turns dark.
            void dark.offsetWidth;
            dark.classList.add('show');

            // 4) The biggest shake yet + the ominous rise-in.
            void quoteEl.offsetWidth;                 // restart animation
            quoteEl.classList.add('quote-slide-in');
            document.documentElement.classList.add('easter-shake-clip');
            document.body.classList.remove('easter-wobble');
            void document.body.offsetWidth;
            document.body.classList.add('easter-shake');

            setTimeout(function () {
                document.body.classList.remove('easter-shake');
                document.documentElement.classList.remove('easter-shake-clip');
            }, 900);
            setTimeout(function () {
                quoteEl.classList.remove('quote-slide-in');
            }, 1050);

            // 5) Hold the darkness a beat, then lift it — leaving the ominous
            //    quote glowing in the restored dashboard.
            setTimeout(function () { dark.classList.remove('show'); }, 2400);
            setTimeout(function () {
                if (container) container.classList.remove('quote-spotlight');
            }, 3350);
        }, 560);   // matches the slide-out transition
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
