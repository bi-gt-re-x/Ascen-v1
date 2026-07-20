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

    // Per-day occupied [top, bottom] pixel ranges, rebuilt on every render; used
    // by drag-to-create so a new selection stops when it meets a task/event.
    var dragBusy = {};

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
    // "6 PM" / "6:40 PM" — drops ":00" on the hour; for the compact short layout.
    function timeLabelShort(d) {
        var hh = d.getHours(), ampm = hh < 12 ? 'AM' : 'PM';
        var h12 = hh % 12; if (h12 === 0) h12 = 12;
        var mm = d.getMinutes();
        return mm ? (h12 + ':' + (mm < 10 ? '0' + mm : mm) + ' ' + ampm) : (h12 + ' ' + ampm);
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
        // A column runs along the GRID window, not calendar midnight: START_HOUR
        // (6 AM) that day to END_HOUR (5 AM the next day). Early-morning hours
        // (before 6 AM) belong to the previous day's column tail, so placing tasks
        // by this window keeps an overnight task (e.g. 3 PM → 5 AM) as one block on
        // the correct column instead of wrongly spilling onto the next day.
        var gridStart = new Date(iso + 'T00:00:00'); gridStart.setHours(START_HOUR, 0, 0, 0);
        var gridEnd = new Date(gridStart.getTime() + (END_HOUR - START_HOUR) * 3600000);
        var out = [];
        gTasks.forEach(function (t) {
            var startDT = toDate(t.created_at) || toDate(t.due_date);
            if (!startDT) return;
            var dueDT = toDate(t.due_date);
            var compDT = (t.status === 'done') ? toDate(t.completed_at) : null;
            // Finishing early shrinks the block to the completion time; finishing
            // late must NOT extend it — a done task never grows past its scheduled
            // slot, so cap the end at the due time.
            var endDT = compDT || dueDT || new Date(startDT.getTime() + 3600000);
            if (dueDT && endDT > dueDT) endDT = dueDT;
            if (endDT <= startDT) endDT = new Date(startDT.getTime() + 3600000);
            if (endDT <= gridStart || startDT >= gridEnd) return;   // outside this column's window
            // Hours measured from the column's 6 AM top: 6 … 29 (29 = 5 AM next day).
            var hourInCol = function (dt) { return START_HOUR + (dt.getTime() - gridStart.getTime()) / 3600000; };
            var s = startDT < gridStart ? START_HOUR : hourInCol(startDT);
            var e = endDT > gridEnd ? END_HOUR : hourInCol(endDT);
            s = Math.max(START_HOUR, Math.min(s, END_HOUR));
            e = Math.max(START_HOUR, Math.min(e, END_HOUR));
            // No minimum: task blocks are sized strictly by their actual time span.
            out.push({
                kind: 'task',
                id: t.id,
                start: s, end: e,
                title: t.title || t.name || 'Task',
                xp: Number(t.xp_value || t.xp_reward) || 0,
                done: t.status === 'done',
                // Only tasks explicitly shown on the calendar take part in overlap
                // conflicts; plain dashboard/to-do tasks are excluded (see below).
                onCalendar: (t.show_on_calendar === true || t.show_on_calendar === 1 ||
                             t.show_on_calendar === '1' || t.show_on_calendar === 'true'),
                priority: String(t.priority || '').toLowerCase(),
                dueDT: toDate(t.due_date),
                startDT: startDT,
                completedDT: t.status === 'done' ? toDate(t.completed_at) : null,
                // Runs past this column's window -> continues on the next day.
                contDT: endDT > gridEnd ? new Date(gridStart.getTime() + 86400000) : null,
                // Began before this column's window -> this column is a continuation.
                cont: startDT < gridStart
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

    // Strict overlap test between two blocks, on the clock (hours). True when their
    // time spans intersect by more than a hair — so any real overlap counts, but
    // blocks that merely touch at an edge (e.g. 2–3 and 3–4) do not.
    function blocksOverlap(a, b) {
        var EPS = 0.001;   // ~3.6s; times snap to 5-min so touching edges give 0
        return Math.min(a.end, b.end) - Math.max(a.start, b.start) > EPS;
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
    // Every block is the same width — events and tasks alike — with a small fixed
    // side inset. (Overlaps are prevented at creation, so blocks no longer need to
    // nest inside one another; a rare leftover overlap just layers, shorter on top.)
    var NEST_BASE = 4;
    function nestPos(b) {
        return 'top:' + b.top + 'px;height:' + b.h + 'px;left:' + NEST_BASE + 'px;right:' + NEST_BASE + 'px';
    }

    // Pairs the user chose to keep — don't nag about them again this session.
    var dismissedConflicts = {};
    function conflictKey(a, b) {
        var ka = a.kind + ':' + (a.id || a.name + a.startHM);
        var kb = b.kind + ':' + (b.id || b.name + b.startHM);
        return ka < kb ? ka + '|' + kb : kb + '|' + ka;
    }

    // Conflict modal: two blocks (event–event or event–task) overlap in time.
    // Centered on a blocking backdrop with no "keep both" — the calendar can't be
    // used until one side is deleted.
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
        msg.textContent = '"' + labelOf(a) + '" and "' + labelOf(b) + '" overlap. Delete one to continue:';
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

    // --- Per-block overflow (three-dots) menu: edit / delete -------------------
    // The dots glyph adapts to the block's height: a short block gets a
    // horizontal ellipsis (⋯) so it fits the thin strip; a taller block gets
    // the usual vertical three-dots (⋮).
    function cardMenuBtn(h) {
        var dots = h < 44 ? '⋯' : '⋮';   // ⋯ horizontal vs ⋮ vertical
        return '<button type="button" class="wk-card-menu" aria-label="Options">' + dots + '</button>';
    }

    // The dropdown is a body-level popover (not nested in the block) so the
    // block's overflow:hidden can't clip it. Only one is open at a time.
    function closeCardPop() {
        var p = document.getElementById('wkCardPop');
        if (p) p.remove();
    }
    function openCardPop(btn) {
        closeCardPop();
        var block = btn.closest('.wk-event');
        if (!block) return;
        var kind = block.getAttribute('data-kind');
        var iso = block.getAttribute('data-iso');
        var pop = document.createElement('div');
        pop.id = 'wkCardPop';
        pop.className = 'wk-card-pop';
        var items = [];
        if (kind === 'event') items.push(['Edit', 'edit']);   // tasks aren't editable here
        items.push(['Delete', 'del']);
        items.forEach(function (it) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'wk-dd-item' + (it[1] === 'del' ? ' wk-dd-del' : '');
            b.textContent = it[0];
            b.addEventListener('click', function (e) {
                e.stopPropagation();
                closeCardPop();
                doCardAction(it[1], kind, iso, block);
            });
            pop.appendChild(b);
        });
        document.body.appendChild(pop);
        // Anchor the popover to the button, flipping above/left if it would
        // run off the viewport.
        var r = btn.getBoundingClientRect();
        var pw = pop.offsetWidth || 120, ph = pop.offsetHeight || 72;
        var left = Math.max(6, Math.min(r.right - pw, window.innerWidth - pw - 6));
        var top = r.bottom + 4;
        if (top + ph > window.innerHeight - 6) top = Math.max(6, r.top - ph - 4);
        pop.style.left = left + 'px';
        pop.style.top = top + 'px';
    }
    function doCardAction(action, kind, iso, block) {
        if (action === 'edit') {
            editEvent(iso, block);   // events only (tasks have no edit item)
            return;
        }
        // Delete: confirm first in a styled, blocking popup. Only on confirm does
        // the tested deleteBlock remove the item and redraw.
        var titleEl = block.querySelector('.wk-event-title');
        var name = kind === 'task'
            ? (titleEl ? titleEl.textContent.replace('✓', '').trim() : 'this task')
            : block.getAttribute('data-name');
        if (kind === 'event') {
            var evName = block.getAttribute('data-name');
            var evS = block.getAttribute('data-shm');
            var evE = block.getAttribute('data-ehm');
            var occs = findEventOccurrences(evName, evS, evE);
            // A recurring event (more than one occurrence) offers all / this /
            // choose-specific; a one-off just confirms.
            if (occs.length > 1) {
                showRecurrenceDeleteDialog(evName, evS, evE, iso, occs);
            } else {
                showDeleteConfirm('event', name, function () {
                    deleteBlock({ kind: 'event', name: evName, startHM: evS, endHM: evE }, iso);
                });
            }
            return;
        }
        showDeleteConfirm(kind, name, function () {
            deleteBlock({ kind: 'task', id: block.getAttribute('data-id') }, iso);
        });
    }
    // Styled, blocking delete confirmation. A full-viewport backdrop intercepts
    // all clicks so the rest of the page can't be used until the user answers.
    function showDeleteConfirm(kind, name, onConfirm) {
        closeCardPop();
        var existing = document.getElementById('wkConfirmBackdrop');
        if (existing) existing.remove();
        var noun = kind === 'task' ? 'task' : 'event';
        var backdrop = document.createElement('div');
        backdrop.id = 'wkConfirmBackdrop';
        backdrop.className = 'wk-confirm-backdrop';
        var pop = document.createElement('div');
        pop.className = 'wk-confirm-popup';
        var title = document.createElement('h3');
        title.className = 'wk-confirm-title';
        title.textContent = 'Delete ' + noun + '?';
        var msg = document.createElement('p');
        msg.className = 'wk-confirm-msg';
        msg.textContent = 'Delete "' + name + '"? This can’t be undone.';
        var actions = document.createElement('div');
        actions.className = 'wk-confirm-actions';
        var cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'wk-confirm-cancel';
        cancel.textContent = 'Cancel';
        cancel.addEventListener('click', function () { backdrop.remove(); });
        var del = document.createElement('button');
        del.type = 'button';
        del.className = 'wk-confirm-delete';
        del.textContent = 'Delete';
        del.addEventListener('click', function () { backdrop.remove(); onConfirm(); });
        actions.appendChild(cancel);
        actions.appendChild(del);
        pop.appendChild(title);
        pop.appendChild(msg);
        pop.appendChild(actions);
        backdrop.appendChild(pop);
        // Clicking the dimmed area (outside the card) cancels; the card doesn't.
        backdrop.addEventListener('click', function (e) { if (e.target === backdrop) backdrop.remove(); });
        document.body.appendChild(backdrop);
    }

    // --- Recurring-event delete: all / this one / choose specific dates --------
    // Recurrences of an event are separate timestamps (one per day) that share the
    // same name + start/end time across the month-view store. Find them all.
    function findEventOccurrences(name, shm, ehm) {
        var res = [];
        if (typeof dateContent === 'undefined') return res;
        Object.keys(dateContent).forEach(function (key) {
            var store = dateContent[key];
            if (!store || !Array.isArray(store.timestamps)) return;
            var hit = store.timestamps.some(function (t) {
                return t && t.task === name && t.startTime === shm && t.endTime === ehm;
            });
            if (hit) res.push({ key: key, date: keyToDate(key) });
        });
        res.sort(function (a, b) { return a.date - b.date; });
        return res;
    }
    function keyToDate(key) {
        var p = String(key).split('-');
        return new Date(+p[0], (+p[1] || 1) - 1, +p[2] || 1);
    }
    // Remove every occurrence of the event on the given month-store keys, persist,
    // and redraw (which re-runs the overlap check).
    function removeEventFromKeys(name, shm, ehm, keys) {
        keys.forEach(function (key) {
            var store = (typeof dateContent !== 'undefined') ? dateContent[key] : null;
            if (store && Array.isArray(store.timestamps)) {
                store.timestamps = store.timestamps.filter(function (t) {
                    return !(t.task === name && t.startTime === shm && t.endTime === ehm);
                });
            }
        });
        if (typeof saveCalendarData === 'function') saveCalendarData();
        renderDayColumns();
    }

    function showRecurrenceDeleteDialog(name, shm, ehm, thisIso, occs) {
        closeCardPop();
        var existing = document.getElementById('wkConfirmBackdrop');
        if (existing) existing.remove();
        var thisKey = monthKey(thisIso);
        var backdrop = document.createElement('div');
        backdrop.id = 'wkConfirmBackdrop';
        backdrop.className = 'wk-confirm-backdrop';
        var pop = document.createElement('div');
        pop.className = 'wk-confirm-popup';
        backdrop.appendChild(pop);
        backdrop.addEventListener('click', function (e) { if (e.target === backdrop) backdrop.remove(); });
        document.body.appendChild(backdrop);

        function btn(cls, text, onClick) {
            var b = document.createElement('button');
            b.type = 'button'; b.className = cls; b.textContent = text;
            b.addEventListener('click', onClick);
            return b;
        }
        var DAYS3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        function fmtDate(d) { return DAYS3[d.getDay()] + ' ' + MONTHS[d.getMonth()] + ' ' + d.getDate(); }

        // Main view: this / all / choose / cancel.
        function renderMain() {
            pop.innerHTML = '';
            var title = document.createElement('h3');
            title.className = 'wk-confirm-title';
            title.textContent = 'Delete recurring event';
            var msg = document.createElement('p');
            msg.className = 'wk-confirm-msg';
            msg.textContent = '"' + name + '" repeats across ' + occs.length + ' days. What should be deleted?';
            var actions = document.createElement('div');
            actions.className = 'wk-recur-actions';
            actions.appendChild(btn('wk-recur-btn', 'Only this occurrence', function () {
                backdrop.remove(); removeEventFromKeys(name, shm, ehm, [thisKey]);
            }));
            actions.appendChild(btn('wk-recur-btn', 'All ' + occs.length + ' occurrences', function () {
                backdrop.remove(); removeEventFromKeys(name, shm, ehm, occs.map(function (o) { return o.key; }));
            }));
            actions.appendChild(btn('wk-recur-btn', 'Choose specific dates…', renderChoose));
            actions.appendChild(btn('wk-confirm-cancel', 'Cancel', function () { backdrop.remove(); }));
            pop.appendChild(title); pop.appendChild(msg); pop.appendChild(actions);
        }

        // Choose view: a checklist of every occurrence date (current pre-checked).
        function renderChoose() {
            pop.innerHTML = '';
            var title = document.createElement('h3');
            title.className = 'wk-confirm-title';
            title.textContent = 'Choose dates to delete';
            var list = document.createElement('div');
            list.className = 'wk-recur-list';
            occs.forEach(function (o) {
                var row = document.createElement('label');
                row.className = 'wk-recur-row';
                var cb = document.createElement('input');
                cb.type = 'checkbox'; cb.value = o.key;
                if (o.key === thisKey) cb.checked = true;
                var span = document.createElement('span');
                span.textContent = fmtDate(o.date);
                row.appendChild(cb); row.appendChild(span);
                list.appendChild(row);
            });
            var actions = document.createElement('div');
            actions.className = 'wk-confirm-actions';
            actions.appendChild(btn('wk-confirm-cancel', 'Back', renderMain));
            actions.appendChild(btn('wk-confirm-delete', 'Delete selected', function () {
                var keys = [].slice.call(list.querySelectorAll('input:checked')).map(function (c) { return c.value; });
                backdrop.remove();
                if (keys.length) removeEventFromKeys(name, shm, ehm, keys);
            }));
            pop.appendChild(title); pop.appendChild(list); pop.appendChild(actions);
        }

        renderMain();
    }

    // Edit an event through the month view's shared edit modal by pointing
    // selectedDate at the event's day and finding its timestamp index.
    function editEvent(iso, block) {
        var name = block.getAttribute('data-name');
        var shm = block.getAttribute('data-shm');
        var ehm = block.getAttribute('data-ehm');
        var mk = monthKey(iso);
        var store = (typeof dateContent !== 'undefined') ? dateContent[mk] : null;
        if (!store || !Array.isArray(store.timestamps)) return;
        var idx = -1;
        for (var i = 0; i < store.timestamps.length; i++) {
            var t = store.timestamps[i];
            if (t && t.task === name && t.startTime === shm && t.endTime === ehm) { idx = i; break; }
        }
        if (idx < 0) return;
        selectedDate = mk;   // shared global lexical binding the month flow reads
        if (typeof editTaskSection === 'function') editTaskSection(idx);
        // Match the wide Add-Event popup: widen the edit modal in the week view.
        var em = document.getElementById('editSectionModal');
        if (em) em.classList.add('from-week');
    }

    // --- Calendar events (created via the shared "Add New Event" modal) --------
    // Events live in the month view's localStorage store (dateContent, from
    // calendar-month.js), keyed by a non-padded YYYY-M-D string. Each event is
    // colour-coded per identity: one colour per event, shared by all of its
    // recurrences. The palette matches the month view's EVENT_COLOR_PALETTE so a
    // given event looks identical in both views.
    var WK_EVENT_PALETTE = [
        [139, 92, 246],   // violet
        [236, 72, 153],   // pink
        [20, 184, 166],   // teal
        [249, 115, 22],   // orange
        [217, 70, 239],   // fuchsia
        [34, 211, 238],   // cyan
        [124, 58, 237],   // purple
        [244, 63, 94]     // rose
    ];
    // Colour index for an event block: its stored colorIndex, else a stable hash
    // of the name (so legacy events and their repeats still share a colour).
    function wkEventColorIndex(b) {
        var n = WK_EVENT_PALETTE.length;
        if (b && typeof b.colorIndex === 'number') return ((b.colorIndex % n) + n) % n;
        var s = String((b && b.name) || ''), h = 0;
        for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
        return h % n;
    }
    // Returns { fill, border } rgba strings for an event block. Prefers the
    // event's stored distinct hex (shared with the month view), falling back to
    // the local palette for legacy events.
    function eventColor(b) {
        var rgb;
        if (window.eventRgb) {
            rgb = window.eventRgb({ color: b.color, colorIndex: b.colorIndex, task: b.name });
        } else {
            rgb = WK_EVENT_PALETTE[wkEventColorIndex(b)];
        }
        return {
            fill: 'rgba(' + rgb[0] + ', ' + rgb[1] + ', ' + rgb[2] + ', 0.4)',
            border: 'rgba(' + rgb[0] + ', ' + rgb[1] + ', ' + rgb[2] + ', 0.62)',
            // A stronger, near-solid version for the left accent border.
            left: 'rgba(' + rgb[0] + ', ' + rgb[1] + ', ' + rgb[2] + ', 0.95)'
        };
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
    // Compact start time — drops ":00" on the hour (e.g. "12 PM", "1:45 PM").
    // Used by the short-event one-row layout.
    function hmLabelShort(hm) {
        var p = String(hm).split(':');
        var H = parseInt(p[0], 10) || 0, M = parseInt(p[1], 10) || 0;
        var ap = H < 12 ? 'AM' : 'PM', h12 = H % 12; if (h12 === 0) h12 = 12;
        return M ? (h12 + ':' + (M < 10 ? '0' + M : M) + ' ' + ap) : (h12 + ' ' + ap);
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
            if (eh <= sh) eh = sh + 1;                      // degenerate -> 1h
            var base = { kind: 'event', name: t.task || 'Event', startHM: t.startTime, endHM: t.endTime, colorIndex: t.colorIndex, color: t.color };
            var clamp = function (x) { return Math.max(START_HOUR, Math.min(x, END_HOUR)); };
            // An event crossing midnight (24:00) is split there so the after-
            // midnight part renders as its own "continued" block on the next day.
            if (sh < 24 && eh > 24) {
                out.push(Object.assign({ start: clamp(sh), end: 24 }, base));
                out.push(Object.assign({ start: 24, end: clamp(eh), cont: true }, base));
            } else {
                // Sizes are strictly the block's actual time span (no minimum).
                out.push(Object.assign({ start: clamp(sh), end: clamp(eh) }, base));
            }
        });
        return out;
    }

    // Open the shared Add-Event modal for a specific day, widened for the week
    // view and defaulted to weekly recurrence. `times`, when given, pre-fills the
    // start/end pickers (minutes-of-day) — used by the drag-to-create flow.
    function openWeekModalForDate(key, times) {
        if (typeof openAddSectionModal !== 'function') return;
        if (typeof dateContent !== 'undefined' && !dateContent[key]) dateContent[key] = { timestamps: [] };
        selectedDate = key;   // global from calendar-month.js; confirmAddSection reads it
        openAddSectionModal();
        var modal = document.getElementById('addSectionModal');
        if (modal) modal.classList.add('from-week');   // 2x-wide popup, no h-scroll
        if (times && typeof setTimePickers === 'function') {
            setTimePickers('start', times.start);
            setTimePickers('end', times.end);
        }
        // Week calendar → default to weekly recurrence on the selected day.
        if (typeof applyDefaultRecurrence === 'function') applyDefaultRecurrence('weekly');
    }

    // --- Drag-to-create: choose Event or Task, then open the matching modal ----
    // The drag interaction (selection, gap-clamping, snapping) is shared; only the
    // outcome differs. This chooser is the first popup a drag pops up.
    function showCreateChooser(iso, times) {
        var existing = document.getElementById('wkChooseBackdrop');
        if (existing) existing.remove();
        var backdrop = document.createElement('div');
        backdrop.id = 'wkChooseBackdrop';
        backdrop.className = 'wk-choose-backdrop';
        var pop = document.createElement('div');
        pop.className = 'wk-choose-popup';
        var title = document.createElement('div');
        title.className = 'wk-choose-title';
        title.textContent = 'Create in this slot';
        var row = document.createElement('div');
        row.className = 'wk-choose-row';
        var evBtn = document.createElement('button');
        evBtn.type = 'button'; evBtn.className = 'wk-choose-btn'; evBtn.textContent = 'Event';
        evBtn.addEventListener('click', function () {
            backdrop.remove();
            openWeekModalForDate(monthKey(iso), times);
        });
        var taskBtn = document.createElement('button');
        taskBtn.type = 'button'; taskBtn.className = 'wk-choose-btn is-task'; taskBtn.textContent = 'Task';
        taskBtn.addEventListener('click', function () {
            backdrop.remove();
            openWeekTaskModal(iso, times);
        });
        row.appendChild(evBtn); row.appendChild(taskBtn);
        var cancel = document.createElement('button');
        cancel.type = 'button'; cancel.className = 'wk-choose-cancel'; cancel.textContent = 'Cancel';
        cancel.addEventListener('click', function () { backdrop.remove(); });
        pop.appendChild(title); pop.appendChild(row); pop.appendChild(cancel);
        backdrop.appendChild(pop);
        backdrop.addEventListener('click', function (e) { if (e.target === backdrop) backdrop.remove(); });
        document.body.appendChild(backdrop);
    }

    // The day (YYYY-M-D-ish iso) a drag-created task belongs to; read by confirm.
    var wkTaskIso = null;

    // Fill the task modal's hour (1–12) and minute (5-min) selects for a prefix.
    function fillTaskTimeSelects() {
        ['taskStart', 'taskEnd'].forEach(function (p) {
            var hEl = document.getElementById(p + 'Hour');
            var mEl = document.getElementById(p + 'Minute');
            if (hEl) { var h = '<option value="">--</option>'; for (var i = 1; i <= 12; i++) h += '<option value="' + i + '">' + i + '</option>'; hEl.innerHTML = h; }
            if (mEl) { var m = '<option value="">--</option>'; for (var j = 0; j <= 59; j += 5) { var mm = (j < 10 ? '0' + j : '' + j); m += '<option value="' + mm + '">' + mm + '</option>'; } mEl.innerHTML = m; }
        });
    }

    // Open the task modal (same layout as the Add-Event modal) with the dragged
    // times and default XP pre-filled. Tasks don't recur yet — no recurrence UI.
    function openWeekTaskModal(iso, times) {
        var modal = document.getElementById('addTaskModal');
        if (!modal) return;
        wkTaskIso = iso;
        fillTaskTimeSelects();
        var nameEl = document.getElementById('taskName'); if (nameEl) nameEl.value = '';
        syncTaskXp(10);   // reset the XP slider/input/label together
        if (times && typeof setTimePickers === 'function') {
            setTimePickers('taskStart', times.start);
            setTimePickers('taskEnd', times.end);
        }
        ['taskName', 'taskStartHour', 'taskEndHour'].forEach(function (id) {
            var el = document.getElementById(id); if (el) el.classList.remove('invalid-input');
        });
        modal.classList.add('from-week');   // match the wide Add-Event popup
        modal.style.display = 'block';
    }

    function closeWeekTaskModal() {
        var modal = document.getElementById('addTaskModal');
        if (modal) modal.style.display = 'none';
    }

    // Create the task from the modal: place its block on the dragged slot by using
    // created_at = start and due_date = end (both on wkTaskIso), persist it, then
    // add it to the grid and redraw — which runs the strict overlap check.
    function confirmWeekTask() {
        var name = (document.getElementById('taskName').value || '').trim();
        var xp = parseInt(document.getElementById('taskXp').value, 10);
        if (isNaN(xp) || xp < 0) xp = 0;
        var hasStart = !!document.getElementById('taskStartHour').value;
        var hasEnd = !!document.getElementById('taskEndHour').value;
        var bad = false;
        function mark(id, on) { var el = document.getElementById(id); if (el) el.classList.toggle('invalid-input', on); }
        mark('taskName', !name); if (!name) bad = true;
        mark('taskStartHour', !hasStart); if (!hasStart) bad = true;
        mark('taskEndHour', !hasEnd); if (!hasEnd) bad = true;
        if (bad) return;
        var startT = getTimeTo24Hour('taskStart');
        var endT = getTimeTo24Hour('taskEnd');

        // iso is 'YYYY-M-D' (non-padded); build a local ISO with zero-padded parts.
        var parts = String(wkTaskIso).split('-');
        var day = parts[0] + '-' + String(parts[1]).padStart(2, '0') + '-' + String(parts[2]).padStart(2, '0');
        var createdAt = day + 'T' + startT + ':00';
        var dueDate = day + 'T' + endT + ':00';
        var user = (window.localStorage && localStorage.getItem('currentUser')) || 'Default';
        var id = String(Date.now());
        // Difficulty (priority) is derived from XP, matching the dashboard's slider
        // thresholds, so the block colour-codes by difficulty like a dashboard task.
        var priority = xpToPriority(xp);
        var payload = {
            id: id, username: user, name: name, priority: priority,
            xp_reward: xp, due_date: dueDate, created_at: createdAt, show_on_calendar: true
        };
        if (typeof addTaskToBackend === 'function') addTaskToBackend(payload);
        // Reflect on the grid immediately (mirrors the shape loadSidebar caches).
        gTasks.push({
            id: id, title: name, status: 'todo', priority: priority,
            xp_value: xp, created_at: createdAt, due_date: dueDate
        });
        closeWeekTaskModal();
        renderDayColumns();   // draws the task and runs the overlap conflict check
    }

    // XP -> difficulty, matching the dashboard (updateXPDisplay): <33 low,
    // <66 medium, else high. Drives the task block's colour on the calendar.
    function xpToPriority(xp) {
        return xp < 33 ? 'low' : (xp < 66 ? 'medium' : 'high');
    }

    // Keep the task modal's XP slider, number box and label in sync (mirrors the
    // dashboard's XP slider). Clamped to 10–100 like the dashboard.
    function syncTaskXp(val) {
        val = Math.max(10, Math.min(100, parseInt(val, 10) || 10));
        var slider = document.getElementById('taskXpSlider');
        var input = document.getElementById('taskXp');
        var label = document.getElementById('taskXpValue');
        if (slider) slider.value = val;
        if (input) input.value = val;
        if (label) label.textContent = val;
    }

    // Exposed for the task modal's inline onclick / oninput handlers.
    window.confirmWeekTask = confirmWeekTask;
    window.closeWeekTaskModal = closeWeekTaskModal;
    window.syncTaskXp = syncTaskXp;

    // --- Drag on an empty grid spot to create an event ------------------------
    // Mouse-down on empty space in a day column starts a selection; dragging grows
    // it, clamped so it can't cross into an existing task/event; releasing opens
    // the Add-Event modal with the dragged times (snapped to 5 min) pre-filled.
    var MIN5_PX = HOUR_H / 12;               // pixels per 5 minutes
    function snapPx(px) { return Math.round(px / MIN5_PX) * MIN5_PX; }
    // Grid pixels (from a column's top) -> clock time, snapped to 5 minutes.
    function pxToClockMin(px) {
        var gridMin = START_HOUR * 60 + (px / HOUR_H) * 60;   // 360 … 1740
        gridMin = Math.round(gridMin / 5) * 5;
        return ((gridMin % 1440) + 1440) % 1440;              // wrap into 0 … 1439
    }
    // The free [top, bottom] gap around y in a column, or null if y sits in a block.
    function gapAround(iso, y, gridH) {
        var busy = (dragBusy[iso] || []);
        var top = 0, bottom = gridH;
        for (var i = 0; i < busy.length; i++) {
            if (busy[i][0] <= y && busy[i][1] > y) return null;               // inside a block
            if (busy[i][1] <= y && busy[i][1] > top) top = busy[i][1];        // nearest block above
            if (busy[i][0] >= y && busy[i][0] < bottom) bottom = busy[i][0];  // nearest block below
        }
        return [top, bottom];
    }

    var dragState = null;
    function initDragCreate() {
        var cols = document.getElementById('wkDayCols');
        if (!cols || cols.__dragWired) return;
        cols.__dragWired = true;
        var gridH = (END_HOUR - START_HOUR) * HOUR_H;
        var scroller = document.querySelector('#weekView .wk-scroll');
        var EDGE = 46;         // px from a scroll edge that triggers auto-scroll
        var MAX_STEP = 16;     // max px scrolled per frame (faster the closer to the edge)

        // Size the selection from the pointer's Y. Because y is measured against the
        // column's live top, it stays correct as the grid scrolls, and the gap
        // clamp keeps the selection out of existing tiles even when those tiles are
        // scrolled above the view.
        function applyDrag(clientY) {
            if (!dragState) return;
            var y = clientY - dragState.col.getBoundingClientRect().top;
            y = Math.max(dragState.gap[0], Math.min(y, dragState.gap[1]));   // stop at neighbours
            // Snap to 5 min, then re-clamp to the gap so rounding can't push an edge
            // past a neighbour into an existing task/event.
            var top = Math.max(dragState.gap[0], snapPx(Math.min(dragState.y0, y)));
            var bottom = Math.min(dragState.gap[1], snapPx(Math.max(dragState.y0, y)));
            dragState.preview.style.top = top + 'px';
            dragState.preview.style.height = Math.max(0, bottom - top) + 'px';
            dragState.curTop = top; dragState.curBottom = bottom;
            if (bottom - top > 3) dragState.moved = true;
        }

        // How far to auto-scroll for a pointer near the scroller's top/bottom edge,
        // scaled by how deep into the edge zone it is. Returns 0 when the selection
        // can't grow any further that way (it's already flush against its gap).
        function edgeScroll(clientY) {
            if (!scroller || !dragState) return 0;
            var r = scroller.getBoundingClientRect();
            if (clientY > r.bottom - EDGE && dragState.curBottom < dragState.gap[1]) {
                return Math.min(MAX_STEP, Math.max(3, (clientY - (r.bottom - EDGE)) / EDGE * MAX_STEP));
            }
            if (clientY < r.top + EDGE && dragState.curTop > dragState.gap[0]) {
                return -Math.min(MAX_STEP, Math.max(3, ((r.top + EDGE) - clientY) / EDGE * MAX_STEP));
            }
            return 0;
        }
        function autoScrollTick() {
            if (!dragState) return;
            var amt = edgeScroll(dragState.lastClientY);
            if (amt !== 0) {
                var before = scroller.scrollTop;
                scroller.scrollTop += amt;
                if (scroller.scrollTop !== before) applyDrag(dragState.lastClientY);
                dragState.rafId = requestAnimationFrame(autoScrollTick);
            } else {
                dragState.rafId = null;   // idle; a later mousemove restarts it
            }
        }

        cols.addEventListener('mousedown', function (e) {
            if (e.button !== 0) return;
            if (e.target.closest('.wk-event') || e.target.closest('.wk-card-menu')) return;
            var col = e.target.closest('.wk-daycol');
            if (!col) return;
            var y = e.clientY - col.getBoundingClientRect().top;
            var gap = gapAround(col.getAttribute('data-iso'), y, gridH);
            if (!gap) return;                      // started on top of a block
            e.preventDefault();
            var preview = document.createElement('div');
            preview.className = 'wk-drag-preview';
            col.appendChild(preview);
            dragState = { iso: col.getAttribute('data-iso'), col: col, y0: y, gap: gap, preview: preview,
                          moved: false, curTop: y, curBottom: y, lastClientY: e.clientY, rafId: null };
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', function (e) {
            if (!dragState) return;
            dragState.lastClientY = e.clientY;
            applyDrag(e.clientY);
            // Near a scroll edge and not already auto-scrolling? Start the loop.
            if (dragState.rafId == null && edgeScroll(e.clientY) !== 0) {
                dragState.rafId = requestAnimationFrame(autoScrollTick);
            }
        });

        document.addEventListener('mouseup', function () {
            if (!dragState) return;
            var st = dragState; dragState = null;
            if (st.rafId != null) cancelAnimationFrame(st.rafId);
            document.body.style.userSelect = '';
            if (st.preview && st.preview.parentNode) st.preview.parentNode.removeChild(st.preview);
            if (!st.moved || (st.curBottom - st.curTop) < MIN5_PX) return;   // ignore a tiny drag
            // Same dragged slot, then ask: make this an event or a task?
            showCreateChooser(st.iso, { start: pxToClockMin(st.curTop), end: pxToClockMin(st.curBottom) });
        });
    }

    // Draw the seven day columns from the cached real tasks. Kept separate so it
    // can redraw when tasks arrive (async) without rebuilding headers/focus.
    function renderDayColumns() {
        var cols = document.getElementById('wkDayCols');
        if (!cols) return;
        var DAYS = buildDays();
        var gridH = (END_HOUR - START_HOUR) * HOUR_H;
        var conflict = null;
        dragBusy = {};   // per-day occupied [top, bottom] pixel ranges, for drag-to-create
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
                // Height is strictly the block's time span (no minimum floor).
                b.h = Math.max(2, (b.end - b.start) * HOUR_H - 4);
            });
            dragBusy[d.iso] = all.map(function (b) { return [b.top, b.top + b.h]; });
            // Strictly no overlap between any two live blocks — event↔event,
            // event↔task AND task↔task — is a conflict the user must resolve by
            // deleting one side. Only calendar tasks (show_on_calendar) count;
            // plain to-do/dashboard tasks and completed tasks are excluded.
            if (!conflict) {
                var cand = all.filter(function (b) { return b.kind === 'event' || (b.onCalendar && !b.done); });
                for (var ci = 0; ci < cand.length && !conflict; ci++) {
                    for (var cj = ci + 1; cj < cand.length; cj++) {
                        if (blocksOverlap(cand[ci], cand[cj])) {
                            conflict = { a: cand[ci], b: cand[cj], iso: d.iso };
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
                    var col = eventColor(b);
                    // A short event (≤15 min) is too thin for two rows: show its
                    // name and start time on one line, without the end time.
                    var compact = (b.end - b.start) * 60 <= 15;
                    var body = compact
                        ? '<div class="wk-event-head">' +
                              '<div class="wk-event-title">' + esc(b.name) + (b.cont ? ' — continued' : '') + '</div>' +
                              '<span class="wk-event-start">' + esc(hmLabelShort(b.startHM)) + '</span>' +
                          '</div>'
                        : '<div class="wk-event-title">' + esc(b.name) + (b.cont ? ' — continued' : '') + '</div>' +
                          '<div class="wk-event-foot"><span class="wk-event-due">' +
                              esc(hmLabel(b.startHM) + ' – ' + hmLabel(b.endHM)) +
                          '</span></div>';
                    return '<div class="wk-event wk-event-cal' + (compact ? ' is-compact' : '') + '" data-kind="event"' +
                        ' data-iso="' + esc(d.iso) + '" data-name="' + esc(b.name) +
                        '" data-shm="' + esc(b.startHM) + '" data-ehm="' + esc(b.endHM) + '" style="' + nestPos(b) +
                        ';background:' + col.fill + ';border-color:' + col.border +
                        ';border-left-color:' + col.left + '">' +
                        cardMenuBtn(b.h) + body +
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
                // A short task (≤15 min) mirrors the short-event layout: name and
                // start time on one row, dropping the due/XP footer that won't fit.
                var compactTask = (b.end - b.start) * 60 <= 15;
                // Start time (the task's start clock time) sits at the top next to
                // the title, kept compact so the title stays readable beside it.
                var startText = b.startDT ? (compactTask ? timeLabelShort(b.startDT) : timeLabel(b.startDT)) : '';
                return '<div class="wk-event wk-task ' + stateCls + (compactTask ? ' is-compact' : '') + '" data-kind="task"' +
                    ' data-iso="' + esc(d.iso) + '" data-id="' + esc(String(b.id)) + '" style="' + nestPos(b) + '">' +
                    cardMenuBtn(b.h) +
                    '<div class="wk-event-head">' +
                        '<div class="wk-event-title">' +
                            (b.done ? '<span class="wk-event-check">✓</span> ' : '') +
                            esc(b.title) + (b.cont ? ' — continued' : '') +
                        '</div>' +
                        (startText ? '<span class="wk-event-start">' + esc(startText) + '</span>' : '') +
                    '</div>' +
                    (compactTask ? '' :
                    '<div class="wk-event-foot">' +
                        (timeText ? '<span class="' + timeClass + '">' + esc(timeText) + '</span>' : '') +
                        '<span class="wk-event-xp">' + b.xp + ' XP</span>' +
                    '</div>') +
                    '</div>';
            }).join('');
            return '<div class="wk-daycol' + (d.today ? ' today' : '') + '" data-iso="' + esc(d.iso) + '" style="height:' + gridH + 'px">' + lines + html + '</div>';
        }).join('');

        // Force resolution of the first event–event overlap on any day this week.
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

    // Frozen weekly-overview snapshots, keyed by the week's Monday (YYYY-MM-DD).
    // Once a week is over, its overview must not change as tasks are later edited
    // or deleted — so we read the saved value instead of recomputing.
    function loadWkSnapshots() {
        try { return JSON.parse((window.localStorage && localStorage.getItem('wkOverviewSnapshots')) || '{}') || {}; }
        catch (e) { return {}; }
    }
    function saveWkSnapshot(key, snap) {
        if (!window.localStorage) return;
        var all = loadWkSnapshots();
        all[key] = snap;
        try { localStorage.setItem('wkOverviewSnapshots', JSON.stringify(all)); } catch (e) {}
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

                // A past week (weekOffset < 0) shows its frozen snapshot and never
                // recomputes. The current week (offset 0) stays live and keeps its
                // snapshot fresh, so whatever it holds when the week ends is what
                // freezes. (A past week seen for the first time is frozen now.)
                var wkKey = wk.start;
                var snaps = loadWkSnapshots();
                if (weekOffset < 0 && snaps[wkKey]) {
                    total = snaps[wkKey].total; done = snaps[wkKey].done;
                    rate = snaps[wkKey].rate;   xp = snaps[wkKey].xp;
                } else if (weekOffset <= 0) {
                    saveWkSnapshot(wkKey, { total: total, done: done, rate: rate, xp: xp });
                }

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
        // Scope to the shown week (Mon–Sun): a pending task is a priority for this
        // week if it was created in the week or is due within it — the same window
        // the rest of the weekly overview uses — so stepping weeks changes these.
        var wk = weekRange(mondayOf(weekOffset));
        function inShownWeek(t) {
            var c = (t.created_at || '').slice(0, 10);
            var d = (t.due_date || '').slice(0, 10);
            return (c && c >= wk.start && c <= wk.end) || (d && d >= wk.start && d <= wk.end);
        }
        var pending = (tasks || []).filter(function (t) {
            return t.status !== 'done' && inShownWeek(t);
        });
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
        // Whenever the week view becomes visible, redraw it so any events added
        // or removed on the month view sync in, then jump to the current time.
        if (view === 'week') {
            renderDayColumns();
            requestAnimationFrame(scrollToNow);
        }
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

        // Events are created by dragging on an empty grid spot (see initDragCreate).

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
        // The three-dots menu routes event edit/delete through the month modals;
        // redraw the grid after those confirm so the change syncs into the week.
        if (typeof window.confirmEditSection === 'function' && !window.__wkWrapEdit) {
            window.__wkWrapEdit = true;
            var origEdit = window.confirmEditSection;
            window.confirmEditSection = function () {
                origEdit.apply(this, arguments);
                renderDayColumns();
            };
        }
        // Open a block's overflow menu on click of its three-dots button. The
        // menu is a body-level popover; a click anywhere else (or a grid scroll)
        // closes it.
        var colsEl = document.getElementById('wkDayCols');
        if (colsEl) {
            colsEl.addEventListener('click', function (e) {
                var btn = e.target.closest('.wk-card-menu');
                if (!btn) return;
                e.stopPropagation();
                if (document.getElementById('wkCardPop')) { closeCardPop(); return; }
                openCardPop(btn);
            });
        }
        document.addEventListener('click', closeCardPop);
        window.addEventListener('resize', closeCardPop);
        var wkScroll = document.querySelector('#weekView .wk-scroll');
        if (wkScroll) wkScroll.addEventListener('scroll', closeCardPop, true);

        // Drag on an empty grid spot to create an event (delegated once).
        initDragCreate();

        // Keep the "now" line tracking the clock (re-placed each minute).
        setInterval(renderNowLine, 60000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
