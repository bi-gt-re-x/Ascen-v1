/* engine-settings.js — the room behind THE ENGINE's metal door.
 *
 * Opening ENGINE SETTINGS boots a fake developer console for the Ascen Engine:
 * a black/green/gray terminal OS with core-module switches, a locked
 * experimental module, a theme "compiler", live performance + diagnostics,
 * audio meters, a hold-to-fire danger zone, and a tiny command line.
 *
 * It is pure theatre — nothing here touches real data or settings.
 */
(function () {
    'use strict';

    var MODULES = ['XP Engine', 'Task Scheduler', 'Analytics Core',
                   'Focus Runtime', 'Notification Daemon', 'Rendering Engine'];
    var PROFILES = [
        { name: 'Eclipse',  accent: '#9b7bff' },
        { name: 'Aurora',   accent: '#43e5b0' },
        { name: 'Midnight', accent: '#5a86ff' },
        { name: 'Frost',    accent: '#79d6ff' },
        { name: 'Matrix',   accent: '#33ff88' }
    ];
    // Public commands (what `help` lists) — the secret `unlock hidden` is not here.
    var COMMANDS = ['help', 'status', 'version', 'diagnostics', 'clear', 'echo', 'reboot', 'exit'];

    var panel = null, diagTimer = null;

    function open() {
        if (panel) return;
        panel = document.createElement('div');
        panel.id = 'engSettingsPanel';
        panel.style.setProperty('--es-accent', '#33ff88');
        panel.innerHTML =
            '<div class="es-scan"></div>' +
            '<div class="es-boot"><pre class="es-bootlog"></pre></div>' +
            '<div class="es-dash"></div>';
        document.body.appendChild(panel);
        requestAnimationFrame(function () { panel.classList.add('show'); });
        runBoot(panel.querySelector('.es-bootlog'), function () {
            var boot = panel.querySelector('.es-boot');
            boot.classList.add('gone');
            setTimeout(function () { boot.style.display = 'none'; }, 550);
            buildDash(panel.querySelector('.es-dash'));
        });
    }

    function close() {
        if (!panel) return;
        if (diagTimer) { clearInterval(diagTimer); diagTimer = null; }
        panel.classList.remove('show');
        var p = panel; panel = null;
        setTimeout(function () { p.remove(); }, 500);
    }

    // --- Boot sequence -----------------------------------------------------
    // Revealed line-by-line (with a blinking block cursor via CSS) rather than
    // char-by-char, so it stays crisp and quick even when the browser throttles
    // background timers.
    function runBoot(pre, done) {
        var lines = ['> Accessing Ascen Engine...', 'Loading subsystems...',
                     'Verifying integrity...', 'ENGINE READY.'];
        pre.classList.add('es-cursor');
        var i = 0, out = '';
        (function tick() {
            if (i >= lines.length) {
                pre.classList.remove('es-cursor');
                setTimeout(done, 600);
                return;
            }
            out += (i ? '\n' : '') + lines[i];
            pre.textContent = out;
            i++;
            setTimeout(tick, 520);
        })();
    }

    // --- Dashboard ---------------------------------------------------------
    function buildDash(dash) {
        dash.innerHTML =
            '<div class="es-topbar">' +
                '<span class="es-brand">ASCEN ENGINE <em>// settings</em></span>' +
                '<button class="es-close" type="button">◂ RETURN TO ENGINE</button>' +
            '</div>' +
            '<div class="es-bg"></div>' +
            '<div class="es-grid">' +
                coreCard() + experimentalCard() + profileCard() +
                performanceCard() + diagnosticsCard() + audioCard() +
                dangerCard() + terminalCard() +
            '</div>' +
            '<div class="es-console">' +
                '<span class="es-console-tag">SYS</span>' +
                '<span class="es-console-line">system idle.</span>' +
                '<span class="es-console-bar"><i></i></span>' +
            '</div>';
        requestAnimationFrame(function () { dash.classList.add('in'); });
        dash.querySelector('.es-close').addEventListener('click', close);
        wireCore(dash); wireProfile(dash); wirePerformance(dash);
        wireDiagnostics(dash); wireAudio(dash); wireDanger(dash); wireTerminal(dash);
    }

    // Every setting change reads out on the console and drives the machine —
    // lights blink, the progress bar fills, and it settles back to idle.
    var seqBusy = false;
    function runSequence(lines, per) {
        if (!panel) return;
        per = per || 480;
        var lineEl = panel.querySelector('.es-console-line');
        var bar = panel.querySelector('.es-console-bar > i');
        if (!lineEl || !bar) return;
        panel.classList.add('es-busy');            // lights flash faster
        var total = lines.length * per;
        bar.style.transition = 'none'; bar.style.width = '0%'; void bar.offsetWidth;
        bar.style.transition = 'width ' + total + 'ms linear'; bar.style.width = '100%';
        var i = 0;
        (function step() {
            if (i >= lines.length) {
                setTimeout(function () {
                    panel.classList.remove('es-busy');
                    lineEl.textContent = 'system idle.';
                    bar.style.transition = 'width 0.3s ease'; bar.style.width = '0%';
                }, 420);
                return;
            }
            lineEl.textContent = lines[i];
            i++; setTimeout(step, per);
        })();
    }

    function card(title, body, cls) {
        return '<section class="es-card ' + (cls || '') + '">' +
            '<h3 class="es-card-title">' + title + '</h3>' +
            '<div class="es-card-body">' + body + '</div></section>';
    }

    // Core Systems
    function coreCard() {
        var rows = MODULES.map(function (m, i) {
            return '<div class="es-mod" data-mod="' + i + '">' +
                '<span class="es-mod-gear">⚙</span>' +
                '<span class="es-mod-name">' + m + '</span>' +
                '<span class="es-mod-status">ONLINE</span>' +
                '<button class="es-switch on" type="button" role="switch" aria-checked="true"><i></i></button>' +
            '</div>';
        }).join('');
        return card('⚙ Core Systems', rows, 'es-core');
    }
    function wireCore(dash) {
        dash.querySelectorAll('.es-mod').forEach(function (row) {
            var sw = row.querySelector('.es-switch');
            var status = row.querySelector('.es-mod-status');
            var gear = row.querySelector('.es-mod-gear');
            var name = MODULES[parseInt(row.getAttribute('data-mod'), 10)];
            gear.classList.add('spin');
            sw.addEventListener('click', function () {
                var on = sw.classList.toggle('on');
                sw.setAttribute('aria-checked', on ? 'true' : 'false');
                reactEngine();                          // the machine responds
                // The subsystem physically spins down / restarts.
                gear.classList.remove('spin', 'stop'); void gear.offsetWidth;
                gear.classList.add(on ? 'spin' : 'stop');
                row.classList.add('es-mod-busy');
                status.textContent = on ? 'STARTING' : 'STOPPING';
                status.classList.toggle('off', !on);
                var lines = on
                    ? ['Starting ' + name + '...', 'Applying configuration...', 'Done.']
                    : ['Stopping ' + name + '...', 'Applying configuration...', 'Restarting subsystem...', 'Done.'];
                runSequence(lines);
                setTimeout(function () {
                    row.classList.remove('es-mod-busy');
                    status.textContent = on ? 'ONLINE' : 'OFFLINE';
                }, lines.length * 480);
            });
        });
    }

    // Experimental (locked)
    function experimentalCard() {
        var body =
            '<div class="es-locked">[ Locked ]</div>' +
            '<div class="es-exp-name">Adaptive AI</div>' +
            '<div class="es-exp-ver">Version: α</div>' +
            '<div class="es-exp-req">Requires:</div>' +
            '<ul class="es-exp-list"><li>Administrator Title</li><li>Level 50</li><li>????</li></ul>';
        return card('Experimental Modules', body, 'es-exp');
    }

    // Rendering Profile (theme compiler)
    function profileCard() {
        var opts = PROFILES.map(function (p, i) {
            return '<button class="es-profile' + (i === 4 ? ' sel' : '') + '" type="button" data-accent="' +
                p.accent + '">› ' + p.name + '</button>';
        }).join('');
        return card('Rendering Profile', opts + '<pre class="es-profile-log"></pre>', 'es-profiles');
    }
    function wireProfile(dash) {
        var opts = dash.querySelectorAll('.es-profile');
        var log = dash.querySelector('.es-profile-log');
        opts.forEach(function (o) {
            o.addEventListener('click', function () {
                if (o.classList.contains('sel')) return;
                opts.forEach(function (x) { x.classList.remove('sel'); });
                o.classList.add('sel');
                var accent = o.getAttribute('data-accent');
                var steps = ['Compiling assets...', 'Applying shaders...', 'Restart complete.'];
                runSequence(steps);
                log.textContent = ''; var i = 0;
                (function step() {
                    if (i >= steps.length) return;
                    log.textContent += (i ? '\n' : '') + steps[i];
                    if (i === 1) panel.style.setProperty('--es-accent', accent);
                    i++; setTimeout(step, 480);
                })();
            });
        });
    }

    // Performance (live sliders)
    function performanceCard() {
        var body =
            bar('Animation Speed', 'anim', 6) +
            bar('Particle Density', 'part', 3) +
            bar('Interface Blur', 'blur', 8) +
            '<div class="es-row"><span class="es-row-label">Power Saving Mode</span>' +
                '<button class="es-switch" data-perf="power" type="button" role="switch" aria-checked="false"><i></i></button></div>';
        return card('Performance', body, 'es-perf');
    }
    function bar(label, key, level) {
        var segs = '';
        for (var i = 0; i < 10; i++) segs += '<i class="' + (i < level ? 'on' : '') + '" data-i="' + i + '"></i>';
        return '<div class="es-bar-row"><span class="es-row-label">' + label + '</span>' +
            '<div class="es-bar" data-key="' + key + '" data-level="' + level + '">' + segs + '</div></div>';
    }
    function wirePerformance(dash) {
        dash.querySelectorAll('.es-perf .es-bar').forEach(function (b) {
            b.addEventListener('click', function (e) {
                var seg = e.target.closest('i'); if (!seg) return;
                var lvl = parseInt(seg.getAttribute('data-i'), 10) + 1;
                setBar(b, lvl);
                applyPerf(b.getAttribute('data-key'), lvl);
            });
        });
        var power = dash.querySelector('[data-perf="power"]');
        power.addEventListener('click', function () {
            var on = power.classList.toggle('on');
            power.setAttribute('aria-checked', on ? 'true' : 'false');
            panel.classList.toggle('es-powersave', on);
            runSequence(on ? ['Power Saving enabled...', 'Throttling subsystems...', 'Done.']
                            : ['Power Saving disabled...', 'Restoring subsystems...', 'Done.']);
        });
    }
    function setBar(b, lvl) {
        b.setAttribute('data-level', lvl);
        b.querySelectorAll('i').forEach(function (seg, i) { seg.classList.toggle('on', i < lvl); });
    }
    function applyPerf(key, lvl) {
        if (key === 'anim') panel.style.setProperty('--es-speed', (2.2 - lvl * 0.19).toFixed(2));
        if (key === 'blur') { var bg = panel.querySelector('.es-bg'); if (bg) bg.style.filter = 'blur(' + (lvl * 1.4) + 'px)'; }
        if (key === 'part') panel.style.setProperty('--es-particles', (lvl / 10).toFixed(2));
    }

    // System Diagnostics (live numbers)
    function diagnosticsCard() {
        var body =
            stat('CPU Usage', 'cpu', '14%') + stat('Memory', 'mem', '58 MB') +
            stat('Objects', 'obj', '4,928') + stat('Tasks Rendered', 'tasks', '37') +
            stat('Version', null, 'v0.8.2-alpha') + stat('Build', null, '240724');
        return card('System Diagnostics', '<div class="es-diag">' + body + '</div>', 'es-diagcard');
    }
    function stat(label, key, val) {
        return '<div class="es-stat"><span class="es-stat-label">' + label + '</span>' +
            '<span class="es-stat-val"' + (key ? ' data-diag="' + key + '"' : '') + '>' + val + '</span></div>';
    }
    function wireDiagnostics(dash) {
        var cpu = dash.querySelector('[data-diag="cpu"]'), mem = dash.querySelector('[data-diag="mem"]');
        var obj = dash.querySelector('[data-diag="obj"]'), tasks = dash.querySelector('[data-diag="tasks"]');
        var ri = function (a, b) { return a + Math.floor(Math.random() * (b - a + 1)); };
        diagTimer = setInterval(function () {
            if (cpu) cpu.textContent = ri(9, 31) + '%';
            if (mem) mem.textContent = ri(52, 66) + ' MB';
            if (obj) obj.textContent = ri(4800, 5100).toLocaleString();
            if (tasks) tasks.textContent = ri(30, 45);
        }, 900);
    }

    // System Audio (meters)
    function audioCard() {
        var body =
            meter('Mechanical', 8) + meter('Clicks', 4) + meter('Completion Chime', 6) +
            '<div class="es-row"><span class="es-row-label">Startup Sequence</span>' +
                '<button class="es-switch on" data-audio="startup" type="button" role="switch" aria-checked="true"><i></i></button></div>';
        return card('System Audio', body, 'es-audio');
    }
    function meter(label, level) {
        var segs = '';
        for (var i = 0; i < 10; i++) segs += '<i class="' + (i < level ? 'on' : '') + '" data-i="' + i + '"></i>';
        return '<div class="es-meter-row"><span class="es-row-label">' + label + '</span>' +
            '<div class="es-meter" data-level="' + level + '">' + segs + '</div></div>';
    }
    function wireAudio(dash) {
        dash.querySelectorAll('.es-audio .es-meter').forEach(function (m) {
            m.addEventListener('click', function (e) {
                var seg = e.target.closest('i'); if (!seg) return;
                var lvl = parseInt(seg.getAttribute('data-i'), 10) + 1;
                m.querySelectorAll('i').forEach(function (s, i) { s.classList.toggle('on', i < lvl); });
                beep(220 + lvl * 40);
            });
        });
        var st = dash.querySelector('[data-audio="startup"]');
        st.addEventListener('click', function () {
            var on = st.classList.toggle('on');
            st.setAttribute('aria-checked', on ? 'true' : 'false');
            if (on) beep(520);
        });
    }
    function beep(freq) {
        try {
            var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
            beep._c = beep._c || new AC();
            var o = beep._c.createOscillator(), g = beep._c.createGain();
            o.type = 'square'; o.frequency.value = freq;
            g.gain.value = 0.03; o.connect(g); g.connect(beep._c.destination);
            o.start(); o.stop(beep._c.currentTime + 0.05);
        } catch (e) {}
    }

    // Danger Zone (hold to fire)
    function dangerCard() {
        var items = [
            ['Reset Statistics', 'STATISTICS RESET'],
            ['Delete Local Cache', 'CACHE DELETED'],
            ['Factory Restore', 'FACTORY RESTORED'],
            ['Purge Engine', 'ENGINE PURGED']
        ];
        var body = items.map(function (it) {
            return '<button class="es-danger-btn" type="button" data-done="' + it[1] + '">' +
                '<span class="es-danger-fill"></span>' +
                '<span class="es-danger-label">' + it[0] + '</span>' +
                '<span class="es-danger-hint">hold 3s</span></button>';
        }).join('');
        return card('████ DANGER ZONE ████', body, 'es-danger');
    }
    function wireDanger(dash) {
        dash.querySelectorAll('.es-danger-btn').forEach(function (btn) {
            var fill = btn.querySelector('.es-danger-fill');
            var lbl = btn.querySelector('.es-danger-label');
            var raf = null, start = 0, firing = false;
            function loop() {
                var p = Math.min(1, (Date.now() - start) / 3000);
                fill.style.width = (p * 100) + '%';
                if (p >= 1) { fire(); return; }
                raf = requestAnimationFrame(loop);
            }
            function begin() {
                if (firing) return;
                start = Date.now(); panel.classList.add('es-alarm'); loop();
            }
            function cancel() {
                if (firing) return;
                if (raf) cancelAnimationFrame(raf);
                panel.classList.remove('es-alarm'); fill.style.width = '0';
            }
            function fire() {
                firing = true; if (raf) cancelAnimationFrame(raf);
                panel.classList.remove('es-alarm'); btn.classList.add('fired');
                var orig = lbl.textContent;
                lbl.textContent = '░ ' + btn.getAttribute('data-done') + ' ░';
                setTimeout(function () {
                    lbl.textContent = orig; btn.classList.remove('fired');
                    fill.style.width = '0'; firing = false;
                }, 1700);
            }
            btn.addEventListener('pointerdown', function (e) { e.preventDefault(); begin(); });
            ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) {
                btn.addEventListener(ev, cancel);
            });
        });
    }

    // Terminal
    function terminalCard() {
        var body =
            '<div class="es-term-log"></div>' +
            '<div class="es-term-input-row"><span class="es-term-prompt">ascen ›</span>' +
                '<input class="es-term-input" type="text" spellcheck="false" autocomplete="off" ' +
                'aria-label="command"></div>';
        return card('Terminal', body, 'es-term');
    }
    function wireTerminal(dash) {
        var input = dash.querySelector('.es-term-input');
        var log = dash.querySelector('.es-term-log');
        function out(t, cls) {
            var d = document.createElement('div');
            if (cls) d.className = cls;
            d.textContent = t; log.appendChild(d); log.scrollTop = log.scrollHeight;
        }
        out("type 'help' for a list of commands.", 'es-term-dim');
        input.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter') return;
            var raw = input.value; var cmd = raw.trim(); input.value = '';
            out('ascen › ' + raw, 'es-term-cmd');
            run(cmd, out, log, dash);
        });
        dash.querySelector('.es-term').addEventListener('click', function () { input.focus(); });
    }
    function printSeq(out, lines, done, per) {
        per = per || 380; var i = 0;
        (function step() {
            if (i >= lines.length) { if (done) done(); return; }
            if (lines[i] !== null) out(lines[i]);
            i++; setTimeout(step, per);
        })();
    }

    function run(cmd, out, log, dash) {
        var parts = cmd.split(/\s+/);
        var c = (parts[0] || '').toLowerCase();
        var arg = (parts[1] || '').toLowerCase();
        reactEngine();                              // every command stirs the machine

        switch (c) {
            case '': break;
            case 'help':
                out('available commands:');
                out('  ' + COMMANDS.join('   '));
                break;
            case 'status':
                out('Core Systems: ONLINE');
                out('Modules Loaded: 18');
                out('Integrity: 100%');
                out('Hidden Modules: ████████');
                out('Access: USER');
                break;
            case 'version':
                out('Ascen Engine v0.8.2-alpha  (build 240724)');
                break;
            case 'diagnostics':
                printSeq(out, [
                    'running diagnostics...',
                    '[ OK ] XP Engine',
                    '[ OK ] Task Scheduler',
                    '[ OK ] Analytics Core',
                    '[ OK ] Focus Runtime',
                    '[ OK ] Notification Daemon',
                    '[ OK ] Rendering Engine',
                    null
                ], function () {
                    out('[ !! ] ' + '▓'.repeat(10) + '   INACCESSIBLE');
                    out('1 module could not be reached.', 'es-term-err');
                });
                break;
            case 'clear': log.innerHTML = ''; break;
            case 'echo': out(parts.slice(1).join(' ')); break;
            case 'reboot':
                out('rebooting core...');
                setTimeout(function () {
                    log.innerHTML = '';
                    out('core online.', 'es-term-cmd');
                }, 1100);
                break;
            case 'exit':
                out('closing session...');
                setTimeout(close, 700);
                break;

            /* --- secrets (never listed by help) --- */
            case 'unlock':
                if (arg === 'hidden') { unlockHidden(out); }
                else { out('access denied: unknown module.', 'es-term-err'); }
                break;
            case 'matrix': out('entering the matrix...'); matrixRain(); break;

            default: out('command not found: ' + c, 'es-term-err');
        }
    }

    // The discovered secret: open the hidden module and the door behind it.
    function unlockHidden(out) {
        printSeq(out, [
            'Verifying...',
            'Access Token Accepted.',
            null,
            'Hidden Module Unlocked.',
            null,
            'Initializing...'
        ], function () {
            if (panel) panel.classList.add('es-unlocking');   // shake + dim
            setTimeout(function () {
                if (window.AscenHiddenEngine) window.AscenHiddenEngine.reveal(close);
                else if (window.AscenEngine) window.AscenEngine.react();
            }, 900);
        }, 460);
    }

    function reactEngine() {
        try { if (window.AscenEngine && window.AscenEngine.react) window.AscenEngine.react(); } catch (e) {}
    }

    function matrixRain() {
        if (!panel || panel.querySelector('.es-matrix')) return;
        var cv = document.createElement('canvas');
        cv.className = 'es-matrix';
        panel.appendChild(cv);
        var ctx = cv.getContext('2d');
        function size() { cv.width = cv.offsetWidth; cv.height = cv.offsetHeight; }
        size();
        var cols = Math.floor(cv.width / 14), drops = [];
        for (var i = 0; i < cols; i++) drops[i] = Math.random() * cv.height;
        var glyphs = 'ｦｧｨｩｪｫ01ABCDEF<>[]{}=+*'.split('');
        var t0 = Date.now();
        var timer = setInterval(function () {
            ctx.fillStyle = 'rgba(0,8,4,0.14)';
            ctx.fillRect(0, 0, cv.width, cv.height);
            ctx.fillStyle = '#39ff9d'; ctx.font = '14px monospace';
            for (var i = 0; i < drops.length; i++) {
                ctx.fillText(glyphs[(Math.random() * glyphs.length) | 0], i * 14, drops[i]);
                drops[i] = drops[i] > cv.height && Math.random() > 0.975 ? 0 : drops[i] + 14;
            }
            if (Date.now() - t0 > 5000) {
                clearInterval(timer);
                cv.style.transition = 'opacity 0.8s ease'; cv.style.opacity = '0';
                setTimeout(function () { if (cv.parentNode) cv.remove(); }, 850);
            }
        }, 55);
    }

    window.AscenEngineSettings = { open: open, close: close };
})();
