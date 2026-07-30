/* home-play.js — the bits every demo on the landing page needs.
 *
 * The demos (the dashboard, the task list, the calendar, the charts) all work
 * the same way: they sit still until the reader scrolls to them, run once, and
 * hold their finished state. Scroll away and back and they run again, from the
 * beginning. This file is that behaviour, plus the two helpers the demos share
 * — a cancellable timeline and a counter that climbs through waypoints.
 *
 * Everything here is cancellable, and that is the point. A reader who scrolls
 * past a half-played demo and comes back must see it start cleanly, not catch
 * the tail of the last run. `onView` cancels before it replays, and each demo
 * hands back the handles it created so there is nothing left running.
 *
 * Exposed as window.HomePlay because the landing page has no module system.
 */
(function () {
    'use strict';

    var reduced = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* A list of callbacks at millisecond offsets, all of which can be called
     * off at once. `at(0, fn)` still defers by a tick, so a timeline is always
     * asynchronous whatever offsets it is given — a demo that ran its first
     * step synchronously and the rest later would be hard to reason about. */
    function timeline() {
        var timers = [];
        var api = {
            at: function (ms, fn) {
                timers.push(setTimeout(fn, ms));
                return api;
            },
            cancel: function () {
                timers.forEach(clearTimeout);
                timers = [];
            }
        };
        return api;
    }

    /* Climbs a number through a series of waypoints — 0 → 75 → 220 → 500 —
     * easing into and out of each one, so it reads as a figure being counted up
     * in stages rather than a single sweep. Each leg gets an equal share of the
     * time regardless of how far it travels, which is what makes the small
     * early steps feel deliberate.
     *
     * Returns a handle; call .cancel() to stop it where it is, or .finish() to
     * jump it to the last waypoint. */
    function countThrough(el, stops, options) {
        options = options || {};
        var total = options.duration || 1600;
        var format = options.format || function (v) { return String(Math.round(v)); };
        var frame = null;

        function set(v) { el.textContent = format(v); }

        if (reduced || stops.length < 2) {
            set(stops[stops.length - 1]);
            return { cancel: function () {}, finish: function () {} };
        }

        var legs = stops.length - 1;
        var legMs = total / legs;
        var t0 = null;

        function step(now) {
            if (t0 === null) t0 = now;
            var elapsed = now - t0;
            if (elapsed >= total) { set(stops[legs]); frame = null; return; }

            var leg = Math.min(legs - 1, Math.floor(elapsed / legMs));
            var p = (elapsed - leg * legMs) / legMs;
            // Ease in and out of every waypoint, so each one is a beat.
            var eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
            set(stops[leg] + (stops[leg + 1] - stops[leg]) * eased);
            frame = requestAnimationFrame(step);
        }

        set(stops[0]);
        frame = requestAnimationFrame(step);

        return {
            cancel: function () { if (frame) { cancelAnimationFrame(frame); frame = null; } },
            finish: function () { this.cancel(); set(stops[legs]); }
        };
    }

    /* Runs `spec.play` when `el` scrolls into view and `spec.reset` when it
     * leaves, so the demo is always either playing forward or back at its
     * start — never stuck halfway.
     *
     * With less motion asked for, `spec.still` is called once instead: the
     * demo's finished state, painted immediately, with nothing moving. */
    function onView(el, spec) {
        if (!el) return;

        if (reduced || !('IntersectionObserver' in window)) {
            if (spec.still) spec.still();
            else if (spec.play) spec.play();
            return;
        }

        var playing = false;
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    if (playing) return;
                    playing = true;
                    if (spec.reset) spec.reset();
                    if (spec.play) spec.play();
                } else if (playing) {
                    playing = false;
                    if (spec.reset) spec.reset();
                }
            });
        }, { threshold: spec.threshold || 0.35 });

        io.observe(el);
    }

    window.HomePlay = {
        reduced: reduced,
        timeline: timeline,
        countThrough: countThrough,
        onView: onView
    };
})();
