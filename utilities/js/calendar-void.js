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
        // let the shards paint one frame as an intact black pane, then break
        requestAnimationFrame(function () {
            requestAnimationFrame(function () { layer.classList.add('go'); });
        });
        setTimeout(function () { layer.remove(); if (done) done(); }, 2000);
    }

    function addShard(layer, c, r, G, upper) {
        var u = 100 / G;
        var x0 = c * u, x1 = (c + 1) * u, y0 = r * u, y1 = (r + 1) * u;
        var clip = upper
            ? 'polygon(' + x0 + '% ' + y0 + '%, ' + x1 + '% ' + y0 + '%, ' + x0 + '% ' + y1 + '%)'
            : 'polygon(' + x1 + '% ' + y0 + '%, ' + x1 + '% ' + y1 + '%, ' + x0 + '% ' + y1 + '%)';
        var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        var dx = (cx - 50) / 50, dy = (cy - 50) / 50;   // offset from centre (-1..1)
        var sh = document.createElement('div');
        sh.className = 'void-shard';
        sh.style.clipPath = clip;
        sh.style.webkitClipPath = clip;
        // Break loose, then fall: a little sideways drift, then straight down and
        // off the bottom, tumbling as it goes.
        sh.style.setProperty('--tx', (dx * (6 + Math.random() * 14)).toFixed(1) + 'vw');
        sh.style.setProperty('--ty', (108 + Math.random() * 60).toFixed(1) + 'vh');
        sh.style.setProperty('--rot', ((Math.random() - 0.5) * 220).toFixed(0) + 'deg');
        // Cracks radiate from the centre, so the centre pieces let go first.
        sh.style.transitionDelay = ((Math.abs(dx) + Math.abs(dy)) * 0.13).toFixed(2) + 's';
        layer.appendChild(sh);
    }

    // --- THE ENGINE: a dark industrial room, alive beneath the calendar -----
    function buildEngine() {
        if (document.getElementById('voidEngine')) return;
        var eng = document.createElement('div');
        eng.id = 'voidEngine';

        // Slowly rotating gears set into the back wall.
        var gearSpecs = [
            { x: '7%',  y: '22%', s: 190, t: 14, dur: 36, dir: 1 },
            { x: '90%', y: '17%', s: 250, t: 16, dur: 48, dir: -1 },
            { x: '85%', y: '80%', s: 290, t: 18, dur: 56, dir: 1 },
            { x: '13%', y: '82%', s: 220, t: 14, dur: 42, dir: -1 },
            { x: '50%', y: '9%',  s: 130, t: 12, dur: 30, dir: 1 }
        ];
        var gears = gearSpecs.map(function (g) {
            return '<div class="eng-gear" style="left:' + g.x + ';top:' + g.y +
                ';width:' + g.s + 'px;height:' + g.s + 'px;animation-duration:' + g.dur +
                's;animation-direction:' + (g.dir < 0 ? 'reverse' : 'normal') + '">' +
                gearSVG(g.t) + '</div>';
        }).join('');

        // Pistons pumping along the base.
        var pistons = '';
        for (var i = 0; i < 7; i++) {
            pistons += '<div class="eng-piston" style="left:' + (4 + i * 14) + '%;' +
                'animation-delay:' + (i * 0.16) + 's"><span></span></div>';
        }

        // Conveyor belts carrying XP and tasks past the core.
        var belts =
            belt('20%', 'ltr', ['+10 XP', 'TASK ✓', '+25 XP', 'FOCUS', '+5 XP', 'TASK ✓', 'LEVEL ↑', '+15 XP']) +
            belt('73%', 'rtl', ['COMPILE', '+40 XP', 'TASK ✓', 'STREAK', '+15 XP', 'RENDER', '+10 XP', 'BUILD']);

        // Floating code — the etched comments, plus live streams.
        var comments = [
            { t: '// Productivity is manufactured here.', x: '6%',  y: '33%' },
            { t: '// Reality is compiled every refresh.', x: '58%', y: '26%' },
            { t: '// Do not alter the engine.',           x: '30%', y: '63%' }
        ];
        var floatCode = comments.map(function (c, i) {
            return '<pre class="eng-cmt" style="left:' + c.x + ';top:' + c.y +
                ';animation-delay:' + (i * 0.8) + 's">' + c.t + '</pre>';
        }).join('');
        var streams = '';
        for (var j = 0; j < 3; j++) {
            streams += '<pre class="eng-stream" style="left:' + (12 + j * 38) +
                '%;animation-duration:' + (9 + j * 3) + 's"></pre>';
        }

        // A control strip of blinking status lights.
        var lightCols = ['#57e08a', '#e0b74f', '#b0413e', '#57e08a', '#5aa0ff', '#e0b74f', '#57e08a', '#b0413e', '#5aa0ff'];
        var lights = lightCols.map(function (col, k) {
            return '<span class="eng-light" style="--lc:' + col + ';animation-delay:' +
                (k * 0.21) + 's;animation-duration:' + (0.9 + (k % 3) * 0.5) + 's"></span>';
        }).join('');

        eng.innerHTML =
            '<div class="eng-room"><div class="eng-floor"></div><div class="eng-haze"></div></div>' +
            '<div class="eng-layer eng-pipes">' + pipesSVG() + '</div>' +
            '<div class="eng-layer eng-gears">' + gears + '</div>' +
            '<div class="eng-layer eng-belts">' + belts + '</div>' +
            '<div class="eng-layer eng-codewrap">' + floatCode + streams + '</div>' +
            '<div class="eng-layer eng-pistons">' + pistons + '</div>' +
            coreMarkup() +
            '<div class="eng-panel">' + lights + '</div>' +
            '<div class="eng-vignette"></div>' +
            '<div class="eng-nameplate">THE ENGINE</div>' +
            settingsArrow();
        document.body.appendChild(eng);

        wireSettings(eng);
        requestAnimationFrame(function () { eng.classList.add('lit'); });
        startCode(eng);
    }

    function coreMarkup() {
        return '<div class="eng-core">' +
            '<div class="eng-core-glow"></div>' +
            '<div class="eng-core-ring eng-core-ring1"></div>' +
            '<div class="eng-core-ring eng-core-ring2"></div>' +
            '<div class="eng-core-ring eng-core-ring3"></div>' +
            '<div class="eng-core-hub">' +
                '<div class="eng-core-pulse"></div>' +
                '<div class="eng-core-name"><span>ASCEN</span><strong>ENGINE</strong></div>' +
            '</div>' +
        '</div>';
    }

    function pipesSVG() {
        var pipe = function (d) { return '<path class="eng-pipe" d="' + d + '"/>'; };
        var flow = function (d) { return '<path class="eng-flow" d="' + d + '"/>'; };
        var d1 = 'M0 28 H26 Q38 28 38 40 V64';
        var d2 = 'M100 20 H72 Q60 20 60 32 V58';
        var d3 = 'M10 100 V82 Q10 72 22 72 H44';
        var d4 = 'M100 74 H80 Q70 74 70 84 V100';
        return '<svg viewBox="0 0 100 100" preserveAspectRatio="none">' +
            pipe(d1) + pipe(d2) + pipe(d3) + pipe(d4) +
            flow(d1) + flow(d2) + flow(d3) +
            '</svg>';
    }

    function belt(top, dir, items) {
        var doubled = items.concat(items);
        var chips = doubled.map(function (it) {
            return '<span class="eng-chip">' + it + '</span>';
        }).join('');
        return '<div class="eng-belt" style="top:' + top + '">' +
            '<div class="eng-belt-surface"></div>' +
            '<div class="eng-belt-track' + (dir === 'rtl' ? ' rtl' : '') + '">' + chips + '</div>' +
        '</div>';
    }

    function settingsArrow() {
        return '<button id="engSettings" class="eng-settings" type="button" aria-label="Engine settings">' +
            '<span class="eng-settings-text">ENGINE SETTINGS</span>' +
            '<svg class="eng-settings-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
                'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
                '<line x1="4" y1="12" x2="17" y2="12"/><polyline points="12 6 18 12 12 18"/></svg>' +
        '</button>';
    }

    function wireSettings(eng) {
        var btn = eng.querySelector('#engSettings');
        if (!btn) return;
        btn.addEventListener('click', function () {
            // The metal door to the next room. Wired to boot with a flicker until
            // the ENGINE SETTINGS room is built.
            btn.classList.add('pressed');
            eng.classList.add('powering');
            setTimeout(function () {
                btn.classList.remove('pressed');
                eng.classList.remove('powering');
            }, 700);
        });
    }

    function gearSVG(teeth) {
        var t = '';
        for (var i = 0; i < teeth; i++) {
            var ang = i * (360 / teeth);
            t += '<rect x="44" y="2" width="12" height="18" rx="2.5" fill="#3a4150" ' +
                 'transform="rotate(' + ang + ' 50 50)"/>';
        }
        return '<svg viewBox="0 0 100 100">' + t +
            '<circle cx="50" cy="50" r="34" fill="#2f3542"/>' +
            '<circle cx="50" cy="50" r="34" fill="none" stroke="#4b566b" stroke-width="1.5"/>' +
            '<circle cx="50" cy="50" r="25" fill="none" stroke="#12151c" stroke-width="2.5"/>' +
            '<circle cx="50" cy="50" r="13" fill="#0a0d13"/>' +
            '<circle cx="50" cy="50" r="13" fill="none" stroke="#5a6675" stroke-width="2"/>' +
            '</svg>';
    }

    function startCode(eng) {
        var glyphs = '01{}[]()<>=+-*/;:#&|!$%ABCDEF0123456789';
        var line = function (n) {
            var s = '';
            for (var i = 0; i < n; i++) s += glyphs[(Math.random() * glyphs.length) | 0];
            return s;
        };
        var cols = eng.querySelectorAll('.eng-stream');
        cols.forEach(function (pre) {
            var rows = 22, buf = [];
            for (var i = 0; i < rows; i++) buf.push(line(9));
            pre.textContent = buf.join('\n');
            pre._buf = buf;
        });
        eng._codeTimer = setInterval(function () {
            cols.forEach(function (pre) {
                var buf = pre._buf; if (!buf) return;
                for (var k = 0; k < 3; k++) buf[(Math.random() * buf.length) | 0] = line(9);
                pre.textContent = buf.join('\n');
            });
        }, 130);
    }
})();
