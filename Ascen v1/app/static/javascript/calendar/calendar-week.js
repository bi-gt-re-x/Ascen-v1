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
    // The day runs 6 AM through 5 AM the following morning, so hours past
    // midnight are expressed as 24–29 (e.g. 29 = 5 AM next day).
    var START_HOUR = 6;    // 6 AM
    var END_HOUR = 29;     // 5 AM the next day (24 + 5)
    var HOUR_H = 141;      // px per hour (0.7× the previous 202px — a shorter grid)

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
        var hm = ((h % 24) + 24) % 24;          // normalise 24–29 back to 0–5
        var ampm = hm < 12 ? 'AM' : 'PM';
        var hh = hm % 12; if (hh === 0) hh = 12;
        return hh + ' ' + ampm;
    }
    function clock(h) {
        var whole = Math.floor(h);
        var mins = Math.round((h - whole) * 60);
        var hh = whole % 12; if (hh === 0) hh = 12;
        return hh + ':' + (mins < 10 ? '0' + mins : mins);
    }
    // "6:40 PM" — clock time only.
    function timeLabel(d) {
        var hh = d.getHours(), ampm = hh < 12 ? 'AM' : 'PM';
        var h12 = hh % 12; if (h12 === 0) h12 = 12;
        var mm = d.getMinutes();
        return h12 + ':' + (mm < 10 ? '0' + mm : mm) + ' ' + ampm;
    }
    // "Jul 15, 6:40 PM" for a Date — used to label a task block's due date.
    function dueLabel(d) {
        return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + timeLabel(d);
    }
    // "Jul 15 6:40 PM" — compact date+time, for a completion on another day.
    function shortDT(d) {
        return MONTHS[d.getMonth()] + ' ' + d.getDate() + ' ' + timeLabel(d);
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
            // Hours after midnight (0–5:59) belong to the late-night tail of the
            // grid, so express them as 24–29 to sit below the day's midnight line.
            var hourOf = function (dt) {
                var h = dt.getHours() + dt.getMinutes() / 60;
                return h < START_HOUR ? h + 24 : h;
            };
            var s = startDT < dayStart ? START_HOUR : hourOf(startDT);
            var e = endDT > dayEnd ? END_HOUR : hourOf(endDT);
            s = Math.max(START_HOUR, Math.min(s, END_HOUR));
            e = Math.max(START_HOUR, Math.min(e, END_HOUR));
            if (e - s < 0.5) e = Math.min(s + 0.5, END_HOUR);   // keep a readable minimum
            out.push({
                kind: 'task',
                id: t.id,
                start: s, end: e,
                title: t.title || t.name || 'Task',
                xp: Number(t.xp_value || t.xp_reward) || 0,
                done: t.status === 'done',
                priority: String(t.priority || '').toLowerCase(),
                dueDT: toDate(t.due_date),
                startDT: startDT,
                completedDT: t.status === 'done' ? toDate(t.completed_at) : null,
                // Runs past this day's end -> the block continues on the next day.
                contDT: endDT > dayEnd ? new Date(dayStart.getTime() + 86400000) : null
            });
        });
        out.sort(function (a, b) { return a.start - b.start; });
        return out;
    }

    // Overlapping blocks keep their original form: full width, layered
    // vertically. Longer blocks sit beneath shorter ones so a short block
    // always lands on top and stays visible; ties keep the earlier start
    // beneath, so staggered titles all stay readable.
    function byStackOrder(a, b) {
        if (a.h !== b.h) return b.h - a.h;   // longer first (beneath), shorter on top
        return a.top - b.top;                // ties: earlier start beneath
    }

    // Overlap measured against the LONGER block's span (0..1). Above 0.75 the two
    // occupy essentially the same slot — a conflict worth resolving. (A short
    // block tucked inside a long one stays well under this, so it just nests.)
    function overlapFrac(a, b) {
        var o = Math.min(a.top + a.h, b.top + b.h) - Math.max(a.top, b.top);
        if (o <= 0) return 0;
        return o / Math.max(a.h, b.h);
    }

    // Nesting depth: how many overlapping blocks are longer (taller) than this
    // one. A block sitting inside N longer blocks is inset N steps so it fits
    // within them, leaving side padding. Ties break by earlier start / id so
    // the ordering is stable and symmetric.
    function assignNesting(all) {
        function overlaps(a, b) {
            var EPS = 8;
            return a.top < (b.top + b.h) - EPS && b.top < (a.top + a.h) - EPS;
        }
        function longerThan(o, b) {
            if (o.h !== b.h) return o.h > b.h;
            if (o.top !== b.top) return o.top < b.top;
            return String(o.id != null ? o.id : o.name) < String(b.id != null ? b.id : b.name);
        }
        all.forEach(function (b) {
            var depth = 0;
            all.forEach(function (o) {
                if (o !== b && overlaps(o, b) && longerThan(o, b)) depth++;
            });
            b.depth = depth;
        });
    }
    // Inset (left = right) for a block at a given nesting depth, so shorter
    // blocks sit inside longer ones. Uses left+right so a block can never
    // overhang its day column. Capped so deep nesting stays usably wide.
    var NEST_BASE = 4, NEST_STEP = 9, NEST_MAX = 5;
    function nestPos(b) {
        var inset = NEST_BASE + Math.min(b.depth || 0, NEST_MAX) * NEST_STEP;
        return 'top:' + b.top + 'px;height:' + b.h + 'px;left:' + inset + 'px;right:' + inset + 'px';
    }

    // Pairs the user chose to keep — don't nag about them again this session.
    var dismissedConflicts = {};
    function conflictKey(a, b) {
        var ka = a.kind + ':' + (a.id || a.name + a.startHM);
        var kb = b.kind + ':' + (b.id || b.name + b.startHM);
        return ka < kb ? ka + '|' + kb : kb + '|' + ka;
    }

    // Conflict modal: two blocks overlap >75%. Centered on a blocking backdrop
    // with no "keep both" — the calendar can't be used until one side is deleted.
    function showConflictPopup(a, b, dayIso) {
        if (document.getElementById('wkOverlapBackdrop')) return;
        var backdrop = document.createElement('div');
        backdrop.id = 'wkOverlapBackdrop';
        backdrop.className = 'wk-overlap-backdrop';
        var pop = document.createElement('div');
        pop.id = 'wkOverlapPopup';
        pop.className = 'wk-overlap-popup';
        var labelOf = function (x) { return x.kind === 'event' ? x.name : x.title; };
        var msg = document.createElement('span');
        msg.className = 'wk-overlap-msg';
        msg.textContent = '"' + labelOf(a) + '" and "' + labelOf(b) + '" overlap more than 75%. Delete one to continue:';
        pop.appendChild(msg);
        [a, b].forEach(function (x) {
            var del = document.createElement('button');
            del.type = 'button';
            del.className = 'wk-overlap-close';
            del.textContent = 'Delete "' + labelOf(x) + '"';
            del.addEventListener('click', function () {
                backdrop.remove();
                deleteBlock(x, dayIso);
            });
            pop.appendChild(del);
        });
        backdrop.appendChild(pop);
        document.body.appendChild(backdrop);
    }
    function hideOverlapPopup() {
        var p = document.getElementById('wkOverlapBackdrop');
        if (p) p.remove();
    }

    // Delete one side of a conflict: a task goes through the backend (no XP
    // tracking — it wasn't completed); an event is removed from the shared
    // month-view store. Either way the grid redraws right after.
    function deleteBlock(x, dayIso) {
        if (x.kind === 'task' && x.id != null) {
            if (typeof deleteTaskFromBackendWithoutTracking === 'function') {
                deleteTaskFromBackendWithoutTracking(x.id);
            }
            gTasks = gTasks.filter(function (t) { return String(t.id) !== String(x.id); });
            renderDayColumns();
        } else if (x.kind === 'event') {
            var store = (typeof dateContent !== 'undefined') ? dateContent[monthKey(dayIso)] : null;
            if (store && Array.isArray(store.timestamps)) {
                store.timestamps = store.timestamps.filter(function (t) {
                    return !(t.task === x.name && t.startTime === x.startHM && t.endTime === x.endHM);
                });
                if (typeof saveCalendarData === 'function') saveCalendarData();
            }
            renderDayColumns();
        }
    }

    // --- Calendar events (created via the shared "Add New Event" modal) --------
    // Events live in the month view's localStorage store (dateContent, from
    // calendar-month.js), keyed by a non-padded YYYY-M-D string. They render
    // beneath tasks in light, 40%-opaque colours from a palette that avoids the
    // task colours (blue/yellow/red/green).
    var EVENT_COLORS = [
        'rgba(139, 92, 246, 0.4)',   // violet
        'rgba(217, 70, 239, 0.4)',   // fuchsia
        'rgba(236, 72, 153, 0.4)',   // pink
        'rgba(20, 184, 166, 0.4)',   // teal
        'rgba(124, 58, 237, 0.4)'    // purple
    ];
    function eventColor(name) {
        var h = 0, s = String(name || '');
        for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
        return EVENT_COLORS[h % EVENT_COLORS.length];
    }
    function monthKey(iso) {
        var p = iso.split('-');
        return parseInt(p[0], 10) + '-' + parseInt(p[1], 10) + '-' + parseInt(p[2], 10);
    }
    function hmToHour(hm) {
        var p = String(hm).split(':');
        return (parseInt(p[0], 10) || 0) + (parseInt(p[1], 10) || 0) / 60;
    }
    function hmLabel(hm) {
        var p = String(hm).split(':');
        var H = parseInt(p[0], 10) || 0, M = parseInt(p[1], 10) || 0;
        var ap = H < 12 ? 'AM' : 'PM', h12 = H % 12; if (h12 === 0) h12 = 12;
        return h12 + ':' + (M < 10 ? '0' + M : M) + ' ' + ap;
    }
    // User-created events for a day (dashboard tasks and the default daily
    // sessions are excluded — those aren't calendar events).
    function dayEventBlocks(iso) {
        var store = (typeof dateContent !== 'undefined') ? dateContent[monthKey(iso)] : null;
        if (!store || !Array.isArray(store.timestamps)) return [];
        var out = [];
        store.timestamps.forEach(function (t) {
            if (!t || t.isDashboardTask) return;
            if (typeof isPlaceholderTask === 'function' && isPlaceholderTask(t.task)) return;
            if (!t.startTime || !t.endTime) return;
            var sh = hmToHour(t.startTime); if (sh < START_HOUR) sh += 24;
            var eh = hmToHour(t.endTime); if (eh < START_HOUR) eh += 24;
            if (eh <= sh) eh = sh + 1;                      // overnight/degenerate -> 1h
            var s = Math.max(START_HOUR, Math.min(sh, END_HOUR));
            var e = Math.max(START_HOUR, Math.min(eh, END_HOUR));
            if (e - s < 0.5) e = Math.min(s + 0.5, END_HOUR);
            out.push({ kind: 'event', start: s, end: e, name: t.task || 'Event', startHM: t.startTime, endHM: t.endTime });
        });
        return out;
    }

    // Open the shared month-page "Add New Event" modal from the week view. The
    // month flow (confirmAddSection) writes to dateContent[selectedDate], so we
    // point selectedDate at a real day first: today if it's in the shown week,
    // otherwise that week's Monday.
    function openWeekEventModal() {
        if (typeof openAddSectionModal !== 'function') return;
        var mon = mondayOf(weekOffset);
        var weekEnd = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 7);
        var today = new Date(); today.setHours(0, 0, 0, 0);
        var target = (today >= mon && today < weekEnd) ? today : mon;
        var key = target.getFullYear() + '-' + (target.getMonth() + 1) + '-' + target.getDate();
        if (typeof dateContent !== 'undefined' && !dateContent[key]) dateContent[key] = { timestamps: [] };
        selectedDate = key;   // global from calendar-month.js; confirmAddSection reads it
        openAddSectionModal();
    }

    // Draw the seven day columns from the cached real tasks. Kept separate so it
    // can redraw when tasks arrive (async) without rebuilding headers/focus.
    function renderDayColumns() {
        var cols = document.getElementById('wkDayCols');
        if (!cols) return;
        var DAYS = buildDays();
        var gridH = (END_HOUR - START_HOUR) * HOUR_H;
        var conflict = null;
        cols.innerHTML = DAYS.map(function (d) {
            var lines = '';
            for (var h = START_HOUR; h < END_HOUR; h++) {
                lines += '<div class="wk-hourline" style="top:' + ((h - START_HOUR) * HOUR_H) + 'px"></div>';
            }
            var blocks = dayTaskBlocks(d.iso);
            var events = dayEventBlocks(d.iso);
            // Position everything by its start/end time. Blocks keep full width
            // and layer where they overlap (shorter blocks render on top).
            var all = blocks.concat(events);
            all.forEach(function (b) {
                b.top = (b.start - START_HOUR) * HOUR_H;
                // Floor the height so even a very short block keeps enough room
                // for its name plus the time/XP footer (two lines + padding).
                b.h = Math.max(48, (b.end - b.start) * HOUR_H - 4);
            });
            // A pending pair (task and/or event) overlapping >75% of the LONGER
            // block is a conflict — remember the first undismissed pair to offer
            // a delete. Completed tasks are history, so only pending ones count.
            if (!conflict) {
                var live = all.filter(function (b) { return !b.done; });
                for (var ci = 0; ci < live.length && !conflict; ci++) {
                    for (var cj = ci + 1; cj < live.length; cj++) {
                        if (overlapFrac(live[ci], live[cj]) > 0.75 &&
                            !dismissedConflicts[conflictKey(live[ci], live[cj])]) {
                            conflict = { a: live[ci], b: live[cj], iso: d.iso };
                            break;
                        }
                    }
                }
            }

            // Nesting insets, then draw tasks and events together in one pass:
            // longer blocks beneath and a bit wider, shorter ones on top and
            // tucked inside — so task-in-task, event-in-task and task-in-event
            // all read as containment.
            assignNesting(all);
            all.sort(byStackOrder);   // longer beneath (wider), shorter on top (inset)
            var html = all.map(function (b) {
                if (b.kind === 'event') {
                    var col = eventColor(b.name);
                    var border = col.replace('0.4)', '0.6)');
                    return '<div class="wk-event wk-event-cal" style="' + nestPos(b) +
                        ';background:' + col + ';border-color:' + border + '">' +
                        '<div class="wk-event-title">' + esc(b.name) + '</div>' +
                        '<div class="wk-event-foot"><span class="wk-event-due">' +
                            esc(hmLabel(b.startHM) + ' – ' + hmLabel(b.endHM)) +
                        '</span></div>' +
                        '</div>';
                }
                // Task block. Colour-coded by state: completed = green, else by
                // difficulty (low/easy = blue, medium = yellow, high/hard = red).
                var prioCls = b.priority === 'high' ? 'prio-high'
                    : (b.priority === 'medium' ? 'prio-medium' : 'prio-low');
                // Completed tasks keep their priority colour; the done state shows
                // only as a green check sign + green text (see .is-done in CSS).
                var stateCls = prioCls + (b.done ? ' is-done' : '');
                // Footer: a task running past this day says where it continues; a
                // finished task shows its completion time; else its due time.
                var timeText, timeClass;
                if (b.contDT) {
                    timeText = 'Continued on ' + MONTHS[b.contDT.getMonth()] + ' ' + b.contDT.getDate();
                    timeClass = 'wk-event-cont';
                } else if (b.done) {
                    var end = b.completedDT || b.dueDT;
                    timeText = end ? (isoDay(end) === d.iso ? timeLabel(end) : shortDT(end)) : '';
                    timeClass = 'wk-event-done-time';
                } else {
                    var dueStr = b.dueDT ? dueLabel(b.dueDT) : '';
                    timeText = dueStr ? 'Due ' + dueStr : '';
                    timeClass = 'wk-event-due';
                }
                return '<div class="wk-event wk-task ' + stateCls + '" style="' + nestPos(b) + '">' +
                    '<div class="wk-event-title">' +
                        (b.done ? '<span class="wk-event-check">✓</span> ' : '') +
                        esc(b.title) +
                    '</div>' +
                    '<div class="wk-event-foot">' +
                        (timeText ? '<span class="' + timeClass + '">' + esc(timeText) + '</span>' : '') +
                        '<span class="wk-event-xp">' + b.xp + ' XP</span>' +
                    '</div>' +
                    '</div>';
            }).join('');
            return '<div class="wk-daycol' + (d.today ? ' today' : '') + '" style="height:' + gridH + 'px">' + lines + html + '</div>';
        }).join('');

        // Offer to resolve the first >75% overlap conflict (task or event pair).
        if (conflict) showConflictPopup(conflict.a, conflict.b, conflict.iso);
        else hideOverlapPopup();

        // Draw/refresh the "current time" red line after the columns exist.
        renderNowLine();
    }

    // --- "Now" indicator: a red line across the grid at the current time, with
    // the exact time shown on the left (time-label) side. Only on this week. ----
    function fmtNow(d) {
        var hh = d.getHours(), ampm = hh < 12 ? 'AM' : 'PM';
        var h12 = hh % 12; if (h12 === 0) h12 = 12;
        var mm = d.getMinutes();
        return h12 + ':' + (mm < 10 ? '0' + mm : mm) + ' ' + ampm;
    }
    function renderNowLine() {
        var cols = document.getElementById('wkDayCols');
        var labels = document.getElementById('wkTimeLabels');
        if (!cols || !labels) return;

        var oldLine = document.getElementById('wkNowLine');
        if (oldLine) oldLine.remove();
        var oldLabel = document.getElementById('wkNowLabel');
        if (oldLabel) oldLabel.remove();

        // The line only makes sense on the real current week…
        if (weekOffset !== 0) return;
        var now = new Date();
        var h = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
        // Early-morning hours (before 6 AM) sit in the late-night tail (24–29).
        if (h < START_HOUR) h += 24;
        // …and only while "now" falls inside the visible hour window (6 AM–5 AM).
        if (h > END_HOUR) return;
        var top = (h - START_HOUR) * HOUR_H;

        var line = document.createElement('div');
        line.id = 'wkNowLine';
        line.className = 'wk-nowline';
        line.style.top = top + 'px';
        cols.appendChild(line);

        var lab = document.createElement('div');
        lab.id = 'wkNowLabel';
        lab.className = 'wk-nowlabel';
        lab.style.top = top + 'px';
        lab.textContent = fmtNow(now);
        labels.appendChild(lab);
    }

    // Scroll the time grid so the current time sits in the middle of the view.
    // Only on the real current week (else "now" isn't on screen).
    function scrollToNow() {
        if (weekOffset !== 0) return;
        var sc = document.querySelector('#weekView .wk-scroll');
        if (!sc) return;
        var now = new Date();
        var h = now.getHours() + now.getMinutes() / 60;
        if (h < START_HOUR) h += 24;       // early morning lives in the late-night tail
        if (h > END_HOUR) return;
        var top = (h - START_HOUR) * HOUR_H;
        sc.scrollTop = Math.max(0, top - sc.clientHeight / 2);
    }

    // --- Real sidebar numbers, scoped to the current week --------------------
    // "This week" = the Mon–Sun calendar week containing today. Total/Completed/
    // Rate/XP are all derived from the tasks created in that window so they stay
    // internally consistent (Completed <= Total, Rate <= 100%). Streak is the
    // account's live streak.
    function loadSidebar() {
        var user = (window.localStorage && localStorage.getItem('currentUser')) || 'Default';
        fetch('/api/get_user_data?username=' + encodeURIComponent(user), { cache: 'no-store' })
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
                scrollToNow();   // grid + data are ready — jump to the current time
            })
            .catch(function () { renderPriorities([]); scrollToNow(); });
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
        // Whenever the week view becomes visible, jump straight to the current time.
        if (view === 'week') requestAnimationFrame(scrollToNow);
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

        // "Add New Event" opens the same modal the month page uses.
        var addEventBtn = document.querySelector('#weekView .wk-addevent');
        if (addEventBtn) addEventBtn.addEventListener('click', openWeekEventModal);

        // Overview sidebar collapse/expand. Collapsing removes the sidebar column,
        // so the seven day columns widen to fill the freed space. State persists.
        var sidebarToggle = document.getElementById('wkSidebarToggle');
        var wkMain = document.querySelector('#weekView .wk-main');
        var wkHeader = document.querySelector('#weekView .wk-header');
        function applySidebar(collapsed) {
            if (!wkMain) return;
            wkMain.classList.toggle('sidebar-collapsed', collapsed);
            if (wkHeader) wkHeader.classList.toggle('sidebar-collapsed', collapsed);
            if (sidebarToggle) {
                sidebarToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
                sidebarToggle.title = (collapsed ? 'Open' : 'Collapse') + ' the overview sidebar';
                var icon = sidebarToggle.querySelector('.wk-sidebar-toggle-icon');
                if (icon) icon.innerHTML = collapsed ? '&#10095;' : '&#10094;';
            }
            try { localStorage.setItem('wkSidebarCollapsed', collapsed ? '1' : ''); } catch (e) { /* ignore */ }
        }
        if (sidebarToggle && wkMain) {
            sidebarToggle.addEventListener('click', function () {
                applySidebar(!wkMain.classList.contains('sidebar-collapsed'));
            });
            var saved = '';
            try { saved = localStorage.getItem('wkSidebarCollapsed') || ''; } catch (e) { /* ignore */ }
            if (saved === '1') applySidebar(true);
        }

        // After the shared modal adds an event, redraw the grid so it appears.
        if (typeof window.confirmAddSection === 'function' && !window.__wkWrapConfirm) {
            window.__wkWrapConfirm = true;
            var origConfirm = window.confirmAddSection;
            window.confirmAddSection = function () {
                origConfirm.apply(this, arguments);
                renderDayColumns();
            };
        }

        // Keep the "now" line tracking the clock (re-placed each minute).
        setInterval(renderNowLine, 60000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
