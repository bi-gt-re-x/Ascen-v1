/* calendar-void.js — the riddle at the end of the void, and what it opens.
 *
 * When the pentagon's arrow drops you into /calendar#void, the calendar is
 * frozen (no interaction) and a single riddle hangs in the dark:
 *
 *   "The person who makes me doesn't want me, the person who buys me doesn't
 *    use me, and the person who uses me will never see me."   →  coffin
 *
 * Answer it and jagged cracks race across the screen, the whole page shatters
 * into shards, and a living machine layer is revealed beneath — gears turning,
 * pistons pumping, code churning — titled THE ENGINE.
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

        buildEngine();                          // built underneath, waiting
        drawCracks(function () {
            shatter(function () {
                // Clean up everything that was over the engine, leaving it clear.
                var r = document.getElementById('voidRiddle');
                if (r) r.remove();
                var cracks = document.getElementById('voidCracks');
                if (cracks) {
                    cracks.style.transition = 'opacity 0.6s ease';
                    cracks.style.opacity = '0';
                    setTimeout(function () { cracks.remove(); }, 650);
                }
                var cal = document.querySelector('.calendar-container');
                if (cal) cal.style.display = 'none';
            });
        });
    }

    // --- Jagged cracks racing across the screen -----------------------------
    function drawCracks(done) {
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'voidCracks';
        svg.setAttribute('viewBox', '0 0 100 100');
        svg.setAttribute('preserveAspectRatio', 'none');

        // A handful of forks radiating out from the centre.
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

    // --- The shatter: the screen breaks into shards that fly apart -----------
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
        // let the shards paint one frame as an intact black pane, then blow apart
        requestAnimationFrame(function () {
            requestAnimationFrame(function () { layer.classList.add('go'); });
        });
        setTimeout(function () { layer.remove(); if (done) done(); }, 1500);
    }

    function addShard(layer, c, r, G, upper) {
        var u = 100 / G;
        var x0 = c * u, x1 = (c + 1) * u, y0 = r * u, y1 = (r + 1) * u;
        var clip = upper
            ? 'polygon(' + x0 + '% ' + y0 + '%, ' + x1 + '% ' + y0 + '%, ' + x0 + '% ' + y1 + '%)'
            : 'polygon(' + x1 + '% ' + y0 + '%, ' + x1 + '% ' + y1 + '%, ' + x0 + '% ' + y1 + '%)';
        var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        var dx = (cx - 50) / 50, dy = (cy - 50) / 50;   // direction from centre (-1..1)
        var mag = 60 + Math.random() * 60;
        var sh = document.createElement('div');
        sh.className = 'void-shard';
        sh.style.clipPath = clip;
        sh.style.webkitClipPath = clip;
        sh.style.setProperty('--tx', (dx * mag).toFixed(1) + 'vw');
        sh.style.setProperty('--ty', (dy * mag + 25).toFixed(1) + 'vh');   // + gravity
        sh.style.setProperty('--rot', ((Math.random() - 0.5) * 140).toFixed(0) + 'deg');
        sh.style.transitionDelay = (Math.abs(dx) + Math.abs(dy)) * 0.06 + 's';
        layer.appendChild(sh);
    }

    // --- THE ENGINE: gears, machines and code, alive underneath -------------
    function buildEngine() {
        if (document.getElementById('voidEngine')) return;
        var eng = document.createElement('div');
        eng.id = 'voidEngine';

        var gears = '';
        var specs = [
            { x: '8%',  y: '18%', s: 150, t: 12, dur: 14, dir: 1,  col: '#3a4150' },
            { x: '82%', y: '12%', s: 210, t: 14, dur: 22, dir: -1, col: '#2f3542' },
            { x: '72%', y: '70%', s: 260, t: 16, dur: 30, dir: 1,  col: '#353c4a' },
            { x: '18%', y: '74%', s: 190, t: 12, dur: 18, dir: -1, col: '#2b313d' },
            { x: '46%', y: '44%', s: 120, t: 10, dur: 10, dir: 1,  col: '#4a5265' }
        ];
        specs.forEach(function (g) {
            gears += '<div class="eng-gear" style="left:' + g.x + ';top:' + g.y +
                ';width:' + g.s + 'px;height:' + g.s + 'px;animation-duration:' + g.dur +
                's;animation-direction:' + (g.dir < 0 ? 'reverse' : 'normal') + '">' +
                gearSVG(g.t, g.col) + '</div>';
        });

        // Reciprocating "machines" — pistons pumping at the base.
        var pistons = '';
        for (var i = 0; i < 6; i++) {
            pistons += '<div class="eng-piston" style="left:' + (6 + i * 16) + '%;' +
                'animation-delay:' + (i * 0.18) + 's"><span></span></div>';
        }

        // Code columns — monospaced streams that keep changing.
        var cols = '';
        for (var j = 0; j < 5; j++) {
            cols += '<pre class="eng-code" data-col="' + j + '" style="left:' +
                (4 + j * 22) + '%;animation-duration:' + (7 + j * 2) + 's"></pre>';
        }

        eng.innerHTML =
            '<div class="eng-gears">' + gears + '</div>' +
            '<div class="eng-code-wrap">' + cols + '</div>' +
            '<div class="eng-pistons">' + pistons + '</div>' +
            '<div class="eng-vignette"></div>' +
            '<h1 class="eng-title">THE ENGINE</h1>' +
            '<p class="eng-sub">// it was running the whole time</p>';
        document.body.appendChild(eng);

        requestAnimationFrame(function () { eng.classList.add('lit'); });
        startCode(eng);
    }

    function gearSVG(teeth, col) {
        var t = '';
        for (var i = 0; i < teeth; i++) {
            var ang = i * (360 / teeth);
            t += '<rect x="44" y="2" width="12" height="18" rx="2.5" fill="' + col +
                 '" transform="rotate(' + ang + ' 50 50)"/>';
        }
        return '<svg viewBox="0 0 100 100">' + t +
            '<circle cx="50" cy="50" r="34" fill="' + col + '"/>' +
            '<circle cx="50" cy="50" r="26" fill="none" stroke="#12151c" stroke-width="2"/>' +
            '<circle cx="50" cy="50" r="13" fill="#070a0f"/>' +
            '<circle cx="50" cy="50" r="13" fill="none" stroke="#4b566b" stroke-width="2"/>' +
            '</svg>';
    }

    function startCode(eng) {
        var glyphs = '01{}[]()<>=+-*/;:#&|!$%01ABCDEF0123456789';
        var line = function (n) {
            var s = '';
            for (var i = 0; i < n; i++) s += glyphs[(Math.random() * glyphs.length) | 0];
            return s;
        };
        var cols = eng.querySelectorAll('.eng-code');
        cols.forEach(function (pre) {
            var rows = 26, buf = [];
            for (var i = 0; i < rows; i++) buf.push(line(10));
            pre.textContent = buf.join('\n');
            pre._buf = buf;
        });
        // Keep mutating a few random rows so the code is always changing.
        eng._codeTimer = setInterval(function () {
            cols.forEach(function (pre) {
                var buf = pre._buf; if (!buf) return;
                for (var k = 0; k < 3; k++) {
                    buf[(Math.random() * buf.length) | 0] = line(10);
                }
                pre.textContent = buf.join('\n');
            });
        }, 120);
    }
})();
