/* celebrate.js — "day clear" confetti for the dashboard.
 *
 * When the user completes the LAST remaining task due today, confetti erupts
 * from the bottom corners of the screen. The check runs against a client-side
 * snapshot of the task list (fed by loadTasks in dashboard.js) so it works the
 * same for logged-in users and the local Default user — no extra server round
 * trip on every completion.
 *
 * A localStorage guard ('dayClearCelebrated:<user>:<date>' = how many due-today
 * tasks existed when we celebrated) keeps it from re-firing on reloads, while
 * still letting it fire again if the user adds MORE tasks due today and clears
 * the day a second time (the count changes, so the guard no longer matches).
 */
(function () {
    'use strict';

    var tasksSnapshot = [];

    function user() {
        return (window.localStorage && localStorage.getItem('currentUser')) || 'Default';
    }
    function localDay(v) {
        if (!v) return '';
        var d = (v instanceof Date) ? v : new Date(v);
        if (isNaN(d.getTime())) return '';
        var p = function (n) { return n < 10 ? '0' + n : '' + n; };
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    }
    function isDone(t) {
        return t.status === 'done' || t.completed === 1 || t.completed === true || t.completed === '1';
    }

    // --- Confetti ----------------------------------------------------------
    // Canvas overlay; particles launch up-and-inward from the two bottom
    // corners, tumble under gravity, and the canvas removes itself when the
    // last particle falls off screen.
    var COLORS = ['#A38A70', '#f4b942', '#e4572e', '#29bf12', '#08bdbd', '#f25f9c', '#7768ae'];

    function confettiFromCorners() {
        var canvas = document.createElement('canvas');
        canvas.setAttribute('aria-hidden', 'true');
        canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:99999;';
        var dpr = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = Math.floor(window.innerWidth * dpr);
        canvas.height = Math.floor(window.innerHeight * dpr);
        document.body.appendChild(canvas);
        var ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        var W = window.innerWidth, H = window.innerHeight;
        var parts = [];

        // dir = +1 launches up-right (left corner), -1 up-left (right corner).
        function spawn(x, dir, count) {
            for (var i = 0; i < count; i++) {
                // Aim mostly upward, fanned toward the center of the screen.
                var angle = (-Math.PI / 2) + dir * (Math.PI / 4) * (0.15 + Math.random() * 0.85);
                var speed = 13 + Math.random() * 11;
                parts.push({
                    x: x + dir * Math.random() * 30,
                    y: H + 10,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    w: 6 + Math.random() * 6,
                    h: 4 + Math.random() * 4,
                    color: COLORS[(Math.random() * COLORS.length) | 0],
                    rot: Math.random() * Math.PI * 2,
                    vr: (Math.random() - 0.5) * 0.3,
                    shape: Math.random() < 0.25 ? 'circle' : 'rect'
                });
            }
        }
        spawn(0, 1, 90);
        spawn(W, -1, 90);

        var frame = 0;
        var started = Date.now(); // wall-clock cutoff — rAF can be throttled
        function tick() {
            frame++;
            ctx.clearRect(0, 0, W, H);
            var alive = false;
            for (var i = 0; i < parts.length; i++) {
                var p = parts[i];
                p.vy += 0.32;             // gravity
                p.vx *= 0.99;             // air drag
                p.x += p.vx;
                p.y += p.vy;
                p.rot += p.vr;
                if (p.y < H + 30) alive = true;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.fillStyle = p.color;
                if (p.shape === 'circle') {
                    ctx.beginPath();
                    ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    // "Flutter" by squashing height with a per-particle phase.
                    var squash = Math.abs(Math.sin(frame / 10 + p.rot));
                    ctx.fillRect(-p.w / 2, -p.h * squash / 2, p.w, Math.max(1, p.h * squash));
                }
                ctx.restore();
            }
            if (alive && Date.now() - started < 8000) requestAnimationFrame(tick);
            else canvas.remove();
        }
        requestAnimationFrame(tick);
        // Belt and braces: rAF stops entirely in hidden/inactive tabs, so make
        // sure the overlay never outlives the party even if tick never re-runs.
        setTimeout(function () { canvas.remove(); }, 10000);
    }

    // --- Day-clear detection ------------------------------------------------
    function guardKey() { return 'dayClearCelebrated:' + user() + ':' + localDay(new Date()); }

    function checkDayClear() {
        var today = localDay(new Date());
        var dueToday = tasksSnapshot.filter(function (t) {
            return t.due_date && localDay(t.due_date) === today;
        });
        if (!dueToday.length) return;

        if (!dueToday.every(isDone)) {
            // Not clear (or no longer clear — a new task was added): re-arm.
            try { localStorage.removeItem(guardKey()); } catch (e) { /* ignore */ }
            return;
        }
        var count = String(dueToday.length);
        try {
            if (localStorage.getItem(guardKey()) === count) return; // already celebrated this clear
            localStorage.setItem(guardKey(), count);
        } catch (e) { /* ignore */ }
        confettiFromCorners();
    }

    window.Celebrate = {
        // loadTasks() hands us the freshly fetched full task list.
        setTasks: function (tasks) {
            tasksSnapshot = Array.isArray(tasks) ? tasks : [];
            checkDayClear(); // a reload mid-clear stays guarded by localStorage
        },
        // A task created in this session (the Default user's tasks never reach
        // the backend, so loadTasks can't pick them up) joins the snapshot here.
        taskAdded: function (task) {
            if (task && task.id != null) tasksSnapshot.push(task);
            checkDayClear(); // an incomplete due-today task re-arms the guard
        },
        // Called right after a completion syncs; marks it done in the snapshot
        // (the backend write may still be in flight) and re-checks.
        taskCompleted: function (taskId) {
            tasksSnapshot.forEach(function (t) {
                if (t.id === taskId) t.status = 'done';
            });
            checkDayClear();
        },
        confetti: confettiFromCorners
    };
})();
