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

    // --- Which week is shown (0 = the real current week; the arrows step this) --
    var weekOffset = 0;
    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Monday (midnight) of the shown week.
    function mondayOf(offset) {
        var d = new Date();
        d.setHours(0, 0, 0, 0);
        var dow = (d.getDay() + 6) % 7;            // Mon = 0 … Sun = 6
        d.setDate(d.getDate() - dow + offset * 7);
        return d;
    }
    function sameDay(a, b) {
        return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    }
    // Seven day cells (Mon–Sun) for the shown week, marking the real "today".
    function buildDays() {
        var mon = mondayOf(weekOffset);
        var today = new Date(); today.setHours(0, 0, 0, 0);
        var out = [];
        for (var i = 0; i < 7; i++) {
            var d = new Date(mon); d.setDate(mon.getDate() + i);
            out.push({ name: DOW[i], date: MONTHS[d.getMonth()] + ' ' + d.getDate(), iso: isoDay(d), today: sameDay(d, today) });
        }
        return out;
    }
    // "July 13 – July 19, 2026"-style range for the shown week.
    function weekTitle() {
        var mon = mondayOf(weekOffset), sun = new Date(mon); sun.setDate(mon.getDate() + 6);
        var full = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        return full[mon.getMonth()] + ' ' + mon.getDate() + ' – ' + full[sun.getMonth()] + ' ' + sun.getDate() + ', ' + sun.getFullYear();
    }


    // Real user tasks are placed on the grid (fetched in loadSidebar). We do
    // not render placeholder events, and calendar events proper aren't shown yet.
    var gTasks = [];

    // --- Formatting helpers --------------------------------------------------
    function hourLabel(h) {
        var ampm = h < 12 || h === 24 ? 'AM' : 'PM';
        var hh = h % 12; if (hh === 0) hh = 12;
        return hh + ' ' + ampm;
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

        var DAYS = buildDays();
        var titleEl = document.getElementById('wkTitle');
        if (titleEl) titleEl.textContent = weekTitle();

        var gridH = (END_HOUR - START_HOUR) * HOUR_H;

        // Day headers
        heads.innerHTML = DAYS.map(function (d) {
            return '<div class="wk-dayhead">' +
                '<div class="wk-dayname">' + d.name + '</div>' +
                '<div class="wk-daydate' + (d.today ? ' today' : '') + '">' + d.date.replace('Jul ', 'Jul ') + '</div>' +
                '</div>';
        }).join('');

        // Per-day Focus row: one editable field per day, saved per user + date.
        allday.innerHTML = DAYS.map(function (d) {
            return '<div class="wk-allday-cell">' +
                '<input class="wk-day-focus" type="text" data-date="' + d.iso + '" ' +
                'value="' + esc(loadDayFocus(d.iso)) + '" placeholder="Focus…" ' +
                'aria-label="Focus for ' + esc(d.name + ' ' + d.date) + '"></div>';
        }).join('');

        // Time labels
        var lab = '';
        for (var h = START_HOUR; h <= END_HOUR; h++) {
            lab += '<div class="wk-timelabel" style="height:' + HOUR_H + 'px">' +
                   '<span>' + hourLabel(h) + '</span></div>';
        }
        labels.innerHTML = lab;
        labels.style.height = gridH + 'px';

        renderDayColumns();
    }

    function toDate(v) { if (!v) return null; var d = new Date(v); return isNaN(d.getTime()) ? null : d; }

    // Real tasks overlapping a given day, spanning from their start (creation)
    // to their end (completion time if done, else the due date), clamped to the
    // day and the visible hour window. Multi-day tasks fill each day they cover.
    function dayTaskBlocks(iso) {
        var dayStart = new Date(iso + 'T00:00:00');
        var dayEnd = new Date(iso + 'T23:59:59.999');
        var out = [];
        gTasks.forEach(function (t) {
            var startDT = toDate(t.created_at) || toDate(t.due_date);
            if (!startDT) return;
            var endDT = (t.status === 'done' && toDate(t.completed_at)) ||
                        toDate(t.due_date) ||
                        new Date(startDT.getTime() + 3600000);
            if (endDT <= startDT) endDT = new Date(startDT.getTime() + 3600000);
            if (endDT < dayStart || startDT > dayEnd) return;   // no overlap with this day
            var s = startDT < dayStart ? START_HOUR : startDT.getHours() + startDT.getMinutes() / 60;
            var e = endDT > dayEnd ? END_HOUR : endDT.getHours() + endDT.getMinutes() / 60;
            s = Math.max(START_HOUR, Math.min(s, END_HOUR));
            e = Math.max(START_HOUR, Math.min(e, END_HOUR));
            if (e - s < 0.5) e = Math.min(s + 0.5, END_HOUR);   // keep a readable minimum
            out.push({
                start: s, end: e,
                title: t.title || t.name || 'Task',
                xp: Number(t.xp_value || t.xp_reward) || 0,
                done: t.status === 'done',
                priority: String(t.priority || '').toLowerCase()
            });
        });
        out.sort(function (a, b) { return a.start - b.start; });
        return out;
    }

    // Draw the seven day columns from the cached real tasks. Kept separate so it
    // can redraw when tasks arrive (async) without rebuilding headers/focus.
    function renderDayColumns() {
        var cols = document.getElementById('wkDayCols');
        if (!cols) return;
        var DAYS = buildDays();
        var gridH = (END_HOUR - START_HOUR) * HOUR_H;
        cols.innerHTML = DAYS.map(function (d) {
            var lines = '';
            for (var h = START_HOUR; h < END_HOUR; h++) {
                lines += '<div class="wk-hourline" style="top:' + ((h - START_HOUR) * HOUR_H) + 'px"></div>';
            }
            var evs = dayTaskBlocks(d.iso).map(function (b) {
                var top = (b.start - START_HOUR) * HOUR_H;
                var height = Math.max(24, (b.end - b.start) * HOUR_H - 4);
                return '<div class="wk-event wk-task' + (b.done ? ' done' : '') + '" style="top:' + top + 'px;height:' + height + 'px">' +
                    '<div class="wk-event-time">' + clock(b.start) + '</div>' +
                    '<div class="wk-event-title">' + esc(b.title) + '</div>' +
                    '<div class="wk-event-xp">' + b.xp + ' XP</div>' +
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
                if (!data || !data.success) { renderPriorities([]); return; }
                var stats = data.stats || {};
                var tasks = data.tasks || [];
                gTasks = tasks;            // cache for the grid, then draw them
                renderDayColumns();
                var wk = weekRange(mondayOf(weekOffset));
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

                // Streak straight from the account's stored current_streak, with
                // correct singular/plural so it reads accurately.
                var streak = Number(stats.current_streak) || 0;
                setText('wkStreak', streak + (streak === 1 ? ' day' : ' days'));

                renderPriorities(tasks);
            })
            .catch(function () { renderPriorities([]); });
    }
    function setText(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }

    // --- Top Priorities: the outstanding tasks worth the most XP -------------
    // Pending (not-done) tasks ranked by XP, highest first, top 3. Done tasks
    // aren't priorities, so if nothing is outstanding we show a "-- --" row.
    function renderPriorities(tasks) {
        var ol = document.querySelector('.wk-priorities');
        if (!ol) return;
        var pending = (tasks || []).filter(function (t) { return t.status !== 'done'; });
        pending.sort(function (a, b) { return (Number(b.xp_value) || 0) - (Number(a.xp_value) || 0); });
        var top = pending.slice(0, 3);
        if (!top.length) {
            ol.innerHTML = '<li><span>--</span><span class="wk-badge">--</span></li>';
            return;
        }
        ol.innerHTML = top.map(function (t, i) {
            var p = String(t.priority || '').toLowerCase();
            var cls = p === 'high' ? 'high' : (p === 'medium' ? 'med' : 'low');
            var label = p ? p.charAt(0).toUpperCase() + p.slice(1) : '—';
            return '<li><span>' + (i + 1) + '. ' + esc(t.title || 'Untitled') + '</span>' +
                   '<span class="wk-badge ' + cls + '">' + label + '</span></li>';
        }).join('');
    }

    // --- Weekly Focus (editable, persisted per user + week) ------------------
    // Saved to localStorage keyed by the current user and the Mon–Sun week, so
    // each week keeps its own focus and it survives reloads.
    function focusKey() {
        var user = (window.localStorage && localStorage.getItem('currentUser')) || 'Default';
        return 'wkFocus:' + user + ':' + isoDay(mondayOf(weekOffset));
    }
    function loadFocus() {
        var input = document.getElementById('wkFocusInput');
        if (!input) return;
        // Show the shown week's saved focus. Assigning (not addEventListener)
        // keeps a single handler across week navigation, and focusKey() is read
        // live so edits always save to the week currently on screen.
        try { input.value = localStorage.getItem(focusKey()) || ''; } catch (e) { /* ignore */ }
        input.oninput = input.onblur = function () {
            try { localStorage.setItem(focusKey(), input.value); } catch (e) { /* ignore */ }
        };
    }

    // --- Per-day Focus (one editable field per day, persisted per user + date) --
    function wkUser() {
        return (window.localStorage && localStorage.getItem('currentUser')) || 'Default';
    }
    function dayFocusKey(iso) { return 'wkDayFocus:' + wkUser() + ':' + iso; }
    function loadDayFocus(iso) {
        try { return localStorage.getItem(dayFocusKey(iso)) || ''; } catch (e) { return ''; }
    }

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

    // Re-render everything that depends on the shown week.
    function refresh() {
        renderWeek();
        loadSidebar();
        loadFocus();
    }

    function init() {
        refresh();

        // Week navigation: prev / next step a week, Today returns to this week.
        var arrows = document.querySelectorAll('#weekView .wk-nav .wk-arrow');
        if (arrows[0]) arrows[0].addEventListener('click', function () { weekOffset -= 1; refresh(); });
        if (arrows[1]) arrows[1].addEventListener('click', function () { weekOffset += 1; refresh(); });

        // Per-day focus: delegate saving so it survives the row re-rendering on
        // week navigation. Each field saves to its own date under the user.
        var focusRow = document.getElementById('wkAllday');
        if (focusRow) {
            var saveDay = function (e) {
                var inp = e.target && e.target.closest ? e.target.closest('.wk-day-focus') : null;
                if (!inp) return;
                try { localStorage.setItem(dayFocusKey(inp.dataset.date), inp.value); } catch (err) { /* ignore */ }
            };
            focusRow.addEventListener('input', saveDay);
            focusRow.addEventListener('blur', saveDay, true);
        }

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
