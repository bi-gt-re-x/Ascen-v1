/* void.js — the riddle at the end of the mutated calendar.
 *
 * When the pentagon's arrow drops you into /calendar#void, the calendar is
 * frozen and a single riddle hangs in the dark:
 *
 *   "The person who makes me doesn't want me, the person who buys me doesn't
 *    use me, and the person who uses me will never see me."   →  coffin
 *
 * Answer it and jagged cracks race across the screen, the page shatters into
 * shards that rain down, and you drop through into /engine.
 */
(function () {
    'use strict';

    if (!document.documentElement.classList.contains('egg-void')) return;

    var ANSWER = 'coffin';
    var RIDDLE = "The person who makes me doesn't want me, the person who buys " +
                 "me doesn't use me, and the person who uses me will never see me.";

    function ready(fn) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
        else fn();
    }

    ready(function () {
        lockCalendar();
        buildRiddle();
    });

    // The frozen calendar can't be touched.
    function lockCalendar() {
        var card = document.querySelector('.calendar-card');
        if (card) card.style.pointerEvents = 'none';
        document.body.style.userSelect = 'none';
    }

    function buildRiddle() {
        var wrap = document.createElement('div');
        wrap.id = 'voidRiddle';
        wrap.innerHTML =
            '<div class="void-riddle-inner">' +
                '<p class="void-riddle-text"></p>' +
                '<form id="voidRiddleForm" autocomplete="off">' +
                    '<input id="voidRiddleInput" type="text" spellcheck="false" ' +
                        'autocomplete="off" placeholder="…" aria-label="Answer" />' +
                '</form>' +
                '<p class="void-riddle-err" id="voidRiddleErr" aria-live="polite"></p>' +
            '</div>';
        document.body.appendChild(wrap);
        wrap.querySelector('.void-riddle-text').textContent = RIDDLE;

        var form = document.getElementById('voidRiddleForm');
        var input = document.getElementById('voidRiddleInput');
        var err = document.getElementById('voidRiddleErr');

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var val = (input.value || '').trim().toLowerCase().replace(/[^a-z]/g, '');
            if (val === ANSWER) {
                solve(wrap);
            } else {
                err.textContent = '… no.';
                input.classList.remove('wrong');
                void input.offsetWidth;
                input.classList.add('wrong');
            }
        });

        requestAnimationFrame(function () { wrap.classList.add('show'); });
        setTimeout(function () { input.focus(); }, 500);
    }

    function solve(wrap) {
        var input = document.getElementById('voidRiddleInput');
        if (input) input.blur();
        wrap.classList.add('solved');          // riddle recedes into the dark

        drawCracks(function () {
            shatter(function () {
                // The floor is gone — drop through into the engine.
                window.location.href = '/engine';
            });
        });
    }

    // --- Jagged cracks racing across the screen -----------------------------
    function drawCracks(done) {
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'voidCracks';
        svg.setAttribute('viewBox', '0 0 100 100');
        svg.setAttribute('preserveAspectRatio', 'none');

        var forks = 9;
        for (var i = 0; i < forks; i++) {
            var ang = (i / forks) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
            svg.appendChild(makeCrack(50, 50, ang, i * 0.05));
        }
        document.body.appendChild(svg);
        setTimeout(done, 620);
    }

    function makeCrack(cx, cy, angle, delay) {
        var d = 'M ' + cx + ' ' + cy;
        var x = cx, y = cy, a = angle, step = 8 + Math.random() * 6, hops = 7;
        for (var i = 0; i < hops; i++) {
            a += (Math.random() - 0.5) * 0.8;
            x += Math.cos(a) * step;
            y += Math.sin(a) * step;
            d += ' L ' + x.toFixed(1) + ' ' + y.toFixed(1);
            step *= 0.92;
        }
        var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        p.setAttribute('d', d);
        p.setAttribute('class', 'void-crack');
        p.style.animationDelay = delay + 's';
        return p;
    }

    // --- The shatter: the screen breaks into shards that rain down ----------
    function shatter(done) {
        var layer = document.createElement('div');
        layer.id = 'voidShatter';
        var G = 7;                               // G×G grid, two shards per cell
        for (var r = 0; r < G; r++) {
            for (var c = 0; c < G; c++) {
                addShard(layer, c, r, G, true);
                addShard(layer, c, r, G, false);
            }
        }
        document.body.appendChild(layer);
        requestAnimationFrame(function () {
            requestAnimationFrame(function () { layer.classList.add('go'); });
        });
        setTimeout(function () { if (done) done(); }, 1650);
    }

    function addShard(layer, c, r, G, upper) {
        var u = 100 / G;
        var x0 = c * u, x1 = (c + 1) * u, y0 = r * u, y1 = (r + 1) * u;
        var clip = upper
            ? 'polygon(' + x0 + '% ' + y0 + '%, ' + x1 + '% ' + y0 + '%, ' + x0 + '% ' + y1 + '%)'
            : 'polygon(' + x1 + '% ' + y0 + '%, ' + x1 + '% ' + y1 + '%, ' + x0 + '% ' + y1 + '%)';
        var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        var dx = (cx - 50) / 50, dy = (cy - 50) / 50;
        var sh = document.createElement('div');
        sh.className = 'void-shard';
        sh.style.clipPath = clip;
        sh.style.webkitClipPath = clip;
        sh.style.setProperty('--tx', (dx * (6 + Math.random() * 14)).toFixed(1) + 'vw');
        sh.style.setProperty('--ty', (108 + Math.random() * 60).toFixed(1) + 'vh');
        sh.style.setProperty('--rot', ((Math.random() - 0.5) * 220).toFixed(0) + 'deg');
        sh.style.transitionDelay = ((Math.abs(dx) + Math.abs(dy)) * 0.13).toFixed(2) + 's';
        layer.appendChild(sh);
    }
})();
