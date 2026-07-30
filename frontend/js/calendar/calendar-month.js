// Calendar JavaScript

let currentDate = new Date();

let currentMonth = currentDate.getMonth();

let currentYear = currentDate.getFullYear();

let selectedDate = null;

// --- Per-event colour coding ------------------------------------------------
// Each event created gets the next colour in the palette (round-robin), stored
// as `colorIndex` on the event and copied to all of its recurrences (via the
// {...section} spread in addRecurringSections). So an event and all its repeats
// share one colour, and two separately-created events get different colours.
// The week view (calendar-week.js) uses an identical palette so a given event
// looks the same in both views.
const EVENT_COLOR_PALETTE = [
    [139, 92, 246],   // violet
    [236, 72, 153],   // pink
    [20, 184, 166],   // teal
    [249, 115, 22],   // orange
    [217, 70, 239],   // fuchsia
    [34, 211, 238],   // cyan
    [124, 58, 237],   // purple
    [244, 63, 94]     // rose
];// Colour index for an event. Events created before colour coding have no
// colorIndex, so fall back to a stable hash of the name (its repeats share the
// name, so they still share a colour).
function eventColorIndexFor(section) {
    const n = EVENT_COLOR_PALETTE.length;
    if (section && typeof section.colorIndex === 'number') {
        return ((section.colorIndex % n) + n) % n;
    }
    const s = String((section && section.task) || '');
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % n;
}
// Expose for the separate week-view script.
window.EVENT_COLOR_PALETTE = EVENT_COLOR_PALETTE;
window.eventColorIndexFor = eventColorIndexFor;

// --- Distinct per-event hex colours (tracked in data/eventcolors.json) -------
// Every used colour is tracked server-side so each new event gets a hex that is
// a good amount different (max hue distance) from all the existing ones.
window.eventColorsUsed = window.eventColorsUsed || [];
function loadEventColors() {
    fetch('/api/get_event_colors')
        .then(r => r.json())
        .then(d => { if (d && d.success && Array.isArray(d.colors)) window.eventColorsUsed = d.colors.slice(); })
        .catch(() => { /* offline / no backend — fall back to the palette */ });
}
function hslToRgb(h, s, l) {
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => Math.round((l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))) * 255);
    return [f(0), f(8), f(4)];
}
function rgbToHex(r, g, b) { const to = x => x.toString(16).padStart(2, '0'); return '#' + to(r) + to(g) + to(b); }
function hexToRgbArr(hex) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || ''));
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
}
// Colour families events may use — browns, greys, oranges, greens, and red /
// yellow / blue shifted away from the task-difficulty colours so an event never
// reads as a task colour. [h, s, l] with s,l in 0..1.
const EVENT_HSL_CANDIDATES = [
    // Each entry is [hue, sat, light, family]; family drives the pick weighting.
    // browns (warm, muted, darker)
    [22, 0.55, 0.34, 'brown'], [28, 0.45, 0.40, 'brown'], [33, 0.50, 0.30, 'brown'], [16, 0.42, 0.38, 'brown'], [30, 0.35, 0.46, 'brown'], [25, 0.60, 0.44, 'brown'],
    // greys (near-zero saturation, light → dark)
    [30, 0.05, 0.45, 'gray'], [30, 0.05, 0.56, 'gray'], [210, 0.06, 0.50, 'gray'], [210, 0.05, 0.64, 'gray'], [30, 0.05, 0.70, 'gray'],
    // oranges
    [30, 0.85, 0.55, 'orange'], [38, 0.80, 0.52, 'orange'], [23, 0.78, 0.50, 'orange'], [43, 0.75, 0.58, 'orange'],
    // greens
    [95, 0.45, 0.45, 'green'], [120, 0.42, 0.42, 'green'], [140, 0.45, 0.40, 'green'], [105, 0.55, 0.50, 'green'], [150, 0.34, 0.46, 'green'], [82, 0.50, 0.48, 'green'],
    // reds shifted off the task red (brick / rose)
    [8, 0.60, 0.45, 'red'], [12, 0.55, 0.52, 'red'], [350, 0.42, 0.46, 'red'],
    // yellows shifted off the task yellow (mustard / gold)
    [48, 0.68, 0.48, 'yellow'], [52, 0.60, 0.55, 'yellow'], [45, 0.55, 0.44, 'yellow'],
    // blues shifted off the task blue (steel / indigo)
    [200, 0.50, 0.48, 'blue'], [225, 0.45, 0.52, 'blue'], [210, 0.42, 0.42, 'blue'], [235, 0.34, 0.56, 'blue'],
    // purples (deliberately rarer)
    [270, 0.45, 0.52, 'purple'], [285, 0.40, 0.48, 'purple'], [258, 0.42, 0.56, 'purple'],
    // pinks (deliberately rarer)
    [330, 0.60, 0.60, 'pink'], [340, 0.55, 0.66, 'pink'], [318, 0.50, 0.58, 'pink']
];
// Pick-frequency per colour family: orange / green / yellow / red / blue come up
// more often; purple / pink / gray / brown are the rarer accents.
const EVENT_FAMILY_WEIGHT = {
    orange: 3, green: 3, yellow: 3, red: 3, blue: 3,
    purple: 1, pink: 1, gray: 1, brown: 1
};
// Task-difficulty colours (blue / yellow / red) events must stay distinct from.
const TASK_RGB = [[56, 132, 255], [245, 196, 92], [240, 90, 95]];
function rgbDist2(a, b) { const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2]; return dr * dr + dg * dg + db * db; }
// Pick a family colour weighted toward the common families (orange/green/yellow/
// red/blue) and away from the rarer ones (purple/pink/gray/brown), while still
// biasing toward colours that sit far (in RGB) from those already in use and the
// task colours → each new event stays a good amount different, with the requested
// colour odds.
function generateDistinctColor() {
    const avoid = (window.eventColorsUsed || []).map(hexToRgbArr).filter(Boolean).concat(TASK_RGB);
    const scored = EVENT_HSL_CANDIDATES.map(function (c) {
        const rgb = hslToRgb(c[0], c[1], c[2]);
        let minD = Infinity;
        for (const a of avoid) { const d = rgbDist2(rgb, a); if (d < minD) minD = d; }
        if (!isFinite(minD)) minD = 1;   // nothing to avoid yet
        return { rgb: rgb, family: c[3] || 'other', minD: minD };
    });
    const maxD = scored.reduce(function (m, s) { return Math.max(m, s.minD); }, 1) || 1;
    // Weight = family frequency × a softened distinctness factor, so a common
    // family can still win even when its nearest match is a little closer.
    let total = 0;
    scored.forEach(function (s) {
        const fw = EVENT_FAMILY_WEIGHT[s.family] || 1;
        s.weight = fw * (0.3 + 0.7 * (s.minD / maxD));
        total += s.weight;
    });
    let r = Math.random() * total;
    for (const s of scored) { r -= s.weight; if (r <= 0) return rgbToHex(s.rgb[0], s.rgb[1], s.rgb[2]); }
    const last = scored[scored.length - 1].rgb;
    return rgbToHex(last[0], last[1], last[2]);
}
// Assign a fresh distinct colour to a new event and persist it to the tracker.
function assignEventColor() {
    const color = generateDistinctColor();
    if (!window.eventColorsUsed) window.eventColorsUsed = [];
    window.eventColorsUsed.push(color);
    fetch('/api/add_event_color', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color: color })
    }).catch(() => { /* best-effort persistence */ });
    return color;
}
// [r,g,b] for an event: its stored hex if any, else the legacy palette colour.
function eventRgb(section) {
    const hex = section && typeof section.color === 'string' && /^#?[0-9a-f]{6}$/i.test(section.color)
        ? section.color.replace('#', '') : null;
    if (hex) return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
    return EVENT_COLOR_PALETTE[eventColorIndexFor(section)];
}
window.eventRgb = eventRgb;

const monthNames = [

    "January", "February", "March", "April", "May", "June",

    "July", "August", "September", "October", "November", "December"

];

// Store content for each date

// --- Per-account browser storage --------------------------------------------
// Calendar events and task state used to live under single shared localStorage
// keys ('calendarData', 'dashboardTasks', ...), so every account that signed in
// on this machine saw the same data. Keys are now scoped per account. Any legacy
// shared data is migrated once to the first real account that loads a page (the
// head snippet has already synced currentUser from the server session).
window.userScopedKey = function (base) {
    var u = 'Default';
    try { u = localStorage.getItem('currentUser') || 'Default'; } catch (e) { /* ignore */ }
    return base + ':' + u;
};
(function migrateSharedKeys() {
    // Only adopt the legacy shared data once a real account is signed in, so it
    // lands under the right account key (a signed-out load leaves it in place).
    var u = null;
    try { u = localStorage.getItem('currentUser'); } catch (e) { /* ignore */ }
    if (!u || u === 'Default') return;
    ['calendarData', 'hiddenPlaceholderTasks', 'dashboardTasks', 'wkOverviewSnapshots'].forEach(function (base) {
        try {
            var legacy = localStorage.getItem(base);
            if (legacy === null) return;
            if (localStorage.getItem(window.userScopedKey(base)) === null) {
                localStorage.setItem(window.userScopedKey(base), legacy);
            }
            localStorage.removeItem(base);
        } catch (e) { /* ignore */ }
    });
})();

const dateContent = {};

// Store hidden placeholder tasks information

const hiddenPlaceholderTasks = {

    permanentlyDeleted: [], // Array of task names that are permanently deleted

    timePeriodDeletions: [], // Array of {task, startDate, endDate}

    dayOfMonthDeletions: [], // Array of {task, days: [1,2,3...]}

    dayOfWeekDeletions: [] // Array of {task, days: [0,1,2...]}

};

// Store dashboard tasks that should appear on calendar

const dashboardTasks = [];

// Only tasks placed ON the calendar (dragged out a slot there, which sets
// show_on_calendar) may render on any calendar view. Tasks made on the dashboard
// are to-dos: they never appear on the week, day or month grids. Every path that
// feeds tasks into a calendar is gated on this, so a task can only show up by
// being explicitly flagged — no field, no calendar.
function isCalendarPlacedTask(task) {
    var v = task && task.show_on_calendar;
    return v === true || v === 1 || v === '1' || v === 'true';
}
window.isCalendarPlacedTask = isCalendarPlacedTask;

// Make removeDashboardTaskFromCalendar globally accessible

window.removeDashboardTaskFromCalendar = function(taskId) {

    const taskIndex = dashboardTasks.findIndex(t => t.id === taskId);

    let taskName = '';

    if (taskIndex !== -1) {

        taskName = dashboardTasks[taskIndex].name;

        dashboardTasks.splice(taskIndex, 1);

    }

    Object.keys(dateContent).forEach(dateStr => {

        if (dateContent[dateStr] && dateContent[dateStr].timestamps) {

            dateContent[dateStr].timestamps = dateContent[dateStr].timestamps.filter(

                ts => !(ts.isDashboardTask && ts.dashboardTaskId === taskId)

            );

            // Remove subtasks matching this task

            dateContent[dateStr].timestamps.forEach(ts => {

                if (ts.subtasks && taskName) {

                    ts.subtasks = ts.subtasks.filter(st => !st.includes(taskName));

                    if (ts.subtasks.length === 0) {

                        ts.hasSubtasks = false;

                        delete ts.subtasks;

                    }

                }

            });

        }

    });

    saveCalendarData();

    // Refresh calendar if currently viewing any date

    if (selectedDate) {

        updateBottomSection(selectedDate);

    }

};

// Load calendar data from localStorage

function loadCalendarData() {

    const savedData = localStorage.getItem(userScopedKey('calendarData'));

    if (savedData) {

        try {

            const parsed = JSON.parse(savedData);

            Object.assign(dateContent, parsed);

            // Purge any legacy default/placeholder session events so no default
            // events remain on any day (they used to be auto-generated per day).
            Object.keys(dateContent).forEach(function (k) {
                const day = dateContent[k];
                if (day && Array.isArray(day.timestamps)) {
                    day.timestamps = day.timestamps.filter(function (t) {
                        return !(t && !t.isDashboardTask && isPlaceholderTask(t.task));
                    });
                }
            });

        } catch (e) {

            console.error('Error loading calendar data:', e);

        }

    }

    // Load hidden placeholder tasks data

    const hiddenData = localStorage.getItem(userScopedKey('hiddenPlaceholderTasks'));

    if (hiddenData) {

        try {

            const parsed = JSON.parse(hiddenData);

            Object.assign(hiddenPlaceholderTasks, parsed);

        } catch (e) {

            console.error('Error loading hidden placeholder tasks:', e);

        }

    }

    // Load dashboard tasks data

    const dashboardData = localStorage.getItem(userScopedKey('dashboardTasks'));

    if (dashboardData) {

        try {

            const parsed = JSON.parse(dashboardData);

            dashboardTasks.length = 0;

            // Older stores predate the flag and can still hold dashboard to-dos —
            // keep only what belongs on a calendar.
            dashboardTasks.push(...parsed.filter(isCalendarPlacedTask));

        } catch (e) {

            console.error('Error loading dashboard tasks:', e);

        }

    }

}

// Save calendar data to localStorage

function saveCalendarData() {

    // Filter out empty subtasks before saving

    const cleanedDateContent = {};

    Object.keys(dateContent).forEach(dateStr => {

        if (dateContent[dateStr] && dateContent[dateStr].timestamps) {

            cleanedDateContent[dateStr] = {

                // A finished to-do's card is derived from the database every
                // time its day is opened (see selectDate), so it is not saved
                // here. Keeping a copy would leave the card on the day after
                // the task was re-opened or deleted somewhere else.
                timestamps: dateContent[dateStr].timestamps.filter(ts => !ts.completedTodo).map(ts => {

                    if (ts.subtasks && ts.subtasks.length > 0) {

                        // Filter out empty subtasks

                        const filteredSubtasks = ts.subtasks.filter(st => {
                            if (typeof st === 'string') {
                                return st && st.trim() !== '';
                            } else if (typeof st === 'object' && st.text) {
                                return st.text.trim() !== '';
                            }
                            return false;
                        });

                        if (filteredSubtasks.length === 0) {

                            // If all subtasks are empty, remove subtasks array and hasSubtasks flag

                            const { subtasks, hasSubtasks, ...rest } = ts;

                            return rest;

                        } else {

                            // Update with filtered subtasks

                            return { ...ts, subtasks: filteredSubtasks };

                        }

                    }

                    return ts;

                }),

                focus: dateContent[dateStr].focus // Preserve focus value

            };

        }

    });

    localStorage.setItem(userScopedKey('calendarData'), JSON.stringify(cleanedDateContent));

    localStorage.setItem(userScopedKey('hiddenPlaceholderTasks'), JSON.stringify(hiddenPlaceholderTasks));

    localStorage.setItem(userScopedKey('dashboardTasks'), JSON.stringify(dashboardTasks));

}

// Reset calendar data to defaults

// Generate default timestamps (8am to 10pm split into 5 sections, plus Sleep Time)

function generateDefaultTimestamps() {

    // No default session events — every day starts empty on the month and week.
    return [];

    return [

        { startTime: '22:00', endTime: '08:00', task: 'Sleep Time' },

        { startTime: '08:00', endTime: '12:00', task: 'Morning session' },

        { startTime: '12:00', endTime: '15:00', task: 'Afternoon session' },

        { startTime: '15:00', endTime: '18:00', task: 'Late afternoon session' },

        { startTime: '18:00', endTime: '20:00', task: 'Evening session' },

        { startTime: '20:00', endTime: '22:00', task: 'Night session' }

    ];

}

// Check if a task is a placeholder (default) task

