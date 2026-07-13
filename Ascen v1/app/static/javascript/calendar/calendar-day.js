/* calendar-day.js — self-contained Day view for the calendar.
 *
 * First pass (matching the Week view's approach): a single-day time grid built
 * from representative sample data, display-only. Reuses the Week view's .wk-*
 * styles/geometry (see calendar-week.css) plus a few day-only rules in
 * calendar-day.css. The view-toggle wiring lives in calendar-week.js and just
 * shows/hides #dayView; this module renders its contents on load.
 *
 * The Month view (calendar-month.js) is untouched.
 */
(function () {
    'use strict';

    var START_HOUR = 6;    // 6 AM
    var END_HOUR = 22;     // 10 PM
    var HOUR_H = 54;       // px per hour — matches the Week view

    var TITLE = 'Wednesday, July 15, 2026';
    var ALLDAY = 'Violin Practice';

    var ICON = {
        math: '🧮', coding: '💻', scioly: '🧪', violin: '🎻',
        workout: '🏋️', reading: '📖', tennis: '🎾', personal: '⭐', rest: '🌙'
    };

    // Today's sample events (times are decimal hours, 24h).
    var EVENTS = [
        ev(8, 10, 'Math Practice', 120, 'math'),
        ev(10.5, 12, 'Coding Project', 180, 'coding'),
        ev(13, 14, 'Scioly Study', 80, 'scioly'),
        ev(15, 16.25, 'Violin Practice', 120, 'violin'),
        ev(19, 20.5, 'Workout', 100, 'workout'),
        ev(21, 22, 'Reading', 50, 'reading')
    ];

    function ev(start, end, title, xp, cat) {
        return { start: start, end: end, title: title, xp: xp, cat: cat };
    }

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

    function renderDay() {
        var title = document.getElementById('dayTitle');
        var allday = document.getElementById('dayAllday');
        var labels = document.getElementById('dayTimeLabels');
        var col = document.getElementById('dayCol');
        if (!col) return;

        var gridH = (END_HOUR - START_HOUR) * HOUR_H;

        if (title) title.textContent = TITLE;
        if (allday) allday.innerHTML = '<span class="wk-allday-chip">' + esc(ALLDAY) + '</span>';

        var lab = '';
        for (var h = START_HOUR; h <= END_HOUR; h++) {
            lab += '<div class="wk-timelabel" style="height:' + HOUR_H + 'px">' +
                   '<span>' + hourLabel(h) + '</span></div>';
        }
        labels.innerHTML = lab;
        labels.style.height = gridH + 'px';

        var lines = '';
        for (var g = START_HOUR; g < END_HOUR; g++) {
            lines += '<div class="wk-hourline" style="top:' + ((g - START_HOUR) * HOUR_H) + 'px"></div>';
        }
        var evs = EVENTS.map(function (e) {
            var top = (e.start - START_HOUR) * HOUR_H;
            var height = (e.end - e.start) * HOUR_H - 4;
            return '<div class="wk-event cat-' + e.cat + '" style="top:' + top + 'px;height:' + height + 'px">' +
                '<div class="wk-event-time">' + clock(e.start) + ' - ' + clock(e.end) + '</div>' +
                '<div class="wk-event-title">' + esc(e.title) + '</div>' +
                '<div class="wk-event-xp"><span class="wk-event-icon">' + (ICON[e.cat] || '•') + '</span>' + e.xp + ' XP</div>' +
                '</div>';
        }).join('');
        col.style.height = gridH + 'px';
        col.innerHTML = lines + evs;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderDay);
    } else {
        renderDay();
    }
})();
