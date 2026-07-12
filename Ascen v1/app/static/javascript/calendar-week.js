/* calendar-week.js — self-contained Week view for the calendar.
 *
 * First pass (per product decisions):
 *  - Sample data for the time grid (representative events, static/display-only).
 *  - Real sidebar numbers where they exist (streak / XP / task counts via the
 *    existing /api/get_user_data endpoint); Focus / Priorities / Charge are
 *    placeholders baked into the HTML.
 *  - Lives in its own #weekView pane; the toggle shows/hides it vs #monthView.
 *    Week is the default view. Day view is a later task (shows a placeholder).
 *
 * The Month view (calendar.js) is untouched.
 */
(function () {
    'use strict';

    // --- Time grid geometry ---------------------------------------------------
    var START_HOUR = 6;    // 6 AM
    var END_HOUR = 22;     // 10 PM
    var HOUR_H = 54;       // px per hour

    // --- Sample week (matches the reference mockup) --------------------------
    var DAYS = [
        { name: 'Mon', date: 'Jul 13' },
        { name: 'Tue', date: 'Jul 14' },
        { name: 'Wed', date: 'Jul 15', today: true },
        { name: 'Thu', date: 'Jul 16' },
        { name: 'Fri', date: 'Jul 17' },
        { name: 'Sat', date: 'Jul 18' },
        { name: 'Sun', date: 'Jul 19' }
    ];

    var ALLDAY = ['Math Goal', 'Coding Sprint', 'Violin Practice', 'Scioly Prep',
                  'Review Day', 'Tennis Match', 'Rest & Reflect'];

    // category -> emoji icon
    var ICON = {
        math: '🧮', coding: '💻', scioly: '🧪', violin: '🎻',
        workout: '🏋️', reading: '📖', tennis: '🎾', personal: '⭐', rest: '🌙'
    };

    // Events per day index (0 = Mon … 6 = Sun). Times are decimal hours (24h).
    var EVENTS = [
        [ // Mon
            e(8, 10, 'Math Practice', 120, 'math'),
            e(10.5, 12, 'Coding Project', 180, 'coding'),
            e(13, 14, 'Scioly Study', 80, 'scioly'),
            e(15, 16, 'Violin Practice', 100, 'violin'),
            e(19, 20.5, 'Workout', 100, 'workout'),
            e(21, 22, 'Reading', 50, 'reading')
        ],
        [ // Tue
            e(7, 9, 'Coding Sprint', 200, 'coding'),
            e(9.5, 10.5, 'Math Practice', 100, 'math'),
            e(11, 12, 'Scioly Prep', 80, 'scioly'),
            e(14, 15.5, 'Project Work', 150, 'scioly'),
            e(16, 17, 'Violin Practice', 100, 'violin'),
            e(19, 20, 'Workout', 100, 'workout'),
            e(21, 22, 'Leetcode', 80, 'reading')
        ],
        [ // Wed
            e(8, 10, 'Math Practice', 120, 'math'),
            e(10.5, 12, 'Coding Project', 180, 'coding'),
            e(13, 14, 'Scioly Study', 80, 'scioly'),
            e(15, 16.25, 'Violin Practice', 120, 'violin'),
            e(19, 20.5, 'Workout', 100, 'workout'),
            e(21, 22, 'Reading', 50, 'reading')
        ],
        [ // Thu
            e(7, 9, 'Coding Sprint', 200, 'coding'),
            e(9.5, 10.5, 'Math Practice', 100, 'math'),
            e(11, 12, 'Scioly Prep', 80, 'scioly'),
            e(14, 15.5, 'Project Work', 150, 'scioly'),
            e(16, 17, 'Violin Practice', 100, 'violin'),
            e(19, 20, 'Workout', 100, 'workout'),
            e(21, 22, 'Leetcode', 80, 'reading')
        ],
        [ // Fri
            e(8, 10, 'Math Review', 120, 'math'),
            e(10.5, 12, 'Coding Project', 180, 'coding'),
            e(13, 14, 'Scioly Study', 80, 'scioly'),
            e(15, 16, 'Violin Practice', 100, 'violin'),
            e(19, 20.5, 'Workout', 100, 'workout'),
            e(21, 22, 'Review Week', 60, 'reading')
        ],
        [ // Sat
            e(9, 11, 'Tennis Match', 120, 'tennis'),
            e(13, 15, 'Personal Project', 150, 'personal'),
            e(16, 17.5, 'Violin Practice', 120, 'violin'),
            e(19, 20, 'Workout', 100, 'workout'),
            e(21, 22, 'Watch / Learn', 50, 'reading')
        ],
        [ // Sun
            e(9, 11, 'Rest & Reflection', 60, 'rest'),
            e(13, 14, 'Plan Week', 80, 'personal'),
            e(15, 16, 'Read / Relax', 50, 'reading'),
            e(19, 20, 'Light Workout', 80, 'workout'),
            e(21, 22, 'Prep for Week', 60, 'reading')
        ]
    ];

    function e(start, end, title, xp, cat) {
        return { start: start, end: end, title: title, xp: xp, cat: cat };
    }

    // --- Formatting helpers --------------------------------------------------
    function hourLabel(h) {
        var ampm = h < 12 || h === 24 ? 'AM' : 'PM';
        var hh = h % 12; if (hh === 0) hh = 12;
        return hh + ' ' + ampm;
    }
    function timeRange(ev) {
        // Compact 12h with no AM/PM, matching the reference ("8:00 - 10:00").
        return clock(ev.start) + ' - ' + clock(ev.end);
    }
    function clock(h) {
        var whole = Math.floor(h);
        var mins = Math.round((h - whole) * 60);
        var hh = whole % 12; if (hh === 0) hh = 12;
        return hh + ':' + (mins < 10 ? '0' + mins : mins);
    }
    function esc(s) {
        return String(s).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    }

    // --- Render the grid -----------------------------------------------------
    function renderWeek() {
        var heads = document.getElementById('wkDayHeads');
        var allday = document.getElementById('wkAllday');
        var labels = document.getElementById('wkTimeLabels');
        var cols = document.getElementById('wkDayCols');
        if (!heads || !cols) return;

        var gridH = (END_HOUR - START_HOUR) * HOUR_H;

        // Day headers
        heads.innerHTML = DAYS.map(function (d) {
            return '<div class="wk-dayhead">' +
                '<div class="wk-dayname">' + d.name + '</div>' +
                '<div class="wk-daydate' + (d.today ? ' today' : '') + '">' + d.date.replace('Jul ', 'Jul ') + '</div>' +
                '</div>';
        }).join('');

        // All-day row
        allday.innerHTML = ALLDAY.map(function (g) {
            return '<div class="wk-allday-cell"><span class="wk-allday-chip">' + esc(g) + '</span></div>';
        }).join('');

        // Time labels
        var lab = '';
        for (var h = START_HOUR; h <= END_HOUR; h++) {
            lab += '<div class="wk-timelabel" style="height:' + HOUR_H + 'px">' +
                   '<span>' + hourLabel(h) + '</span></div>';
        }
        labels.innerHTML = lab;
        labels.style.height = gridH + 'px';

        // Day columns with absolutely-positioned events
        cols.innerHTML = DAYS.map(function (d, di) {
            var lines = '';
            for (var h = START_HOUR; h < END_HOUR; h++) {
                lines += '<div class="wk-hourline" style="top:' + ((h - START_HOUR) * HOUR_H) + 'px"></div>';
            }
            var evs = (EVENTS[di] || []).map(function (ev) {
                var top = (ev.start - START_HOUR) * HOUR_H;
                var height = (ev.end - ev.start) * HOUR_H - 4;
                return '<div class="wk-event cat-' + ev.cat + '" style="top:' + top + 'px;height:' + height + 'px">' +
                    '<div class="wk-event-time">' + timeRange(ev) + '</div>' +
                    '<div class="wk-event-title">' + esc(ev.title) + '</div>' +
                    '<div class="wk-event-xp"><span class="wk-event-icon">' + (ICON[ev.cat] || '•') + '</span>' + ev.xp + ' XP</div>' +
                    '</div>';
            }).join('');
            return '<div class="wk-daycol' + (d.today ? ' today' : '') + '" style="height:' + gridH + 'px">' + lines + evs + '</div>';
        }).join('');
    }

    // --- Real sidebar numbers, scoped to the current week --------------------
    // "This week" = the Mon–Sun calendar week containing today. Total/Completed/
    // Rate/XP are all derived from the tasks created in that window so they stay
    // internally consistent (Completed <= Total, Rate <= 100%). Streak is the
    // account's live streak.
    function loadSidebar() {
        var user = (window.localStorage && localStorage.getItem('currentUser')) || 'Default';
        fetch('/api/get_user_data?username=' + encodeURIComponent(user))
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (!data || !data.success) return;
                var stats = data.stats || {};
                var tasks = data.tasks || [];
                var wk = weekRange(new Date());
                function inWeek(s) { s = (s || '').slice(0, 10); return s && s >= wk.start && s <= wk.end; }

                var weekTasks = tasks.filter(function (t) { return inWeek(t.created_at); });
                var weekDone = weekTasks.filter(function (t) { return t.status === 'done'; });
                var total = weekTasks.length;
                var done = weekDone.length;
                var rate = total ? Math.round(done / total * 100) : 0;
                var xp = weekDone.reduce(function (sum, t) { return sum + (Number(t.xp_value) || 0); }, 0);

                setText('wkTotalTasks', total);
                setText('wkCompleted', done);
                setText('wkRate', rate + '%');
                setText('wkXP', xp.toLocaleString() + ' XP');
                setText('wkStreak', (stats.current_streak || 0) + ' days');
            })
            .catch(function () { /* leave placeholders on error */ });
    }
    function setText(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }

    // Mon–Sun week containing date d, as {start, end} YYYY-MM-DD strings.
    function weekRange(d) {
        var dow = (d.getDay() + 6) % 7;   // Mon = 0 … Sun = 6
        var mon = new Date(d); mon.setDate(d.getDate() - dow);
        var sun = new Date(mon); sun.setDate(mon.getDate() + 6);
        return { start: isoDay(mon), end: isoDay(sun) };
    }
    function isoDay(d) {
        var p = function (n) { return n < 10 ? '0' + n : '' + n; };
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    }

    // --- View toggle (Week / Day / Month) ------------------------------------
    function setView(view, btns) {
        var panes = { week: 'weekView', day: 'dayView', month: 'monthView' };
        Object.keys(panes).forEach(function (k) {
            var el = document.getElementById(panes[k]);
            if (el) el.classList.toggle('active', k === view);
        });
        btns.forEach(function (b) {
            var on = b.getAttribute('data-view') === view;
            b.classList.toggle('active', on);
            b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
    }

    function init() {
        renderWeek();
        loadSidebar();

        var btns = Array.prototype.slice.call(document.querySelectorAll('.view-toggle-btn'));
        btns.forEach(function (b) {
            b.addEventListener('click', function () {
                setView(b.getAttribute('data-view'), btns);
            });
        });
        // Week is the default landing view.
        setView('week', btns);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