function isPlaceholderTask(taskName) {

    const placeholderTasks = [

        'Sleep Time',

        'Morning session',

        'Afternoon session',

        'Late afternoon session',

        'Evening session',

        'Night session'

    ];

    return placeholderTasks.includes(taskName);

}

// Helper function to find the event that contains a given time

function findEventForTime(timestamps, hours, minutes) {

    const timeInMinutes = hours * 60 + minutes;

    for (const ts of timestamps) {

        const startParts = ts.startTime.split(':').map(Number);

        const endParts = ts.endTime.split(':').map(Number);

        let startMinutes = startParts[0] * 60 + startParts[1];

        let endMinutes = endParts[0] * 60 + endParts[1];

        // Handle overnight events (e.g., 22:00 to 08:00)

        if (endMinutes < startMinutes) {

            // Event spans midnight

            if (timeInMinutes >= startMinutes || timeInMinutes < endMinutes) {

                return ts;

            }

        } else {

            // Normal event within same day

            if (timeInMinutes >= startMinutes && timeInMinutes < endMinutes) {

                return ts;

            }

        }

    }

    return null;

}

// A day's intensity: how many tasks that day is carrying.
//
// The tasks are read from the database and nowhere else — `dbTasks` below is
// the account's rows from the tasks table, exactly as /api/tasks returned
// them. The browser's own `dashboardTasks` copy is deliberately not consulted:
// it only holds what was created in this browser, and it keeps whatever it
// saved the first time — two ways for the shading to disagree with the
// account's real workload.
//
// What counts is what the day was asked to carry, so a task counts whether or
// not it has been finished — the shade is a record of the day's load, not a
// to-do list that empties as the day goes. Which day it lands on is
// taskCalendarDay's answer: its deadline for a calendar task, and for a
// dashboard to-do the day it was finished, since that is the only day a to-do
// is ever on the calendar. A calendar task with no deadline is not work
// scheduled for any particular day, so it colours none.
//
// Each task counts for its priority — a high task weighs three times a low one
// — so a day holding two hard tasks reads heavier than a day holding two easy
// ones. That weight is measured against the busiest day of the month on
// screen, with DAY_FULL_LOAD as a floor under the comparison so a quiet month
// doesn't paint its one easy task the darkest navy on the map.
//
// The index is rebuilt on every render — see renderCalendar — so a reload or a
// month change recomputes from current tasks rather than from whatever was
// cached.

const dayIntensityIndex = { key: '', byDate: {}, max: 0 };

// The account's tasks as the database holds them. Filled by
// loadBackendTasksIntoCalendar; the day shading is counted from this alone, so
// until that fetch lands no day is shaded (it re-renders when it does).
window.dbTasks = window.dbTasks || [];

// What a task of each priority contributes to its day.
const PRIORITY_WEIGHT = { low: 1, medium: 2, high: 3 };

// The weight that reads as a fully-loaded day — two high-priority tasks. Used
// as the floor for the month's scale, never as a cap: a month with a heavier
// day still measures against that day, so the full colour range stays in use.
const DAY_FULL_LOAD = 6;

// A day carrying anything never fades to nothing, so "some work" and "no work"
// always look different.
const MIN_SHADE = 12;

