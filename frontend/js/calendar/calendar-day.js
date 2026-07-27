/* calendar-day.js — the Day view is now rendered by calendar-week.js.
 *
 * The Day view is a single-day version of the Week grid: it shares the exact same
 * rendering pipeline, data (gTasks + calendar events), and interactions (drag-to-
 * create, the three-dots edit/delete menu, recurrence, overlap detection, the
 * "now" line). That lives in calendar-week.js (see renderDay / buildColumnInner /
 * initDragCreate) so both views stay in lockstep from one source of truth.
 *
 * This file is intentionally left as a no-op so the older sample-data renderer no
 * longer fights the shared one for #dayCol.
 */
