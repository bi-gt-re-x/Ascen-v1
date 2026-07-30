/* home-ambient.js — the landing page's background.
 *
 * One fixed layer behind everything, holding four quiet things: a grid, a slow
 * colour gradient, a field of drifting particles, and a glow that follows the
 * cursor. The first two are pure CSS (styles/home-motion.css); this file builds
 * the layer, runs the particle canvas, and moves the glow.
 *
 * The rules it plays by, because a background that costs anything is a
 * background that should not exist:
 *
 *   one canvas, one rAF loop, and the loop stops entirely when the tab is
 *   hidden or the page is scrolled past the point where particles are visible;
 *   the glow is moved with a transform on a promoted layer, never with top/left,
 *   and it eases toward the pointer instead of tracking it exactly, so it reads
 *   as light rather than as a cursor;
 *   nothing runs at all when the machine asks for less motion, or on a device
 *   with no fine pointer (the glow), or before the page has been revealed.
 */
(function () {
    'use strict';

    var reduced = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 40 is enough to read as a field and cheap enough to be free. Fewer on a
    // small screen, where they would crowd.
    var PARTICLE_COUNT = window.innerWidth < 720 ? 18 : 40;

    document.addEventListener('DOMContentLoaded', function () {
        var layer = build();
        if (!layer) return;

        // Fade the whole layer in one beat after the page itself arrives, so
        // the background settles behind content that is already there.
        setTimeout(function () { layer.classList.add('hm-ready'); }, reduced ? 0 : 260);
        if (reduced) return;

        layer.classList.add('hm-animate');
        startParticles(layer.querySelector('.hm-particles'));
        startCursorGlow(layer.querySelector('.hm-cursor'));
    });

    // --- the layer -----------------------------------------------------------
    function build() {
        if (document.querySelector('.hm-ambient')) return null;
        var layer = document.createElement('div');
        layer.className = 'hm-ambient';
        layer.setAttribute('aria-hidden', 'true');
        layer.innerHTML =
            '<div class="hm-gradient"></div>' +
            '<div class="hm-grid"></div>' +
            '<canvas class="hm-particles"></canvas>' +
            '<div class="hm-cursor"></div>';
        document.body.insertBefore(layer, document.body.firstChild);
        return layer;
    }

    // --- particles -----------------------------------------------------------
    function startParticles(canvas) {
        if (!canvas || !canvas.getContext) return;
        var ctx = canvas.getContext('2d');
        var dots = [];
        var w = 0, h = 0, dpr = 1;
        var frame = null;
        var last = 0;

        // Returns false when there is nothing to measure yet. A canvas sized
        // while the page is laid out at zero — loaded in a background tab, or
        // in a window that has not been presented — stays zero for good
        // otherwise, and the field never appears. The draw loop retries.
        function resize() {
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            w = canvas.clientWidth || window.innerWidth || 0;
            h = canvas.clientHeight || window.innerHeight || 0;
            if (!w || !h) return false;
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            return true;
        }

        function seed() {
            dots = [];
            for (var i = 0; i < PARTICLE_COUNT; i++) {
                dots.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    r: 0.8 + Math.random() * 1.6,
                    // Pixels per second. Slow: a dot crosses the screen in
                    // something like two minutes.
                    vx: (Math.random() - 0.5) * 12,
                    vy: -4 - Math.random() * 10,
                    a: 0.10 + Math.random() * 0.22
                });
            }
        }

        function colour() {
            return document.documentElement.getAttribute('data-theme') === 'dark'
                ? '255, 255, 255' : '30, 41, 59';
        }

        function draw(now) {
            frame = requestAnimationFrame(draw);

            // Nothing measurable yet — try again next frame rather than
            // drawing into a zero-sized canvas forever.
            if (!w || !h) {
                if (!resize()) return;
                seed();
            }

            if (!last) last = now;
            // Seconds since the last frame, clamped so a backgrounded tab does
            // not teleport every dot when it comes back.
            var dt = Math.min((now - last) / 1000, 0.05);
            last = now;

            ctx.clearRect(0, 0, w, h);
            var rgb = colour();
            for (var i = 0; i < dots.length; i++) {
                var d = dots[i];
                d.x += d.vx * dt;
                d.y += d.vy * dt;
                // Off one edge, back on the other.
                if (d.y < -8) { d.y = h + 8; d.x = Math.random() * w; }
                if (d.x < -8) d.x = w + 8;
                if (d.x > w + 8) d.x = -8;

                ctx.beginPath();
                ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(' + rgb + ',' + d.a + ')';
                ctx.fill();
            }
        }

        function play() {
            if (frame) return;
            last = 0;
            frame = requestAnimationFrame(draw);
        }
        function pause() {
            if (!frame) return;
            cancelAnimationFrame(frame);
            frame = null;
        }

        if (resize()) seed();
        play();

        var resizeTimer = null;
        window.addEventListener('resize', function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () { if (resize()) seed(); }, 150);
        });

        // A hidden tab paints nothing, and neither should this.
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) pause(); else play();
        });

        // The layer is fixed, so once the reader is a couple of screens down
        // the dots are still being drawn behind content that covers them.
        // Stop there and pick up again on the way back.
        var scrollTimer = null;
        window.addEventListener('scroll', function () {
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(function () {
                if (window.scrollY > window.innerHeight * 2) pause();
                else if (!document.hidden) play();
            }, 120);
        }, { passive: true });
    }

    // --- cursor glow ---------------------------------------------------------
    function startCursorGlow(glow) {
        if (!glow) return;
        // Touch and pen have no hovering cursor to follow.
        if (window.matchMedia && !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

        var tx = 0, ty = 0;     // where the pointer is
        var cx = 0, cy = 0;     // where the light has got to
        var running = false;
        var seen = false;

        function loop() {
            // Ease a tenth of the remaining distance each frame: the light
            // trails the cursor slightly instead of being welded to it.
            cx += (tx - cx) * 0.1;
            cy += (ty - cy) * 0.1;
            glow.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
            // Close enough to stopped — park the loop until the pointer moves.
            if (Math.abs(tx - cx) < 0.4 && Math.abs(ty - cy) < 0.4) {
                running = false;
                return;
            }
            requestAnimationFrame(loop);
        }

        document.addEventListener('pointermove', function (event) {
            tx = event.clientX;
            ty = event.clientY;
            if (!seen) {
                // First sighting: drop the light straight onto the pointer
                // rather than sliding it in from the corner.
                seen = true;
                cx = tx; cy = ty;
                glow.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)';
                glow.classList.add('hm-cursor-on');
            }
            if (!running) { running = true; requestAnimationFrame(loop); }
        }, { passive: true });

        document.addEventListener('pointerleave', function () {
            glow.classList.remove('hm-cursor-on');
        });
        document.addEventListener('pointerenter', function () {
            if (seen) glow.classList.add('hm-cursor-on');
        });
    }
})();