// A timestamp as "YYYY-M-D", the key the month grid writes on its cells.
function dayKeyOf(stamp) {
    if (!stamp) return null;
    const d = new Date(stamp);
    if (isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// Which day a task belongs to, or null if it belongs to none. A calendar task
// sits on its deadline. A dashboard to-do is never planned onto a day, so it
// sits on no day at all until it is finished — then it sits on the day it was
// finished, which is when the work actually happened.
function taskCalendarDay(task) {
    if (!task) return null;
    if (isCalendarPlacedTask(task)) return dayKeyOf(task.due_date);
    return task.status === 'done' ? dayKeyOf(task.completed_at) : null;
}

// A task's share of its day. An unset or unrecognised priority counts as
// medium, which is what the tasks table defaults a new row to.
function taskPriorityWeight(task) {
    const priority = String((task && task.priority) || '').toLowerCase();
    return PRIORITY_WEIGHT[priority] || PRIORITY_WEIGHT.medium;
}

// Every task landing in `month`/`year`, totalled per day.
function buildDayIntensityIndex(month, year) {
    const byDate = {};

    (window.dbTasks || []).forEach(task => {
        const key = taskCalendarDay(task);
        if (!key) return;

        const parts = key.split('-').map(Number);
        if (parts[0] !== year || parts[1] - 1 !== month) return;

        const entry = byDate[key] || (byDate[key] = { count: 0, weight: 0, xp: 0 });
        entry.count += 1;
        entry.weight += taskPriorityWeight(task);
        entry.xp += Number(task.xp_value) || 0;
    });

    let max = 0;
    Object.keys(byDate).forEach(k => {
        max = Math.max(max, byDate[k].weight);
    });

    dayIntensityIndex.key = `${year}-${month}`;
    dayIntensityIndex.byDate = byDate;
    dayIntensityIndex.max = max;
}

// `dateStr` is "YYYY-M-D" as the grid writes it.
function calculateDailyIntensity(dateStr) {
    const entry = dayIntensityIndex.byDate[dateStr];
    if (!entry || !entry.count) {
        return { taskCount: 0, avgXP: 0, percentage: 0 };
    }

    // The busiest day of the month is 100%, unless the whole month is lighter
    // than one full day's work — then a full day is the yardstick instead.
    const reference = Math.max(dayIntensityIndex.max, DAY_FULL_LOAD);
    const percentage = Math.round((entry.weight / reference) * 100);

    return {
        taskCount: entry.count,
        avgXP: Math.round(entry.xp / entry.count),
        percentage: Math.min(100, Math.max(MIN_SHADE, percentage))
    };
}

// Get intensity color based on percentage (green -> yellow -> red)

function getIntensityColor(percentage) {

    if (percentage >= 80) return 'linear-gradient(90deg, #ff4444, #ff6666)'; // Red

    if (percentage >= 60) return 'linear-gradient(90deg, #ffbb33, #ffcc66)'; // Yellow

    return 'linear-gradient(90deg, #4CAF50, #8BC34A)'; // Green

}

// Intensity as a shade of blue for the calendar date markers: a light blue for
// a light day, deepening to dark navy as the day gets busier (higher intensity).
function getIntensityBlue(percentage) {
    const p = Math.max(0, Math.min(100, percentage)) / 100;
    const light = [158, 200, 250]; // low intensity -> light blue
    const dark = [10, 31, 82];     // high intensity -> dark navy blue
    const c = light.map((l, i) => Math.round(l + (dark[i] - l) * p));
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

// A day's task intensity for the calendar marker (0 = no colour, so a day with
// nothing due stays unshaded). The tasks due that day, weighted by priority and
// measured against the busiest day of the month — higher -> darker blue. Events
// never contribute, so adding one never darkens a date, and neither do tasks
// without a due date.
function getDayTaskIntensity(dateStr) {
    return calculateDailyIntensity(dateStr).percentage;
}

// Add a task to the calendar. Exposed on window for the dashboard page, so it
// enforces the same rule as every other entry point: only a task placed on the
// calendar gets on it — a dashboard to-do is turned away here.

function addDashboardTaskToCalendar(task) {

    if (!isCalendarPlacedTask(task)) return;

    // Add created_at timestamp if not present

    if (!task.created_at) {

        task.created_at = new Date().toISOString();

    }

    if (!task.due_date) return;

    const dueDate = new Date(task.due_date);

    const dateStr = `${dueDate.getFullYear()}-${dueDate.getMonth() + 1}-${dueDate.getDate()}`;

    const hours = dueDate.getHours();

    const minutes = dueDate.getMinutes();

    // Convert to 24-hour format string

    const startTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

    // Calculate end time (assume 1 hour duration)

    const endTimeDate = new Date(dueDate.getTime() + 60 * 60 * 1000);

    const endTime = `${endTimeDate.getHours().toString().padStart(2, '0')}:${endTimeDate.getMinutes().toString().padStart(2, '0')}`;

    // Check if task already exists in dashboardTasks

    const existingIndex = dashboardTasks.findIndex(t => t.id === task.id);

    if (existingIndex === -1) {

        dashboardTasks.push(task);

    }

    // Add to dateContent

    if (!dateContent[dateStr]) {

        dateContent[dateStr] = { timestamps: [] };

    }

    // Check if this task already exists in the date

    const existingTimestamp = dateContent[dateStr].timestamps.find(

        ts => ts.isDashboardTask && ts.dashboardTaskId === task.id

    );

    if (!existingTimestamp) {

        // Format time for display (12-hour format)

        const displayHours = hours % 12 || 12;

        const ampm = hours >= 12 ? 'PM' : 'AM';

        const displayTime = `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;

        // Find the event that contains this task's due time

        const targetEvent = findEventForTime(dateContent[dateStr].timestamps, hours, minutes);

        if (targetEvent) {

            // Add as subtask to the matching time-based event

            if (!targetEvent.subtasks) {

                targetEvent.subtasks = [];

            }

            const taskXP = task.xp || task.xp_reward || task.difficulty || 0;

            targetEvent.subtasks.push({

                text: `${task.name} due at ${displayTime}`,

                xp: taskXP,

                taskId: task.id

            });

            targetEvent.hasSubtasks = true;

        } else if (dateContent[dateStr].timestamps.length > 0) {

            // Fallback: add to first available event if no time match found

            const firstEvent = dateContent[dateStr].timestamps[0];

            if (!firstEvent.subtasks) {

                firstEvent.subtasks = [];

            }

            const taskXP = task.xp || task.xp_reward || task.difficulty || 0;

            firstEvent.subtasks.push({

                text: `${task.name} due at ${displayTime}`,

                xp: taskXP,

                taskId: task.id

            });

            firstEvent.hasSubtasks = true;

        }

    }

    saveCalendarData();

    // Refresh calendar if currently viewing this date

    if (selectedDate) {

        const selectedDateStr = `${selectedDate.getFullYear()}-${selectedDate.getMonth() + 1}-${selectedDate.getDate()}`;

        if (selectedDateStr === dateStr) {

            updateBottomSection(selectedDate);

        }

    }

}

// Make function globally accessible

window.addDashboardTaskToCalendar = addDashboardTaskToCalendar;

// Clear all dashboard tasks from calendar

// Check if a placeholder task should be hidden for a specific date

function shouldHidePlaceholderTask(taskName, dateStr) {

    const dateParts = dateStr.split('-').map(Number);

    const date = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);

    const dayOfMonth = date.getDate();

    const dayOfWeek = date.getDay();

    // Check if permanently deleted

    if (hiddenPlaceholderTasks.permanentlyDeleted.includes(taskName)) {

        return true;

    }

    // Check if deleted for a time period

    for (const deletion of hiddenPlaceholderTasks.timePeriodDeletions) {

        if (deletion.task === taskName) {

            const startDate = new Date(deletion.startDate);

            const endDate = new Date(deletion.endDate);

            if (date >= startDate && date <= endDate) {

                return true;

            }

        }

    }

    // Check if deleted for specific days of month

    for (const deletion of hiddenPlaceholderTasks.dayOfMonthDeletions) {

        if (deletion.task === taskName && deletion.days.includes(dayOfMonth)) {

            return true;

        }

    }

    // Check if deleted for specific days of week

    for (const deletion of hiddenPlaceholderTasks.dayOfWeekDeletions) {

        if (deletion.task === taskName && deletion.days.includes(dayOfWeek)) {

            return true;

        }

    }

    return false;

}

function initializeCalendar() {

    // Load saved calendar data

    loadCalendarData();

    // Load the tracked event colours so new events get a distinct hex.
    loadEventColors();

    // Merge the account's backend tasks into the calendar (localStorage only has
    // tasks created in this browser). Async: it re-renders when done.
    loadBackendTasksIntoCalendar();

    // Fetch backend task statuses to get accurate completion states
    fetchBackendTaskStatuses();

    // Check for stored task completions from dashboard and apply them
    const completedTasks = JSON.parse(localStorage.getItem('completedTasks') || '[]');
    if (completedTasks.length > 0) {
        // Apply completions to dashboardTasks and dateContent
        completedTasks.forEach(taskId => {
            const task = dashboardTasks.find(t => String(t.id) === String(taskId));
            if (task) {
                task.completed = true;
            }
            // Also update dateContent
            Object.keys(dateContent).forEach(dateStr => {
                if (dateContent[dateStr] && dateContent[dateStr].timestamps) {
                    dateContent[dateStr].timestamps.forEach(section => {
                        if (section.subtasks && section.subtasks.length > 0) {
                            section.subtasks.forEach(subtask => {
                                if (typeof subtask === 'object' && String(subtask.taskId) === String(taskId)) {
                                    subtask.completed = true;
                                }
                            });
                        }
                    });
                }
            });
        });
        // Clear the stored completions after applying
        localStorage.removeItem('completedTasks');
        saveCalendarData();
    }

    renderCalendar(currentMonth, currentYear);

    // Auto-select today's date after calendar is fully rendered

    setTimeout(() => {

        const today = new Date();

        const dateStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;

        const dayElement = document.querySelector(`[data-date="${dateStr}"]`);

        if (dayElement) {

            selectDate(dateStr, dayElement);

        } else {

        }

    }, 200);

}

function renderCalendar(month, year) {

    // Recount every day's open tasks before painting. Every path that changes
    // the picture — first load, the backend merge finishing, completing a task,
    // moving month — comes back through here, so the shading is never left
    // showing a stale count.
    buildDayIntensityIndex(month, year);

    const monthYearElement = document.getElementById('monthYear');

    const calendarDaysElement = document.getElementById('calendarDays');

    // Update month/year display

    monthYearElement.textContent = `${monthNames[month]} ${year}`;

    // Clear previous days

    calendarDaysElement.innerHTML = '';

    // Get first day of the month and total days in the month

    // Monday-first grid: convert JS getDay() (Sunday=0..Saturday=6) into the number
    // of leading empty cells when the week starts on Monday (Monday=0..Sunday=6).
    const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;

    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Get today's date for highlighting

    const today = new Date();

    const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;

    // Add empty cells for days before the first day of the month

    for (let i = 0; i < firstDay; i++) {

        const emptyDay = document.createElement('div');

        emptyDay.className = 'calendar-day empty';

        calendarDaysElement.appendChild(emptyDay);

    }

    // Add days of the month

    for (let day = 1; day <= daysInMonth; day++) {

        const dayElement = document.createElement('div');

        dayElement.className = 'calendar-day';

        // Store date data

        const dateStr = `${year}-${month + 1}-${day}`;

        dayElement.dataset.date = dateStr;

        const dayNumber = document.createElement('span');

        dayNumber.className = 'day-number';

        dayNumber.textContent = day;

        dayElement.appendChild(dayNumber);

        // Colour the day's number by its task intensity: light blue = low load,
        // dark navy = high load. The current date is NOT treated specially — it
        // is coloured by its own intensity exactly like any other day. Selection
        // is shown only by the white dot (CSS .calendar-day.selected).
        const dayIntensity = getDayTaskIntensity(dateStr);
        if (dayIntensity > 0) {
            dayNumber.style.background = getIntensityBlue(dayIntensity);
            dayNumber.style.color = dayIntensity >= 45 ? '#ffffff' : '#0b1b3a';
        }

        // Highlight today's date

        if (isCurrentMonth && day === today.getDate()) {

            dayElement.classList.add('today');

        }

        // Highlight selected date

        if (selectedDate === dateStr) {

            dayElement.classList.add('selected');

        }

        // Add click handler for date selection

        dayElement.addEventListener('click', function() {

            selectDate(dateStr, dayElement);

        });

        calendarDaysElement.appendChild(dayElement);

    }

}

function selectDate(dateStr, element) {

    // Remove selected class from all days

    const allDays = document.querySelectorAll('.calendar-day');

    allDays.forEach(day => {

        if (!day.classList.contains('empty')) {

            day.classList.remove('selected');

        }

    });

    // Add selected class to clicked day

    element.classList.add('selected');

    selectedDate = dateStr;

    // Get or create content for this date

    if (!dateContent[dateStr]) {

        // Generate default content for this date

        const dateParts = dateStr.split('-');

        const date = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);

        const dayOfWeek = date.getDay();

        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        const dayName = dayNames[dayOfWeek];

        // Generate default timestamps (8am to 10pm split into 5 sections)

        const timestamps = generateDefaultTimestamps();

        // Filter out hidden placeholder tasks

        const filteredTimestamps = timestamps.filter(ts => {

            if (isPlaceholderTask(ts.task)) {

                return !shouldHidePlaceholderTask(ts.task, dateStr);

            }

            return true;

        });

        dateContent[dateStr] = {

            timestamps: filteredTimestamps

        };

    } else {

        // If content exists, also filter out hidden placeholder tasks

        dateContent[dateStr].timestamps = dateContent[dateStr].timestamps.filter(ts => {

            if (isPlaceholderTask(ts.task)) {

                return !shouldHidePlaceholderTask(ts.task, dateStr);

            }

            return true;

        });

    }

    // Add this date's calendar tasks to the day's list, one entry each.
    //
    // Every task used to be tucked in as a subtask of whichever event block
    // covered its time, and updateBottomSection then lifted it straight back
    // out into an entry of its own — so the detour decided nothing, except on a
    // day with no blocks to tuck it under, where the task was dropped and never
    // appeared at all. It gets its own entry from the start now. The times here
    // are provisional: updateBottomSection recomputes them from the task, along
    // with its completed state, and keeps them in step.
    //
    // Dashboard to-dos are filtered out upstream, and skipped again here so
    // nothing added to the array at runtime can leak onto the day either; a
    // finished to-do reaches the day by the separate rule below.
    dashboardTasks.forEach(task => {

        if (!isCalendarPlacedTask(task)) return;

        // A task sits on its deadline, or — having none — on the day it was
        // created, which is the only day it can be said to belong to.
        const placedAt = task.due_date ? new Date(task.due_date)
            : (task.created_at ? new Date(task.created_at) : new Date());

        if (isNaN(placedAt.getTime())) return;

        if (`${placedAt.getFullYear()}-${placedAt.getMonth() + 1}-${placedAt.getDate()}` !== dateStr) return;

        const known = dateContent[dateStr].timestamps.some(
            ts => (ts.isDashboardTask && String(ts.dashboardTaskId) === String(task.id)) ||
                  (ts.subtasks && ts.subtasks.some(st => String(st.taskId) === String(task.id)))
        );

        if (known) return;

        const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

        dateContent[dateStr].timestamps.push({
            startTime: hhmm(placedAt),
            endTime: task.due_date ? hhmm(placedAt) : '',
            task: task.name,
            isDashboardTask: true,
            dashboardTaskId: task.id,
            xp: task.xp || task.xp_reward || task.difficulty || 0,
            completed: !!task.completed
        });

    });

    // A dashboard to-do lands on the calendar the moment it is finished, on the
    // day it was finished. A to-do is never planned onto a day, so there is
    // nothing to show while it is still open — but once it's done, when it got
    // done is worth a place on the month. It carries an end time and no start
    // time, because a completion is a moment, not a block of the day.
    //
    // These are read from the database rather than from dashboardTasks, which
    // holds only calendar tasks, and they are rebuilt on every visit to the day
    // (saveCalendarData drops them) so the day always shows what the account
    // actually has, never a copy left behind by an earlier session.
    (window.dbTasks || []).forEach(task => {

        if (isCalendarPlacedTask(task)) return;   // already placed, by due date

        if (taskCalendarDay(task) !== dateStr) return;

        const finished = new Date(task.completed_at);

        const already = dateContent[dateStr].timestamps.some(
            ts => ts.isDashboardTask && String(ts.dashboardTaskId) === String(task.id)
        );

        if (already) return;

        dateContent[dateStr].timestamps.push({
            startTime: '',
            endTime: `${String(finished.getHours()).padStart(2, '0')}:${String(finished.getMinutes()).padStart(2, '0')}`,
            task: task.title || '',
            isDashboardTask: true,
            dashboardTaskId: task.id,
            xp: Number(task.xp_value) || 0,
            completed: true,
            completedTodo: true
        });

    });

    // Check for conflicts

    checkForConflicts();

    // Update the bottom section with the date's content

    updateBottomSection(dateStr);

    // Refresh the month grid so the just-materialised content shows its
    // intensity tint and event dot on the calendar.
    renderCalendar(currentMonth, currentYear);

}

function updateBottomSection(dateStr) {

    const content = dateContent[dateStr];

    if (!content) return;

    // Treat dashboard tasks as first-class events: pull any dashboard-task
    // subtasks out of the time-block they were nested under and give each its
    // own top-level entry, timed from the task's due/creation time, so they
    // sort chronologically alongside events and can be coloured by difficulty.
    if (Array.isArray(content.timestamps)) {
        const liftedTasks = [];
        const hasStandalone = (taskId) =>
            content.timestamps.some(t => t.isDashboardTask && String(t.dashboardTaskId) === String(taskId)) ||
            liftedTasks.some(t => String(t.dashboardTaskId) === String(taskId));
        content.timestamps.forEach(block => {
            if (!Array.isArray(block.subtasks)) return;
            block.subtasks = block.subtasks.filter(st => {
                const taskId = st && typeof st === 'object' ? st.taskId : null;
                if (!taskId) return true; // keep genuine (non-task) subtasks
                if (!hasStandalone(taskId)) {
                    const t = dashboardTasks.find(dt => String(dt.id) === String(taskId));
                    let startTime = block.startTime;
                    let endTime = block.endTime;
                    let name = t ? t.name : String(st.text || '').replace(/\s+(?:due|created) at .*$/, '');
                    // A task spans creation time -> due date. The task id is its
                    // creation timestamp (ms), a reliable fallback when there's no
                    // explicit created_at.
                    const toDate = (v) => { const d = new Date(v); return isNaN(d.getTime()) ? null : d; };
                    let created = t && t.created_at ? toDate(t.created_at) : null;
                    if (!created && t && /^\d+$/.test(String(t.id))) created = toDate(Number(t.id));
                    const due = t && t.due_date ? toDate(t.due_date) : null;
                    const completedAt = t && t.completed_at ? toDate(t.completed_at) : null;
                    const startDate = created || due;
                    // A due-date task spans creation -> due. A task with NO due date
                    // shows only a start time (its creation) until it's finished, at
                    // which point its completion time becomes the end.
                    const endDate = due || completedAt || null;
                    const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                    if (startDate) startTime = hhmm(startDate);
                    endTime = endDate ? hhmm(endDate) : '';
                    let completed = !!(t && t.completed) || !!st.completed;
                    if (window.backendTaskStatuses && window.backendTaskStatuses[taskId]) {
                        completed = !!window.backendTaskStatuses[taskId].completed;
                    }
                    liftedTasks.push({
                        startTime: startTime,
                        endTime: endTime,
                        task: name,
                        isDashboardTask: true,
                        dashboardTaskId: taskId,
                        xp: (t && (t.xp || t.xp_reward || t.difficulty)) || st.xp || 0,
                        completed: completed
                    });
                }
                return false; // remove the task from its host block
            });
            if (block.subtasks.length === 0) {
                delete block.subtasks;
                block.hasSubtasks = false;
            }
        });
        if (liftedTasks.length) content.timestamps.push(...liftedTasks);

        // Keep already-standalone dashboard-task events in sync with their task,
        // so an end time appears the instant the task is finished this session
        // (its completed_at was just set) without needing a reload.
        content.timestamps.forEach(ev => {
            if (!ev.isDashboardTask || !ev.dashboardTaskId) return;
            const t = dashboardTasks.find(dt => String(dt.id) === String(ev.dashboardTaskId));
            if (!t) return;
            const toDate = (v) => { const d = new Date(v); return isNaN(d.getTime()) ? null : d; };
            let created = t.created_at ? toDate(t.created_at) : null;
            if (!created && /^\d+$/.test(String(t.id))) created = toDate(Number(t.id));
            const due = t.due_date ? toDate(t.due_date) : null;
            const completedAt = t.completed_at ? toDate(t.completed_at) : null;
            const startDate = created || due;
            const endDate = due || completedAt || null;
            const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            if (startDate) ev.startTime = hhmm(startDate);
            ev.endTime = endDate ? hhmm(endDate) : '';
            let completed = !!t.completed;
            if (window.backendTaskStatuses && window.backendTaskStatuses[t.id]) completed = !!window.backendTaskStatuses[t.id].completed;
            ev.completed = completed;
        });
    }

    // Sort timestamps chronologically. A finished to-do has only an end time,
    // so it sorts by the moment it was finished; anything else sorts by when it
    // starts.

    if (content.timestamps && content.timestamps.length > 0) {

        const minutesOf = (value) => {
            const parts = String(value || '').split(':').map(Number);
            if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
            return parts[0] * 60 + parts[1];
        };

        const sortKey = (entry) => {
            const start = minutesOf(entry.startTime);
            if (start !== null) return start;
            const end = minutesOf(entry.endTime);
            return end !== null ? end : 0;
        };

        content.timestamps.sort((a, b) => sortKey(a) - sortKey(b));

    }

    // Update tasks list with timestamps

    const tasksList = document.getElementById('dailyTasks');

    tasksList.innerHTML = '';

    // Calculate daily intensity

    const intensity = calculateDailyIntensity(dateStr);

    // Add intensity bar and focus input above events

    const intensityContainer = document.createElement('div');

    intensityContainer.className = 'daily-intensity-container';

    const intensityBarWrapper = document.createElement('div');

    intensityBarWrapper.className = 'daily-intensity-bar-wrapper';

    intensityBarWrapper.style.flex = '0 0 70%';

    intensityBarWrapper.style.position = 'relative';

    const intensityBar = document.createElement('div');

    intensityBar.className = 'daily-intensity-bar';

    if (intensity.taskCount > 0) {

        const percentage = intensity.percentage;

        intensityBar.style.width = `${percentage}%`;

        intensityBar.style.background = getIntensityColor(percentage);

        intensityBar.title = `${intensity.taskCount} tasks, avg ${intensity.avgXP} XP`;

    } else {

        intensityBar.style.width = '100%';

        intensityBar.style.background = '#ccc';

        intensityBar.style.display = 'flex';

        intensityBar.style.alignItems = 'center';

        intensityBar.style.justifyContent = 'center';

        intensityBar.textContent = "There's no tasks (left) to do today!";

        intensityBar.style.color = '#666';

        intensityBar.style.fontSize = '14px';

    }

    // Add intensity marker

    const intensityMarker = document.createElement('div');

    intensityMarker.className = 'daily-intensity-marker';

    if (intensity.taskCount > 0) {

        // Position marker at the right edge of the bar

        intensityMarker.style.left = `${intensity.percentage}%`;

        intensityMarker.style.transform = 'translateX(-50%)'; // Center marker on the bar edge

        intensityMarker.textContent = `${intensity.percentage}%`;

    } else {

        intensityMarker.style.display = 'none';

    }

    intensityBarWrapper.appendChild(intensityBar);

    intensityBarWrapper.appendChild(intensityMarker);

    const focusInput = document.createElement('input');

    focusInput.type = 'text';

    focusInput.className = 'daily-focus-input';

    focusInput.placeholder = 'Today\'s focus...';

    // Shared per-day focus (day-focus.js) — the same note as the Week row and
    // the Day view's Focus field. The month's internal date keys are unpadded
    // ("2026-7-4"); the shared store uses real ISO ("2026-07-04"), so always go
    // through dayFocusIso(). Older data lived on content.focus only; migrate it
    // into the shared store the first time it's seen.
    const focusIso = dayFocusIso(dateStr);
    if (window.DayFocus && !window.DayFocus.get(focusIso) && content.focus) {
        window.DayFocus.set(focusIso, content.focus);
    }
    focusInput.value = (window.DayFocus ? window.DayFocus.get(focusIso) : content.focus) || '';

    focusInput.dataset.iso = focusIso;

    // Save focus on any change

    focusInput.addEventListener('input', (e) => {

        content.focus = e.target.value;

        if (window.DayFocus) window.DayFocus.set(focusIso, e.target.value);

        saveCalendarData();

    });

    focusInput.addEventListener('blur', (e) => {

        content.focus = e.target.value;

        if (window.DayFocus) window.DayFocus.set(focusIso, e.target.value);

        saveCalendarData();

    });

    // Pin the "Today's focus" field above the scrolling event list (mockup
    // layout). The intensity bar/marker are intentionally not appended.
    const focusHolder = document.getElementById('dailyFocusHolder');
    if (focusHolder) {
        focusHolder.innerHTML = '';
        focusHolder.appendChild(focusInput);
    } else {
        tasksList.appendChild(focusInput);
    }

    if (content.timestamps && content.timestamps.length > 0) {

        let taskNumber = 0;
        content.timestamps.forEach((section, index) => {

            const li = document.createElement('li');

            li.className = 'task-section';

            if (section.isDashboardTask) {
                li.classList.add('dashboard-task');
                const xp = section.xp || 0;
                if (xp >= 66) li.classList.add('priority-high');
                else if (xp >= 33) li.classList.add('priority-medium');
                else li.classList.add('priority-low');
            } else {
                // Events take the theme's card colour, same as tasks: the dark
                // card on the dark theme, the tan one on the light. Their own
                // palette colour used to be painted on inline here, which beat
                // every stylesheet rule (an inline !important always does) and
                // left the day's list a row of mismatched tints under both
                // themes. The per-event colour is still what the Week view
                // draws its blocks in — this only stops it reaching the cards.
                li.classList.add('calendar-event');
            }

            // Add completion styling (green when completed, yellow when in progress)

            if (section.completed) {

                li.classList.add('task-completed');

            } else {

                li.classList.add('task-in-progress');

            }

            // Dashboard tasks are auto-placed from their due date; two of them
            // sharing a time is not a real scheduling conflict, so never give
            // them the red "conflict" styling (which read as "overdue").
            if (section.hasConflict && !section.isDashboardTask) {

                li.classList.add('conflict');

            }

            // Disable editing for dashboard tasks

            // Overflow (⋮) menu replaces the old inline Edit/Remove buttons.
            // Events (calendar-event) get Edit + Remove; auto-placed tasks get Remove only.
            const menuItems = section.isDashboardTask
                ? `<button type="button" class="card-menu-item" onclick="removeTaskSection(${index})">Remove</button>`
                : `<button type="button" class="card-menu-item" onclick="editTaskSection(${index})">Edit</button><button type="button" class="card-menu-item" onclick="removeTaskSection(${index})">Remove</button>`;
            const cardMenu = `<div class="card-menu-wrap"><button type="button" class="card-menu-btn" aria-label="More options" onclick="toggleCardMenu(event)">&#8942;</button><div class="card-menu">${menuItems}</div></div>`;

            // Event clock icon (events only; tasks show the TASK label instead)
            const eventIcon = section.isDashboardTask ? '' : `<span class="event-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 1.8"/></svg></span>`;

            const readonlyAttr = section.isDashboardTask ? 'readonly' : '';

            const timeReadonlyAttr = section.isDashboardTask ? 'disabled' : '';

            let taskKindBadge = '';
            if (section.isDashboardTask) { taskNumber++; taskKindBadge = `<span class="task-kind-badge">Task ${taskNumber}</span>`; }
            // Difficulty shown as a labelled pill on the card (not the card colour)
            let difficultyBadge = '';
            if (section.isDashboardTask) {
                const dxp = section.xp || 0;
                const level = dxp >= 66 ? 'High' : dxp >= 33 ? 'Medium' : 'Low';
                difficultyBadge = `<span class="difficulty-badge difficulty-${level.toLowerCase()}">${level}</span>`;
            }
            const completedBadge = (section.isDashboardTask && section.completed)
                ? `<span class="completed-badge">Completed <svg class="completed-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>`
                : '';

            // An unfinished task can be checked off from here: its name is the
            // target, and hovering the card shows the hint where the "Completed"
            // badge will end up. Events have nothing to complete.
            const canComplete = !!(section.isDashboardTask && !section.completed && section.dashboardTaskId);
            if (canComplete) li.classList.add('can-complete');
            const completeHint = canComplete
                ? `<span class="complete-hint">Mark complete <svg class="completed-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>`
                : '';
            const nameAttrs = canComplete
                ? ` role="button" title="Click to mark complete" onclick="completeTaskSection(${index})"`
                : '';
            // Tasks show a tag row (Task N + difficulty pill); events have neither.
            const cardTags = (taskKindBadge || difficultyBadge)
                ? `<div class="card-tags">${taskKindBadge}${difficultyBadge}</div>` : '';

            // The time row shows only the times the entry actually has, and the
            // dash only when it has both. A finished to-do is placed on the day
            // by when it was finished and has no start time, so it shows a lone
            // end time rather than an empty "--:--" field beside it.
            const startField = section.startTime
                ? `<input type="time" class="start-time" value="${section.startTime}" ${timeReadonlyAttr} onchange="updateTimestamp(${index}, 'startTime', this.value)">`
                : '';
            const endField = section.endTime
                ? `<input type="time" class="end-time" value="${section.endTime}" ${timeReadonlyAttr} onchange="updateTimestamp(${index}, 'endTime', this.value)">`
                : '';
            const timeRow = `<div class="timestamp-section">${startField}${startField && endField ? '<span>-</span>' : ''}${endField}</div>`;

            // Check if this section has sub-tasks

            const hasSubtasks = section.subtasks && section.subtasks.length > 0;

            // Add has-subtasks class if there are subtasks

            if (hasSubtasks) {

                li.classList.add('has-subtasks');

            }

            li.innerHTML = `
                ${eventIcon}
                <div class="card-body">
                    ${cardTags}
                    <input type="text" class="task-input-inline" value="${section.task}" placeholder="What will you do..." ${readonlyAttr} onchange="updateTimestamp(${index}, 'task', this.value)"${nameAttrs}>
                    ${timeRow}
                </div>
                ${cardMenu}
                ${completedBadge}
                ${completeHint}



                ${hasSubtasks ? `



                    <ul class="subtasks-list">



                        ${section.subtasks.map((subtask, subIndex) => {

                            // Handle both string and object subtasks

                            const subtaskText = typeof subtask === 'object' ? subtask.text : subtask;

                            const subtaskXP = typeof subtask === 'object' ? subtask.xp : 0;

                            const isDashboardTask = typeof subtask === 'object' && subtask.taskId;

                            // Determine priority color based on XP (blue 10-40, yellow 40-75, red 75+)

                            let priorityClass = '';

                            let difficultyLabel = '';

                            if (subtaskXP >= 75) {

                                priorityClass = 'priority-high';

                                difficultyLabel = 'Hard';

                            } else if (subtaskXP >= 40) {



                                priorityClass = 'priority-medium';



                                difficultyLabel = 'Medium';



                            } else if (subtaskXP >= 10) {



                                priorityClass = 'priority-low';



                                difficultyLabel = 'Easy';



                            }



                            






                            



                            // Check if subtask is completed - pull from backend as source of truth
                            let subtaskCompleted = false;
                            let subtaskExpired = false;
                            let subtaskTimeout = false;
                            if (typeof subtask === 'object' && subtask.taskId) {
                                // Check cached backend task status first
                                if (window.backendTaskStatuses && window.backendTaskStatuses[subtask.taskId]) {
                                    subtaskCompleted = window.backendTaskStatuses[subtask.taskId].completed;
                                    subtaskExpired = window.backendTaskStatuses[subtask.taskId].timer_expired || false;
                                    subtaskTimeout = window.backendTaskStatuses[subtask.taskId].status === 'timeout';
                                } else {
                                    // Fallback to local subtask.completed
                                    subtaskCompleted = subtask.completed || false;
                                    subtaskExpired = subtask.timer_expired || false;
                                    subtaskTimeout = subtask.status === 'timeout';
                                }
                            }



                            



                            // Don't allow removing dashboard task subtasks



                            const removeButton = isDashboardTask ? '' : `<button class="remove-subtask-btn" onclick="removeSubtask(${index}, ${subIndex})">×</button>`;



                            const taskLabel = isDashboardTask ? `<span class="task-label">Task</span>` : '';



                            



                            // Add XP and difficulty labels for dashboard tasks



                            const xpDifficultyLabel = isDashboardTask ? `<span class="xp-difficulty-label">${subtaskXP} XP - ${difficultyLabel}</span>` : '';

                            const subtaskInProgressBadge = subtaskTimeout && isDashboardTask ? `<span class="timeout-badge">TIME'S UP</span>` : subtaskExpired && isDashboardTask ? `<span class="expired-badge">TIME'S UP!</span>` : (!subtaskCompleted && isDashboardTask) ? `<span class="in-progress-badge">In Progress</span>` : (subtaskCompleted && isDashboardTask) ? `<span class="completed-badge">COMPLETED</span>` : '';

                            const finalClass = `subtask-item ${priorityClass} ${subtaskTimeout ? 'task-timeout' : (subtaskExpired ? 'task-expired' : (subtaskCompleted ? 'task-completed' : 'task-in-progress'))}`;

                            return `



                            <li class="${finalClass}">



                                <span class="bullet">•</span>



                                <input type="text" class="subtask-input" value="${subtaskText}" placeholder="Add a subtask..." onchange="updateSubtask(${index}, ${subIndex}, this.value)" ${isDashboardTask ? 'readonly' : ''}>



                                ${subtaskInProgressBadge}

                                ${taskLabel}



                                ${xpDifficultyLabel}



                                ${removeButton}



                            </li>



                            `;

                        }).join('')}

                        <li class="add-subtask-item">

                            <button class="add-subtask-btn" onclick="addSubtask(${index})">+ Add subtask</button>

                        </li>

                    </ul>

                ` : `

                    <button class="add-subtask-btn-small" onclick="addSubtask(${index})">+ Add subtask</button>

                `}



            `;

            tasksList.appendChild(li);

        });

    } else {

        const emptyMsg = document.createElement('li');
        emptyMsg.className = 'no-events-message';
        emptyMsg.textContent = 'No Tasks or Events scheduled yet';
        tasksList.appendChild(emptyMsg);

    }

    // Calculate total tasks and completed tasks

    let totalTasks = 0;

    let completedTasks = 0;

    if (content.timestamps && content.timestamps.length > 0) {

        content.timestamps.forEach(section => {

            // Count main task (if it's not a placeholder)

            if (!isPlaceholderTask(section.task)) {

                totalTasks++;

                // Check backend status cache for main task completion
                let mainTaskCompleted = section.completed;
                if (section.isDashboardTask && section.taskId) {
                    if (window.backendTaskStatuses && window.backendTaskStatuses[section.taskId]) {
                        mainTaskCompleted = window.backendTaskStatuses[section.taskId].completed;
                    }
                }

                if (mainTaskCompleted) {

                    completedTasks++;

                }

            }

            // Count subtasks

            if (section.subtasks && section.subtasks.length > 0) {

                section.subtasks.forEach(subtask => {

                    const subtaskText = typeof subtask === 'object' ? subtask.text : subtask;

                    // Check backend status cache for completion status
                    let subtaskCompleted = false;
                    if (typeof subtask === 'object' && subtask.taskId) {
                        if (window.backendTaskStatuses && window.backendTaskStatuses[subtask.taskId]) {
                            subtaskCompleted = window.backendTaskStatuses[subtask.taskId].completed;
                        } else {
                            // Fallback to local subtask.completed
                            subtaskCompleted = subtask.completed || false;
                        }
                    } else if (typeof subtask === 'object') {
                        subtaskCompleted = subtask.completed || false;
                    }

                    const isDashboardTask = typeof subtask === 'object' && (subtask.taskId !== undefined || subtask.isDashboardTask);

                    // Only count dashboard subtasks

                    if (subtaskText && subtaskText.trim() !== '' && isDashboardTask) {

                        totalTasks++;

                        if (subtaskCompleted) {

                            completedTasks++;

                        }

                    }

                });

            }

        });

    }

    // Calculate percentage

    const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Display task counter at the bottom

    const taskCounter = document.getElementById('taskCounter');

    if (taskCounter) {

        const R = 18;
        const CIRC = 2 * Math.PI * R;
        const dash = (CIRC * percentage) / 100;
        taskCounter.innerHTML = `
            <div class="day-progress">
                <svg class="day-progress-ring" viewBox="0 0 44 44" aria-hidden="true">
                    <circle class="dpr-track" cx="22" cy="22" r="${R}"></circle>
                    <circle class="dpr-fill" cx="22" cy="22" r="${R}" stroke-dasharray="${dash.toFixed(2)} ${CIRC.toFixed(2)}"></circle>
                </svg>
                <div class="day-progress-text">
                    <span class="dpr-title">Day Completion Progress</span>
                    <span class="dpr-sub">${completedTasks} Tasks (${percentage}% Completed)</span>
                </div>
            </div>`;

    }

}

function updateTimestamp(index, field, value) {

    if (!selectedDate || !dateContent[selectedDate]) return;

    const timestamps = dateContent[selectedDate].timestamps;

    timestamps[index][field] = value;

    // Ensure XP value is set for priority color coding

    if (!timestamps[index].xp) {

        timestamps[index].xp = 10; // Default XP for user-created tasks

    }

    // Check for conflicts and update UI

    checkForConflicts();

    // Update the UI

    updateBottomSection(selectedDate);

    // Save to localStorage

    saveCalendarData();

}

function addSubtask(index) {

    if (!selectedDate || !dateContent[selectedDate]) return;

    const timestamps = dateContent[selectedDate].timestamps;

    if (!timestamps[index].subtasks) {

        timestamps[index].subtasks = [];

    }

    // Add subtask as object with default XP for priority color coding

    timestamps[index].subtasks.push({

        text: '',

        xp: 10 // Default XP for user-created subtasks

    });

    // Add has-subtasks class to remove priority border

    timestamps[index].hasSubtasks = true;

    // Update the UI

    updateBottomSection(selectedDate);

    // Save to localStorage

    saveCalendarData();

}

function removeSubtask(index, subIndex) {

    if (!selectedDate || !dateContent[selectedDate]) return;

    const timestamps = dateContent[selectedDate].timestamps;

    if (timestamps[index].subtasks) {

        // Check if this is a dashboard task subtask - don't allow removal

        const subtask = timestamps[index].subtasks[subIndex];

        const isDashboardTask = typeof subtask === 'object' && subtask.taskId;

        if (isDashboardTask) {

            return; // Don't remove dashboard task subtasks

        }

        timestamps[index].subtasks.splice(subIndex, 1);

        // Remove has-subtasks class if no more subtasks or if all subtasks are empty

        if (timestamps[index].subtasks.length === 0 || timestamps[index].subtasks.every(st => !st || (typeof st === 'string' ? st.trim() === '' : st.text.trim() === ''))) {

            timestamps[index].hasSubtasks = false;

        }

    }

    // Save to localStorage

    saveCalendarData();

    // Update the UI (this will recalculate intensity but should use stored max)

    updateBottomSection(selectedDate);

}

function updateSubtask(index, subIndex, value) {

    if (!selectedDate || !dateContent[selectedDate]) return;

    const timestamps = dateContent[selectedDate].timestamps;

    if (timestamps[index].subtasks) {

        // Check if this is a dashboard task subtask - don't allow editing

        const subtask = timestamps[index].subtasks[subIndex];

        const isDashboardTask = typeof subtask === 'object' && subtask.taskId;

        if (isDashboardTask) {

            return; // Don't edit dashboard task subtasks

        }

        // Convert string subtasks to objects with XP for priority color coding

        if (typeof subtask === 'string') {

            timestamps[index].subtasks[subIndex] = {

                text: value,

                xp: 10 // Default XP for user-created subtasks

            };

        } else {

            timestamps[index].subtasks[subIndex].text = value;

        }

        // Remove has-subtasks class if all subtasks are empty

        if (timestamps[index].subtasks.every(st => !st || (typeof st === 'string' ? st.trim() === '' : st.text.trim() === ''))) {

            timestamps[index].hasSubtasks = false;

        }

    }

    // Save to localStorage

    saveCalendarData();

}

function checkForConflicts() {

    if (!selectedDate || !dateContent[selectedDate]) return;

    const timestamps = dateContent[selectedDate].timestamps;

    // Parse time string to minutes

    function timeToMinutes(timeStr) {

        const [hours, minutes] = timeStr.split(':').map(Number);

        return hours * 60 + minutes;

    }

    // Reset all conflict flags

    timestamps.forEach(section => {

        section.hasConflict = false;

    });

    // Check if any section has same start and end time

    timestamps.forEach(section => {

        if (section.startTime === section.endTime) {

            section.hasConflict = true;

        }

    });

    // Only check for identical timeframes if there are at least 2 sections

    if (timestamps.length < 2) return;

    // Check for identical timeframes between different sections

    for (let i = 0; i < timestamps.length; i++) {

        for (let j = i + 1; j < timestamps.length; j++) {

            const section1 = timestamps[i];

            const section2 = timestamps[j];

            const start1 = timeToMinutes(section1.startTime);

            const end1 = timeToMinutes(section1.endTime);

            const start2 = timeToMinutes(section2.startTime);

            const end2 = timeToMinutes(section2.endTime);

            // Only mark as conflict if timeframes are identical (same start AND same end)

            if (start1 === start2 && end1 === end2) {

                section1.hasConflict = true;

                section2.hasConflict = true;

            }

        }

    }

}

function addTaskSection() {

    if (!selectedDate || !dateContent[selectedDate]) return;

    // Show the modal instead of immediately adding

    openAddSectionModal();

    // New events start as one-offs — "No recurrence" until it's asked for.
    applyDefaultRecurrence('none');

}

function openAddSectionModal() {

    const modal = document.getElementById('addSectionModal');

    // Week view adds .from-week for a wider popup; month view always resets to normal width.
    modal.classList.remove('from-week');

    modal.style.display = 'block';

    // Live overlap/suggestion under the time pickers: wire the selects once, then
    // refresh whenever the modal opens or a time changes.
    if (!modal.__evSuggestWired) {
        modal.__evSuggestWired = true;
        ['startHour', 'startMinute', 'startAmPm', 'endHour', 'endMinute', 'endAmPm'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener('change', function () { updateEventSuggestion(); });
        });
    }
    setTimeout(updateEventSuggestion, 0);

    // Generate monthly days checkboxes

    generateMonthlyDays();

    // Populate time dropdowns

    populateTimeDropdowns();

    // Reset form fields

    document.getElementById('timeframeName').value = '';

    // Reset time dropdowns to empty (no default time)

    document.getElementById('startHour').value = '';

    document.getElementById('startMinute').value = '00'; // minutes default to 00

    document.getElementById('startAmPm').value = 'AM';

    document.getElementById('endHour').value = '';

    document.getElementById('endMinute').value = '00'; // minutes default to 00

    document.getElementById('endAmPm').value = 'AM';

    // Reset recurrence options

    document.querySelectorAll('input[name="recurrenceType"]').forEach(radio => {

        radio.checked = (radio.value === 'none');

    });

    document.getElementById('weeklyOptions').style.display = 'none';

    document.getElementById('monthlyOptions').style.display = 'none';

    // Uncheck all checkboxes

    document.querySelectorAll('input[name="dayOfWeek"]').forEach(cb => cb.checked = false);

    document.querySelectorAll('input[name="dayOfMonth"]').forEach(cb => cb.checked = false);

    // Add event listeners for recurrence type changes

    document.querySelectorAll('input[name="recurrenceType"]').forEach(radio => {

        radio.addEventListener('change', handleRecurrenceTypeChange);

    });

    // Add event listeners to clear invalid styling on input

    document.getElementById('timeframeName').addEventListener('input', function() {

        this.classList.remove('invalid-input');

    });

    document.getElementById('startHour').addEventListener('change', function() {

        this.classList.remove('invalid-input');

    });

    document.getElementById('startMinute').addEventListener('change', function() {

        this.classList.remove('invalid-input');

    });

    document.getElementById('endHour').addEventListener('change', function() {

        this.classList.remove('invalid-input');

    });

    document.getElementById('endMinute').addEventListener('change', function() {

        this.classList.remove('invalid-input');

    });

}

