/* quote-egg.js — the short way into the riddle.
 *
 * The testimonial card on the landing page is a door. Click it and it twitches;
 * keep clicking and it shakes harder each time — a wee shiver on the first,
 * the whole card thrown about by the ninth — and on the tenth the page itself
 * quakes, the light goes out, and you drop into the riddle at /calendar#void:
 * the same one waiting at the end of the pentagon's chain.
 *
 * The ten are a streak, exactly as the dashboard logo's ten clicks are: leave
 * more than RESET_MS between two of them and the count starts over (and the
 * shaking starts small again).
 */
(function () {
    'use strict';

    var NEEDED = 10;        // clicks to open the door
    var RESET_MS = 1500;    // gap that breaks the "in a row" streak

    var reduced = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function init() {
        var quote = document.querySelector('.lp-quote');
        if (!quote) return;

        var clicks = 0;
        var last = 0;
        var busy = false;
        var timer = null;

        quote.addEventListener('click', function () {
            if (busy) return;
            var now = Date.now();
            if (now - last > RESET_MS) clicks = 0;   // streak broken — start again
            last = now;
            clicks++;
            if (timer) clearTimeout(timer);
            timer = setTimeout(function () { clicks = 0; }, RESET_MS);

            if (clicks < NEEDED) {
                shake(quote, clicks);
                return;
            }
            busy = true;
            if (timer) clearTimeout(timer);
            openTheVoid();
        });
    }

    // Click n of ten. The throw and the tilt both grow with n, and the shake
    // tightens as it widens, so the last few read as angrier rather than merely
    // looser. The numbers are handed to the keyframes as custom properties.
    function shake(el, n) {
        if (reduced) return;
        el.style.setProperty('--qk-x', (1 + n * 1.5).toFixed(2) + 'px');
        el.style.setProperty('--qk-r', (n * 0.18).toFixed(2) + 'deg');
        el.style.setProperty('--qk-t', Math.max(0.26, 0.52 - n * 0.02).toFixed(2) + 's');
        el.classList.remove('quote-shake');
        void el.offsetWidth;                 // restart the animation from the top
        el.classList.add('quote-shake');
    }

    // The tenth: the whole page throws itself about, everything fades to black,
    // and the riddle is on the other side of it. It opens right here rather than
    // at /calendar#void, where the pentagon's arrow leads — that page needs an
    // account, and a visitor reading a testimonial usually hasn't got one. Same
    // void, same riddle, same drop into /engine when it's answered.
    function openTheVoid() {
        var main = document.querySelector('.home-main') || document.body;
        if (!reduced) main.classList.add('page-quake');

        var fade = document.createElement('div');
        fade.id = 'quoteVoidFade';
        document.body.appendChild(fade);

        var quakeMs = reduced ? 0 : 620;
        setTimeout(function () { fade.classList.add('show'); }, quakeMs);
        setTimeout(function () {
            // The void swallows the page (void.css), and the question is left.
            document.documentElement.classList.add('egg-void');
            if (window.VoidRiddle) window.VoidRiddle.open();
            else window.location.href = '/calendar#void';   // void.js missing
        }, quakeMs + 900);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
