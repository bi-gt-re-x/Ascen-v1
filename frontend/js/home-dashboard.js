/* home-dashboard.js — the simulated dashboard on the landing page.
 *
 * A mock of the real dashboard that fills itself in when the reader scrolls to
 * it, so the section shows the app working rather than a screenshot of it.
 *
 *      0ms   the frame slides up and fades in
 *    260ms   the sidebar appears
 *    380ms   the nav icons follow, 70ms apart
 *    720ms   the cards arrive, 110ms apart
 *   1150ms   the XP bar fills in three pulls and the XP counter climbs with it
 *   1500ms   the task count climbs
 *   2050ms   the growth rating steps C -> B -> A
 *   2450ms   the level badge flips 8 -> 9
 *   3100ms   the frame starts floating, and keeps floating
 *
 * The numbers are the ones the spec asked for: XP 0 -> 75 -> 220 -> 500, tasks
 * 0 -> 24 -> 67 -> 142, rating C -> B -> A, level 8 -> 9.
 *
 * Every step goes on one cancellable timeline (window.HomePlay), because the
 * reader can scroll away mid-run. Leaving cancels it and puts the mock back to
 * its opening frame, so coming back plays it again from the top rather than
 * catching the tail of the last run.
 */
(function () {
    'use strict';

    var GRADES = ['C', 'B', 'A'];
    var XP_STOPS = [0, 75, 220, 500];
    var TASK_STOPS = [0, 24, 67, 142];
    var BAR_STEPS = [0.10, 0.58, 1];    // the three pulls, as a fraction of full

    document.addEventListener('DOMContentLoaded', function () {
        var play = window.HomePlay;
        var stage = document.getElementById('dashDemo');
        if (!play || !stage) return;

        var frame = stage.querySelector('.dd-frame');
        var navIcons = stage.querySelectorAll('.dd-nav-i');
        var cards = stage.querySelectorAll('.dd-card');
        var bar = document.getElementById('ddBar');
        var xp = document.getElementById('ddXp');
        var tasks = document.getElementById('ddTasks');
        var grade = document.getElementById('ddGrade');
        var level = document.getElementById('ddLevel');

        var tl = null;
        var counters = [];

        function reset() {
            if (tl) tl.cancel();
            counters.forEach(function (c) { c.cancel(); });
            counters = [];

            stage.classList.add('dd-armed');
            frame.classList.remove('dd-float');
            level.classList.remove('is-flipped');
            grade.classList.remove('dd-grade-pop');
            grade.textContent = GRADES[0];
            xp.textContent = '0';
            tasks.textContent = '0';
            bar.style.transform = 'scaleX(0)';

            // Clear the per-element delays from the last run, or the second
            // play would stagger against stale numbers.
            navIcons.forEach(function (el) { el.style.transitionDelay = ''; });
            cards.forEach(function (el) { el.style.transitionDelay = ''; });
        }

        function start() {
            tl = play.timeline();

            navIcons.forEach(function (el, i) {
                el.style.transitionDelay = (380 + i * 70) + 'ms';
            });
            cards.forEach(function (el, i) {
                el.style.transitionDelay = (720 + i * 110) + 'ms';
            });
            stage.querySelector('.dd-side').style.transitionDelay = '260ms';

            // Unarm on the next frame, so the browser has painted the opening
            // state and every transition above has something to move from.
            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    stage.classList.remove('dd-armed');
                });
            });

            // The bar fills in three pulls rather than one sweep, so it reads
            // as work landing in batches.
            BAR_STEPS.forEach(function (fraction, i) {
                tl.at(1150 + i * 420, function () {
                    bar.style.transform = 'scaleX(' + fraction + ')';
                });
            });

            tl.at(1150, function () {
                counters.push(play.countThrough(xp, XP_STOPS, { duration: 1260 }));
            });
            tl.at(1500, function () {
                counters.push(play.countThrough(tasks, TASK_STOPS, { duration: 1260 }));
            });

            // C -> B -> A, each letter popping in over the last.
            GRADES.slice(1).forEach(function (letter, i) {
                tl.at(2050 + i * 400, function () {
                    grade.textContent = letter;
                    grade.classList.remove('dd-grade-pop');
                    void grade.offsetWidth;          // restart the animation
                    grade.classList.add('dd-grade-pop');
                });
            });

            tl.at(2450, function () { level.classList.add('is-flipped'); });

            // Only once everything has landed — a frame that floats while its
            // contents are still arriving reads as unsteady, not alive.
            tl.at(3100, function () { frame.classList.add('dd-float'); });
        }

        function still() {
            stage.classList.remove('dd-armed');
            bar.style.transform = 'scaleX(1)';
            xp.textContent = String(XP_STOPS[XP_STOPS.length - 1]);
            tasks.textContent = String(TASK_STOPS[TASK_STOPS.length - 1]);
            grade.textContent = GRADES[GRADES.length - 1];
            level.classList.add('is-flipped');
        }

        reset();
        play.onView(stage, { play: start, reset: reset, still: still, threshold: 0.3 });
    });
})();