function populateTimeDropdowns() {

    // Populate hour dropdowns (1-12)

    const startHour = document.getElementById('startHour');

    const endHour = document.getElementById('endHour');

    startHour.innerHTML = '';

    endHour.innerHTML = '';

    // Add empty option at the beginning

    startHour.innerHTML += '<option value="">--</option>';

    endHour.innerHTML += '<option value="">--</option>';

    for (let i = 1; i <= 12; i++) {

        const hourStr = i.toString();

        startHour.innerHTML += `<option value="${hourStr}">${hourStr}</option>`;

        endHour.innerHTML += `<option value="${hourStr}">${hourStr}</option>`;

    }

    // Populate minute dropdowns (00-59)

    const startMinute = document.getElementById('startMinute');

    const endMinute = document.getElementById('endMinute');

    startMinute.innerHTML = '';

    endMinute.innerHTML = '';

    // Add empty option at the beginning

    startMinute.innerHTML += '<option value="">--</option>';

    endMinute.innerHTML += '<option value="">--</option>';

    for (let i = 0; i <= 59; i += 5) {   // minutes snap to 5 (00, 05, 10, …, 55)

        const minuteStr = i.toString().padStart(2, '0');

        startMinute.innerHTML += `<option value="${minuteStr}">${minuteStr}</option>`;

        endMinute.innerHTML += `<option value="${minuteStr}">${minuteStr}</option>`;

    }

}

