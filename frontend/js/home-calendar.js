/* home-calendar.js — planning a week, played out on the landing page.
 *
 * The week grid fills in, a pointer picks "Math revision" up off Monday and
 * carries it to Tuesday, the column it is over lights up, the event snaps in
 * with a small overshoot, then a new task appears on Wednesday, gets ticked
 * off, pays its XP and pushes the streak from 27 to 28.
 *
 *      0ms   the events fade onto the grid, 70ms apart
 *    700ms   the pointer arrives on Monday's "Math revision"
 *   1050ms   it presses; the event lifts, tilts and casts further
 *   1250ms   pointer and event travel to Tuesday; the column highlights
 *   1950ms   released: the event lands in Tuesday's column with an overshoot
 *   2350ms   a new task appears on Wednesday
 *   2750ms   the pointer moves to it and clicks
 *   3050ms   it is ticked off, "+40 XP" floats away, the flame takes the streak
 *            to 28
 *   3700ms   the pointer leaves
 *
 * The drag is a transform, and the drop is a real move: the event is appended
 * to Tuesday's column and the transform cleared in the same frame, so it stays
 * exactly where it was on screen while changing which column owns it. Anything
 * else makes it jump at the handover.
 */
(function () {
    'use strict';

    var STREAK_FROM = 27;
    var STREAK_TO = 28;

    /* Where the dragged event lands on Tuesday, and what that slot is called.
     *
     * Tuesday already holds "Goal review" from 14% to 44% of the column, so
     * dropping at 30% — the middle, which is where a naive drop goes — would
     * bury one under the other. 50% clears it with room to spare.
     *
     * The column's own scale is set by the event being dragged: it starts at
     * 4% labelled 9:00 and is 22% tall for its hour, so 22% is an hour and
     * 50% is 9:00 plus (50-4)/22 hours — eleven o'clock. Moving an event has
     * to move its time with it, or the card is showing two different answers.
     */
    var DROP_TOP = 50;
    var DROP_TIME = '11:00–12:00';

    document.addEventListener('DOMContentLoaded', function () {
        var play = window.HomePlay;
        var card = document.getElementById('calDemo');
        if (!play || !card) return;

        var from = document.getElementById('calFrom');
        var to = document.getElementById('calTo');
        var newHost = document.getElementById('calNewHost');
        var drag = document.getElementById('calDrag');
        var cursor = document.getElementById('calCursor');
        var streak = document.getElementById('calStreak');
        var streakNum = document.getElementById('calStreakNum');

        // Remember where the dragged event started, so a replay can put it back.
        var homeParent = drag.parentNode;
        var homeTop = drag.style.top;
        var dragTime = drag.querySelector('small');
        var homeTime = dragTime ? dragTime.textContent : '';

        var tl = null;
        var effects = [];
        var floaters = [];
        var fresh = null;

        function clearEffects() {
            effects.forEach(function (a) { try { a.cancel(); } catch (e) { /* done */ } });
            effects = [];
            floaters.forEach(function (el) { el.remove(); });
            floaters = [];
        }

        function reset() {
            if (tl) tl.cancel();
            clearEffects();
            if (fresh) { fresh.remove(); fresh = null; }

            card.classList.add('cal-armed');
            drag.classList.remove('is-dragging', 'is-dropped');
            drag.style.removeProperty('--cal-dx');
            drag.style.removeProperty('--cal-dy');
            drag.style.top = homeTop;
            if (dragTime) dragTime.textContent = homeTime;
            if (drag.parentNode !== homeParent) homeParent.appendChild(drag);

            to.classList.remove('is-target');
            cursor.classList.remove('is-on', 'is-press');
            cursor.style.transitionDuration = '';
            cursor.style.setProperty('--fx-at', 'none');
            cursor.style.transform = '';
            streak.classList.remove('is-lit');
            streakNum.textContent = String(STREAK_FROM);

            card.querySelectorAll('.lp-ev').forEach(function (ev, i) {
                ev.style.transitionDelay = '';
                ev.classList.remove('is-done');
                void i;
            });
        }

        function moveCursor(x, y, ms) {
            var at = 'translate3d(' + x + 'px,' + y + 'px,0)';
            cursor.style.transitionDuration = '260ms, ' + ms + 'ms';
            cursor.style.setProperty('--fx-at', at);
            cursor.style.transform = at;
        }

        function pointIn(el, fx, fy) {
            var a = el.getBoundingClientRect();
            var b = card.getBoundingClientRect();
            return { x: a.left - b.left + a.width * fx, y: a.top - b.top + a.height * fy };
        }

        function flyXp(at, label) {
            var badge = document.createElement('span');
            badge.className = 'fx-xp-fly';
            badge.textContent = label;
            badge.style.left = at.x + 'px';
            badge.style.top = at.y + 'px';
            card.appendChild(badge);
            floaters.push(badge);
            effects.push(badge.animate([
                { transform: 'translate3d(-50%,-50%,0) scale(0.7)', opacity: 0 },
                { transform: 'translate3d(-50%,-130%,0) scale(1)', opacity: 1, offset: 0.3 },
                { transform: 'translate3d(-50%,-260%,0) scale(0.9)', opacity: 0 }
            ], { duration: 1100, easing: 'cubic-bezier(0.25,0.6,0.3,1)', fill: 'forwards' }));
        }

        function start() {
            tl = play.timeline();

            card.querySelectorAll('.lp-ev').forEach(function (ev, i) {
                ev.style.transitionDelay = (i * 70) + 'ms';
            });
            requestAnimationFrame(function () {
                requestAnimationFrame(function () { card.classList.remove('cal-armed'); });
            });

            // --- the pointer arrives on Monday's event ---
            tl.at(560, function () {
                var start0 = pointIn(card, 0.62, 1.08);
                cursor.style.transitionDuration = '0ms, 0ms';
                var at = 'translate3d(' + start0.x + 'px,' + start0.y + 'px,0)';
                cursor.style.setProperty('--fx-at', at);
                cursor.style.transform = at;
                requestAnimationFrame(function () {
                    cursor.classList.add('is-on');
                    var grab = pointIn(drag, 0.5, 0.45);
                    moveCursor(grab.x, grab.y, 620);
                });
            });

            // --- picked up ---
            tl.at(1050, function () {
                cursor.classList.add('is-press');
                drag.classList.add('is-dragging');
            });

            // --- carried across to Tuesday ---
            tl.at(1250, function () {
                var a = drag.getBoundingClientRect();
                var b = to.getBoundingClientRect();
                // Centred on Tuesday's column, and low enough to clear the
                // event already sitting there — see DROP_TOP.
                var dx = b.left + b.width / 2 - (a.left + a.width / 2);
                var dy = b.top + b.height * (DROP_TOP / 100) - a.top;
                drag.style.setProperty('--cal-dx', dx + 'px');
                drag.style.setProperty('--cal-dy', dy + 'px');
                to.classList.add('is-target');

                var here = pointIn(drag, 0.5, 0.45);
                moveCursor(here.x + dx, here.y + dy, 620);
            });

            // --- released: hand the event to Tuesday without it moving ---
            tl.at(1950, function () {
                cursor.classList.remove('is-press');
                to.classList.remove('is-target');

                drag.classList.remove('is-dragging');
                drag.style.removeProperty('--cal-dx');
                drag.style.removeProperty('--cal-dy');
                to.appendChild(drag);
                // The transform put it at exactly DROP_TOP of the column, so
                // handing ownership over at that same percentage leaves it
                // where it already is on screen — no jump at the handover.
                drag.style.top = DROP_TOP + '%';
                if (dragTime) dragTime.textContent = DROP_TIME;
                drag.classList.add('is-dropped');
            });

            // --- a new task turns up on Wednesday ---
            tl.at(2350, function () {
                fresh = document.createElement('span');
                fresh.className = 'lp-ev lp-ev-b';
                fresh.style.top = '80%';
                fresh.style.height = '16%';
                fresh.innerHTML = '<b>Revision recap</b><small>3:00</small>';
                newHost.appendChild(fresh);
                effects.push(fresh.animate([
                    { opacity: 0, transform: 'translate3d(0,10px,0) scale(0.94)' },
                    { opacity: 1, transform: 'translate3d(0,0,0) scale(1)' }
                ], { duration: 420, easing: 'cubic-bezier(0.22,0.68,0.28,1)', fill: 'forwards' }));
            });

            // --- and gets ticked off ---
            tl.at(2750, function () {
                if (!fresh) return;
                var at = pointIn(fresh, 0.5, 0.5);
                moveCursor(at.x, at.y, 520);
            });
            tl.at(3000, function () { cursor.classList.add('is-press'); });
            tl.at(3140, function () { cursor.classList.remove('is-press'); });

            tl.at(3050, function () {
                if (!fresh) return;
                fresh.classList.add('is-done');
                flyXp(pointIn(fresh, 0.5, 0.2), '+40 XP');
                streakNum.textContent = String(STREAK_TO);
                streak.classList.remove('is-lit');
                void streak.offsetWidth;
                streak.classList.add('is-lit');
            });

            tl.at(3700, function () {
                var out = pointIn(card, 0.62, 1.08);
                moveCursor(out.x, out.y, 620);
                cursor.classList.remove('is-on');
            });
        }

        function still() {
            card.classList.remove('cal-armed');
            // The outcome, painted directly: the event on Tuesday at its new
            // time, and the streak already counted.
            to.appendChild(drag);
            drag.style.top = DROP_TOP + '%';
            if (dragTime) dragTime.textContent = DROP_TIME;
            streakNum.textContent = String(STREAK_TO);
        }

        reset();
        play.onView(card, { play: start, reset: reset, still: still, threshold: 0.35 });
    });
})();
