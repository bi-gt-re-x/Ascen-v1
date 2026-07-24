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
    function markUnlocked() {
        try { localStorage.setItem(key(), '1'); } catch (e) {}
    }

    function init() {
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
            clicks++;
            if (resetTimer) clearTimeout(resetTimer);
            resetTimer = setTimeout(function () { clicks = 0; }, RESET_MS);
            if (clicks >= NEEDED) {
                clicks = 0;
                if (resetTimer) clearTimeout(resetTimer);
                reveal(quoteEl, container);
            }
        });
    }

    function reveal(quoteEl, container) {
        markUnlocked();
        window.__mysteriousQuoteActive = true;

        // 1) Sleek slide-out of the current quote.
        quoteEl.classList.add('quote-slide-out');

        setTimeout(function () {
            // 2) Swap in the mysterious text, dressed ominously.
            quoteEl.textContent = QUOTE;
            if (container) container.classList.add('quote-ominous');
            quoteEl.classList.remove('quote-slide-out');

            // 3) Ominous rise-in + full-screen shake.
            void quoteEl.offsetWidth;                 // restart animation
            quoteEl.classList.add('quote-slide-in');
            document.documentElement.classList.add('easter-shake-clip');
            document.body.classList.add('easter-shake');

            setTimeout(function () {
                document.body.classList.remove('easter-shake');
                document.documentElement.classList.remove('easter-shake-clip');
            }, 850);
            setTimeout(function () {
                quoteEl.classList.remove('quote-slide-in');
            }, 1000);
        }, 560);   // matches the slide-out transition
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