function setTimeFrom24Hour(prefix, time24) {

    const [hours24, minutes] = time24.split(':').map(Number);

    let hours12 = hours24 % 12;

    if (hours12 === 0) hours12 = 12;

    const ampm = hours24 >= 12 ? 'PM' : 'AM';

    document.getElementById(prefix + 'Hour').value = hours12.toString();

    document.getElementById(prefix + 'Minute').value = minutes.toString().padStart(2, '0');

    document.getElementById(prefix + 'AmPm').value = ampm;

}

function getTimeTo24Hour(prefix) {

    const hour = parseInt(document.getElementById(prefix + 'Hour').value);

    const minute = document.getElementById(prefix + 'Minute').value || '00';

    const ampm = document.getElementById(prefix + 'AmPm').value;

    let hours24 = hour;

    if (ampm === 'PM' && hour !== 12) {

        hours24 += 12;

    } else if (ampm === 'AM' && hour === 12) {

        hours24 = 0;

    }

    return `${hours24.toString().padStart(2, '0')}:${minute}`;

}

function closeAddSectionModal() {

    const modal = document.getElementById('addSectionModal');

    modal.style.display = 'none';

}

function handleRecurrenceTypeChange(event) {

    const recurrenceType = event.target.value;

    document.getElementById('weeklyOptions').style.display = 'none';

    document.getElementById('monthlyOptions').style.display = 'none';

    if (recurrenceType === 'weekly') {

        document.getElementById('weeklyOptions').style.display = 'block';

    } else if (recurrenceType === 'monthly') {

        document.getElementById('monthlyOptions').style.display = 'block';

    }

    // Turning recurrence on from the "No recurrence" default starts with no days
    // picked, which can't be saved — seed the event's own day, unless days are
    // already chosen (switching back and forth keeps the user's picks).
    if (recurrenceType === 'weekly' || recurrenceType === 'monthly') {
        var group = recurrenceType === 'weekly' ? 'dayOfWeek' : 'dayOfMonth';
        if (!document.querySelector('input[name="' + group + '"]:checked')) applyDefaultRecurrence(recurrenceType);
    }

}

// Set the Add-Event recurrence. Every view opens on 'none' — a new event is a
// one-off unless the user says otherwise. When a repeating type is passed the
// current day is pre-selected so the recurrence is valid, and the matching
// options panel is shown.
function applyDefaultRecurrence(type) {
    document.querySelectorAll('input[name="recurrenceType"]').forEach(function (r) { r.checked = (r.value === type); });
    document.getElementById('weeklyOptions').style.display = (type === 'weekly') ? 'block' : 'none';
    document.getElementById('monthlyOptions').style.display = (type === 'monthly') ? 'block' : 'none';
    // Clear the day pickers this type owns before seeding them below — 'none'
    // owns both, so it leaves nothing checked behind. The other type's picks are
    // left alone, so flipping between weekly and monthly doesn't lose them.
    var owned = type === 'weekly' ? 'input[name="dayOfWeek"]'
              : type === 'monthly' ? 'input[name="dayOfMonth"]'
              : 'input[name="dayOfWeek"], input[name="dayOfMonth"]';
    document.querySelectorAll(owned).forEach(function (cb) { cb.checked = false; });
    if (!selectedDate) return;
    var p = String(selectedDate).split('-').map(Number);
    var d = new Date(p[0], p[1] - 1, p[2]);
    if (type === 'weekly') {
        var dow = d.getDay();   // 0=Sun … 6=Sat, matching the dayOfWeek checkbox values
        document.querySelectorAll('input[name="dayOfWeek"]').forEach(function (cb) { cb.checked = (parseInt(cb.value, 10) === dow); });
    } else if (type === 'monthly') {
        document.querySelectorAll('input[name="dayOfMonth"]').forEach(function (cb) { cb.checked = (parseInt(cb.value, 10) === p[2]); });
    }
}

function generateMonthlyDays() {

    const container = document.getElementById('monthlyDaysContainer');

    container.innerHTML = '';

    for (let i = 1; i <= 31; i++) {

        const label = document.createElement('label');

        label.innerHTML = `<input type="checkbox" name="dayOfMonth" value="${i}"> ${i}`;

        container.appendChild(label);

    }

}

// Minutes between two "HH:MM" times, wrapping past midnight. Used only to reject
// a zero-length event (equal start/end); short events are allowed.
function eventDurationMinutes(startTime, endTime) {
    var toMin = function (t) { var p = String(t).split(':').map(Number); return p[0] * 60 + p[1]; };
    var d = toMin(endTime) - toMin(startTime);
    if (d < 0) d += 24 * 60;
    return d;
}

// --- Event scheduling: prevent overlaps + suggest a free slot ----------------
// Same "available time" idea as the dashboard, but on the calendar's own store:
// an event may not overlap any other event or on-calendar task on its day, and
// the modal suggests the closest free slot after the current time.
function escHtml(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function hmToMinutes(hm) { var p = String(hm).split(':'); return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0); }
function minutesToLabel(m) {
    m = ((m % 1440) + 1440) % 1440;
    var h = Math.floor(m / 60), mm = m % 60, ap = h < 12 ? 'AM' : 'PM', h12 = h % 12; if (h12 === 0) h12 = 12;
    return h12 + ':' + (mm < 10 ? '0' + mm : mm) + ' ' + ap;
}
// Busy [startMin, endMin, label] spans on a day, from every event and on-calendar
// task (anything with start/end times), skipping placeholders and one excluded row.
function eventBusyIntervals(dateStr, excludeIndex) {
    var out = [];
    var store = (typeof dateContent !== 'undefined') ? dateContent[dateStr] : null;
    if (!store || !Array.isArray(store.timestamps)) return out;
    store.timestamps.forEach(function (t, i) {
        if (excludeIndex != null && i === excludeIndex) return;
        if (!t || !t.startTime || !t.endTime) return;
        if (typeof isPlaceholderTask === 'function' && isPlaceholderTask(t.task)) return;
        var s = hmToMinutes(t.startTime), e = hmToMinutes(t.endTime);
        if (e <= s) e += 1440;   // overnight
        out.push([s, e, t.task || (t.isDashboardTask ? 'Task' : 'Event')]);
    });
    return out;
}
function eventOverlapLabel(s, e, busy) { for (var i = 0; i < busy.length; i++) { if (s < busy[i][1] && busy[i][0] < e) return busy[i][2]; } return null; }
// Closest free start (aligned to 15 min, 6 AM–11 PM) fitting durMin, at/after fromMin.
function eventFindFreeStart(busy, durMin, fromMin) {
    var step = 15, open = 6 * 60, lastStart = 23 * 60 - Math.max(15, durMin);
    var t = Math.max(open, fromMin || 0);
    t = Math.ceil(t / step) * step;
    for (; t <= lastStart; t += step) {
        if (!eventOverlapLabel(t, t + Math.max(15, durMin), busy)) return t;
    }
    return null;
}
// Minutes-of-day "now" if the modal's day is today, else the day's 6 AM open.
function eventDayFromMinutes(dateStr) {
    var p = String(dateStr).split('-').map(Number);
    var now = new Date();
    if (p[0] === now.getFullYear() && p[1] === now.getMonth() + 1 && p[2] === now.getDate()) {
        return now.getHours() * 60 + now.getMinutes();
    }
    return 6 * 60;
}
// The Add-Event "availability" / next-free-slot message has been removed — events
// are created freely and the strict overlap popup resolves any conflict — so this
// is now a no-op kept only so its existing callers stay harmless.
function updateEventSuggestion() {
    return;
    // eslint-disable-next-line no-unreachable
    var box = document.getElementById('eventSuggestion');
    if (!box || !selectedDate) return;
    var busy = eventBusyIntervals(selectedDate, null);
    var startTime = getTimeTo24Hour('start'), endTime = getTimeTo24Hour('end');
    var hasStart = document.getElementById('startHour').value !== '';
    var hasEnd = document.getElementById('endHour').value !== '';
    var dur = (hasStart && hasEnd) ? eventDurationMinutes(startTime, endTime) : 60;
    if (dur < 15) dur = 60;
    var slot = eventFindFreeStart(busy, dur, eventDayFromMinutes(selectedDate));
    var suggestHtml = slot == null ? 'No free slot left that day.'
        : 'Next available: <a href="#" class="event-suggest-link" data-min="' + slot + '">' + minutesToLabel(slot) + '</a>' +
          ' is free — ' + eventNextGapText(busy, slot);
    box.style.display = 'block';
    if (hasStart && hasEnd) {
        var s = hmToMinutes(startTime), e = hmToMinutes(endTime); if (e <= s) e += 1440;
        var label = eventOverlapLabel(s, e, busy);
        if (label) {
            box.className = 'event-suggest event-suggest-bad';
            box.innerHTML = '⚠ That time overlaps "' + escHtml(label) + '". ' + suggestHtml;
        } else {
            box.className = 'event-suggest event-suggest-ok';
            box.textContent = '✓ ' + minutesToLabel(s) + ' – ' + minutesToLabel(e % 1440) + ' is free.';
            wireEventSuggestLink();
            return;
        }
    } else {
        box.className = 'event-suggest';
        box.innerHTML = suggestHtml;
    }
    wireEventSuggestLink();
}
// "<duration> until <thing>" (or "nothing else scheduled") after a free start.
function eventNextGapText(busy, slotMin) {
    var next = null;
    for (var i = 0; i < busy.length; i++) { if (busy[i][0] >= slotMin && (!next || busy[i][0] < next[0])) next = busy[i]; }
    if (!next) return 'nothing else scheduled';
    var mins = next[0] - slotMin, h = Math.floor(mins / 60), r = mins % 60;
    var dur = mins < 60 ? mins + ' min' : (h + ' hr' + (r ? ' ' + r + ' min' : ''));
    return dur + ' until "' + escHtml(next[2]) + '"';
}
// Clicking the suggested time fills the start pickers (+1 h default end).
function wireEventSuggestLink() {
    var link = document.querySelector('#eventSuggestion .event-suggest-link');
    if (!link) return;
    link.addEventListener('click', function (e) {
        e.preventDefault();
        var startMin = parseInt(link.getAttribute('data-min'), 10) || 0;
        var hasEnd = document.getElementById('endHour').value !== '';
        var hasStart = document.getElementById('startHour').value !== '';
        var dur = (hasStart && hasEnd) ? eventDurationMinutes(getTimeTo24Hour('start'), getTimeTo24Hour('end')) : 60;
        if (dur < 15) dur = 60;
        setTimePickers('start', startMin);
        setTimePickers('end', (startMin + dur) % 1440);
        clearInvalidStyling('add');
        updateEventSuggestion();
    });
}
// Set the hour/minute/AM-PM pickers for a prefix from minutes-of-day.
function setTimePickers(prefix, minute) {
    minute = ((minute % 1440) + 1440) % 1440;
    var h = Math.floor(minute / 60), mm = minute % 60, ap = h < 12 ? 'AM' : 'PM', h12 = h % 12; if (h12 === 0) h12 = 12;
    document.getElementById(prefix + 'Hour').value = String(h12);
    document.getElementById(prefix + 'Minute').value = (mm < 10 ? '0' + mm : String(mm));
    document.getElementById(prefix + 'AmPm').value = ap;
}

