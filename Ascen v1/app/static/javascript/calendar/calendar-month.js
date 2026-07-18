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
];
function nextEventColorIndex() {
    let n = 0;
    try { n = parseInt(localStorage.getItem('eventColorCounter') || '0', 10) || 0; } catch (e) { /* ignore */ }
    try { localStorage.setItem('eventColorCounter', String(n + 1)); } catch (e) { /* ignore */ }
    return n % EVENT_COLOR_PALETTE.length;
}
// Colour index for an event. Events created before colour coding have no
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
    // browns (warm, muted, darker)
    [22, 0.55, 0.34], [28, 0.45, 0.40], [33, 0.50, 0.30], [16, 0.42, 0.38], [30, 0.35, 0.46], [25, 0.60, 0.44],
    // greys (near-zero saturation, light → dark)
    [30, 0.05, 0.45], [30, 0.05, 0.56], [210, 0.06, 0.50], [210, 0.05, 0.64], [30, 0.05, 0.70],
    // oranges
    [30, 0.85, 0.55], [38, 0.80, 0.52], [23, 0.78, 0.50], [43, 0.75, 0.58],
    // greens
    [95, 0.45, 0.45], [120, 0.42, 0.42], [140, 0.45, 0.40], [105, 0.55, 0.50], [150, 0.34, 0.46], [82, 0.50, 0.48],
    // reds shifted off the task red (brick / rose)
    [8, 0.60, 0.45], [12, 0.55, 0.52], [350, 0.42, 0.46],
    // yellows shifted off the task yellow (mustard / gold)
    [48, 0.68, 0.48], [52, 0.60, 0.55], [45, 0.55, 0.44],
    // blues shifted off the task blue (steel / indigo)
    [200, 0.50, 0.48], [225, 0.45, 0.52], [210, 0.42, 0.42], [235, 0.34, 0.56]
];
// Task-difficulty colours (blue / yellow / red) events must stay distinct from.
const TASK_RGB = [[56, 132, 255], [245, 196, 92], [240, 90, 95]];
function rgbDist2(a, b) { const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2]; return dr * dr + dg * dg + db * db; }
// Pick the family colour furthest (in RGB) from every colour already in use and
// from the task colours → each new event is a good amount different.
function generateDistinctColor() {
    const avoid = (window.eventColorsUsed || []).map(hexToRgbArr).filter(Boolean).concat(TASK_RGB);
    let best = null, bestScore = -1;
    for (const c of EVENT_HSL_CANDIDATES) {
        const rgb = hslToRgb(c[0], c[1], c[2]);
        let minD = Infinity;
        for (const a of avoid) { const d = rgbDist2(rgb, a); if (d < minD) minD = d; }
        if (minD > bestScore) { bestScore = minD; best = rgb; }
    }
    if (!best) best = hslToRgb(30, 0.5, 0.45);
    return rgbToHex(best[0], best[1], best[2]);
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



    const savedData = localStorage.getItem('calendarData');



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



    const hiddenData = localStorage.getItem('hiddenPlaceholderTasks');



    if (hiddenData) {



        try {



            const parsed = JSON.parse(hiddenData);



            Object.assign(hiddenPlaceholderTasks, parsed);



        } catch (e) {



            console.error('Error loading hidden placeholder tasks:', e);



        }



    }



    



    // Load dashboard tasks data



    const dashboardData = localStorage.getItem('dashboardTasks');



    if (dashboardData) {



        try {



            const parsed = JSON.parse(dashboardData);



            dashboardTasks.length = 0;



            dashboardTasks.push(...parsed);



        } catch (e) {



            console.error('Error loading dashboard tasks:', e);



        }



    }



    



    console.log('Calendar data loaded successfully');



}







function migrateAllSubtasks() {



    let migrated = false;



    Object.keys(dateContent).forEach(dateStr => {



        const content = dateContent[dateStr];



        if (content && content.timestamps) {



            content.timestamps.forEach(section => {



                if (section.subtasks && section.subtasks.length > 0) {



                    section.subtasks.forEach((subtask, subIndex) => {



                        if (typeof subtask === 'string') {



                            section.subtasks[subIndex] = {



                                text: subtask,



                                xp: 10 // Default XP for migrated subtasks



                            };



                            migrated = true;



                            console.log('Migrated string subtask to object:', subtask);



                        }



                    });



                }



            });



        }



    });



    



    if (migrated) {



        saveCalendarData();



        console.log('Migration completed and saved');



    }



}







// Save calendar data to localStorage



