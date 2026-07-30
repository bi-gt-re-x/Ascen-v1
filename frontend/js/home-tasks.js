/* home-tasks.js — finishing a task, played out on the landing page.
 *
 * The workflow the app is built on, shown rather than described: a pointer
 * moves to the first task, clicks it, the box fills, a little confetti goes up,
 * the row slides out and the list closes over it, and the XP it earned flies to
 * the bar and lands.
 *
 *      0ms   the panel's three rows arrive, 90ms apart
 *    620ms   the pointer comes in from the lower right
 *   1150ms   it reaches the first checkbox
 *   1400ms   it presses
 *   1500ms   the box fills, the check draws, confetti goes up
 *   1900ms   the row slides right and its box closes; the rows below rise
 *   2050ms   "+50 XP" lifts off the row
 *   2350ms   it reaches the bar; the bar grows and the total counts 150 -> 200
 *   2900ms   the pointer leaves
 *
 * Two things are worth knowing about the row leaving. Its height, margin,
 * padding and border are animated to zero alongside the slide, because a
 * transform alone would leave the row's space behind and the list would jump
 * when it was finally removed. And the row is not removed at all — it is left
 * collapsed, so replaying only has to put it back.
 *
 * The confetti and the flying badge are Web Animations, so they can be
 * cancelled outright when the reader scrolls away mid-run.
 */