function confirmAddSection() {

    const timeframeName = document.getElementById('timeframeName').value.trim();

    const startTime = getTimeTo24Hour('start');

    const endTime = getTimeTo24Hour('end');

    const recurrenceType = document.querySelector('input[name="recurrenceType"]:checked').value;

    // Clear previous invalid styling

    clearInvalidStyling('add');

    let isValid = true;

    if (!timeframeName) {

        document.getElementById('timeframeName').classList.add('invalid-input');

        isValid = false;

    }

    if (!startTime || !endTime) {

        if (!startTime) {

            document.getElementById('startHour').classList.add('invalid-input');

            document.getElementById('startMinute').classList.add('invalid-input');

        }

        if (!endTime) {

            document.getElementById('endHour').classList.add('invalid-input');

            document.getElementById('endMinute').classList.add('invalid-input');

        }

        isValid = false;

    }

    if (eventDurationMinutes(startTime, endTime) <= 0) {

        document.getElementById('startHour').classList.add('invalid-input');

        document.getElementById('startMinute').classList.add('invalid-input');

        document.getElementById('endHour').classList.add('invalid-input');

        document.getElementById('endMinute').classList.add('invalid-input');

        isValid = false;

    }

    if (!isValid) return;

    // Get selected days based on recurrence type

    let selectedDays = [];

    if (recurrenceType === 'weekly') {

        selectedDays = Array.from(document.querySelectorAll('input[name="dayOfWeek"]:checked'))

            .map(cb => parseInt(cb.value));

    } else if (recurrenceType === 'monthly') {

        selectedDays = Array.from(document.querySelectorAll('input[name="dayOfMonth"]:checked'))

            .map(cb => parseInt(cb.value));

    }

    if (recurrenceType !== 'none' && selectedDays.length === 0) {

        document.getElementById('weeklyOptions').classList.add('invalid-input');

        document.getElementById('monthlyOptions').classList.add('invalid-input');

        return;

    }

    // Check if selected date matches recurrence pattern

    const selectedDateParts = selectedDate.split('-').map(Number);

    const selectedDateObj = new Date(selectedDateParts[0], selectedDateParts[1] - 1, selectedDateParts[2]);

    let selectedDateMatches = true;

    if (recurrenceType === 'weekly') {

        const selectedDayOfWeek = selectedDateObj.getDay();

        selectedDateMatches = selectedDays.includes(selectedDayOfWeek);

    } else if (recurrenceType === 'monthly') {

        const selectedDayOfMonth = selectedDateParts[2];

        selectedDateMatches = selectedDays.includes(selectedDayOfMonth);

    }

    // Overlap is NOT blocked here. Events may be created freely; the week view's
    // strict event-overlap check then forces the user to delete one side of any
    // event–event overlap (see showConflictPopup / renderDayColumns in
    // calendar-week.js). A silent block-and-suggest here would pre-empt that popup.

    // Add the section to the selected date only if it matches recurrence pattern or if no recurrence

    const newSection = {

        startTime: startTime,

        endTime: endTime,

        task: timeframeName,

        recurrence: recurrenceType,

        recurrenceDays: selectedDays,

        xp: 10, // Default XP for user-created tasks

        color: assignEventColor() // distinct hex per event; copied to its recurrences

    };

    if (recurrenceType === 'none' || selectedDateMatches) {

        dateContent[selectedDate].timestamps.push(newSection);

    } else {

    }

    // If recurrence is set, add to other dates

    if (recurrenceType !== 'none' && selectedDays.length > 0) {

        addRecurringSections(newSection, recurrenceType, selectedDays);

    } else {

    }

    // Check for conflicts

    checkForConflicts();

    // Update the UI

    updateBottomSection(selectedDate);

    // Save to localStorage

    saveCalendarData();

    // Close the modal

    closeAddSectionModal();

}

function clearInvalidStyling(modalType) {

    if (modalType === 'add') {

        document.getElementById('timeframeName').classList.remove('invalid-input');

        document.getElementById('startHour').classList.remove('invalid-input');

        document.getElementById('startMinute').classList.remove('invalid-input');

        document.getElementById('endHour').classList.remove('invalid-input');

        document.getElementById('endMinute').classList.remove('invalid-input');

        document.getElementById('weeklyOptions').classList.remove('invalid-input');

        document.getElementById('monthlyOptions').classList.remove('invalid-input');

    } else if (modalType === 'edit') {

        document.getElementById('editTimeframeName').classList.remove('invalid-input');

        document.getElementById('editStartHour').classList.remove('invalid-input');

        document.getElementById('editStartMinute').classList.remove('invalid-input');

        document.getElementById('editEndHour').classList.remove('invalid-input');

        document.getElementById('editEndMinute').classList.remove('invalid-input');

        document.getElementById('editWeeklyOptions').classList.remove('invalid-input');

        document.getElementById('editMonthlyOptions').classList.remove('invalid-input');

    }

}

function addRecurringSections(section, recurrenceType, selectedDays) {

    const selectedDateParts = selectedDate.split('-').map(Number);

    const startYear = selectedDateParts[0];

    const startMonth = selectedDateParts[1];

    // Calculate end date (12 months from start)

    const endDate = new Date(startYear, startMonth - 1 + 12, 0);

    const endYear = endDate.getFullYear();

    const endMonth = endDate.getMonth() + 1;

    let addedCount = 0;

    if (recurrenceType === 'weekly') {

        // Add to all selected days of the week for the next 12 months

        for (let year = startYear; year <= endYear; year++) {

            const monthStart = (year === startYear) ? startMonth : 1;

            const monthEnd = (year === endYear) ? endMonth : 12;

            for (let month = monthStart; month <= monthEnd; month++) {

                const daysInMonth = new Date(year, month, 0).getDate();

                for (let day = 1; day <= daysInMonth; day++) {

                    const date = new Date(year, month - 1, day);

                    const dayOfWeek = date.getDay();

                    if (selectedDays.includes(dayOfWeek)) {

                        const dateStr = `${year}-${month}-${day}`;

                        // Skip the selected date (it's handled separately)

                        if (dateStr === selectedDate) {

                            continue;

                        }

                        // Log existing timestamps before adding

                        const beforeCount = dateContent[dateStr] ? dateContent[dateStr].timestamps.length : 0;

                        if (!dateContent[dateStr]) {

                            // Generate default timestamps (placeholder timeframes) for new dates

                            const timestamps = generateDefaultTimestamps();

                            dateContent[dateStr] = { timestamps: timestamps };

                        }

                        // Check if section already exists

                        const exists = dateContent[dateStr].timestamps.some(

                            ts => ts.startTime === section.startTime &&

                                  ts.endTime === section.endTime &&

                                  ts.task === section.task

                        );

                        if (!exists) {

                            // Preserve existing timestamps (including placeholder timeframes)

                            const existingTimestamps = dateContent[dateStr].timestamps;

                            dateContent[dateStr].timestamps = existingTimestamps;

                            dateContent[dateStr].timestamps.push({

                                ...section,

                                recurrence: 'weekly',

                                recurrenceDays: selectedDays

                            });

                            addedCount++;

                            // Log after adding

                            const afterCount = dateContent[dateStr].timestamps.length;

                        }

                    }

                }

            }

        }

    } else if (recurrenceType === 'monthly') {

        // Add to selected days of the month for the next 12 months

        for (let monthOffset = 0; monthOffset < 12; monthOffset++) {

            const targetDate = new Date(startYear, startMonth - 1 + monthOffset, 1);

            const year = targetDate.getFullYear();

            const month = targetDate.getMonth() + 1;

            selectedDays.forEach(day => {

                const daysInMonth = new Date(year, month, 0).getDate();

                if (day <= daysInMonth) {

                    const dateStr = `${year}-${month}-${day}`;

                    // Skip the selected date (it's handled separately)

                    if (dateStr === selectedDate) {

                        return;

                    }

                    // Log existing timestamps before adding

                    const beforeCount = dateContent[dateStr] ? dateContent[dateStr].timestamps.length : 0;

                    if (!dateContent[dateStr]) {

                        // Generate default timestamps (placeholder timeframes) for new dates

                        const timestamps = generateDefaultTimestamps();

                        dateContent[dateStr] = { timestamps: timestamps };

                    }

                    // Check if section already exists

                    const exists = dateContent[dateStr].timestamps.some(

                        ts => ts.startTime === section.startTime &&

                              ts.endTime === section.endTime &&

                              ts.task === section.task

                    );

                    if (!exists) {

                        // Preserve existing timestamps (including placeholder timeframes)

                        const existingTimestamps = dateContent[dateStr].timestamps;

                        dateContent[dateStr].timestamps = existingTimestamps;

                        dateContent[dateStr].timestamps.push({

                            ...section,

                            recurrence: 'monthly',

                            recurrenceDays: selectedDays

                        });

                        addedCount++;

                        // Log after adding

                        const afterCount = dateContent[dateStr].timestamps.length;

                    }

                }

            });

        }

    }

}

function removeTaskSection(index) {

    if (!selectedDate || !dateContent[selectedDate]) return;

    // Only remove the task from the selected date, not from recurring dates

    dateContent[selectedDate].timestamps.splice(index, 1);

    // Check for conflicts

    checkForConflicts();

    updateBottomSection(selectedDate);

    // Save to localStorage

    saveCalendarData();

}

let editingSectionIndex = null;

let deletingSectionIndex = null;

function editTaskSection(index) {

    if (!selectedDate || !dateContent[selectedDate]) return;

    editingSectionIndex = index;

    const section = dateContent[selectedDate].timestamps[index];

    // Open edit modal

    openEditSectionModal(section);

}

function removeTaskSection(index) {

    if (!selectedDate || !dateContent[selectedDate]) return;

    deletingSectionIndex = index;

    const section = dateContent[selectedDate].timestamps[index];

    // Open delete modal

    openDeleteModal(section);

}

// Click a pending task's name on a plan card to finish it. The completion goes
// through CalendarTaskComplete — the dashboard's own path, so the XP, the
// streak and any "complete N tasks" goal all move exactly as they would there —
// and the card is only redrawn as done once the server has recorded it.
function completeTaskSection(index) {

    if (!selectedDate || !dateContent[selectedDate]) return;

    const section = dateContent[selectedDate].timestamps[index];

    if (!section || !section.isDashboardTask || section.completed) return;

    const taskId = section.dashboardTaskId;

    if (!taskId || !window.CalendarTaskComplete) return;

    const card = document.querySelectorAll('#dailyTasks .task-section')[index];

    if (card) card.classList.add('is-completing');   // dimmed + inert while it flies

    window.CalendarTaskComplete.run(taskId, section.xp || 0).then((ok) => {

        if (card) card.classList.remove('is-completing');

        if (!ok) return;   // nothing was awarded — leave the card as it was

        // markTaskCompletedInCalendar (run inside the completion) has already
        // updated the stored task; mirror it onto this entry so the card flips
        // to "Completed" without waiting on a reload, and re-shade the month
        // grid, whose day tints count only the tasks still open.
        section.completed = true;

        saveCalendarData();

        updateBottomSection(selectedDate);

        renderCalendar(currentMonth, currentYear);

    });

}

window.completeTaskSection = completeTaskSection;

// Toggle a plan card's ⋮ overflow menu (Edit / Remove). Only one open at a time.
function toggleCardMenu(event) {
    event.stopPropagation();
    const wrap = event.currentTarget.closest('.card-menu-wrap');
    const menu = wrap ? wrap.querySelector('.card-menu') : null;
    const willOpen = menu && !menu.classList.contains('open');
    document.querySelectorAll('#dailyTasks .card-menu.open').forEach(m => m.classList.remove('open'));
    if (willOpen) menu.classList.add('open');
}
// Any click outside an open menu closes it (menu-item clicks bubble here too,
// so choosing Edit/Remove opens its modal and dismisses the menu).
document.addEventListener('click', () => {
    document.querySelectorAll('#dailyTasks .card-menu.open').forEach(m => m.classList.remove('open'));
});

function openDeleteModal(section) {

    const modal = document.getElementById('deleteModal');

    modal.style.display = 'block';

    // Check if this is a placeholder task

    const isPlaceholder = isPlaceholderTask(section.task);

    // Hide all options first

    document.getElementById('placeholderDeleteOptions').style.display = 'none';

    document.getElementById('timePeriodOptions').style.display = 'none';

    document.getElementById('customDeleteOptions').style.display = 'none';

    document.getElementById('recurrenceDeleteOptions').style.display = 'none';

    document.getElementById('datesDeleteOptions').style.display = 'none';

    document.getElementById('daysDeleteOptions').style.display = 'none';

    if (isPlaceholder) {

        // Show placeholder delete options

        document.getElementById('deleteModalTitle').textContent = 'Delete Placeholder Task';

        document.getElementById('placeholderDeleteOptions').style.display = 'block';

        // Reset placeholder delete options

        document.querySelector('input[name="placeholderDeleteOption"][value="permanent"]').checked = true;

        document.getElementById('timePeriodOptions').style.display = 'none';

        document.getElementById('placeholderRecurrenceOptions').style.display = 'none';

        document.getElementById('placeholderDatesOptions').style.display = 'none';

        document.getElementById('placeholderDaysOptions').style.display = 'none';

        // Uncheck all checkboxes

        document.querySelectorAll('input[name="placeholderDeleteDayOfWeek"]').forEach(cb => cb.checked = false);

        // Add event listener for placeholder delete option change

        document.querySelectorAll('input[name="placeholderDeleteOption"]').forEach(radio => {

            radio.removeEventListener('change', handlePlaceholderDeleteOptionChange);

            radio.addEventListener('change', handlePlaceholderDeleteOptionChange);

        });

        // Add event listeners for placeholder recurrence type changes

        document.querySelectorAll('input[name="placeholderRecurrenceType"]').forEach(radio => {

            radio.removeEventListener('change', handlePlaceholderRecurrenceTypeChange);

            radio.addEventListener('change', handlePlaceholderRecurrenceTypeChange);

        });

        // Generate placeholder dates for deletion

        generatePlaceholderDates(section);

    } else {

        // Show custom task delete options

        document.getElementById('deleteModalTitle').textContent = 'Delete Task';

        document.getElementById('customDeleteOptions').style.display = 'block';

        // Reset form

        document.querySelector('input[name="deleteOption"][value="individual"]').checked = true;

        document.getElementById('recurrenceDeleteOptions').style.display = 'none';

        document.getElementById('datesDeleteOptions').style.display = 'none';

        document.getElementById('daysDeleteOptions').style.display = 'none';

        // Uncheck all checkboxes

        document.querySelectorAll('input[name="deleteDayOfWeek"]').forEach(cb => cb.checked = false);

        // Add event listeners for delete option changes

        document.querySelectorAll('input[name="deleteOption"]').forEach(radio => {

            radio.removeEventListener('change', handleDeleteOptionChange);

            radio.addEventListener('change', handleDeleteOptionChange);

        });

        // Add event listeners for recurrence delete type changes

        document.querySelectorAll('input[name="recurrenceDeleteType"]').forEach(radio => {

            radio.removeEventListener('change', handleRecurrenceDeleteTypeChange);

            radio.addEventListener('change', handleRecurrenceDeleteTypeChange);

        });

        // Generate dates for deletion if the section has recurrence

        if (section.recurrence && section.recurrence !== 'none') {

            generateDeleteDates(section);

        }

    }

}

function closeDeleteModal() {

    const modal = document.getElementById('deleteModal');

    modal.style.display = 'none';

    deletingSectionIndex = null;

}

function handleDeleteOptionChange(event) {

    const deleteOption = event.target.value;

    if (deleteOption === 'individual') {

        document.getElementById('recurrenceDeleteOptions').style.display = 'none';

        document.getElementById('datesDeleteOptions').style.display = 'none';

        document.getElementById('daysDeleteOptions').style.display = 'none';

    } else if (deleteOption === 'recurrences') {

        document.getElementById('recurrenceDeleteOptions').style.display = 'block';

    }

}

function handleRecurrenceDeleteTypeChange(event) {

    const recurrenceDeleteType = event.target.value;

    if (recurrenceDeleteType === 'dates') {

        document.getElementById('datesDeleteOptions').style.display = 'block';

        document.getElementById('daysDeleteOptions').style.display = 'none';

    } else if (recurrenceDeleteType === 'days') {

        document.getElementById('datesDeleteOptions').style.display = 'none';

        document.getElementById('daysDeleteOptions').style.display = 'block';

    }

}

function handlePlaceholderDeleteOptionChange(event) {

    const deleteOption = event.target.value;

    document.getElementById('timePeriodOptions').style.display = 'none';

    document.getElementById('placeholderRecurrenceOptions').style.display = 'none';

    document.getElementById('placeholderDatesOptions').style.display = 'none';

    document.getElementById('placeholderDaysOptions').style.display = 'none';

    if (deleteOption === 'permanent') {

        // No additional options needed

    } else if (deleteOption === 'temporary') {

        document.getElementById('timePeriodOptions').style.display = 'block';

    } else if (deleteOption === 'recurrences') {

        document.getElementById('placeholderRecurrenceOptions').style.display = 'block';

    }

}

function handlePlaceholderRecurrenceTypeChange(event) {

    const recurrenceType = event.target.value;

    if (recurrenceType === 'dates') {

        document.getElementById('placeholderDatesOptions').style.display = 'block';

        document.getElementById('placeholderDaysOptions').style.display = 'none';

    } else if (recurrenceType === 'days') {

        document.getElementById('placeholderDatesOptions').style.display = 'none';

        document.getElementById('placeholderDaysOptions').style.display = 'block';

    }

}

