/* home-fx.js — landing page interactivity.
 *
 * 1. Scroll reveals: sections/cards slide in from the side as they enter the
 *    viewport and slide back out when they leave (IntersectionObserver toggles
 *    .rv-in both ways). Directions are assigned here so the HTML stays clean.
 * 2. Count-up stats: numbers animate from 0 the first time they scroll into view.
 * 3. Daily/Weekly tabs on the Performance chart actually switch the chart.
 * 4. Theme swatches apply the theme (Light/Dark) or explain they're coming soon.
 * 5. Feature cards are fully clickable, not just their "Go to" link.
 *
 * Everything respects prefers-reduced-motion: reveals and counters are skipped
 * and content just shows.
 */
(function () {
    'use strict';

    var reduced = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    document.addEventListener('DOMContentLoaded', function () {
        setupReveals();
        setupCounters();
        setupChartTabs();
        setupSwatches();
        setupFeatureCards();
    });

    // --- 1. Scroll reveals ---------------------------------------------------
    function setupReveals() {
        if (reduced || !('IntersectionObserver' in window)) return;
        var targets = [];

        function mark(el, dir, delay) {
            if (!el || el.classList.contains('rv')) return;
            el.classList.add('rv');
            el.setAttribute('data-rv', dir);
            if (delay) el.style.transitionDelay = delay + 'ms';
            targets.push(el);
        }

        // Hero: text from the left, art from the right.
        mark(document.querySelector('.lp-hero-text'), 'left');
        mark(document.querySelector('.lp-hero-art'), 'right');

        // Section headers drift up; grid children alternate left/right with a
        // small stagger so each row cascades in.
        document.querySelectorAll('.lp-head').forEach(function (el) { mark(el, 'up'); });
        document.querySelectorAll('.lp-strip, .lp-split, .lp-perf, .lp-streak-grid, .lp-philo, .lp-tech')
            .forEach(function (grid) {
                Array.prototype.forEach.call(grid.children, function (el, i) {
                    mark(el, i % 2 ? 'right' : 'left', (i % 4) * 80);
                });
            });

        mark(document.querySelector('.lp-calendar'), 'up');
        mark(document.querySelector('.lp-final'), 'up');

        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                // Toggling both ways makes elements slide back out to their side
                // as they leave the viewport.
                en.target.classList.toggle('rv-in', en.isIntersecting);
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
        targets.forEach(function (t) { io.observe(t); });
    }

    // --- 2. Count-up stats ---------------------------------------------------
    function setupCounters() {
        var els = document.querySelectorAll('.lp-stat-v b, .lp-metric-num, .lp-prev-overall strong');
        if (!els.length || !('IntersectionObserver' in window)) return;

        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (!en.isIntersecting) return;
                io.unobserve(en.target);
                animateCount(en.target);
            });
        }, { threshold: 0.6 });

        els.forEach(function (el) {
            // Only pure numbers (possibly with , and .) — the number is the
            // element's first text node; suffixes like " hrs" live in <small>.
            var node = el.firstChild;
            if (!node || node.nodeType !== 3) return;
            var m = node.nodeValue.trim().match(/^\d[\d,]*(?:\.\d+)?$/);
            if (!m) return;
            el.dataset.countTo = node.nodeValue.trim();
            io.observe(el);
        });
    }

    function animateCount(el) {
        var raw = el.dataset.countTo;
        if (!raw) return;
        var target = parseFloat(raw.replace(/,/g, ''));
        var decimals = (raw.split('.')[1] || '').length;
        var grouped = raw.indexOf(',') !== -1;

        function fmt(v) {
            return grouped
                ? Math.round(v).toLocaleString('en-US')
                : v.toFixed(decimals);
        }
        if (reduced) { el.firstChild.nodeValue = fmt(target); return; }

        var t0 = null, dur = 900;
        function step(ts) {
            if (!t0) t0 = ts;
            var p = Math.min(1, (ts - t0) / dur);
            var eased = 1 - Math.pow(1 - p, 3);
            el.firstChild.nodeValue = fmt(target * eased);
            if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }

    // --- 3. Daily / Weekly chart tabs ---------------------------------------
    function setupChartTabs() {
        var tabs = document.querySelectorAll('.lp-perf-main .lp-tab');
        var chart = document.querySelector('.lp-perf-main .lp-area-lg');
        var xrow = document.querySelector('.lp-perf-main .lp-chart-x');
        if (!tabs.length || !chart) return;

        var area = chart.querySelector('path[fill^="url"]');
        var line = chart.querySelector('path[fill="none"]');
        var dot = chart.querySelector('circle');

        var DATA = {
            Daily: {
                line: 'M0,120 C40,96 80,108 120,72 C160,40 200,84 240,64 C280,44 320,88 360,52 C400,28 440,60 480,34',
                dot: [360, 52],
                x: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
            },
            Weekly: {
                line: 'M0,112 C60,104 120,82 180,86 C240,90 300,56 360,46 C420,38 450,28 480,20',
                dot: [300, 56],
                x: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7']
            }
        };

        tabs.forEach(function (tab) {
            tab.setAttribute('role', 'button');
            tab.tabIndex = 0;
            function activate() {
                if (tab.classList.contains('is-active')) return;
                tabs.forEach(function (t) { t.classList.remove('is-active'); });
                tab.classList.add('is-active');
                var d = DATA[tab.textContent.trim()] || DATA.Daily;
                // Quick crossfade while the paths swap (path `d` can't tween).
                chart.classList.add('lp-chart-swap');
                setTimeout(function () {
                    if (line) line.setAttribute('d', d.line);
                    if (area) area.setAttribute('d', d.line + ' L480,160 L0,160 Z');
                    if (dot) { dot.setAttribute('cx', d.dot[0]); dot.setAttribute('cy', d.dot[1]); }
                    if (xrow) {
                        xrow.innerHTML = d.x.map(function (l) { return '<span>' + l + '</span>'; }).join('');
                    }
                    chart.classList.remove('lp-chart-swap');
                }, reduced ? 0 : 160);
            }
            tab.addEventListener('click', activate);
            tab.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
            });
        });
    }

    // --- 4. Theme swatches ---------------------------------------------------
    function setupSwatches() {
        var sel = document.getElementById('themeSelect');
        document.querySelectorAll('.lp-swatch').forEach(function (sw) {
            sw.setAttribute('role', 'button');
            sw.tabIndex = 0;
            function activate() {
                var theme = sw.classList.contains('lp-sw-light') ? 'light'
                    : sw.classList.contains('lp-sw-dark') ? 'dark' : null;
                if (theme && sel) {
                    sel.value = theme;
                    // theme.js listens for this change and applies + persists it.
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                    sw.classList.remove('lp-swatch-pop');
                    void sw.offsetWidth; // restart the pop animation
                    sw.classList.add('lp-swatch-pop');
                } else {
                    toast((sw.getAttribute('title') || 'That') + ' theme is coming soon');
                }
            }
            sw.addEventListener('click', activate);
            sw.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
            });
        });
    }

    var toastEl = null, toastTimer = null;
    function toast(msg) {
        if (!toastEl) {
            toastEl = document.createElement('div');
            toastEl.className = 'hfx-toast';
            document.body.appendChild(toastEl);
        }
        toastEl.textContent = msg;
        toastEl.classList.add('is-shown');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toastEl.classList.remove('is-shown'); }, 2200);
    }

    // --- 5. Fully clickable feature cards ------------------------------------
    function setupFeatureCards() {
        document.querySelectorAll('.lp-feature').forEach(function (card) {
            var link = card.querySelector('a.lp-link');
            if (!link) return;
            card.classList.add('lp-clickable');
            card.addEventListener('click', function (e) {
                if (e.target.closest('a')) return; // the real link handles itself
                window.location.href = link.href;
            });
        });
    }
})();
