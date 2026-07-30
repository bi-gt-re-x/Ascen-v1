/* home-streak.js — the streak catching, and the XP history writing itself.
 *
 * Two small demonstrations in the Streak & Level section.
 *
 * The streak. Three flames light one after another, the count climbs
 * 0 -> 7 -> 14 -> 28 alongside them, and a few sparks go up with each. Once
 * all three are lit they keep flickering, slightly out of step with each
 * other, so the card is never quite still.
 *
 * The XP history. The rail draws itself top to bottom, the three events hang
 * themselves off it in order, then the level badge flips 9 -> 10, the bar runs
 * to full and a light sweeps across it.
 *
 * Both reset when the reader leaves and play again on the way back — the
 * sparks are Web Animations so they can be cancelled outright rather than
 * finishing over a card that has already gone back to its opening state.
 */
(function () {
    'use strict';

    // Escaped rather than literal, so the file survives any re-encoding.
    var FLAME = '\uD83D\uDD25';   // the fire emoji
    var STREAK_STOPS = [0, 7, 14, 28];

    document.addEventListener('DOMContentLoaded', function () {
        var play = window.HomePlay;
        if (!play) return;
        setupStreak(play);
        setupHistory(play);
    });

    // ------------------------------------------------------------------
    // The streak card
    // ------------------------------------------------------------------
    function setupStreak(play) {
        var card = document.getElementById('streakDemo');
        var flames = document.getElementById('skFlames');
        var num = document.getElementById('skNum');
        if (!card || !flames || !num) return;

        var target = parseInt(num.textContent, 10) || 28;
        var tl = null;
        var counter = null;
        var effects = [];
        var sparks = [];

        function clearSparks() {
            effects.forEach(function (a) { try { a.cancel(); } catch (e) { /* done */ } });
            effects = [];
            sparks.forEach(function (el) { el.remove(); });
            sparks = [];
        }

        function reset() {
            if (tl) tl.cancel();
            if (counter) counter.cancel();
            clearSparks();
            flames.classList.remove('is-lit');
            flames.textContent = '';
            num.textContent = '0';
        }

        function sparkFrom(el) {
            var a = el.getBoundingClientRect();
            var b = card.getBoundingClientRect();
            for (var i = 0; i < 5; i++) {
                var s = document.createElement('span');
                s.className = 'sk-spark';
                s.style.left = (a.left - b.left + a.width / 2) + 'px';
                s.style.top = (a.top - b.top + 2) + 'px';
                card.appendChild(s);
                sparks.push(s);
                effects.push(s.animate([
                    { transform: 'translate3d(0,0,0) scale(1)', opacity: 1 },
                    {
                        transform: 'translate3d(' + (Math.random() * 26 - 13) + 'px,' +
                            (-18 - Math.random() * 22) + 'px,0) scale(0.2)',
                        opacity: 0
                    }
                ], { duration: 700 + Math.random() * 300, easing: 'cubic-bezier(0.25,0.7,0.35,1)', fill: 'forwards' }));
            }
        }

        function light(i) {
            var flame = document.createElement('span');
            flame.textContent = FLAME;
            flame.className = 'is-new';
            flames.appendChild(flame);
            sparkFrom(flame);
            if (i === 2) {
                // Only start the idle flicker once the last one is up, or the
                // first two would be flickering while the third ignites.
                setTimeout(function () { flames.classList.add('is-lit'); }, 620);
            }
        }

        function start() {
            tl = play.timeline();
            for (var i = 0; i < 3; i++) {
                (function (n) { tl.at(220 + n * 420, function () { light(n); }); })(i);
            }
            tl.at(220, function () {
                counter = play.countThrough(num, STREAK_STOPS, { duration: 1400 });
            });
        }

        function still() {
            flames.textContent = '';
            for (var i = 0; i < 3; i++) {
                var f = document.createElement('span');
                f.textContent = FLAME;
                flames.appendChild(f);
            }
            num.textContent = String(target);
        }

        reset();
        play.onView(card, { play: start, reset: reset, still: still, threshold: 0.5 });
    }

    // ------------------------------------------------------------------
    // The XP history
    // ------------------------------------------------------------------
    function setupHistory(play) {
        var card = document.getElementById('xpDemo');
        if (!card) return;

        var track = document.getElementById('xpTrack');
        var rows = Array.prototype.slice.call(card.querySelectorAll('.xp-row'));
        var level = document.getElementById('xpLevel');
        var bar = document.getElementById('xpBar');
        var wrap = bar ? bar.parentNode : null;

        // The width in the markup is where the bar ends up.
        var full = bar ? bar.style.width : '78%';

        var tl = null;

        function reset() {
            if (tl) tl.cancel();
            track.classList.add('xp-armed');
            rows.forEach(function (row) { row.style.transitionDelay = ''; });
            if (level) level.classList.remove('is-flipped');
            if (bar) bar.style.width = '0%';
            if (wrap) wrap.classList.remove('is-full');
        }

        function start() {
            tl = play.timeline();
            // The rail draws first; the events hang off it as it passes them.
            rows.forEach(function (row, i) { row.style.transitionDelay = (420 + i * 260) + 'ms'; });

            requestAnimationFrame(function () {
                requestAnimationFrame(function () { track.classList.remove('xp-armed'); });
            });

            tl.at(1500, function () { if (level) level.classList.add('is-flipped'); });
            tl.at(1700, function () { if (bar) bar.style.width = full; });
            tl.at(2500, function () {
                if (!wrap) return;
                wrap.classList.remove('is-full');
                void wrap.offsetWidth;
                wrap.classList.add('is-full');
            });
        }

        function still() {
            track.classList.remove('xp-armed');
            if (level) level.classList.add('is-flipped');
            if (bar) bar.style.width = full;
        }

        reset();
        play.onView(card, { play: start, reset: reset, still: still, threshold: 0.35 });
    }
})();
