/* home-final.js — the last of the landing page's motion.
 *
 * Five small things, none of which needed a demo of its own:
 *
 *   philosophy      the four line icons stroke themselves on, and the cards
 *                   stagger in 150ms apart
 *   tech stack      the cards rise, their icons untwist, each named technology
 *                   arrives on its own, and wires draw between the boxes in
 *                   order — frontend, then backend, then database
 *   trend arrows    the little green triangles slide up into place while their
 *                   percentages count from zero
 *   theme           the switch fades over 500ms instead of cutting, by putting
 *                   a class on <html> for exactly as long as the fade lasts
 *   the closing CTA the glow behind it comes up, the button breathes every four
 *                   seconds, and a ripple opens where it is clicked
 *
 * The wires are the only fiddly part. They are drawn between the *measured*
 * centres of the cards, so they follow the grid however it reflows — two
 * columns on a narrow screen, four on a wide one — and they are redrawn on
 * resize rather than being written down as coordinates that would only be
 * right at one width.
 */
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        var play = window.HomePlay;
        if (!play) return;

        setupPhilosophy(play);
        setupTech(play);
        setupTrends(play);
        setupThemeFade();
        setupFinalCta(play);
    });

    // ------------------------------------------------------------------
    // Philosophy
    // ------------------------------------------------------------------
    function setupPhilosophy(play) {
        var grid = document.getElementById('philoGrid');
        if (!grid) return;

        var cards = Array.prototype.slice.call(grid.querySelectorAll('.lp-phi'));
        var paths = Array.prototype.slice.call(grid.querySelectorAll('.ph-ico path'));

        // Each path gets its own dash length, or the short strokes finish long
        // before the long ones start.
        paths.forEach(function (path) {
            var len = 120;
            try { len = Math.ceil(path.getTotalLength()); } catch (e) { /* keep default */ }
            path.style.setProperty('--ph-len', len);
        });

        function reset() {
            grid.classList.add('ph-armed');
            cards.forEach(function (c) { c.style.transitionDelay = ''; });
            paths.forEach(function (p) { p.style.transitionDelay = ''; });
        }

        function start() {
            cards.forEach(function (c, i) { c.style.transitionDelay = (i * 150) + 'ms'; });
            // The icon draws once its card has arrived.
            paths.forEach(function (p, i) {
                p.style.transitionDelay = (260 + Math.floor(i / (paths.length / cards.length || 1)) * 150) + 'ms';
            });
            requestAnimationFrame(function () {
                requestAnimationFrame(function () { grid.classList.remove('ph-armed'); });
            });
        }

        reset();
        play.onView(grid, { play: start, reset: reset, still: function () { grid.classList.remove('ph-armed'); }, threshold: 0.25 });
    }

    // ------------------------------------------------------------------
    // Technology stack
    // ------------------------------------------------------------------
    function setupTech(play) {
        var grid = document.getElementById('techGrid');
        var wires = document.getElementById('techWires');
        if (!grid) return;

        var cards = Array.prototype.slice.call(grid.querySelectorAll('.lp-techitem'));

        // Split each card's list into its own spans so they can arrive in turn.
        cards.forEach(function (card) {
            var p = card.querySelector('p');
            if (!p || p.querySelector('.tech-bit')) return;
            var parts = p.textContent.split('·');
            p.textContent = '';
            parts.forEach(function (part, i) {
                if (i) p.appendChild(document.createTextNode(' · '));
                var bit = document.createElement('span');
                bit.className = 'tech-bit';
                bit.textContent = part.trim();
                p.appendChild(bit);
            });
        });

        var bits = Array.prototype.slice.call(grid.querySelectorAll('.tech-bit'));
        var lines = [];

        /* One wire between each neighbouring pair of cards, measured off the
         * grid as it currently is. Cards that have wrapped onto another row are
         * skipped — a wire running backwards across the grid reads as a mistake
         * rather than a connection. */
        function drawWires() {
            if (!wires) return;
            while (wires.firstChild) wires.removeChild(wires.firstChild);
            lines = [];

            var box = grid.getBoundingClientRect();
            wires.setAttribute('viewBox', '0 0 ' + box.width + ' ' + box.height);

            for (var i = 0; i < cards.length - 1; i++) {
                var a = cards[i].getBoundingClientRect();
                var b = cards[i + 1].getBoundingClientRect();
                if (b.left < a.left) continue;   // wrapped to the next row

                var x1 = a.right - box.left;
                var x2 = b.left - box.left;
                var y1 = a.top - box.top + a.height / 2;
                var y2 = b.top - box.top + b.height / 2;

                var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', x1);
                line.setAttribute('y1', y1);
                line.setAttribute('x2', x2);
                line.setAttribute('y2', y2);
                line.setAttribute('class', 'tech-wire');
                wires.appendChild(line);

                var len = Math.max(1, x2 - x1);
                line.style.setProperty('--wire-len', len);
                line.style.strokeDasharray = len;
                line.style.transitionDelay = (700 + i * 240) + 'ms';
                lines.push(line);

                /* The gap between two cards is only as wide as the grid's
                 * gutter, so a bare line is a stub you would not notice. A node
                 * at the midpoint, popping in as the wire lands, is what makes
                 * it read as a connection. */
                var node = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                node.setAttribute('cx', (x1 + x2) / 2);
                node.setAttribute('cy', (y1 + y2) / 2);
                node.setAttribute('r', 3.5);
                node.setAttribute('class', 'tech-node');
                node.style.transitionDelay = (1000 + i * 240) + 'ms';
                wires.appendChild(node);
            }
        }

        function reset() {
            grid.classList.add('tech-armed');
            cards.forEach(function (c) { c.style.transitionDelay = ''; });
            bits.forEach(function (b) { b.style.transitionDelay = ''; });
            drawWires();
        }

        function start() {
            drawWires();
            cards.forEach(function (c, i) { c.style.transitionDelay = (i * 120) + 'ms'; });
            bits.forEach(function (b, i) { b.style.transitionDelay = (420 + i * 90) + 'ms'; });
            requestAnimationFrame(function () {
                requestAnimationFrame(function () { grid.classList.remove('tech-armed'); });
            });
        }

        reset();
        play.onView(grid, { play: start, reset: reset, still: function () { drawWires(); grid.classList.remove('tech-armed'); }, threshold: 0.25 });

        var timer = null;
        window.addEventListener('resize', function () {
            clearTimeout(timer);
            timer = setTimeout(drawWires, 150);
        });
    }

    // ------------------------------------------------------------------
    // Trend arrows
    // ------------------------------------------------------------------
    function setupTrends(play) {
        var trends = Array.prototype.slice.call(document.querySelectorAll('.lp-trend.up'));
        if (!trends.length) return;

        trends.forEach(function (trend) {
            // "▲ 8%" becomes an arrow that can move and a number that can count.
            var text = trend.textContent.trim();
            var match = text.match(/^(\D*)(\d[\d.,]*)(.*)$/);
            if (!match) return;

            var value = parseFloat(match[2].replace(/,/g, ''));
            trend.innerHTML = '';
            var arrow = document.createElement('span');
            arrow.className = 'tr-arrow';
            arrow.textContent = match[1].trim() || '▲';
            // A span, deliberately not a <b>: home-fx.js's count-up looks for
            // `.lp-stat-v b`, and these arrows live inside one. Two counters
            // writing the same text node would fight.
            var num = document.createElement('span');
            num.className = 'tr-num';
            num.textContent = match[2];
            trend.appendChild(arrow);
            trend.appendChild(document.createTextNode(' '));
            trend.appendChild(num);
            if (match[3]) trend.appendChild(document.createTextNode(match[3]));

            var host = trend.closest('.lp-card') || trend;
            var counter = null;

            play.onView(host, {
                threshold: 0.4,
                reset: function () {
                    if (counter) counter.cancel();
                    host.classList.add('tr-armed');
                    num.textContent = '0';
                },
                play: function () {
                    requestAnimationFrame(function () {
                        requestAnimationFrame(function () { host.classList.remove('tr-armed'); });
                    });
                    counter = play.countThrough(num, [0, value], { duration: 900 });
                },
                still: function () {
                    host.classList.remove('tr-armed');
                    num.textContent = match[2];
                }
            });
            host.classList.add('tr-armed');
            num.textContent = '0';
        });
    }

    // ------------------------------------------------------------------
    // Theme
    // ------------------------------------------------------------------
    /* theme.js flips data-theme on <html>. Watch for that and put
     * `.theme-shift` on for the length of the fade, so the surfaces cross over
     * instead of cutting — and come off again, because leaving those
     * transitions on would make every hover half a second late. */
    function setupThemeFade() {
        if (!window.MutationObserver) return;
        var root = document.documentElement;
        var timer = null;

        new MutationObserver(function () {
            root.classList.add('theme-shift');
            clearTimeout(timer);
            timer = setTimeout(function () { root.classList.remove('theme-shift'); }, 560);
        }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    }

    // ------------------------------------------------------------------
    // The closing call to action
    // ------------------------------------------------------------------
    function setupFinalCta(play) {
        var section = document.querySelector('.lp-final');
        if (!section) return;
        var button = section.querySelector('.lp-btn-lg');

        play.onView(section, {
            threshold: 0.4,
            reset: function () {
                section.classList.remove('is-lit');
                if (button) button.classList.remove('is-breathing');
            },
            play: function () {
                section.classList.add('is-lit');
                // Only once it has settled — a button breathing while its
                // section is still arriving looks like a glitch.
                setTimeout(function () {
                    if (button) button.classList.add('is-breathing');
                }, 1200);
            },
            still: function () { section.classList.add('is-lit'); }
        });

        if (!button || play.reduced) return;
        button.addEventListener('pointerdown', function (event) {
            var box = button.getBoundingClientRect();
            var ripple = document.createElement('span');
            ripple.className = 'cta-ripple';
            // Big enough to cover the button from wherever it was clicked.
            var size = Math.max(box.width, box.height) * 2.4;
            ripple.style.width = size + 'px';
            ripple.style.height = size + 'px';
            ripple.style.left = (event.clientX - box.left) + 'px';
            ripple.style.top = (event.clientY - box.top) + 'px';
            button.appendChild(ripple);
            ripple.addEventListener('animationend', function () { ripple.remove(); });
        });
    }
})();