(function () {
    'use strict';

    var CONFETTI = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#38bdf8'];
    var XP_FROM = 150;
    var XP_TO = 200;
    var BAR_FROM = 0.3;
    var BAR_TO = 0.62;

    document.addEventListener('DOMContentLoaded', function () {
        var play = window.HomePlay;
        var panel = document.getElementById('taskDemo');
        if (!play || !panel) return;

        var list = document.getElementById('tdList');
        var rows = Array.prototype.slice.call(list.querySelectorAll('.td-task'));
        var cursor = document.getElementById('tdCursor');
        var bar = document.getElementById('tdBar');
        var total = document.getElementById('tdXp');
        var first = rows[0];
        var box = first.querySelector('.td-box');

        var tl = null;
        var counter = null;
        var effects = [];      // Web Animations to cancel on reset
        var floaters = [];     // elements to remove on reset

        function clearEffects() {
            effects.forEach(function (a) { try { a.cancel(); } catch (e) { /* done already */ } });
            effects = [];
            floaters.forEach(function (el) { el.remove(); });
            floaters = [];
        }

        function reset() {
            if (tl) tl.cancel();
            if (counter) counter.cancel();
            clearEffects();

            panel.classList.add('td-armed');
            rows.forEach(function (row, i) {
                row.classList.remove('is-leaving', 'is-done');
                row.style.transitionDelay = '';
                void i;
            });
            cursor.classList.remove('is-on', 'is-press');
            cursor.style.transitionDuration = '';
            cursor.style.setProperty('--fx-at', 'none');
            cursor.style.transform = '';
            bar.style.transform = 'scaleX(' + BAR_FROM + ')';
            total.textContent = String(XP_FROM);
        }

        /* Moves the pointer to a point in the panel's own coordinates, over a
         * duration that suits the distance — a hand does not cross the panel in
         * the same time it nudges a few pixels. */
        function moveCursor(x, y, ms) {
            var at = 'translate3d(' + x + 'px,' + y + 'px,0)';
            cursor.style.transitionDuration = '260ms, ' + ms + 'ms';
            cursor.style.setProperty('--fx-at', at);
            cursor.style.transform = at;
        }

        function centreOf(el) {
            var a = el.getBoundingClientRect();
            var b = panel.getBoundingClientRect();
            return { x: a.left - b.left + a.width / 2, y: a.top - b.top + a.height / 2 };
        }

        function confettiAt(point) {
            for (var i = 0; i < 14; i++) {
                var bit = document.createElement('span');
                bit.className = 'fx-confetti';
                bit.style.background = CONFETTI[i % CONFETTI.length];
                bit.style.left = (point.x - 3) + 'px';
                bit.style.top = (point.y - 3) + 'px';
                panel.appendChild(bit);
                floaters.push(bit);

                var angle = (-125 + Math.random() * 70) * Math.PI / 180;
                var reach = 34 + Math.random() * 46;
                effects.push(bit.animate([
                    { transform: 'translate3d(0,0,0) rotate(0deg)', opacity: 1 },
                    {
                        transform: 'translate3d(' + Math.cos(angle) * reach + 'px,' +
                            Math.sin(angle) * reach + 'px,0) rotate(' + (Math.random() * 420 - 210) + 'deg)',
                        opacity: 0
                    }
                ], { duration: 620 + Math.random() * 260, easing: 'cubic-bezier(0.2,0.7,0.3,1)', fill: 'forwards' }));
            }
        }

        function flyXp(from, to, label) {
            var badge = document.createElement('span');
            badge.className = 'fx-xp-fly';
            badge.textContent = label;
            badge.style.left = from.x + 'px';
            badge.style.top = from.y + 'px';
            panel.appendChild(badge);
            floaters.push(badge);

            effects.push(badge.animate([
                { transform: 'translate3d(-50%,-50%,0) scale(0.7)', opacity: 0 },
                { transform: 'translate3d(-50%,-160%,0) scale(1)', opacity: 1, offset: 0.22 },
                {
                    transform: 'translate3d(' + (to.x - from.x) + 'px,' + (to.y - from.y) + 'px,0) ' +
                        'translate(-50%,-50%) scale(0.55)',
                    opacity: 0
                }
            ], { duration: 900, easing: 'cubic-bezier(0.35,0.05,0.2,1)', fill: 'forwards' }));
        }

        function start() {
            tl = play.timeline();

            rows.forEach(function (row, i) { row.style.transitionDelay = (i * 90) + 'ms'; });
            requestAnimationFrame(function () {
                requestAnimationFrame(function () { panel.classList.remove('td-armed'); });
            });

            // In from the lower right, then across to the box.
            tl.at(620, function () {
                var box0 = panel.getBoundingClientRect();
                cursor.style.transitionDuration = '0ms, 0ms';
                var at = 'translate3d(' + (box0.width - 40) + 'px,' + (box0.height + 20) + 'px,0)';
                cursor.style.setProperty('--fx-at', at);
                cursor.style.transform = at;
                // Next frame, or the entrance and the travel collapse into one.
                requestAnimationFrame(function () {
                    cursor.classList.add('is-on');
                    var target = centreOf(box);
                    moveCursor(target.x - 2, target.y - 2, 620);
                });
            });

            tl.at(1400, function () { cursor.classList.add('is-press'); });
            tl.at(1560, function () { cursor.classList.remove('is-press'); });

            tl.at(1500, function () {
                first.classList.add('is-done');
                confettiAt(centreOf(box));
            });

            tl.at(1900, function () { first.classList.add('is-leaving'); });

            tl.at(2050, function () {
                flyXp(centreOf(first), centreOf(bar), '+50 XP');
            });

            tl.at(2350, function () {
                bar.style.transform = 'scaleX(' + BAR_TO + ')';
                counter = play.countThrough(total, [XP_FROM, XP_TO], { duration: 700 });
            });

            tl.at(2900, function () {
                var b = panel.getBoundingClientRect();
                moveCursor(b.width - 40, b.height + 20, 620);
                cursor.classList.remove('is-on');
            });
        }

        function still() {
            panel.classList.remove('td-armed');
            first.classList.add('is-done', 'is-leaving');
            bar.style.transform = 'scaleX(' + BAR_TO + ')';
            total.textContent = String(XP_TO);
        }

        reset();
        play.onView(panel, { play: start, reset: reset, still: still, threshold: 0.4 });
    });
})();
