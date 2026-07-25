/* hidden-engine.js — the Hidden Engine: the heart of Ascen, never meant to be
 * found. Revealed when the console's secret `unlock hidden` releases the blast
 * doors. A vast mechanical vault around a gigantic rotating Core Engine, with
 * an archive wall, energy-conduit wall, suspended ceiling gears, a circuit
 * floor that lights beneath your cursor, and one old ASCEN CORE console where
 * the final puzzle waits.
 */
(function () {
    'use strict';

    var LOGS = {
        LOG_0001: '"...the engine was never a metaphor."',
        LOG_0002: '"we compiled reality nightly. it held. mostly."',
        LOG_0003: '"if you are reading this, the door has already opened."'
    };

    function reveal(closeSettings) {
        if (document.getElementById('hiddenEngine')) return;

        var he = document.createElement('div');
        he.id = 'hiddenEngine';
        he.innerHTML =
            ceiling() +
            '<div class="he-room">' +
                leftWall() + rightWall() + core() + hiddenConsole() +
            '</div>' +
            '<div class="he-floor"><div class="he-floor-grid"></div><div class="he-floor-glow"></div></div>' +
            '<div class="he-doors"><div class="he-door he-door-l"></div>' +
                '<div class="he-door he-door-r"></div><div class="he-seam"></div></div>';
        document.body.appendChild(he);

        requestAnimationFrame(function () { he.classList.add('lit'); });
        setTimeout(function () { he.classList.add('open'); }, 450);   // doors part
        setTimeout(function () {
            var d = he.querySelector('.he-doors'); if (d) d.remove();
        }, 2600);
        if (closeSettings) setTimeout(closeSettings, 700);            // drop the panel behind the doors

        wireFloor(he);
        wireArchives(he);
        wireConsole(he);
        startAmbient(he);
    }

    // --- Ceiling: suspended gears at different speeds -----------------------
    function ceiling() {
        var g = '';
        var specs = [
            { x: '12%', y: '-8%', s: 260, t: 18, dur: 40, dir: 1 },
            { x: '44%', y: '-14%', s: 380, t: 22, dur: 70, dir: -1 },
            { x: '78%', y: '-6%', s: 220, t: 16, dur: 32, dir: 1 },
            { x: '92%', y: '-16%', s: 320, t: 20, dur: 58, dir: -1 }
        ];
        specs.forEach(function (s) {
            g += '<div class="he-ceil-gear" style="left:' + s.x + ';top:' + s.y +
                ';width:' + s.s + 'px;height:' + s.s + 'px;animation-duration:' + s.dur +
                's;animation-direction:' + (s.dir < 0 ? 'reverse' : 'normal') + '">' +
                gearSVG(s.t, '#242c3a') + '</div>';
        });
        return '<div class="he-ceiling">' + g + '<div class="he-sparks"></div></div>';
    }

    // --- Left wall: the archives -------------------------------------------
    function leftWall() {
        var rows = '<div class="he-arch-title">ARCHIVES</div>';
        ['LOG_0001', 'LOG_0002', 'LOG_0003'].forEach(function (id) {
            rows += '<button class="he-archive" type="button" data-log="' + id + '">' + id + '</button>';
        });
        rows += '<div class="he-arch-sub">UNKNOWN</div>';
        for (var i = 0; i < 3; i++) rows += '<button class="he-archive locked" type="button">LOCKED</button>';
        rows += '<div class="he-arch-readout" id="heReadout"></div>';
        return '<aside class="he-wall he-left">' + rows + '</aside>';
    }

    // --- Right wall: energy conduits ---------------------------------------
    function rightWall() {
        return '<aside class="he-wall he-right">' +
            '<div class="he-pw-title">Power Distribution</div>' +
            '<div class="he-bar"><i style="width:100%"></i></div>' +
            '<div class="he-pw-val">100%</div>' +
            '<div class="he-pw-title">Synchronization</div>' +
            '<div class="he-bar"><i id="heSync" style="width:82%"></i></div>' +
            '<div class="he-pw-val" id="heSyncVal">82%</div>' +
            '<div class="he-pw-title">Engine Stability</div>' +
            '<div class="he-stability" id="heStab">99.99%</div>' +
            '<div class="he-conduit"><span></span><span></span><span></span></div>' +
        '</aside>';
    }

    // --- Centerpiece: the gigantic Core Engine -----------------------------
    function core() {
        var cogs = '';
        [['50%', '2%'], ['84%', '30%'], ['74%', '82%'], ['16%', '78%'], ['6%', '32%']].forEach(function (p, i) {
            var s = i === 0 ? 120 : 150;
            cogs += '<div class="he-cog" style="left:' + p[0] + ';top:' + p[1] +
                ';width:' + s + 'px;height:' + s + 'px;animation-duration:' + (14 + i * 4) +
                's;animation-direction:' + (i % 2 ? 'reverse' : 'normal') + '">' +
                gearSVG(14, '#33405a') + '</div>';
        });

        var pistons = '';
        for (var j = 0; j < 4; j++) {
            pistons += '<div class="he-piston" style="left:' + (18 + j * 22) +
                '%;animation-delay:' + (j * 0.3) + 's"><span></span></div>';
        }
        var steam = '';
        ['28%', '50%', '72%'].forEach(function (x) {
            steam += '<span class="he-vent" style="left:' + x + '"><i></i></span>';
        });

        return '<div class="he-core" id="heCore">' +
            '<div class="he-core-glow"></div>' +
            '<div class="he-cogs">' + cogs + '</div>' +
            '<div class="he-ring he-ring1"></div>' +
            '<div class="he-ring he-ring2"></div>' +
            '<div class="he-ring he-ring3"></div>' +
            '<div class="he-hub"><div class="he-hub-pulse"></div>' +
                '<div class="he-hub-core"></div>' +
                '<div class="he-hub-label"><span>ASCEN</span><strong>CORE</strong></div></div>' +
            '<div class="he-pistons">' + pistons + '</div>' +
            '<div class="he-vents">' + steam + '</div>' +
        '</div>';
    }

    function hiddenConsole() {
        return '<div class="he-console" id="heConsole">' +
            '<div class="he-console-scan"></div>' +
            '<div class="he-console-title">ASCEN CORE</div>' +
            '<div class="he-console-line" id="heConsoleLine">Awaiting Administrator...</div>' +
        '</div>';
    }

    // --- Wiring ------------------------------------------------------------
    function wireFloor(he) {
        var glow = he.querySelector('.he-floor-glow');
        he.addEventListener('mousemove', function (e) {
            glow.style.setProperty('--mx', (e.clientX / window.innerWidth * 100) + '%');
            glow.style.setProperty('--my', (e.clientY / window.innerHeight * 100) + '%');
            glow.style.opacity = '1';
        });
        he.addEventListener('mouseleave', function () { glow.style.opacity = '0'; });
    }

    function wireArchives(he) {
        var readout = he.querySelector('#heReadout');
        he.querySelectorAll('.he-archive').forEach(function (btn) {
            btn.addEventListener('click', function () {
                reactCore(he, false);
                if (btn.classList.contains('locked')) {
                    btn.classList.remove('shake'); void btn.offsetWidth; btn.classList.add('shake');
                    readout.textContent = 'ACCESS DENIED';
                    readout.className = 'he-arch-readout err';
                } else {
                    var id = btn.getAttribute('data-log');
                    readout.textContent = '> ' + id + '\n' + (LOGS[id] || '[corrupted]');
                    readout.className = 'he-arch-readout';
                }
            });
        });
    }

    function wireConsole(he) {
        var con = he.querySelector('#heConsole');
        var line = he.querySelector('#heConsoleLine');
        con.addEventListener('click', function () {
            reactCore(he, true);
            line.textContent = 'Administrator credentials required.';
            con.classList.remove('he-console-deny'); void con.offsetWidth;
            con.classList.add('he-console-deny');
            setTimeout(function () { line.textContent = 'Awaiting Administrator...'; }, 2200);
        });
    }

    // The core spins up, flares and vents steam when the vault is touched.
    function reactCore(he, strong) {
        var coreEl = he.querySelector('#heCore');
        if (!coreEl) return;
        coreEl.classList.remove('he-reacting'); void coreEl.offsetWidth;
        coreEl.classList.add('he-reacting');
        he.querySelectorAll('.he-vent').forEach(function (v) {
            v.classList.remove('puff'); void v.offsetWidth; v.classList.add('puff');
        });
        clearTimeout(coreEl._t);
        coreEl._t = setTimeout(function () { coreEl.classList.remove('he-reacting'); }, strong ? 1800 : 1200);
    }

    // Ambient life: steam, pulses and a wandering synchronisation reading.
    function startAmbient(he) {
        var sync = he.querySelector('#heSync'), syncVal = he.querySelector('#heSyncVal');
        var spark = he.querySelector('.he-sparks');
        setInterval(function () {
            he.querySelectorAll('.he-vent').forEach(function (v, i) {
                if (Math.random() < 0.6) setTimeout(function () {
                    v.classList.remove('puff'); void v.offsetWidth; v.classList.add('puff');
                }, i * 160);
            });
            if (sync) {
                var s = (80 + Math.random() * 5).toFixed(0);
                sync.style.width = s + '%'; syncVal.textContent = s + '%';
            }
        }, 3200);
        // occasional spark flashes
        setInterval(function () {
            if (!spark) return;
            spark.classList.remove('flash'); void spark.offsetWidth; spark.classList.add('flash');
        }, 2600);
    }

    function gearSVG(teeth, col) {
        var t = '';
        for (var i = 0; i < teeth; i++) {
            var ang = i * (360 / teeth);
            t += '<rect x="45" y="2" width="10" height="16" rx="2" fill="' + col +
                 '" transform="rotate(' + ang + ' 50 50)"/>';
        }
        return '<svg viewBox="0 0 100 100">' + t +
            '<circle cx="50" cy="50" r="33" fill="' + col + '"/>' +
            '<circle cx="50" cy="50" r="24" fill="none" stroke="#0c0f16" stroke-width="3"/>' +
            '<circle cx="50" cy="50" r="12" fill="#0a0d13"/></svg>';
    }

    window.AscenHiddenEngine = { reveal: reveal };
})();
