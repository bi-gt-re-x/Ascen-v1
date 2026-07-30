/* home-charts.js — the charts and the gauge draw themselves.
 *
 * Every chart on the page is SVG that was already in the markup. Nothing here
 * invents data; it measures what is there and animates it into place:
 *
 *   line charts   the grid fades, then each grid line draws left to right,
 *                 then the line draws itself across, then the points pop in
 *                 along it, then the area underneath fades up
 *   bar charts    bars grow from nothing on a curve that overshoots slightly
 *                 and settles, one after another
 *   the gauge     the ring winds round while the percentage counts up, and the
 *                 grade steps F -> D -> C -> B -> A -> S beside it
 *
 * Two things are measured rather than written down. Dash lengths come from
 * getTotalLength(), so editing a chart's `d` never leaves the animation drawing
 * the wrong amount. And the points are placed with getPointAtLength() at even
 * intervals along the real path, so they sit on the line by construction
 * instead of by a second list of coordinates that could drift out of step.
 *
 * Hovering a point enlarges it, floats a tooltip above it and thickens the
 * line; hovering a bar lifts it and floats its value. Both are real pointer
 * interactions, not part of the timeline.
 */
(function () {
    'use strict';

    var GRADES = ['F', 'D', 'C', 'B', 'A', 'S'];

    document.addEventListener('DOMContentLoaded', function () {
        var play = window.HomePlay;
        if (!play) return;

        document.querySelectorAll('.lp-area-lg').forEach(function (svg) {
            setupLine(play, svg, { points: 7, labels: labelsFor(svg) });
        });
        document.querySelectorAll('.lp-chart-sm .lp-spark, .lp-metric > .lp-spark').forEach(function (svg) {
            setupLine(play, svg, { points: 5, labels: null });
        });
        document.querySelectorAll('.lp-bars-sm').forEach(function (svg) {
            setupBars(play, svg);
        });
        setupGauge(play);
    });

    // The x-axis labels already under the chart, reused for the tooltips.
    function labelsFor(svg) {
        var chart = svg.closest('.lp-perf-main');
        if (!chart) return null;
        var row = chart.querySelector('.lp-chart-x');
        if (!row) return null;
        return Array.prototype.map.call(row.children, function (el) { return el.textContent.trim(); });
    }

    // ------------------------------------------------------------------
    // Line charts
    // ------------------------------------------------------------------
    function setupLine(play, svg, options) {
        var line = svg.querySelector('path[fill="none"], polyline');
        if (!line) return;

        var area = svg.querySelector('path[fill^="url"]');
        var grid = Array.prototype.slice.call(svg.querySelectorAll('.lp-grid'));
        var host = svg.closest('.lp-chart') || svg.parentNode;

        // The dot already in the markup is a decoration at a fixed spot; the
        // measured points replace it.
        var stray = svg.querySelector('circle.lp-dotm');
        if (stray) stray.remove();

        var length = 0;
        try { length = line.getTotalLength(); } catch (e) { return; }

        line.classList.add('ch-line');
        line.style.strokeDasharray = length;
        if (area) area.classList.add('ch-area');
        grid.forEach(function (g) { g.classList.add('ch-grid-line'); });

        // Points, evenly spaced along the real path.
        var dots = [];
        var count = options.points;
        for (var i = 0; i < count; i++) {
            var dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            dot.setAttribute('r', 4.5);
            dot.setAttribute('fill', 'currentColor');
            dot.setAttribute('class', 'ch-dot');
            svg.appendChild(dot);
            dots.push(dot);
        }
        placeDots();

        function placeDots() {
            for (var i = 0; i < dots.length; i++) {
                var at = line.getPointAtLength(length * (i / (dots.length - 1)));
                dots[i].setAttribute('cx', at.x);
                dots[i].setAttribute('cy', at.y);
            }
        }

        /* The Daily/Weekly tabs (home-fx.js) rewrite the path. Re-measure when
         * they do, or the dash would be cut for a shape that no longer exists
         * and the points would sit off the new line. */
        if (window.MutationObserver) {
            new MutationObserver(function () {
                var next = 0;
                try { next = line.getTotalLength(); } catch (e) { return; }
                if (!next || Math.abs(next - length) < 0.5) return;
                length = next;
                line.style.strokeDasharray = length;
                line.style.strokeDashoffset = svg.classList.contains('ch-armed') ? length : 0;
                placeDots();
            }).observe(line, { attributes: true, attributeFilter: ['d', 'points'] });
        }

        var tip = null;
        if (options.labels) {
            tip = document.createElement('span');
            tip.className = 'ch-tip';
            host.appendChild(tip);
            if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
        }

        var tl = null;

        function reset() {
            if (tl) tl.cancel();
            svg.classList.add('ch-armed');
            line.style.strokeDashoffset = length;
            grid.forEach(function (g, i) { g.style.transitionDelay = ''; void i; });
            dots.forEach(function (d) { d.style.transitionDelay = ''; });
            if (tip) tip.classList.remove('is-on');
        }

        function start() {
            tl = play.timeline();
            grid.forEach(function (g, i) { g.style.transitionDelay = (i * 90) + 'ms'; });
            // The points come in behind the line as it passes them.
            dots.forEach(function (d, i) { d.style.transitionDelay = (700 + i * 90) + 'ms'; });

            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    svg.classList.remove('ch-armed');
                    line.style.strokeDashoffset = 0;
                });
            });
        }

        function still() {
            svg.classList.remove('ch-armed');
            line.style.strokeDashoffset = 0;
        }

        reset();
        play.onView(svg, { play: start, reset: reset, still: still, threshold: 0.3 });

        // --- hover ---
        if (!play.reduced) {
            dots.forEach(function (dot, i) {
                dot.addEventListener('pointerenter', function () {
                    dot.classList.add('is-hot');
                    line.style.strokeWidth = lineWidth(line) + 1;
                    if (!tip || !options.labels) return;
                    var box = dot.getBoundingClientRect();
                    var hostBox = host.getBoundingClientRect();
                    tip.textContent = (options.labels[i] || '') + ' · ' + valueAt(svg, dot);
                    tip.style.left = (box.left - hostBox.left + box.width / 2) + 'px';
                    tip.style.top = (box.top - hostBox.top) + 'px';
                    tip.classList.add('is-on');
                });
                dot.addEventListener('pointerleave', function () {
                    dot.classList.remove('is-hot');
                    line.style.strokeWidth = '';
                    if (tip) tip.classList.remove('is-on');
                });
            });
        }
    }

    function lineWidth(line) {
        return parseFloat(getComputedStyle(line).strokeWidth) || 3;
    }

    /* The chart's own y-axis labels say what the top and bottom of the box
     * mean, so a point's height can be read back as a number rather than
     * invented. Falls back to a percentage of the box when there are none. */
    function valueAt(svg, dot) {
        var chart = svg.closest('.lp-chart');
        var axis = chart && chart.querySelector('.lp-chart-y');
        var box = svg.viewBox.baseVal;
        var y = parseFloat(dot.getAttribute('cy'));
        var fraction = 1 - (y - box.y) / box.height;

        if (axis && axis.children.length >= 2) {
            var top = parseFloat(axis.children[0].textContent);
            var bottom = parseFloat(axis.children[axis.children.length - 1].textContent);
            if (!isNaN(top) && !isNaN(bottom)) {
                return Math.round(bottom + (top - bottom) * fraction);
            }
        }
        return Math.round(fraction * 100) + '%';
    }

    // ------------------------------------------------------------------
    // Bar charts
    // ------------------------------------------------------------------
    function setupBars(play, svg) {
        var bars = Array.prototype.slice.call(svg.querySelectorAll('rect'));
        if (!bars.length) return;

        var host = svg.parentNode;
        if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

        var tip = document.createElement('span');
        tip.className = 'ch-tip';
        host.appendChild(tip);

        // The heights stay in the markup; only a scale is animated. Each bar's
        // own height is kept for the hover readout.
        var heights = bars.map(function (bar) {
            bar.classList.add('ch-bar');
            return parseFloat(bar.getAttribute('height'));
        });

        var box = svg.viewBox.baseVal;

        function reset() {
            svg.classList.add('ch-armed');
            bars.forEach(function (bar) { bar.style.transitionDelay = ''; });
        }

        function start() {
            // One after another, on a curve that overshoots and settles.
            bars.forEach(function (bar, i) { bar.style.transitionDelay = (i * 70) + 'ms'; });
            requestAnimationFrame(function () {
                requestAnimationFrame(function () { svg.classList.remove('ch-armed'); });
            });
        }

        function still() { svg.classList.remove('ch-armed'); }

        reset();
        play.onView(svg, { play: start, reset: reset, still: still, threshold: 0.4 });

        if (play.reduced) return;
        bars.forEach(function (bar, i) {
            bar.addEventListener('pointerenter', function () {
                bar.classList.add('is-hot');
                var b = bar.getBoundingClientRect();
                var h = host.getBoundingClientRect();
                // Height as a share of the plot box, read off the bar itself.
                tip.textContent = Math.round(heights[i] / box.height * 100) + '%';
                tip.style.left = (b.left - h.left + b.width / 2) + 'px';
                tip.style.top = (b.top - h.top) + 'px';
                tip.classList.add('is-on');
            });
            bar.addEventListener('pointerleave', function () {
                bar.classList.remove('is-hot');
                tip.classList.remove('is-on');
            });
        });
    }

    // ------------------------------------------------------------------
    // The growth rating gauge
    // ------------------------------------------------------------------
    function setupGauge(play) {
        var card = document.getElementById('ringCard');
        var arc = document.getElementById('ringArc');
        var num = document.getElementById('ringNum');
        var badge = document.getElementById('gradeBadge');
        if (!card || !arc || !num) return;

        // Where the markup leaves the ring is what "full" means here.
        var dash = parseFloat(arc.getAttribute('stroke-dasharray'));
        var end = parseFloat(arc.getAttribute('stroke-dashoffset'));
        var target = parseInt(num.textContent, 10) || 96;

        var tl = null;
        var counter = null;

        function reset() {
            if (tl) tl.cancel();
            if (counter) counter.cancel();
            arc.style.strokeDashoffset = dash;
            num.textContent = '12%';
            if (badge) badge.textContent = GRADES[0];
        }

        function start() {
            tl = play.timeline();
            requestAnimationFrame(function () {
                requestAnimationFrame(function () { arc.style.strokeDashoffset = end; });
            });
            counter = play.countThrough(num, [12, target], {
                duration: 1400,
                format: function (v) { return Math.round(v) + '%'; }
            });

            if (badge) {
                GRADES.forEach(function (letter, i) {
                    if (!i) return;
                    tl.at(240 * i, function () {
                        badge.textContent = letter;
                        badge.classList.remove('gr-pop');
                        void badge.offsetWidth;
                        badge.classList.add('gr-pop');
                    });
                });
            }
        }

        function still() {
            arc.style.strokeDashoffset = end;
            num.textContent = target + '%';
            if (badge) badge.textContent = GRADES[GRADES.length - 1];
        }

        reset();
        play.onView(card, { play: start, reset: reset, still: still, threshold: 0.5 });
    }
})();
