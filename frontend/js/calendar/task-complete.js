/* task-complete.js — finishing a task from the calendar itself.
 *
 * Every calendar view puts task names in front of the reader: blocks on the Week
 * and Day grids, cards in the Month day panel, rows in the Day view's "Tasks
 * Left". Hovering one of those names turns it into a check-it-off target, and a
 * single click finishes the task exactly as ticking it off on the dashboard
 * does — the same /api/complete_task pass that awards the XP, stamps
 * completed_at, extends the streak and advances "complete N tasks" goals.
 *
 * The views don't talk to the backend themselves. They call
 * CalendarTaskComplete.run and then listen for the 'calendartaskcomplete' event
 * to redraw, so a task finished in one view lands in all of them. One in-flight
 * guard per task id means a double click can't award the XP twice.
 */
(function () {
    'use strict';

    var inFlight = {};

    function currentUser() {
        return (window.localStorage && localStorage.getItem('currentUser')) || 'Default';
    }

    function announce(id) {
        var detail = { id: String(id) };
        var ev;
        try {
            ev = new CustomEvent('calendartaskcomplete', { detail: detail });
        } catch (e) {
            ev = document.createEvent('CustomEvent');
            ev.initCustomEvent('calendartaskcomplete', false, false, detail);
        }
        document.dispatchEvent(ev);
    }

    // The completion itself. trackTaskCompletion (api.js) is the dashboard's own
    // path — it awards the XP, syncs the month store through
    // markTaskCompletedInCalendar and records the completion on the calendar —
    // so the calendar uses it too rather than posting its own half of the work.
    // The bare fetch is only the fallback for a page that didn't load api.js.
    function request(id, xp) {
        if (typeof trackTaskCompletion === 'function') {
            return trackTaskCompletion(id, currentUser(), Number(xp) || 0);
        }
        return fetch('/api/complete_task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser(), task_id: id })
        }).then(function (r) { return r.json(); });
    }

    // Resolves true once the server has the completion (and every view has been
    // told), false when nothing was awarded — a failed request, or a click on a
    // task already being completed. A false answer means the caller should leave
    // the task exactly as it was.
    function run(taskId, xp) {
        var id = String(taskId == null ? '' : taskId);
        if (!id || inFlight[id]) return Promise.resolve(false);
        inFlight[id] = true;
        return Promise.resolve(request(id, xp))
            .then(function (res) {
                delete inFlight[id];
                var ok = !!(res && res.success);
                if (ok) announce(id);
                else console.error('Calendar: completing task ' + id + ' failed', res);
                return ok;
            })
            .catch(function (err) {
                delete inFlight[id];
                console.error('Calendar: completing task ' + id + ' failed', err);
                return false;
            });
    }

    function isBusy(id) { return !!inFlight[String(id)]; }

    window.CalendarTaskComplete = { run: run, isBusy: isBusy };
})();