function saveCalendarData() {



    // Filter out empty subtasks before saving



    const cleanedDateContent = {};



    Object.keys(dateContent).forEach(dateStr => {



        if (dateContent[dateStr] && dateContent[dateStr].timestamps) {



            cleanedDateContent[dateStr] = {



                timestamps: dateContent[dateStr].timestamps.map(ts => {



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



    



    localStorage.setItem('calendarData', JSON.stringify(cleanedDateContent));



    localStorage.setItem('hiddenPlaceholderTasks', JSON.stringify(hiddenPlaceholderTasks));



    localStorage.setItem('dashboardTasks', JSON.stringify(dashboardTasks));



}







// Reset calendar data to defaults



function resetCalendarData() {



    localStorage.removeItem('calendarData');



    localStorage.removeItem('hiddenPlaceholderTasks');



    localStorage.removeItem('dashboardTasks');



    Object.keys(dateContent).forEach(key => {



        delete dateContent[key];



    });



    hiddenPlaceholderTasks.permanentlyDeleted = [];



    hiddenPlaceholderTasks.timePeriodDeletions = [];



    hiddenPlaceholderTasks.dayOfMonthDeletions = [];



    hiddenPlaceholderTasks.dayOfWeekDeletions = [];



    dashboardTasks.length = 0;



    console.log('Calendar data reset to defaults');



}







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







// Calculate daily intensity based on task difficulty and number of tasks



// Intensity is based ONLY on dashboard tasks (tasks with due dates from backend)



// Formula: (total_task_difficulty / 10) * number_of_tasks



// It is NOT affected by subtasks or manual calendar tasks



// Intensity decreases as tasks are completed



function calculateDailyIntensity(dateStr) {



    console.log('calculateDailyIntensity called for date:', dateStr);



    



    // Parse the dateStr to normalize it (handle both "2026-5-26" and "2026-05-26" formats)



    const dateParts = dateStr.split('-').map(Number);



    const targetDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);



    targetDate.setHours(0, 0, 0, 0); // Normalize to midnight



    



    const tasksForDay = dashboardTasks.filter(task => {



        if (!task.due_date) return false;



        const dueDate = new Date(task.due_date);



        dueDate.setHours(0, 0, 0, 0); // Normalize to midnight



        



        // Compare dates by year, month, and day



        return dueDate.getFullYear() === targetDate.getFullYear() &&



               dueDate.getMonth() === targetDate.getMonth() &&



               dueDate.getDate() === targetDate.getDate();



    });



    



    console.log('Tasks for day:', tasksForDay);



    



    if (tasksForDay.length === 0) {



        console.log('No tasks for this day, returning 0%');



        return { taskCount: 0, avgXP: 0, percentage: 0 };



    }



    



    const totalXP = tasksForDay.reduce((sum, task) => sum + (task.xp || task.xp_reward || 0), 0);



    const avgXP = totalXP / tasksForDay.length;



    



    // Calculate intensity percentage using formula: (total_task_difficulty / 10) * number_of_tasks



    const currentPercentage = (totalXP / 10) * tasksForDay.length;



    const roundedPercentage = Math.min(Math.round(currentPercentage), 100);



    



    console.log('Total XP:', totalXP, 'Task count:', tasksForDay.length, 'Calculated percentage:', roundedPercentage);



    



    return {



        taskCount: tasksForDay.length,



        avgXP: Math.round(avgXP),



        percentage: roundedPercentage



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

// A day's task intensity for the calendar marker (0 = no colour). Based purely on
// the real workload: the XP-weighted difficulty of dashboard tasks due that day
// (plus no-due-date tasks created that day). Events never contribute, so adding
// an event anywhere never changes a date's colour. Higher value -> darker blue.
// Count dashboard tasks that have no due date and were created on `dateStr`.
// These live on their creation day (start time = when they were made), so the
// day needs to reflect them even though calculateDailyIntensity is due-date based.
function countNoDueDateTasksOn(dateStr) {
    return dashboardTasks.filter(task => {
        if (task.due_date || !task.created_at) return false;
        const c = new Date(task.created_at);
        if (isNaN(c.getTime())) return false;
        return `${c.getFullYear()}-${c.getMonth() + 1}-${c.getDate()}` === dateStr;
    }).length;
}

function getDayTaskIntensity(dateStr) {
    // XP-weighted difficulty of real dashboard tasks due that day.
    const dash = calculateDailyIntensity(dateStr);
    let pct = dash.taskCount > 0 ? dash.percentage : 0;
    // Events do NOT affect a day's intensity — only real tasks (and their XP-
    // weighted difficulty) do, so adding an event never darkens a date.
    // No-due-date tasks pop on their creation day too.
    pct += countNoDueDateTasksOn(dateStr) * 20;
    return Math.min(pct, 100);
}







// Add a dashboard task to the calendar



function addDashboardTaskToCalendar(task) {



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



            console.log('Adding dashboard task subtask with XP:', taskXP, 'for task:', task.name, 'Task object:', JSON.stringify(task));



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



            console.log('Adding dashboard task subtask (fallback) with XP:', taskXP, 'for task:', task.name, 'Task object:', JSON.stringify(task));



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



function clearAllDashboardTasks() {



    dashboardTasks.length = 0;



    



    Object.keys(dateContent).forEach(dateStr => {



        if (dateContent[dateStr] && dateContent[dateStr].timestamps) {



            dateContent[dateStr].timestamps = dateContent[dateStr].timestamps.filter(



                ts => !ts.isDashboardTask



            );



        }



    });



    



    saveCalendarData();



    console.log('All dashboard tasks cleared from calendar');



}







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



    console.log('Initializing calendar...');



    



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
        console.log('📅 Found stored completions from dashboard:', completedTasks);
        // Apply completions to dashboardTasks and dateContent
        completedTasks.forEach(taskId => {
            const task = dashboardTasks.find(t => String(t.id) === String(taskId));
            if (task) {
                task.completed = true;
                console.log('✅ Applied completion to dashboardTask:', task.name);
            }
            // Also update dateContent
            Object.keys(dateContent).forEach(dateStr => {
                if (dateContent[dateStr] && dateContent[dateStr].timestamps) {
                    dateContent[dateStr].timestamps.forEach(section => {
                        if (section.subtasks && section.subtasks.length > 0) {
                            section.subtasks.forEach(subtask => {
                                if (typeof subtask === 'object' && String(subtask.taskId) === String(taskId)) {
                                    subtask.completed = true;
                                    console.log('✅ Applied completion to subtask on', dateStr, ':', subtask.text);
                                }
                            });
                        }
                    });
                }
            });
        });
        // Clear the stored completions after applying
        localStorage.removeItem('completedTasks');
        console.log('📅 Cleared stored completions after applying');
        saveCalendarData();
    }



    



    console.log('Calendar data loaded. Rendering calendar...');



    



    renderCalendar(currentMonth, currentYear);



    



    console.log('Calendar rendered. Auto-selecting today\'s date...');



    



    // Auto-select today's date after calendar is fully rendered



    setTimeout(() => {



        const today = new Date();



        const dateStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;



        const dayElement = document.querySelector(`[data-date="${dateStr}"]`);



        



        if (dayElement) {



            console.log('Auto-selecting today\'s date:', dateStr);



            selectDate(dateStr, dayElement);



        } else {



            console.log('Could not find today\'s date element:', dateStr);



        }



    }, 200);



}







function renderCalendar(month, year) {



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



    



    console.log('selectDate called with dateStr:', dateStr);



    console.log('Current dashboardTasks:', dashboardTasks);



    



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



    



    // Add dashboard tasks for this date



    dashboardTasks.forEach(task => {



        if (task.due_date) {



            const dueDate = new Date(task.due_date);



            const taskDateStr = `${dueDate.getFullYear()}-${dueDate.getMonth() + 1}-${dueDate.getDate()}`;



            



            console.log('Checking task:', task.name, 'due date:', task.due_date, 'taskDateStr:', taskDateStr, 'selected dateStr:', dateStr);



            



            if (taskDateStr === dateStr) {



                const hours = dueDate.getHours();



                const minutes = dueDate.getMinutes();



                const startTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;



                



                // Format time for display (12-hour format)



                const displayHours = hours % 12 || 12;



                const ampm = hours >= 12 ? 'PM' : 'AM';



                const displayTime = `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;



                



                // Calculate end time (assume 1 hour duration)



                const endTimeDate = new Date(dueDate.getTime() + 60 * 60 * 1000);



                const endTime = `${endTimeDate.getHours().toString().padStart(2, '0')}:${endTimeDate.getMinutes().toString().padStart(2, '0')}`;



                



                // Check if this task already exists in the date (as timestamp or subtask)



                const existingTimestamp = dateContent[dateStr].timestamps.find(



                    ts => ts.isDashboardTask && ts.dashboardTaskId === task.id



                );



                



                // Also check if task already exists as a subtask



                let existingSubtask = false;



                dateContent[dateStr].timestamps.forEach(ts => {



                    if (ts.subtasks && ts.subtasks.some(st => st.taskId === task.id)) {



                        existingSubtask = true;



                    }



                });



                



                if (!existingTimestamp && !existingSubtask) {



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



                        targetEvent.subtasks.push({



                            text: `${task.name} due at ${displayTime}`,



                            xp: task.xp || task.xp_reward || task.difficulty || 0,



                            taskId: task.id



                        });



                        targetEvent.hasSubtasks = true;



                    } else if (dateContent[dateStr].timestamps.length > 0) {



                        // Fallback: add to first available event if no time match found



                        const firstEvent = dateContent[dateStr].timestamps[0];



                        if (!firstEvent.subtasks) {



                            firstEvent.subtasks = [];



                        }



                        firstEvent.subtasks.push({



                            text: `${task.name} due at ${displayTime}`,



                            xp: task.xp || task.xp_reward || task.difficulty || 0,



                            taskId: task.id



                        });



                        firstEvent.hasSubtasks = true;



                    }



                }



            }



        } else {



            // Task without due date - add to timestamp where it was created



            // Use the task's created_at timestamp if available, otherwise use current time



            const createdAt = task.created_at ? new Date(task.created_at) : new Date();



            const taskDateStr = `${createdAt.getFullYear()}-${createdAt.getMonth() + 1}-${createdAt.getDate()}`;



            



            if (taskDateStr === dateStr) {



                const hours = createdAt.getHours();



                const minutes = createdAt.getMinutes();



                



                // Format time for display (12-hour format)



                const displayHours = hours % 12 || 12;



                const ampm = hours >= 12 ? 'PM' : 'AM';



                const displayTime = `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;



                



                // Check if this task already exists as a subtask



                let existingSubtask = false;



                dateContent[dateStr].timestamps.forEach(ts => {



                    if (ts.subtasks && ts.subtasks.some(st => st.taskId === task.id)) {



                        existingSubtask = true;



                    }



                });



                



                if (!existingSubtask) {



                    // Find the event that contains this task's creation time



                    const targetEvent = findEventForTime(dateContent[dateStr].timestamps, hours, minutes);



                    



                    if (targetEvent) {



                        // Add as subtask to the matching time-based event



                        if (!targetEvent.subtasks) {



                            targetEvent.subtasks = [];



                        }



                        targetEvent.subtasks.push({



                            text: `${task.name} created at ${displayTime}`,



                            xp: task.xp || task.xp_reward || task.difficulty || 0,



                            taskId: task.id



                        });



                        targetEvent.hasSubtasks = true;



                    } else if (dateContent[dateStr].timestamps.length > 0) {



                        // Fallback: add to first available event if no time match found



                        const firstEvent = dateContent[dateStr].timestamps[0];



                        if (!firstEvent.subtasks) {



                            firstEvent.subtasks = [];



                        }



                        firstEvent.subtasks.push({



                            text: `${task.name} created at ${displayTime}`,



                            xp: task.xp || task.xp_reward || task.difficulty || 0,



                            taskId: task.id



                        });



                        firstEvent.hasSubtasks = true;



                    }



                }



            }



        }



    });



    



    // Check for conflicts



    checkForConflicts();



    



    // Update the bottom section with the date's content



    updateBottomSection(dateStr);

    // Refresh the month grid so the just-materialised content shows its
    // intensity tint and event dot on the calendar.
    renderCalendar(currentMonth, currentYear);



    



    console.log('Selected date:', dateStr);



}







function generateTasksForDay(dayOfWeek) {



    const taskTemplates = [



        // Sunday (0)



        [



            'Task 1: Plan the week ahead',



            'Task 2: Review weekly goals',



            'Task 3: Self-care time',



            'Task 4: Prepare for Monday'



        ],



        // Monday (1)



        [



            'Task 1: Start new project',



            'Task 2: Team standup meeting',



            'Task 3: Prioritize tasks',



            'Task 4: Set weekly objectives'



        ],



        // Tuesday (2)



        [



            'Task 1: Deep work session',



            'Task 2: Code review',



            'Task 3: Documentation update',



            'Task 4: Progress check'



        ],



        // Wednesday (3)



        [



            'Task 1: Mid-week review',



            'Task 2: Client meeting',



            'Task 3: Sprint planning',



            'Task 4: Team collaboration'



        ],



        // Thursday (4)



        [



            'Task 1: Feature development',



            'Task 2: Bug fixing',



            'Task 3: Testing session',



            'Task 4: Code optimization'



        ],



        // Friday (5)



        [



            'Task 1: Weekly wrap-up',



            'Task 2: Deploy changes',



            'Task 3: Team retrospective',



            'Task 4: Plan weekend work'



        ],



        // Saturday (6)



        [



            'Task 1: Learning session',



            'Task 2: Side project work',



            'Task 3: Skill development',



            'Task 4: Rest and recharge'



        ]



    ];



    



    return taskTemplates[dayOfWeek];



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



    



    // Sort timestamps chronologically



    if (content.timestamps && content.timestamps.length > 0) {



        content.timestamps.sort((a, b) => {



            const timeA = a.startTime.split(':').map(Number);



            const timeB = b.startTime.split(':').map(Number);



            return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);



        });



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



        console.log('Setting bar width to:', percentage + '%');



    } else {



        intensityBar.style.width = '100%';



        intensityBar.style.background = '#ccc';



        intensityBar.style.display = 'flex';



        intensityBar.style.alignItems = 'center';



        intensityBar.style.justifyContent = 'center';



        intensityBar.textContent = "There's no tasks (left) to do today!";



        intensityBar.style.color = '#666';



        intensityBar.style.fontSize = '14px';



        console.log('No tasks, showing message in intensity bar');



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



    focusInput.value = content.focus || '';



    



    console.log('Focus input created with value:', content.focus);



    



    // Save focus on any change



    focusInput.addEventListener('input', (e) => {



        console.log('Focus input changed to:', e.target.value);



        content.focus = e.target.value;



        saveCalendarData();



    });



    



    focusInput.addEventListener('blur', (e) => {



        console.log('Focus input blurred, saving:', e.target.value);



        content.focus = e.target.value;



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



            



            // Tasks are colour-coded by difficulty (red/yellow/blue); events get a
            // bright colour from a varied palette that avoids the task colours.
            if (section.isDashboardTask) {
                li.classList.add('dashboard-task');
                const xp = section.xp || 0;
                if (xp >= 66) li.classList.add('priority-high');
                else if (xp >= 33) li.classList.add('priority-medium');
                else li.classList.add('priority-low');
            } else {
                // Events are colour-coded per identity: one colour per event,
                // shared by all its recurrences (see EVENT_COLOR_PALETTE). The
                // tint is applied inline with !important so it beats the base
                // .calendar-event background/border rule.
                li.classList.add('calendar-event');
                const rgb = eventRgb(section);
                li.style.setProperty('background', `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.16)`, 'important');
                li.style.setProperty('border', `1px solid rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.55)`, 'important');
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



                console.log('Adding conflict class to section', index, section.startTime, '-', section.endTime);



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
            // Tasks show a tag row (Task N + difficulty pill); events have neither.
            const cardTags = (taskKindBadge || difficultyBadge)
                ? `<div class="card-tags">${taskKindBadge}${difficultyBadge}</div>` : '';



            



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
                    <input type="text" class="task-input-inline" value="${section.task}" placeholder="What will you do..." ${readonlyAttr} onchange="updateTimestamp(${index}, 'task', this.value)">
                    <div class="timestamp-section">
                        <input type="time" class="start-time" value="${section.startTime}" ${timeReadonlyAttr} onchange="updateTimestamp(${index}, 'startTime', this.value)">
                        <span>-</span>
                        <input type="time" class="end-time" value="${section.endTime}" ${timeReadonlyAttr} onchange="updateTimestamp(${index}, 'endTime', this.value)">
                    </div>
                </div>
                ${cardMenu}
                ${completedBadge}



                ${hasSubtasks ? `



                    <ul class="subtasks-list">



                        ${section.subtasks.map((subtask, subIndex) => {



                            // Handle both string and object subtasks



                            const subtaskText = typeof subtask === 'object' ? subtask.text : subtask;



                            const subtaskXP = typeof subtask === 'object' ? subtask.xp : 0;



                            const isDashboardTask = typeof subtask === 'object' && subtask.taskId;



                            



                            console.log('Subtask:', subtaskText, 'XP:', subtaskXP, 'Type:', typeof subtask);



                            



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



                            



                            console.log('Priority class for subtask:', priorityClass);



                            



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
                                    console.log('🔍 Cached backend task status:', { taskId: subtask.taskId, completed: subtaskCompleted, expired: subtaskExpired, timeout: subtaskTimeout });
                                } else {
                                    // Fallback to local subtask.completed
                                    subtaskCompleted = subtask.completed || false;
                                    subtaskExpired = subtask.timer_expired || false;
                                    subtaskTimeout = subtask.status === 'timeout';
                                    console.log('🔍 Using local subtask.completed (no cache):', { subtaskText: subtask.text, subtaskCompleted, subtaskExpired, subtaskTimeout });
                                }
                            }



                            



                            // Don't allow removing dashboard task subtasks



                            const removeButton = isDashboardTask ? '' : `<button class="remove-subtask-btn" onclick="removeSubtask(${index}, ${subIndex})">×</button>`;



                            const taskLabel = isDashboardTask ? `<span class="task-label">Task</span>` : '';



                            



                            // Add XP and difficulty labels for dashboard tasks



                            const xpDifficultyLabel = isDashboardTask ? `<span class="xp-difficulty-label">${subtaskXP} XP - ${difficultyLabel}</span>` : '';



                            const subtaskInProgressBadge = subtaskTimeout && isDashboardTask ? `<span class="timeout-badge">TIME'S UP</span>` : subtaskExpired && isDashboardTask ? `<span class="expired-badge">TIME'S UP!</span>` : (!subtaskCompleted && isDashboardTask) ? `<span class="in-progress-badge">In Progress</span>` : (subtaskCompleted && isDashboardTask) ? `<span class="completed-badge">COMPLETED</span>` : '';

                            console.log("Rendering:", subtask.taskId, "completed=", subtask.completed, "subtaskCompleted=", subtaskCompleted);
                            console.log('Subtask rendering:', { subtaskText, isDashboardTask, subtaskCompleted, priority: priorityClass, badge: subtaskInProgressBadge });



                            



                            const finalClass = `subtask-item ${priorityClass} ${subtaskTimeout ? 'task-timeout' : (subtaskExpired ? 'task-expired' : (subtaskCompleted ? 'task-completed' : 'task-in-progress'))}`;



                            console.log('Final subtask class:', finalClass, 'Badge:', subtaskInProgressBadge);



                            



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



            console.log('Cannot remove dashboard task subtask');



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



            console.log('Cannot edit dashboard task subtask');



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



    



    console.log('Checking conflicts for', timestamps.length, 'sections');



    



    // Check if any section has same start and end time



    timestamps.forEach(section => {



        if (section.startTime === section.endTime) {



            section.hasConflict = true;



            console.log('*** SAME START/END TIME DETECTED ***', section.startTime);



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



            



            console.log(`Comparing section ${i} (${section1.startTime}-${section1.endTime}) with section ${j} (${section2.startTime}-${section2.endTime})`);



            



            // Only mark as conflict if timeframes are identical (same start AND same end)



            if (start1 === start2 && end1 === end2) {



                section1.hasConflict = true;



                section2.hasConflict = true;



                console.log('*** IDENTICAL TIMEFRAME DETECTED ***');



            }



        }



    }



    



    console.log('Conflict check complete. Conflicts:', timestamps.map((s, i) => i + ': ' + (s.hasConflict ? 'YES' : 'NO')).join(', '));



}







function addTaskSection() {



    if (!selectedDate || !dateContent[selectedDate]) return;



    



    // Show the modal instead of immediately adding



    openAddSectionModal();

    // Month calendar → default to monthly recurrence on the selected date.
    applyDefaultRecurrence('monthly');



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



}

// Default the Add-Event recurrence to match the view it was opened from: weekly
// on the week calendar, monthly on the month calendar. The current day is pre-
// selected so the recurrence is valid, and the matching options panel is shown.
function applyDefaultRecurrence(type) {
    document.querySelectorAll('input[name="recurrenceType"]').forEach(function (r) { r.checked = (r.value === type); });
    document.getElementById('weeklyOptions').style.display = (type === 'weekly') ? 'block' : 'none';
    document.getElementById('monthlyOptions').style.display = (type === 'monthly') ? 'block' : 'none';
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







// Minutes between two "HH:MM" times, wrapping past midnight. Used to enforce a
// 15-minute minimum event duration (also catches equal start/end = 0 minutes).
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
// Refresh the suggestion / overlap line under the Add-Event time pickers.
function updateEventSuggestion() {
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



    



    console.log('Confirm add section:', { timeframeName, startTime, endTime, recurrenceType, selectedDate });



    console.log('Current timestamps before add:', dateContent[selectedDate].timestamps);



    



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



    



    if (eventDurationMinutes(startTime, endTime) < 15) {



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



    



    console.log('Selected days for recurrence:', selectedDays);



    



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



        console.log('Selected date day of week:', selectedDayOfWeek, 'matches:', selectedDateMatches);



    } else if (recurrenceType === 'monthly') {



        const selectedDayOfMonth = selectedDateParts[2];



        selectedDateMatches = selectedDays.includes(selectedDayOfMonth);



        console.log('Selected date day of month:', selectedDayOfMonth, 'matches:', selectedDateMatches);



    }



    



    // Clamp: an event can't overlap another event or on-calendar task on its day.
    // Block the add and point the user at the closest free slot. (Only the primary
    // date is checked; recurrences follow from it.)
    var _evBusy = eventBusyIntervals(selectedDate, null);
    var _evS = hmToMinutes(startTime), _evE = hmToMinutes(endTime); if (_evE <= _evS) _evE += 1440;
    if (eventOverlapLabel(_evS, _evE, _evBusy)) {
        updateEventSuggestion();
        ['startHour', 'startMinute', 'endHour', 'endMinute'].forEach(function (id) {
            document.getElementById(id).classList.add('invalid-input');
        });
        return;
    }

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



        console.log('Added section to selected date');



    } else {



        console.log('Did not add section to selected date (does not match recurrence pattern)');



    }



    



    console.log('Current timestamps after push:', dateContent[selectedDate].timestamps);



    



    // If recurrence is set, add to other dates



    if (recurrenceType !== 'none' && selectedDays.length > 0) {



        console.log('Calling addRecurringSections with:', recurrenceType, selectedDays);



        addRecurringSections(newSection, recurrenceType, selectedDays);



    } else {



        console.log('Not adding recurring sections. recurrenceType:', recurrenceType, 'selectedDays.length:', selectedDays.length);



    }



    



    console.log('Current timestamps after recurrence:', dateContent[selectedDate].timestamps);



    



    // Check for conflicts



    checkForConflicts();



    



    // Update the UI



    updateBottomSection(selectedDate);



    



    console.log('Final timestamps after UI update:', dateContent[selectedDate].timestamps);



    



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



    



    console.log('Adding recurring sections:', { recurrenceType, selectedDays, startYear, startMonth });



    



    // Calculate end date (12 months from start)



    const endDate = new Date(startYear, startMonth - 1 + 12, 0);



    const endYear = endDate.getFullYear();



    const endMonth = endDate.getMonth() + 1;



    



    console.log('Recurrence period:', { startYear, startMonth, endYear, endMonth });



    



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



                            console.log(`Skipping selected date ${dateStr} in addRecurringSections`);



                            continue;



                        }



                        



                        // Log existing timestamps before adding



                        const beforeCount = dateContent[dateStr] ? dateContent[dateStr].timestamps.length : 0;



                        console.log(`Date ${dateStr} before: ${beforeCount} tasks`);



                        



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



                            console.log('Added weekly recurring section to:', dateStr);



                            addedCount++;



                            



                            // Log after adding



                            const afterCount = dateContent[dateStr].timestamps.length;



                            console.log(`Date ${dateStr} after: ${afterCount} tasks`);



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



                        console.log(`Skipping selected date ${dateStr} in addRecurringSections`);



                        return;



                    }



                    



                    // Log existing timestamps before adding



                    const beforeCount = dateContent[dateStr] ? dateContent[dateStr].timestamps.length : 0;



                    console.log(`Date ${dateStr} before: ${beforeCount} tasks`);



                    



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



                        console.log('Added monthly recurring section to:', dateStr);



                        addedCount++;



                        



                        // Log after adding



                        const afterCount = dateContent[dateStr].timestamps.length;



                        console.log(`Date ${dateStr} after: ${afterCount} tasks`);



                    }



                }



            });



        }



    }



    



    console.log('Finished adding recurring sections. Total added:', addedCount);



    console.log('Total dates in dateContent:', Object.keys(dateContent).length);



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



    console.log('Deleted placeholder task permanently:', section.task);



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



                console.log('Deleted placeholder task from:', dateStr);



            }



        }



    });



    console.log('Deleted placeholder task for', months, 'months:', section.task);



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



                            console.log('Deleted placeholder task from:', dateStr);



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



                            console.log('Deleted placeholder task from:', dateStr);



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



    



    console.log('Confirm edit section:', { timeframeName, startTime, endTime, recurrenceType, selectedDate, editingSectionIndex });



    console.log('Current timestamps before edit:', dateContent[selectedDate].timestamps);



    



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



    



    if (eventDurationMinutes(startTime, endTime) < 15) {



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



    



    console.log('Old section data:', { oldTask, oldStartTime, oldEndTime, oldRecurrence });



    



    // Update the section



    dateContent[selectedDate].timestamps[editingSectionIndex].task = timeframeName;



    dateContent[selectedDate].timestamps[editingSectionIndex].startTime = startTime;



    dateContent[selectedDate].timestamps[editingSectionIndex].endTime = endTime;



    dateContent[selectedDate].timestamps[editingSectionIndex].recurrence = recurrenceType;



    dateContent[selectedDate].timestamps[editingSectionIndex].recurrenceDays = selectedDays;



    



    console.log('Current timestamps after update:', dateContent[selectedDate].timestamps);



    



    // Only remove old recurring instances if the old section had recurrence



    if (oldRecurrence && oldRecurrence !== 'none') {



        console.log('Removing old recurring instances...');



        removeOldRecurringInstances(oldTask, oldStartTime, oldEndTime);



    } else {



        console.log('Not removing old recurring instances (old recurrence was none)');



    }



    



    // If recurrence is changed to none, remove the section from the current date as well



    if (oldRecurrence !== 'none' && recurrenceType === 'none') {



        console.log('Removing section from current date since recurrence changed to none');



        dateContent[selectedDate].timestamps.splice(editingSectionIndex, 1);



    }



    // If recurrence is set, add to other dates



    else if (recurrenceType !== 'none' && selectedDays.length > 0) {



        console.log('Adding new recurring instances...');



        addRecurringSections(dateContent[selectedDate].timestamps[editingSectionIndex], recurrenceType, selectedDays);



    }



    



    // Check for conflicts



    checkForConflicts();



    



    // Update the UI



    updateBottomSection(selectedDate);



    



    console.log('Final timestamps after UI update:', dateContent[selectedDate].timestamps);



    



    // Save to localStorage



    saveCalendarData();



    



    // Close the modal



    closeEditSectionModal();



}







function removeOldRecurringInstances(taskName, startTime, endTime) {



    // Remove instances of this specific task from all dates



    console.log('Removing old recurring instances:', { taskName, startTime, endTime });



    



    Object.keys(dateContent).forEach(dateStr => {



        if (dateStr === selectedDate) return; // Skip the current date



        



        if (dateContent[dateStr] && dateContent[dateStr].timestamps) {



            const beforeCount = dateContent[dateStr].timestamps.length;



            



            // Filter out only the matching task instances



            dateContent[dateStr].timestamps = dateContent[dateStr].timestamps.filter(ts => {



                const isMatch = ts.task === taskName && ts.startTime === startTime && ts.endTime === endTime;



                if (isMatch) {



                    console.log('Removed old recurring instance from:', dateStr);



                }



                return !isMatch;



            });



            



            const afterCount = dateContent[dateStr].timestamps.length;



            if (beforeCount !== afterCount) {



                console.log(`Date ${dateStr}: ${beforeCount} -> ${afterCount} tasks`);



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
// THIS browser, so account tasks (including ones with due dates and completed
// ones) never appeared on the calendar. Merging them in makes due-date tasks
// show on their day, count in Day Completion Progress, and carry their completed
// state. Additive: existing localStorage tasks are kept; backend tasks are added
// by id only if not already present. Backend fields are mapped to the shape the
// calendar expects (title->name, xp_value->xp_reward, status->completed).
async function loadBackendTasksIntoCalendar() {
    const username = localStorage.getItem('currentUser') || 'Default';
    try {
        const res = await fetch('/api/tasks?username=' + encodeURIComponent(username));
        const data = await res.json();
        if (!data || !data.success || !Array.isArray(data.tasks)) return;

        const existing = new Set(dashboardTasks.map(t => String(t.id)));
        let added = 0;
        data.tasks.forEach(t => {
            const isDone = t.status === 'done';
            // Seed the completion cache so the render shows completed state
            // without a per-task status fetch.
            window.backendTaskStatuses[t.id] = { completed: isDone, status: t.status };

            // Respect an explicit opt-out; otherwise show it on the calendar.
            if (t.show_on_calendar === false) return;
            if (existing.has(String(t.id))) return;

            dashboardTasks.push({
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
            });
            existing.add(String(t.id));
            added++;
        });
        console.log('📅 Merged backend tasks into calendar:', added, 'added of', data.tasks.length);

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
    console.log('📅 Fetching backend task statuses...');
    try {
        // Get all task IDs from dashboardTasks
        const taskIds = dashboardTasks.map(t => t.id);
        
        if (taskIds.length === 0) {
            console.log('📅 No tasks to fetch statuses for');
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
                    console.log('📅 Cached backend status for task:', taskId, data.completed);
                }
            } catch (error) {
                console.error('📅 Error fetching status for task:', taskId, error);
            }
        }
        
        console.log('📅 Backend task statuses cached:', Object.keys(window.backendTaskStatuses).length, 'tasks');
    } catch (error) {
        console.error('📅 Error fetching backend task statuses:', error);
    }
}

// CALENDAR.JS LOADED
console.log('📅 CALENDAR.JS FILE LOADED SUCCESSFULLY');

// Test function definition
console.log('📅 About to define markTaskCompletedInCalendar function');

// Mark dashboard task as completed in calendar

function markTaskCompletedInCalendar(taskId, completionStatus) {

    console.log("=== TASK COMPLETION RECEIVED ===");
    console.log("taskId:", taskId);
    console.log("completionStatus:", completionStatus);

    console.log('📅 === TASK MARKED AS COMPLETED IN CALENDAR ===');
    console.log('Task ID:', taskId);
    console.log('Task ID type:', typeof taskId);
    console.log('Completion Status:', completionStatus);
    console.log('Timestamp:', new Date().toISOString());

    // Update backend task status cache immediately
    window.backendTaskStatuses = window.backendTaskStatuses || {};
    window.backendTaskStatuses[taskId] = {
        completed: completionStatus === 'done',
        status: completionStatus
    };
    console.log('📅 Updated backend task status cache:', { taskId, completed: window.backendTaskStatuses[taskId].completed });

    console.log('Current dashboardTasks:', dashboardTasks);
    console.log('DashboardTasks length:', dashboardTasks.length);
    console.log('Current dashboardTasks IDs:', dashboardTasks.map(t => ({ id: t.id, name: t.name, idType: typeof t.id })));
    console.log('Looking for task ID:', taskId, 'Type:', typeof taskId);

    console.log('Current dateContent keys:', Object.keys(dateContent));

    // If dashboardTasks is empty, store the completion in localStorage for when calendar loads
    if (dashboardTasks.length === 0) {
        console.log('⚠️ dashboardTasks is empty - storing completion in localStorage for calendar page');
        const completedTasks = JSON.parse(localStorage.getItem('completedTasks') || '[]');
        if (!completedTasks.includes(taskId)) {
            completedTasks.push(taskId);
            localStorage.setItem('completedTasks', JSON.stringify(completedTasks));
            console.log('✅ Stored task completion in localStorage:', taskId);
        }
        return;
    }

    

    // Find the task in dashboardTasks array
    const task = dashboardTasks.find(t => {
        console.log('Comparing IDs:', t.id, 'vs', taskId, 'Types:', typeof t.id, typeof taskId, 'Match:', String(t.id) === String(taskId));
        return String(t.id) === String(taskId);
    });

    if (!task) {

        console.log('❌ ERROR: Task not found in dashboardTasks:', taskId);

        return;

    }

    console.log('✅ Task found:', task.name, 'Previous completed status:', task.completed);

    

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

    console.log('✅ Task marked as completed in dashboardTasks array with status:', completionStatus);

    

    // Update all occurrences of this task in dateContent

    let subtasksUpdated = 0;

    Object.keys(dateContent).forEach(dateStr => {

        if (dateContent[dateStr] && dateContent[dateStr].timestamps) {

            dateContent[dateStr].timestamps.forEach(section => {

                // Check if this section has subtasks

                if (section.subtasks && section.subtasks.length > 0) {

                    section.subtasks.forEach(subtask => {

                        // Check if this subtask is the dashboard task
                        console.log("Comparing:", subtask.taskId, typeof subtask.taskId, "vs", taskId, typeof taskId);
                        if (typeof subtask === 'object' && String(subtask.taskId) === String(taskId)) {
                            console.log('🎯 Found matching subtask:', subtask.text, 'Current completed:', subtask.completed);
                            subtask.completed = completionStatus === 'done' ? true : completionStatus;
                            console.log("UPDATED SUBTASK:", subtask.taskId, subtask.completed);
                            subtasksUpdated++;
                            console.log(`✅ Marked subtask as completed on ${dateStr}:`, subtask.text, 'New Status:', subtask.completed);
                        }

                    });

                }

            });

        }

    });

    console.log('✅ Total subtasks updated:', subtasksUpdated);

    console.log("=== UPDATED dateContent ===");
    console.log(JSON.stringify(dateContent, null, 2));

    

    // Save the updated data
    saveCalendarData();

    console.log('Data saved to localStorage');

    // Refresh the calendar UI to show the updated completion state
    if (selectedDate) {
        console.log('🔄 Refreshing calendar UI for selected date:', selectedDate);
        updateBottomSection(selectedDate);
    } else {
        console.log('No date selected, skipping calendar UI refresh');
    }

    console.log('✅ === TASK COMPLETION SYNC COMPLETE ===');

    // Sync to backend API to ensure persistence
    if (typeof fetch === 'function') {
        console.log('📤 Syncing task completion to backend API');
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
            console.log('✅ Task completion synced to backend:', data);
        })
        .catch(error => {
            console.error('❌ Error syncing task completion to backend:', error);
        });
    } else {
        console.log('⚠️ Fetch not available, skipping backend sync');
    }

}

function markTaskExpiredInCalendar(taskId) {
    console.log("=== TASK TIMER EXPIRED IN CALENDAR ===");
    console.log("taskId:", taskId);
    console.log("Timestamp:", new Date().toISOString());

    // Update backend task status cache with timeout status
    window.backendTaskStatuses = window.backendTaskStatuses || {};
    window.backendTaskStatuses[taskId] = {
        completed: false,
        status: 'timeout',
        timer_expired: true
    };
    console.log('📅 Updated backend task status cache with timeout status:', { taskId, status: 'timeout' });

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
                            console.log('🎯 Found matching subtask for timeout:', subtask.text);
                            subtask.timer_expired = true;
                            subtask.completed = false;
                            subtask.status = 'timeout';
                            subtasksUpdated++;
                            console.log(`✅ Marked subtask as timeout on ${dateStr}:`, subtask.text);
                        }
                    });
                }
            });
        }
    });

    console.log('✅ Total subtasks marked as timeout:', subtasksUpdated);

    // Save the updated data
    saveCalendarData();
    console.log('Data saved to localStorage');

    // Refresh the calendar UI to show the timeout state
    if (selectedDate) {
        console.log('🔄 Refreshing calendar UI for selected date:', selectedDate);
        updateBottomSection(selectedDate);
    } else {
        console.log('No date selected, skipping calendar UI refresh');
    }

    console.log('✅ === TASK TIMEOUT SYNC COMPLETE ===');
}

function removeTaskFromCalendar(taskId) {
    console.log("=== REMOVING TASK FROM CALENDAR ===");
    console.log("taskId:", taskId);
    console.log("Timestamp:", new Date().toISOString());

    // Remove from backend task status cache
    if (window.backendTaskStatuses && window.backendTaskStatuses[taskId]) {
        delete window.backendTaskStatuses[taskId];
        console.log('📅 Removed task from backend status cache:', taskId);
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
                        console.log(`✅ Removed ${removedCount} subtask(s) from ${dateStr}`);
                    }
                }
            });
        }
    });

    console.log('✅ Total subtasks removed:', subtasksRemoved);

    // Save the updated data
    saveCalendarData();
    console.log('Data saved to localStorage');

    // Refresh the calendar UI
    if (selectedDate) {
        console.log('🔄 Refreshing calendar UI for selected date:', selectedDate);
        updateBottomSection(selectedDate);
    } else {
        console.log('No date selected, skipping calendar UI refresh');
    }

    console.log('✅ === TASK REMOVAL FROM CALENDAR COMPLETE ===');
}

// Make function globally accessible
console.log('📅 About to expose removeTaskFromCalendar to global scope');
window.removeTaskFromCalendar = removeTaskFromCalendar;
console.log('📅 Function removeTaskFromCalendar exposed successfully');

console.log('📅 Function markTaskCompletedInCalendar defined successfully. typeof:', typeof markTaskCompletedInCalendar);

// Make function globally accessible

console.log('📅 About to expose markTaskCompletedInCalendar to global scope');
window.markTaskCompletedInCalendar = markTaskCompletedInCalendar;
window.markDashboardTaskCompletedInCalendar = markTaskCompletedInCalendar;
console.log('📅 Function exposed successfully. typeof window.markTaskCompletedInCalendar:', typeof window.markTaskCompletedInCalendar);
console.log('📅 Function itself:', window.markTaskCompletedInCalendar);

// Test the function immediately after definition
console.log('🧪 Testing markTaskCompletedInCalendar function immediately...');
try {
    if (typeof window.markTaskCompletedInCalendar === 'function') {
        console.log('✅ Function is callable, calling with test data...');
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