function deletePlaceholderTaskPermanently(section) {

    // Add to permanently deleted list

    if (!hiddenPlaceholderTasks.permanentlyDeleted.includes(section.task)) {

        hiddenPlaceholderTasks.permanentlyDeleted.push(section.task);

    }

    // Remove from all existing dates

    Object.keys(dateContent).forEach(dateStr => {

        if (dateContent[dateStr] && dateContent[dateStr].timestamps) {

            dateContent[dateStr].timestamps = dateContent[dateStr].timestamps.filter(

                ts => !(ts.task === section.task &&

                       ts.startTime === section.startTime &&

                       ts.endTime === section.endTime)

            );

        }

    });

}

function deletePlaceholderTaskForPeriod(section, months) {

    // Add time period deletion rule

    const selectedDateParts = selectedDate.split('-').map(Number);

    const startDate = new Date(selectedDateParts[0], selectedDateParts[1] - 1, selectedDateParts[2]);

    const endDate = new Date(startDate);

    endDate.setMonth(endDate.getMonth() + months);

    // Remove existing time period deletion for this task if any

    hiddenPlaceholderTasks.timePeriodDeletions = hiddenPlaceholderTasks.timePeriodDeletions.filter(

        d => d.task !== section.task

    );

    // Add new time period deletion rule

    hiddenPlaceholderTasks.timePeriodDeletions.push({

        task: section.task,

        startDate: startDate.toISOString().split('T')[0],

        endDate: endDate.toISOString().split('T')[0]

    });

    // Remove from all existing dates within the time period

    Object.keys(dateContent).forEach(dateStr => {

        const dateParts = dateStr.split('-').map(Number);

        const currentDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);

        // Check if this date is within the time period

        if (currentDate >= startDate && currentDate <= endDate) {

            if (dateContent[dateStr] && dateContent[dateStr].timestamps) {

                dateContent[dateStr].timestamps = dateContent[dateStr].timestamps.filter(

                    ts => !(ts.task === section.task &&

                           ts.startTime === section.startTime &&

                           ts.endTime === section.endTime)

                );

            }

        }

    });

}

function generatePlaceholderDates(section) {

    const container = document.getElementById('placeholderDatesContainer');

    container.innerHTML = '';

    // Generate days 1-31

    for (let i = 1; i <= 31; i++) {

        const label = document.createElement('label');

        label.innerHTML = `<input type="checkbox" name="placeholderDeleteDate" value="${i}"> ${i}`;

        container.appendChild(label);

    }

}

function generateDeleteDates(section) {

    const container = document.getElementById('datesDeleteContainer');

    container.innerHTML = '';

    // Generate days 1-31

    for (let i = 1; i <= 31; i++) {

        const label = document.createElement('label');

        label.innerHTML = `<input type="checkbox" name="deleteDate" value="${i}"> ${i}`;

        container.appendChild(label);

    }

}

let deleteConfirmed = false;

function confirmDelete() {

    deleteConfirmed = true;

    alert('Delete confirmed. Click "Done" to complete the deletion.');

}

function doneDelete() {

    if (deletingSectionIndex === null || !selectedDate || !dateContent[selectedDate]) return;

    const section = dateContent[selectedDate].timestamps[deletingSectionIndex];

    const isPlaceholder = isPlaceholderTask(section.task);

    if (isPlaceholder) {

        // Handle placeholder task deletion

        const placeholderDeleteOption = document.querySelector('input[name="placeholderDeleteOption"]:checked').value;

        if (placeholderDeleteOption === 'permanent') {

            // Delete permanently from all dates

            deletePlaceholderTaskPermanently(section);

        } else if (placeholderDeleteOption === 'temporary') {

            // Delete for a specific time period

            const timePeriod = parseInt(document.querySelector('input[name="timePeriod"]:checked').value);

            deletePlaceholderTaskForPeriod(section, timePeriod);

        } else if (placeholderDeleteOption === 'recurrences') {

            // Handle recurrence deletion for placeholder tasks

            const placeholderRecurrenceType = document.querySelector('input[name="placeholderRecurrenceType"]:checked').value;

            if (placeholderRecurrenceType === 'dates') {

                // Delete from specific days of month

                const selectedDays = Array.from(document.querySelectorAll('input[name="placeholderDeleteDate"]:checked'))

                    .map(cb => parseInt(cb.value));

                // Remove existing day of month deletion for this task if any

                hiddenPlaceholderTasks.dayOfMonthDeletions = hiddenPlaceholderTasks.dayOfMonthDeletions.filter(

                    d => d.task !== section.task

                );

                // Add new day of month deletion rule

                hiddenPlaceholderTasks.dayOfMonthDeletions.push({

                    task: section.task,

                    days: selectedDays

                });

                // Remove from all existing dates that match the selected days

                Object.keys(dateContent).forEach(dateStr => {

                    const dateParts = dateStr.split('-').map(Number);

                    const dayOfMonth = dateParts[2];

                    if (selectedDays.includes(dayOfMonth)) {

                        if (dateContent[dateStr] && dateContent[dateStr].timestamps) {

                            dateContent[dateStr].timestamps = dateContent[dateStr].timestamps.filter(

                                ts => !(ts.task === section.task &&

                                       ts.startTime === section.startTime &&

                                       ts.endTime === section.endTime)

                            );

                        }

                    }

                });

            } else if (placeholderRecurrenceType === 'days') {

                // Delete from specific days of week

                const selectedDays = Array.from(document.querySelectorAll('input[name="placeholderDeleteDayOfWeek"]:checked'))

                    .map(cb => parseInt(cb.value));

                // Remove existing day of week deletion for this task if any

                hiddenPlaceholderTasks.dayOfWeekDeletions = hiddenPlaceholderTasks.dayOfWeekDeletions.filter(

                    d => d.task !== section.task

                );

                // Add new day of week deletion rule

                hiddenPlaceholderTasks.dayOfWeekDeletions.push({

                    task: section.task,

                    days: selectedDays

                });

                // Remove from all existing dates that match the selected days

                Object.keys(dateContent).forEach(dateStr => {

                    if (dateContent[dateStr] && dateContent[dateStr].timestamps) {

                        const dateParts = dateStr.split('-').map(Number);

                        const date = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);

                        const dayOfWeek = date.getDay();

                        if (selectedDays.includes(dayOfWeek)) {

                            dateContent[dateStr].timestamps = dateContent[dateStr].timestamps.filter(

                                ts => !(ts.task === section.task &&

                                       ts.startTime === section.startTime &&

                                       ts.endTime === section.endTime)

                            );

                        }

                    }

                });

            }

        }

    } else {

        // Handle custom task deletion

        const deleteOption = document.querySelector('input[name="deleteOption"]:checked').value;

        if (deleteOption === 'individual') {

            // Delete only the individual task on this date

            dateContent[selectedDate].timestamps.splice(deletingSectionIndex, 1);

        } else if (deleteOption === 'recurrences') {

            const recurrenceDeleteType = document.querySelector('input[name="recurrenceDeleteType"]:checked').value;

            if (recurrenceDeleteType === 'dates') {

                // Delete from specific days of month

                const selectedDays = Array.from(document.querySelectorAll('input[name="deleteDate"]:checked'))

                    .map(cb => parseInt(cb.value));

                // Get the selected date to determine the starting point

                const selectedDateParts = selectedDate.split('-').map(Number);

                const startDate = new Date(selectedDateParts[0], selectedDateParts[1] - 1, selectedDateParts[2]);

                // Delete from the next 12 months

                for (let monthOffset = 0; monthOffset < 12; monthOffset++) {

                    const targetDate = new Date(startDate.getFullYear(), startDate.getMonth() + monthOffset, 1);

                    const year = targetDate.getFullYear();

                    const month = targetDate.getMonth() + 1;

                    const daysInMonth = new Date(year, month, 0).getDate();

                    selectedDays.forEach(day => {

                        // Only delete if the day exists in this month

                        if (day <= daysInMonth) {

                            const dateStr = `${year}-${month}-${day}`;

                            if (dateContent[dateStr] && dateContent[dateStr].timestamps) {

                                dateContent[dateStr].timestamps = dateContent[dateStr].timestamps.filter(

                                    ts => !(ts.task === section.task &&

                                           ts.startTime === section.startTime &&

                                           ts.endTime === section.endTime)

                                );

                            }

                        }

                    });

                }

            } else if (recurrenceDeleteType === 'days') {

                // Delete from specific days of week

                const selectedDays = Array.from(document.querySelectorAll('input[name="deleteDayOfWeek"]:checked'))

                    .map(cb => parseInt(cb.value));

                Object.keys(dateContent).forEach(dateStr => {

                    if (dateContent[dateStr] && dateContent[dateStr].timestamps) {

                        const dateParts = dateStr.split('-').map(Number);

                        const date = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);

                        const dayOfWeek = date.getDay();

                        if (selectedDays.includes(dayOfWeek)) {

                            dateContent[dateStr].timestamps = dateContent[dateStr].timestamps.filter(

                                ts => !(ts.task === section.task &&

                                       ts.startTime === section.startTime &&

                                       ts.endTime === section.endTime)

                            );

                        }

                    }

                });

            }

        }

    }

    // Check for conflicts

    checkForConflicts();

    // Update the UI

    updateBottomSection(selectedDate);

    // Save to localStorage

    saveCalendarData();

    // Close the modal

    closeDeleteModal();

}

function openEditSectionModal(section) {

    const modal = document.getElementById('editSectionModal');

    // Default to normal width; the week view re-adds .from-week (see editEvent in
    // calendar-week.js) so the edit popup matches the wide Add-Event popup there.
    modal.classList.remove('from-week');

    modal.style.display = 'block';

    // Populate time dropdowns

    populateEditTimeDropdowns();

    // Generate monthly days checkboxes

    generateEditMonthlyDays();

    // Set form values

    document.getElementById('editTimeframeName').value = section.task;

    setTimeFrom24HourEdit('editStart', section.startTime);

    setTimeFrom24HourEdit('editEnd', section.endTime);

    // Set recurrence type

    const recurrenceType = section.recurrence || 'none';

    document.querySelectorAll('input[name="editRecurrenceType"]').forEach(radio => {

        radio.checked = (radio.value === recurrenceType);

    });

    // Show/hide recurrence options

    document.getElementById('editWeeklyOptions').style.display = 'none';

    document.getElementById('editMonthlyOptions').style.display = 'none';

    if (recurrenceType === 'weekly') {

        document.getElementById('editWeeklyOptions').style.display = 'block';

        // Check selected days of week

        if (section.recurrenceDays && section.recurrenceDays.length > 0) {

            document.querySelectorAll('input[name="editDayOfWeek"]').forEach(cb => {

                cb.checked = section.recurrenceDays.includes(parseInt(cb.value));

            });

        }

    } else if (recurrenceType === 'monthly') {

        document.getElementById('editMonthlyOptions').style.display = 'block';

        // Check selected days of month

        if (section.recurrenceDays && section.recurrenceDays.length > 0) {

            document.querySelectorAll('input[name="editDayOfMonth"]').forEach(cb => {

                cb.checked = section.recurrenceDays.includes(parseInt(cb.value));

            });

        }

    }

    // Uncheck all checkboxes if no recurrence

    if (recurrenceType === 'none') {

        document.querySelectorAll('input[name="editDayOfWeek"]').forEach(cb => cb.checked = false);

        document.querySelectorAll('input[name="editDayOfMonth"]').forEach(cb => cb.checked = false);

    }

    // Add event listeners for recurrence type changes

    document.querySelectorAll('input[name="editRecurrenceType"]').forEach(radio => {

        radio.addEventListener('change', handleEditRecurrenceTypeChange);

    });

    // Add event listeners to clear invalid styling on input

    document.getElementById('editTimeframeName').addEventListener('input', function() {

        this.classList.remove('invalid-input');

    });

    document.getElementById('editStartHour').addEventListener('change', function() {

        this.classList.remove('invalid-input');

    });

    document.getElementById('editStartMinute').addEventListener('change', function() {

        this.classList.remove('invalid-input');

    });

    document.getElementById('editEndHour').addEventListener('change', function() {

        this.classList.remove('invalid-input');

    });

    document.getElementById('editEndMinute').addEventListener('change', function() {

        this.classList.remove('invalid-input');

    });

}

function closeEditSectionModal() {

    const modal = document.getElementById('editSectionModal');

    modal.style.display = 'none';

    editingSectionIndex = null;

}

function generateEditMonthlyDays() {

    const container = document.getElementById('editMonthlyDaysContainer');

    container.innerHTML = '';

    for (let i = 1; i <= 31; i++) {

        const label = document.createElement('label');

        label.innerHTML = `<input type="checkbox" name="editDayOfMonth" value="${i}"> ${i}`;

        container.appendChild(label);

    }

}

function handleEditRecurrenceTypeChange(event) {

    const recurrenceType = event.target.value;

    document.getElementById('editWeeklyOptions').style.display = 'none';

    document.getElementById('editMonthlyOptions').style.display = 'none';

    if (recurrenceType === 'weekly') {

        document.getElementById('editWeeklyOptions').style.display = 'block';

    } else if (recurrenceType === 'monthly') {

        document.getElementById('editMonthlyOptions').style.display = 'block';

    }

}

function populateEditTimeDropdowns() {

    // Populate hour dropdowns (1-12)

    const editStartHour = document.getElementById('editStartHour');

    const editEndHour = document.getElementById('editEndHour');

    editStartHour.innerHTML = '';

    editEndHour.innerHTML = '';

    // Add empty option at the beginning

    editStartHour.innerHTML += '<option value="">--</option>';

    editEndHour.innerHTML += '<option value="">--</option>';

    for (let i = 1; i <= 12; i++) {

        const hourStr = i.toString();

        editStartHour.innerHTML += `<option value="${hourStr}">${hourStr}</option>`;

        editEndHour.innerHTML += `<option value="${hourStr}">${hourStr}</option>`;

    }

    // Populate minute dropdowns (00-59)

    const editStartMinute = document.getElementById('editStartMinute');

    const editEndMinute = document.getElementById('editEndMinute');

    editStartMinute.innerHTML = '';

    editEndMinute.innerHTML = '';

    // Add empty option at the beginning

    editStartMinute.innerHTML += '<option value="">--</option>';

    editEndMinute.innerHTML += '<option value="">--</option>';

    for (let i = 0; i <= 59; i += 5) {   // minutes snap to 5 (00, 05, 10, …, 55)

        const minuteStr = i.toString().padStart(2, '0');

        editStartMinute.innerHTML += `<option value="${minuteStr}">${minuteStr}</option>`;

        editEndMinute.innerHTML += `<option value="${minuteStr}">${minuteStr}</option>`;

    }

}

function setTimeFrom24HourEdit(prefix, time24) {

    const [hours24, minutes] = time24.split(':').map(Number);

    let hours12 = hours24 % 12;

    if (hours12 === 0) hours12 = 12;

    const ampm = hours24 >= 12 ? 'PM' : 'AM';

    document.getElementById(prefix + 'Hour').value = hours12.toString();

    document.getElementById(prefix + 'Minute').value = minutes.toString().padStart(2, '0');

    document.getElementById(prefix + 'AmPm').value = ampm;

}

function getTimeTo24HourEdit(prefix) {

    const hour = parseInt(document.getElementById(prefix + 'Hour').value);

    const minute = document.getElementById(prefix + 'Minute').value || '00';

    const ampm = document.getElementById(prefix + 'AmPm').value;

    let hours24 = hour;

    if (ampm === 'PM' && hour !== 12) {

        hours24 += 12;

    } else if (ampm === 'AM' && hour === 12) {

        hours24 = 0;

    }

    return `${hours24.toString().padStart(2, '0')}:${minute}`;

}

