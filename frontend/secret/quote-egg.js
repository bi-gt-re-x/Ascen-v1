/* quote-egg.js — the short way into the riddle.
 *
 * The testimonial card on the landing page is a door. Click it and it twitches;
 * keep clicking and it shakes harder each time — a wee shiver on the first,
 * the whole card thrown about by the ninth — and on the tenth the page itself
 * quakes, the light goes out, and you drop into the riddle at /calendar#void:
 * the same one waiting at the end of the pentagon's chain.
 *
 * Ten clicks, at whatever pace: the count is not a streak. It was one at first
 * — the dashboard logo's ten clicks have to be in a row, and this followed it —
 * but a card is not a logo you drum on. Clicking a testimonial to see what it
 * does is a deliberate, once-a-second sort of clicking, and every gap over the
 * limit put the count back to one, so the door never opened and the shake never
 * grew past its first twitch. Now nothing resets it.
 */
(function () {
    'use strict';

    var NEEDED = 10;        // clicks to open the door

    var reduced = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function init() {
        var quote = document.querySelector('.lp-quote');
        if (!quote) return;

        var clicks = 0;
        var busy = false;

        quote.addEventListener('click', function () {
            if (busy) return;
            clicks++;
            if (clicks < NEEDED) {
                shake(quote, clicks);
                return;
            }
            busy = true;
            openTheVoid();
        });
    }

    // Click n of ten. The throw and the tilt both grow with n, and the shake
    // tightens as it widens, so the last few read as angrier rather than merely
    // looser. The numbers are handed to the keyframes as custom properties.
    function shake(el, n) {
        // Reduced motion gets no shaking, but it can't get nothing either: with
        // no answer to a click there is no reason to try a second one. It dims
        // instead, once per click, and deepens the same way.
        if (reduced) {
            el.style.setProperty('--qk-dim', (1 - n * 0.05).toFixed(2));
            el.classList.remove('quote-dim');
            void el.offsetWidth;
            el.classList.add('quote-dim');
            return;
        }
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