function confirmEditSection() {

    if (editingSectionIndex === null || !selectedDate || !dateContent[selectedDate]) return;

    const timeframeName = document.getElementById('editTimeframeName').value.trim();

    const startTime = getTimeTo24HourEdit('editStart');

    const endTime = getTimeTo24HourEdit('editEnd');

    const recurrenceType = document.querySelector('input[name="editRecurrenceType"]:checked').value;

    // Clear previous invalid styling

    clearInvalidStyling('edit');

    let isValid = true;

    if (!timeframeName) {

        document.getElementById('editTimeframeName').classList.add('invalid-input');

        isValid = false;

    }

    if (!startTime || !endTime) {

        if (!startTime) {

            document.getElementById('editStartHour').classList.add('invalid-input');

            document.getElementById('editStartMinute').classList.add('invalid-input');

        }

        if (!endTime) {

            document.getElementById('editEndHour').classList.add('invalid-input');

            document.getElementById('editEndMinute').classList.add('invalid-input');

        }

        isValid = false;

    }

    if (eventDurationMinutes(startTime, endTime) <= 0) {

        document.getElementById('editStartHour').classList.add('invalid-input');

        document.getElementById('editStartMinute').classList.add('invalid-input');

        document.getElementById('editEndHour').classList.add('invalid-input');

        document.getElementById('editEndMinute').classList.add('invalid-input');

        isValid = false;

    }

    if (!isValid) return;

    // Get selected days based on recurrence type

    let selectedDays = [];

    if (recurrenceType === 'weekly') {

        selectedDays = Array.from(document.querySelectorAll('input[name="editDayOfWeek"]:checked'))

            .map(cb => parseInt(cb.value));

    } else if (recurrenceType === 'monthly') {

        selectedDays = Array.from(document.querySelectorAll('input[name="editDayOfMonth"]:checked'))

            .map(cb => parseInt(cb.value));

    }

    // Store the old section data to identify old recurring instances

    const oldSection = dateContent[selectedDate].timestamps[editingSectionIndex];

    const oldTask = oldSection.task;

    const oldStartTime = oldSection.startTime;

    const oldEndTime = oldSection.endTime;

    const oldRecurrence = oldSection.recurrence;

    // Update the section

    dateContent[selectedDate].timestamps[editingSectionIndex].task = timeframeName;

    dateContent[selectedDate].timestamps[editingSectionIndex].startTime = startTime;

    dateContent[selectedDate].timestamps[editingSectionIndex].endTime = endTime;

    dateContent[selectedDate].timestamps[editingSectionIndex].recurrence = recurrenceType;

    dateContent[selectedDate].timestamps[editingSectionIndex].recurrenceDays = selectedDays;

    // Only remove old recurring instances if the old section had recurrence

    if (oldRecurrence && oldRecurrence !== 'none') {

        removeOldRecurringInstances(oldTask, oldStartTime, oldEndTime);

    } else {

    }

    // If recurrence is changed to none, remove the section from the current date as well

    if (oldRecurrence !== 'none' && recurrenceType === 'none') {

        dateContent[selectedDate].timestamps.splice(editingSectionIndex, 1);

    }

    // If recurrence is set, add to other dates

    else if (recurrenceType !== 'none' && selectedDays.length > 0) {

        addRecurringSections(dateContent[selectedDate].timestamps[editingSectionIndex], recurrenceType, selectedDays);

    }

    // Check for conflicts

    checkForConflicts();

    // Update the UI

    updateBottomSection(selectedDate);

    // Save to localStorage

    saveCalendarData();

    // Close the modal

    closeEditSectionModal();

}

function removeOldRecurringInstances(taskName, startTime, endTime) {

    // Remove instances of this specific task from all dates

    Object.keys(dateContent).forEach(dateStr => {

        if (dateStr === selectedDate) return; // Skip the current date

        if (dateContent[dateStr] && dateContent[dateStr].timestamps) {

            const beforeCount = dateContent[dateStr].timestamps.length;

            // Filter out only the matching task instances

            dateContent[dateStr].timestamps = dateContent[dateStr].timestamps.filter(ts => {

                const isMatch = ts.task === taskName && ts.startTime === startTime && ts.endTime === endTime;

                if (isMatch) {

                }

                return !isMatch;

            });

            const afterCount = dateContent[dateStr].timestamps.length;

            if (beforeCount !== afterCount) {

            }

        }

    });

}

function changeMonth(direction) {

    currentMonth += direction;

    // Handle year transition

    if (currentMonth < 0) {

        currentMonth = 11;

        currentYear--;

    } else if (currentMonth > 11) {

        currentMonth = 0;

        currentYear++;

    }

    renderCalendar(currentMonth, currentYear);

}

// Cache backend task statuses
window.backendTaskStatuses = {};

// Load the signed-in account's tasks from the backend and merge them into the
// calendar's task list. localStorage.dashboardTasks only holds tasks created in
// THIS browser, so account tasks placed on the calendar from another browser
// never appeared here. Merging them in makes them show on their day, count in
// Day Completion Progress, and carry their completed state. Only calendar tasks
// come across — dashboard to-dos are skipped (see isCalendarPlacedTask). Additive:
// existing localStorage tasks are kept; backend tasks are added by id only if
// not already present. Backend fields are mapped to the shape the calendar
// expects (title->name, xp_value->xp_reward, status->completed).
async function loadBackendTasksIntoCalendar() {
    const username = localStorage.getItem('currentUser') || 'Default';
    try {
        // no-store: this is what the day shading is counted from, so it has to
        // be the account's tasks as they are now, not a cached copy.
        const res = await fetch('/api/tasks?username=' + encodeURIComponent(username),
                                { cache: 'no-store' });
        const data = await res.json();
        if (!data || !data.success || !Array.isArray(data.tasks)) return;

        // The rows as the database has them, kept whole: the day shading reads
        // their priority off these and decides for itself which of them count
        // (buildDayIntensityIndex).
        window.dbTasks = data.tasks.slice();

        const byId = new Map(dashboardTasks.map(t => [String(t.id), t]));
        let added = 0;
        data.tasks.forEach(t => {
            const isDone = t.status === 'done';
            // Seed the completion cache so the render shows completed state
            // without a per-task status fetch.
            window.backendTaskStatuses[t.id] = { completed: isDone, status: t.status };

            // Only tasks placed on the calendar come across — a dashboard to-do
            // (no flag, or false) never joins the calendar's task list.
            if (!isCalendarPlacedTask(t)) return;

            const mapped = {
                id: t.id,
                name: t.title,
                due_date: t.due_date,
                priority: t.priority,
                xp_reward: t.xp_value,
                created_at: t.created_at,
                completed_at: t.completed_at,
                show_on_calendar: true,
                completed: isDone,
                isDashboardTask: true
            };

            const known = byId.get(String(t.id));
            if (known) {
                // The account is the authority on a task it already knows
                // about. This used to skip them, so a task completed, moved or
                // re-scored anywhere else kept whatever this browser saved the
                // first time — and the day shading counted that stale copy for
                // good. Keys the calendar owns locally are left alone.
                Object.assign(known, mapped);
                return;
            }

            dashboardTasks.push(mapped);
            byId.set(String(t.id), mapped);
            added++;
        });

        // A task deleted elsewhere should stop colouring its day. Only ones
        // that came from the account are dropped; anything created in this
        // browser and not yet saved stays.
        const live = new Set(data.tasks.map(t => String(t.id)));
        for (let i = dashboardTasks.length - 1; i >= 0; i--) {
            const t = dashboardTasks[i];
            if (t.isDashboardTask && !live.has(String(t.id))) dashboardTasks.splice(i, 1);
        }

        // Re-render so the merged tasks appear on the grid and in the selected
        // day's list + progress.
        renderCalendar(currentMonth, currentYear);
        const today = new Date();
        const dateStr = selectedDate ||
            `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
        const dayEl = document.querySelector(`[data-date="${dateStr}"]`);
        if (dayEl) selectDate(dateStr, dayEl);
    } catch (e) {
        console.error('📅 Error loading backend tasks into calendar:', e);
    }
}

async function fetchBackendTaskStatuses() {
    try {
        // Get all task IDs from dashboardTasks
        const taskIds = dashboardTasks.map(t => t.id);

        if (taskIds.length === 0) {
            return;
        }

        // Fetch status for each task
        for (const taskId of taskIds) {
            try {
                const response = await fetch('/api/get_task_status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ task_id: taskId })
                });
                const data = await response.json();
                if (data.success) {
                    window.backendTaskStatuses[taskId] = {
                        completed: data.completed,
                        status: data.status
                    };
                }
            } catch (error) {
                console.error('📅 Error fetching status for task:', taskId, error);
            }
        }

    } catch (error) {
        console.error('📅 Error fetching backend task statuses:', error);
    }
}

// CALENDAR.JS LOADED

// Test function definition

// Mark dashboard task as completed in calendar

function markTaskCompletedInCalendar(taskId, completionStatus) {

    // Update backend task status cache immediately
    window.backendTaskStatuses = window.backendTaskStatuses || {};
    window.backendTaskStatuses[taskId] = {
        completed: completionStatus === 'done',
        status: completionStatus
    };

    // Nothing to repaint on the month grid: a day is shaded by what it carries,
    // and finishing a task doesn't take it off the day.

    // If dashboardTasks is empty, store the completion in localStorage for when calendar loads
    if (dashboardTasks.length === 0) {
        const completedTasks = JSON.parse(localStorage.getItem('completedTasks') || '[]');
        if (!completedTasks.includes(taskId)) {
            completedTasks.push(taskId);
            localStorage.setItem('completedTasks', JSON.stringify(completedTasks));
        }
        return;
    }

    // Find the task in dashboardTasks array
    const task = dashboardTasks.find(t => {
        return String(t.id) === String(taskId);
    });

    if (!task) {

        return;

    }

    // Mark the task as completed with the status from backend

    task.completed = completionStatus === 'done' ? true : completionStatus;

    // Record/clear the completion time so a no-due-date task gets its end time
    // (and date) the moment it's finished, without waiting for a reload. The
    // backend's /api/complete_task persists the same completed_at.
    if (completionStatus === 'done') {
        if (!task.completed_at) task.completed_at = new Date().toISOString();
    } else {
        task.completed_at = null;
    }

    // Update all occurrences of this task in dateContent

    let subtasksUpdated = 0;

    Object.keys(dateContent).forEach(dateStr => {

        if (dateContent[dateStr] && dateContent[dateStr].timestamps) {

            dateContent[dateStr].timestamps.forEach(section => {

                // Check if this section has subtasks

                if (section.subtasks && section.subtasks.length > 0) {

                    section.subtasks.forEach(subtask => {

                        // Check if this subtask is the dashboard task
                        if (typeof subtask === 'object' && String(subtask.taskId) === String(taskId)) {
                            subtask.completed = completionStatus === 'done' ? true : completionStatus;
                            subtasksUpdated++;
                        }

                    });

                }

            });

        }

    });

    // Save the updated data
    saveCalendarData();

    // Refresh the calendar UI to show the updated completion state
    if (selectedDate) {
        updateBottomSection(selectedDate);
    } else {
    }

    // Sync to backend API to ensure persistence
    if (typeof fetch === 'function') {
        fetch('/api/update_task_completion', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                taskId: taskId,
                completed: true
            })
        }).then(response => response.json())
        .then(data => {
        })
        .catch(error => {
            console.error('❌ Error syncing task completion to backend:', error);
        });
    } else {
    }

}

function markTaskExpiredInCalendar(taskId) {

    // Update backend task status cache with timeout status
    window.backendTaskStatuses = window.backendTaskStatuses || {};
    window.backendTaskStatuses[taskId] = {
        completed: false,
        status: 'timeout',
        timer_expired: true
    };

    // Update all occurrences of this task in dateContent
    let subtasksUpdated = 0;
    Object.keys(dateContent).forEach(dateStr => {
        if (dateContent[dateStr] && dateContent[dateStr].timestamps) {
            dateContent[dateStr].timestamps.forEach(section => {
                // Check if this section has subtasks
                if (section.subtasks && section.subtasks.length > 0) {
                    section.subtasks.forEach(subtask => {
                        // Check if this subtask is the dashboard task
                        if (typeof subtask === 'object' && String(subtask.taskId) === String(taskId)) {
                            subtask.timer_expired = true;
                            subtask.completed = false;
                            subtask.status = 'timeout';
                            subtasksUpdated++;
                        }
                    });
                }
            });
        }
    });

    // Save the updated data
    saveCalendarData();

    // Refresh the calendar UI to show the timeout state
    if (selectedDate) {
        updateBottomSection(selectedDate);
    } else {
    }

}

function removeTaskFromCalendar(taskId) {

    // Remove from backend task status cache
    if (window.backendTaskStatuses && window.backendTaskStatuses[taskId]) {
        delete window.backendTaskStatuses[taskId];
    }

    // Remove all occurrences of this task from dateContent
    let subtasksRemoved = 0;
    Object.keys(dateContent).forEach(dateStr => {
        if (dateContent[dateStr] && dateContent[dateStr].timestamps) {
            dateContent[dateStr].timestamps.forEach(section => {
                // Check if this section has subtasks
                if (section.subtasks && section.subtasks.length > 0) {
                    const originalLength = section.subtasks.length;
                    section.subtasks = section.subtasks.filter(subtask => {
                        if (typeof subtask === 'object' && subtask.taskId) {
                            return String(subtask.taskId) !== String(taskId);
                        }
                        return true;
                    });
                    const removedCount = originalLength - section.subtasks.length;
                    subtasksRemoved += removedCount;
                    if (removedCount > 0) {
                    }
                }
            });
        }
    });

    // Save the updated data
    saveCalendarData();

    // Refresh the calendar UI
    if (selectedDate) {
        updateBottomSection(selectedDate);
    } else {
    }

}

// Make function globally accessible
window.removeTaskFromCalendar = removeTaskFromCalendar;

// Make function globally accessible

window.markTaskCompletedInCalendar = markTaskCompletedInCalendar;
window.markDashboardTaskCompletedInCalendar = markTaskCompletedInCalendar;

// Test the function immediately after definition
try {
    if (typeof window.markTaskCompletedInCalendar === 'function') {
        window.markTaskCompletedInCalendar('test-id', 'test-status');
    } else {
        console.error('❌ Function is not callable after exposure');
    }
} catch (error) {
    console.error('❌ Error calling function:', error);
}

// Handle task input keypress
function handleTaskInputKeypress(event) {
    if (event.key === 'Enter') {
        const taskInput = document.getElementById('taskInput');
        if (taskInput && taskInput.value.trim() !== '') {
            addTaskSection(taskInput.value.trim());
            taskInput.value = '';
        }
    }
}

// Make function globally accessible
window.handleTaskInputKeypress = handleTaskInputKeypress;

// Month date keys are unpadded ("2026-7-4"); the shared day-focus store keys by
// real ISO dates ("2026-07-04"). Normalize before any DayFocus call.
function dayFocusIso(dateStr) {
    var p = String(dateStr).split('-');
    if (p.length !== 3) return dateStr;
    return p[0] + '-' + ('0' + p[1]).slice(-2) + '-' + ('0' + p[2]).slice(-2);
}

// Keep the Month view's "Today's focus…" field live-synced when the shared
// day-focus (day-focus.js) changes in another view or hydrates from the server.
document.addEventListener('dayfocuschange', function () {
    document.querySelectorAll('.daily-focus-input').forEach(function (inp) {
        if (inp !== document.activeElement && inp.dataset.iso && window.DayFocus) {
            inp.value = window.DayFocus.get(inp.dataset.iso);
        }
    });
});
