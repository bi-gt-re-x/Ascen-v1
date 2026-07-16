// Dashboard JavaScript

// --- Main Dashboard Logic ---

let currentUser = localStorage.getItem('currentUser') || 'Default';

let xp = 0;

let level = 1;

let xpRequired = 100;

let tasksCompleted = 0;



// Theming (light/dark) is handled globally by theme.js — sourced from users.json.

document.addEventListener('DOMContentLoaded', function () {
    // Start the XP bar at its last-known width instantly (no animation) so the
    // page doesn't render a placeholder then visibly readjust once data loads.
    try {
        var bar = document.getElementById('xpBarFill');
        var pct = localStorage.getItem('xpPct_' + (localStorage.getItem('currentUser') || 'Default'));
        if (bar && pct !== null) {
            bar.style.transition = 'none';
            bar.style.width = pct + '%';
            void bar.offsetWidth;
            bar.style.transition = '';
        }
    } catch (e) {}
});

// Set initial theme

document.addEventListener('DOMContentLoaded', async () => {

    console.log('=== DASHBOARD INITIALIZATION START ===');
    console.log('Current user from localStorage:', currentUser);

    // ... rest of init logic

    // Fetch the daily quote in the background — don't await it, so it never
    // delays the stats/XP bar and task list from loading.
    if (typeof fetchDailyQuoteAPI === 'function') {
        fetchDailyQuoteAPI().then((quoteData) => {
            const el = document.getElementById('dailyQuote');
            if (!el) return;
            el.textContent = quoteData
                ? `"${quoteData.content}" - ${quoteData.author}`
                : '"The secret of getting ahead is getting started." - Mark Twain';
        }).catch(() => {});
    }



    console.log('Checking if user is not Default:', currentUser !== 'Default');

    if (currentUser !== 'Default') {

        console.log('Calling loadUserData() for user:', currentUser);
        await loadUserData();
        console.log('Calling loadTasks()...');
        await loadTasks();

    } else {

        console.log('User is Default, using local stats');
        console.log('Local stats values:', { xp, level, xpRequired, tasksCompleted });
        if (typeof updateStatsUI === 'function') {

            updateStatsUI(xp, level, xpRequired, tasksCompleted);

        }
    }



    // Initialize timers

    if (typeof loadTimers === 'function') {

        loadTimers();

    }



    if (currentUser !== 'Default') {



        // Check for new tasks every minute

    }



    // Everything (stats, XP bar, task list) is now in place — fade the page in
    // once as a finished piece so nothing pops in or re-adjusts after the fade.

    if (typeof window.revealPage === 'function') {

        window.revealPage();

    }

});



document.getElementById('userNameDisplay').innerText = currentUser;



async function loadUserData() {

    console.log('=== LOAD USER DATA START ===');
    console.log('getUserDataAPI exists:', typeof getUserDataAPI === 'function');

    if (typeof getUserDataAPI !== 'function') {
        console.log('ERROR: getUserDataAPI is not available');
        return;
    }

    console.log('Fetching user data for:', currentUser);
    const data = await getUserDataAPI(currentUser);
    console.log('API response:', data);



    if (data && data.success) {

        console.log('API call successful, parsing stats...');

        // Load Stats

        const totalXp = data.stats.xp;

        tasksCompleted = data.stats.tasks_completed;

        const currentStreak = data.stats.current_streak || 0;

        const bestStreak = data.stats.best_streak || 0;

        console.log('Parsed stats:', { totalXp, tasksCompleted, currentStreak, bestStreak });



        // Update streak display

        const currentStreakEl = document.getElementById('currentStreak');
        const bestStreakEl = document.getElementById('bestStreak');
        const tasksCompletedEl = document.getElementById('tasksCompleted');

        console.log('DOM elements found:', { currentStreakEl, bestStreakEl, tasksCompletedEl });

        if (currentStreakEl) currentStreakEl.textContent = currentStreak;
        if (bestStreakEl) bestStreakEl.textContent = bestStreak;
        if (tasksCompletedEl) tasksCompletedEl.textContent = tasksCompleted;

        console.log('Updated DOM elements');



        // Calculate level with infinite progression

        let calculatedLevel = 1;

        let xpNeededForLevel = 100;

        let tempXp = totalXp;



        while (tempXp >= xpNeededForLevel) {

            tempXp -= xpNeededForLevel;

            calculatedLevel++;

            xpNeededForLevel = calculatedLevel * 100;

        }



        level = calculatedLevel;

        xp = tempXp; // Current XP within current level

        xpRequired = xpNeededForLevel;



        console.log('Initial user data loaded:', {

            totalXp: totalXp,

            calculatedLevel: calculatedLevel,

            currentXpInLevel: xp,

            xpRequired: xpRequired,

            tasksCompleted: tasksCompleted,

            currentStreak: currentStreak,

            bestStreak: bestStreak

        });



        if (typeof updateStatsUI === 'function') {

            console.log('Calling updateStatsUI with:', { xp, level, xpRequired, tasksCompleted });
            updateStatsUI(xp, level, xpRequired, tasksCompleted);
            console.log('updateStatsUI completed');

        } else {

            console.log('ERROR: updateStatsUI is not a function');
        }

    } else {

        console.log('ERROR: API call failed or returned no success');
    }

    console.log('=== LOAD USER DATA END ===');

}

async function loadTasks() {
    console.log('=== LOAD TASKS START ===');
    const taskList = document.getElementById('taskList');

    if (!taskList) {
        console.log('ERROR: taskList element not found');
        return;
    }

    taskList.innerHTML = ''; // Clear existing

    // Preserve existing timer state
    const existingTimers = typeof timers !== 'undefined' ? {...timers} : {};

    // Use new getTasksAPI instead of data.tasks from getUserDataAPI
    let tasks = [];

    if (typeof getTasksAPI === 'function') {
        console.log('Fetching tasks via getTasksAPI...');
        const tasksData = await getTasksAPI(currentUser);
        if (tasksData && tasksData.success) {
            tasks = tasksData.tasks;
            console.log('Tasks loaded:', tasks.length);
        }
    } else {
        console.log('ERROR: getTasksAPI not available');
    }

    // Filter out completed tasks - only show incomplete tasks on dashboard
    const incompleteTasks = tasks.filter(task => !(task.status === 'done' || task.completed === 1 || task.completed === true || task.completed === '1'));
    console.log('Incomplete tasks:', incompleteTasks.length);

    incompleteTasks.forEach(task => {
        if (typeof createTaskElement === 'function') {
            const li = createTaskElement(task, handleTaskDeletion);
            taskList.appendChild(li);

            // Start timer with due date if available, but preserve existing timer state
            if (typeof startTaskTimer === 'function') {
                if (existingTimers[task.id]) {
                    // Timer already exists, don't reset it
                    // Just update the display
                    if (typeof updateTimerDisplay === 'function') {
                        updateTimerDisplay(task.id);
                    }
                } else if (task.due_date) {
                    startTaskTimer(task.id, null, task.due_date);
                } else if (task.timer_duration && task.timer_duration > 0) {
                    startTaskTimer(task.id, task.timer_duration);
                } else {
                    startTaskTimer(task.id);
                }
            }
        }
    });

    console.log('=== LOAD TASKS END ===');
}

// Function to restore timer-completed state after tasks are loaded

function restoreTimerCompletedState() {

    const storedTimers = localStorage.getItem('taskTimers');

    if (!storedTimers) return;



    const parsedTimers = JSON.parse(storedTimers);

    const now = Date.now();



    for (const taskId in parsedTimers) {

        const timerData = parsedTimers[taskId];



        // Check if this is a completed countdown timer

        if (

            (timerData.type === 'countdown' ||

            timerData.type === 'due_date_countdown')

            && timerData.completed

            && now >= timerData.endTime

        ) {

            const taskElement = document.getElementById(`task-${taskId}`);

            const timerDisplay = document.getElementById(`timer-${taskId}`);



            if (taskElement && timerDisplay) {

                // Set timer display to "Time's up!"

                timerDisplay.textContent = "Time's up!";



                // Add red styling and flashing animation

                taskElement.classList.add('timer-completed');



                // Move to top

                const taskList = document.getElementById('taskList');

                if (taskList && taskList.firstChild) {

                    taskList.insertBefore(taskElement, taskList.firstChild);

                }



                // Change button to Terminate/More Time

                const deleteBtn = taskElement.querySelector('.delete-btn');

                if (deleteBtn) {

                    deleteBtn.textContent = 'Terminate';

                    deleteBtn.onclick = function() {

                        if (typeof terminateTask === 'function') {

                            terminateTask(taskId);

                        }

                    };



                    // Check if More Time button already exists

                    let moreTimeBtn = taskElement.querySelector('.more-time-btn');

                    if (!moreTimeBtn) {

                        // Add More Time button only if it doesn't exist

                        moreTimeBtn = document.createElement('button');

                        moreTimeBtn.textContent = 'More Time';

                        moreTimeBtn.className = 'more-time-btn';

                        moreTimeBtn.onclick = function() {

                            if (typeof addMoreTime === 'function') {

                                addMoreTime(taskId);

                            }

                        };



                        const taskRight = taskElement.querySelector('.task-right');

                        if (taskRight) {

                            taskRight.insertBefore(moreTimeBtn, deleteBtn);

                        }

                    }

                }

            }

        }

    }

}





function resetRecurrenceOptions() {

    // Reset all options

    document.getElementById('recurrenceType').value = 'daily';

    document.getElementById('weeklyOptions').style.display = 'none';

    document.getElementById('monthlyOptions').style.display = 'none';

    document.getElementById('recurrenceEndDate').value = '';

    document.getElementById('recurrenceOccurrences').value = 10;



    // Uncheck all day checkboxes

    document.querySelectorAll('.day-checkbox').forEach(cb => cb.checked = false);



    // Populate time selectors

}



function updateRecurrenceOptions() {

    const recurrenceType = document.getElementById('recurrenceType').value;

    const weeklyOptions = document.getElementById('weeklyOptions');

    const monthlyOptions = document.getElementById('monthlyOptions');



    weeklyOptions.style.display = recurrenceType === 'weekly' ? 'block' : 'none';

    monthlyOptions.style.display = recurrenceType === 'monthly' ? 'block' : 'none';

}



function populatePopupTimeSelectors() {

    // Populate popup time selectors

    const popupHourSelect = document.getElementById('popupHour');

    const popupMinuteSelect = document.getElementById('popupMinute');



    // Populate hours (1-12)

    popupHourSelect.innerHTML = '<option value="">Hour</option>';

    for (let i = 1; i <= 12; i++) {

        const option = document.createElement('option');

        option.value = i;

        option.textContent = i;

        popupHourSelect.appendChild(option);

    }



    // Populate minutes (0-59)

    popupMinuteSelect.innerHTML = '<option value="">Minute</option>';

    for (let i = 0; i <= 59; i++) {

        const option = document.createElement('option');

        option.value = i;

        option.textContent = i.toString().padStart(2, '0');

        popupMinuteSelect.appendChild(option);

    }

    

    // Set default values to avoid showing 0

    popupHourSelect.value = '';

    popupMinuteSelect.value = '';

}



function getRecurrenceData() {

    const recurrenceType = document.getElementById('recurrenceType').value;

    const recurrenceEndDate = document.getElementById('recurrenceEndDate').value;

    const recurrenceOccurrences = parseInt(document.getElementById('recurrenceOccurrences').value) || 10;



    // Get popup time

    const popupHour = document.getElementById('popupHour').value;

    const popupMinute = document.getElementById('popupMinute').value;

    const popupAmPm = document.getElementById('popupAmPm').value;



    let recurrenceData = {

        type: recurrenceType,

        end_date: recurrenceEndDate || null,

        occurrences: recurrenceEndDate ? null : recurrenceOccurrences,

        popup_hour: popupHour || null,

        popup_minute: popupMinute || null,

        popup_ampm: popupAmPm || null

    };



    if (recurrenceType === 'weekly') {

        const selectedDays = [];

        document.querySelectorAll('.day-checkbox:checked').forEach(cb => {

            selectedDays.push(parseInt(cb.value));

        });

        if (selectedDays.length === 0) {

            alert('Please select at least one day of the week');

            return null;

        }

        recurrenceData.days_of_week = selectedDays;

    } else if (recurrenceType === 'monthly') {

        recurrenceData.day_of_month = parseInt(document.getElementById('dayOfMonth').value);

    }



    return recurrenceData;

}



// Modal Logic

const modal = document.getElementById("taskModal");

const modalName = document.getElementById("modalTaskName");

const timerHours = document.getElementById("timerHours");

const timerMinutes = document.getElementById("timerMinutes");

const xpSlider = document.getElementById("xpSlider");



// More Time Modal Logic

let currentTaskIdForMoreTime = null;



function openMoreTimeModal(taskId) {

    currentTaskIdForMoreTime = taskId;

    const moreTimeModal = document.getElementById("moreTimeModal");

    moreTimeModal.style.display = "block";



    // Reset sliders and input boxes

    document.getElementById('moreTimeHours').value = 0;

    document.getElementById('moreTimeHoursInput').value = 0;

    document.getElementById('moreHoursVal').textContent = '0';

    document.getElementById('moreTimeMinutes').value = 5;

    document.getElementById('moreTimeMinutesInput').value = 5;

    document.getElementById('moreMinsVal').textContent = '5';

    document.getElementById('moreTimeSeconds').value = 0;

    document.getElementById('moreTimeSecondsInput').value = 0;

    document.getElementById('moreSecsVal').textContent = '0';

}



function closeMoreTimeModal() {

    const moreTimeModal = document.getElementById("moreTimeModal");

    moreTimeModal.style.display = "none";

    currentTaskIdForMoreTime = null;

}



function updateMoreTimeFromInput(type, val) {

    // Ensure value is within bounds

    val = Math.max(0, Math.min(type === 'hours' ? 24 : 60, parseInt(val) || 0));



    // Update slider

    if (type === 'hours') {

        const hoursSlider = document.getElementById('moreTimeHours');

        if (hoursSlider) hoursSlider.value = val;

        document.getElementById('moreHoursVal').textContent = val;

    } else if (type === 'minutes') {

        const minutesSlider = document.getElementById('moreTimeMinutes');

        if (minutesSlider) minutesSlider.value = val;

        document.getElementById('moreMinsVal').textContent = val;

    } else if (type === 'seconds') {

        const secondsSlider = document.getElementById('moreTimeSeconds');

        if (secondsSlider) secondsSlider.value = val;

        document.getElementById('moreSecsVal').textContent = val;

    }

}



function updateMoreTimeFromSlider(type, val) {

    // Ensure value is within bounds

    val = Math.max(0, Math.min(type === 'hours' ? 24 : 60, parseInt(val) || 0));



    // Update number input and display

    if (type === 'hours') {

        const hoursInput = document.getElementById('moreTimeHoursInput');

        if (hoursInput) hoursInput.value = val;

        document.getElementById('moreHoursVal').textContent = val;

    } else if (type === 'minutes') {

        const minutesInput = document.getElementById('moreTimeMinutesInput');

        if (minutesInput) minutesInput.value = val;

        document.getElementById('moreMinsVal').textContent = val;

    } else if (type === 'seconds') {

        const secondsInput = document.getElementById('moreTimeSecondsInput');

        if (secondsInput) secondsInput.value = val;

        document.getElementById('moreSecsVal').textContent = val;

    }

}



//  FIXED CODE FOR dashboard.js

// FIXED handler inside dashboard.js

function confirmMoreTime() {

    console.log("CONFIRM CLICKED");



    const hours = parseInt(document.getElementById('moreTimeHours').value) || 0;

    const minutes = parseInt(document.getElementById('moreTimeMinutes').value) || 0;

    const seconds = parseInt(document.getElementById('moreTimeSeconds').value) || 0;



    console.log({

        currentTaskIdForMoreTime,

        hours,

        minutes,

        seconds

    });

    

    // Convert inputs straight down to raw total numeric seconds

    const additionalSeconds = (hours * 3600) + (minutes * 60) + seconds;



    // Execute state patch directly using relative milliseconds to protect values from timezone jumps

    if (typeof currentTaskIdForMoreTime !== 'undefined' && currentTaskIdForMoreTime) {

        if (typeof addMoreTimeToTask === 'function') {

            addMoreTimeToTask(currentTaskIdForMoreTime, additionalSeconds);

        } else {

            console.warn("addMoreTimeToTask structure missing, updating local collection directly");

            // Direct state fallback injection if needed

        }

    }

    

    closeMoreTimeModal();

}



let currentXP = 10;

let currentDifficulty = 'low';



function toggleDropdown(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    const button = dropdown.previousElementSibling;
    
    // Close all other dropdowns first
    const allDropdowns = document.querySelectorAll('.dropdown-content');
    const allButtons = document.querySelectorAll('.dropdown-btn');
    
    allDropdowns.forEach(dd => {
        if (dd.id !== dropdownId) {
            dd.style.display = 'none';
        }
    });
    
    allButtons.forEach(btn => {
        if (btn !== button) {
            btn.classList.remove('active');
        }
    });
    
    // Toggle the clicked dropdown
    if (dropdown.style.display === 'none') {
        dropdown.style.display = 'block';
        button.classList.add('active');
    } else {
        dropdown.style.display = 'none';
        button.classList.remove('active');
    }
}

function openModal() {

    modal.style.display = "block";

    modalName.focus();

    // Reset sliders and input boxes

    timerHours.value = 0;

    document.getElementById('timerHoursInput').value = 0;

    document.getElementById('hoursVal').textContent = '0';

    timerMinutes.value = 0;

    document.getElementById('timerMinutesInput').value = 0;

    document.getElementById('minsVal').textContent = '0';



    // Reset XP slider and input

    xpSlider.value = 10;

    document.getElementById('xpInput').value = 10;

    updateXPDisplay(10);



    // Reset due date inputs

    document.getElementById('dueDate').value = '';

    document.getElementById('dueHour').value = '';

    document.getElementById('dueMinute').value = '';

    document.getElementById('dueAmPm').value = '';



    // Set minimum date to today

    const today = new Date().toISOString().split('T')[0];

    document.getElementById('dueDate').setAttribute('min', today);



    // Populate hour and minute selectors

    populateTimeSelectors();



    // Add event listeners to clear error states

    modalName.addEventListener('input', () => modalName.classList.remove('input-error'));

    document.getElementById('dueDate').addEventListener('input', () => clearErrorStates());

    document.getElementById('dueHour').addEventListener('change', () => clearErrorStates());

    document.getElementById('dueMinute').addEventListener('change', () => clearErrorStates());

    document.getElementById('dueAmPm').addEventListener('change', () => clearErrorStates());

    // Start with no due date/time, so the calendar toggle is off + locked.
    updateShowOnCalendarState();

}

// The "Show task on calendar" toggle only makes sense when the task has a due
// date/time (a task with no due date has no slot to place on the calendar).
// No due date/time -> the toggle is forced OFF and disabled; adding a due
// date/time enables it and defaults it to ON, but the user can still turn it off.
function updateShowOnCalendarState() {
    const cb = document.getElementById('showOnCalendar');
    if (!cb) return;
    const dueDate = document.getElementById('dueDate');
    const dueHour = document.getElementById('dueHour');
    const dueMinute = document.getElementById('dueMinute');
    const dueAmPm = document.getElementById('dueAmPm');
    const hasDate = !!(dueDate && dueDate.value);
    const hasTime = !!(dueHour && dueHour.value && dueMinute && dueMinute.value && dueAmPm && dueAmPm.value);
    const hasDue = hasDate || hasTime;
    const label = document.querySelector('label[for="showOnCalendar"]');
    if (hasDue) {
        if (cb.disabled) {          // was locked off -> unlock and default to yes
            cb.disabled = false;
            cb.checked = true;
        }
    } else {                        // no due date/time -> forced off + locked
        cb.checked = false;
        cb.disabled = true;
    }
    cb.style.cursor = cb.disabled ? 'not-allowed' : 'pointer';
    if (label) {
        label.style.opacity = cb.disabled ? '0.5' : '1';
        label.style.cursor = cb.disabled ? 'not-allowed' : 'pointer';
    }
}

function populateTimeSelectors() {

    const hourSelect = document.getElementById('dueHour');

    const minuteSelect = document.getElementById('dueMinute');



    // Clear existing options (except the first one)

    hourSelect.innerHTML = '<option value="">Hour</option>';

    minuteSelect.innerHTML = '<option value="">Minute</option>';



    // Populate hours (1-12)

    for (let i = 1; i <= 12; i++) {

        const option = document.createElement('option');

        option.value = i;

        option.textContent = i;

        hourSelect.appendChild(option);

    }



    // Populate minutes (0-59)

    for (let i = 0; i <= 59; i++) {

        const option = document.createElement('option');

        option.value = i;

        option.textContent = i.toString().padStart(2, '0');

        minuteSelect.appendChild(option);

    }

}



function closeModal() {

    modal.style.display = "none";

}



window.onclick = function(event) {

    if (event.target == modal) {

        closeModal();

    }

};



function updateXPDisplay(val) {

    document.getElementById('xpValue').textContent = val;

    currentXP = parseInt(val);



    // Sync with input box

    const xpInput = document.getElementById('xpInput');

    if (xpInput) {

        xpInput.value = val;

    }



    // Determine difficulty based on XP

    if (val < 33) {

        currentDifficulty = 'low';

    } else if (val < 66) {

        currentDifficulty = 'medium';

    } else {

        currentDifficulty = 'high';

    }

}



function updateXPFromInput(val) {

    // Ensure value is within bounds

    val = Math.max(10, Math.min(100, parseInt(val) || 10));



    // Update slider

    const xpSlider = document.getElementById('xpSlider');

    if (xpSlider) {

        xpSlider.value = val;

    }



    // Update display

    updateXPDisplay(val);

}



function updateTimerSliderDisplay(type, val) {

    // Ensure value is within bounds

    val = Math.max(0, Math.min(type === 'hours' ? 12 : 60, parseInt(val) || 0));



    // Update display span

    if (type === 'hours') {

        document.getElementById('hoursVal').textContent = val;

        const hoursInput = document.getElementById('timerHoursInput');

        if (hoursInput) hoursInput.value = val;

    } else if (type === 'minutes') {

        document.getElementById('minsVal').textContent = val;

        const minutesInput = document.getElementById('timerMinutesInput');

        if (minutesInput) minutesInput.value = val;

    }

}



function updateTimerFromInput(type, val) {

    // Ensure value is within bounds

    val = Math.max(0, Math.min(type === 'hours' ? 12 : 60, parseInt(val) || 0));



    // Update slider

    if (type === 'hours') {

        const hoursSlider = document.getElementById('timerHours');

        if (hoursSlider) hoursSlider.value = val;

        const hoursInput = document.getElementById('timerHoursInput');

        if (hoursInput) hoursInput.value = val;

        document.getElementById('hoursVal').textContent = val;

    } else if (type === 'minutes') {

        const minutesSlider = document.getElementById('timerMinutes');

        if (minutesSlider) minutesSlider.value = val;

        const minutesInput = document.getElementById('timerMinutesInput');

        if (minutesInput) minutesInput.value = val;

        document.getElementById('minsVal').textContent = val;

    }

}



function clearErrorStates() {

    modalName.classList.remove('input-error');

    document.getElementById('dueDate').classList.remove('input-error');

    document.getElementById('dueHour').classList.remove('input-error');

    document.getElementById('dueMinute').classList.remove('input-error');

    document.getElementById('dueAmPm').classList.remove('input-error');

}



function findNextAvailableTimeSlot(durationSeconds) {

    const now = new Date();

    const currentHour = now.getHours();



    // Define working hours (8 AM - 10 PM)

    const WORK_START_HOUR = 8;

    const WORK_END_HOUR = 22;



    // Calculate end time if we start now

    let endTime = new Date(now.getTime() + (durationSeconds * 1000));



    // If current time is before working hours, schedule for today at 8 AM

    if (currentHour < WORK_START_HOUR) {

        const today8AM = new Date(now);

        today8AM.setHours(WORK_START_HOUR, 0, 0, 0);

        endTime = new Date(today8AM.getTime() + (durationSeconds * 1000));

    }

    // If current time is after working hours, schedule for next day at 8 AM

    else if (currentHour >= WORK_END_HOUR) {

        const nextDay8AM = new Date(now);

        nextDay8AM.setDate(nextDay8AM.getDate() + 1);

        nextDay8AM.setHours(WORK_START_HOUR, 0, 0, 0);

        endTime = new Date(nextDay8AM.getTime() + (durationSeconds * 1000));

    }

    // During working hours - check if end time would go beyond working hours

    else {

        const endHour = endTime.getHours();

        if (endHour >= WORK_END_HOUR) {

            const nextDay8AM = new Date(now);

            nextDay8AM.setDate(nextDay8AM.getDate() + 1);

            nextDay8AM.setHours(WORK_START_HOUR, 0, 0, 0);

            endTime = new Date(nextDay8AM.getTime() + (durationSeconds * 1000));

        }

    }



    return endTime;

}



async function addTaskFromModal() {
    const taskList = document.getElementById('taskList');

    // Clear previous error states
    clearErrorStates();

    // Validate title
    if (modalName.value.trim() === "") {
        modalName.classList.add('input-error');
        return;
    }

    const taskId = Date.now().toString();

    // Calculate timer duration from input boxes (hours + minutes only)
    const h = Math.min(12, parseInt(document.getElementById('timerHoursInput').value) || 0);
    const m = parseInt(document.getElementById('timerMinutesInput').value) || 0;
    const totalSeconds = (h * 3600) + (m * 60);

    // Get due date information
    const dueDate = document.getElementById('dueDate');
    const dueHour = document.getElementById('dueHour');
    const dueMinute = document.getElementById('dueMinute');
    const dueAmPm = document.getElementById('dueAmPm');

    let dueDateTime = null;
    let wasAdjusted = false;

    // Handle both date+time selection and time-only selection
    if (dueHour.value && dueMinute.value && dueAmPm.value) {
        // Convert 12-hour to 24-hour format
        let hour24 = parseInt(dueHour.value);
        if (dueAmPm.value === 'PM' && hour24 !== 12) {
            hour24 += 12;
        } else if (dueAmPm.value === 'AM' && hour24 === 12) {
            hour24 = 0;
        }

        const now = new Date();
        let dueDateObj;

        if (dueDate.value) {
            // User selected both date and time
            const [year, month, day] = dueDate.value.split('-').map(Number);
            dueDateObj = new Date(year, month - 1, day, hour24, parseInt(dueMinute.value), 0, 0);

            if (dueDateObj < now) {
                dueDateObj.setDate(dueDateObj.getDate() + 1);
                wasAdjusted = true;
            }
        } else {
            // User only selected time
            dueDateObj = new Date();
            dueDateObj.setHours(hour24, parseInt(dueMinute.value), 0, 0);

            if (dueDateObj < now) {
                dueDateObj.setDate(dueDateObj.getDate() + 1);
                wasAdjusted = true;
            }
        }

        // Store in UTC by using toISOString()
        dueDateTime = dueDateObj.toISOString();

        // Show notification if time was adjusted
        if (wasAdjusted) {
            const adjustedTime = dueDateObj.toLocaleString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });

            const notification = document.createElement('div');
            notification.className = 'auto-schedule-notification';
            notification.textContent = `Time adjusted to next occurrence: ${adjustedTime}`;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #FF9800;
                color: white;
                padding: 15px 20px;
                border-radius: 5px;
                z-index: 1000;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                animation: slideIn 0.3s ease-out;
            `;
            document.body.appendChild(notification);

            setTimeout(() => {
                notification.style.animation = 'slideOut 0.3s ease-out';
                setTimeout(() => notification.remove(), 300);
            }, 5000);
        }
    } else if (dueDate.value) {
        // Date picked but no time-of-day → the task is due at 12:00 AM
        // (midnight) on exactly the day the user selected. No auto-adjust, so
        // the due date lands on that day rather than being bumped forward.
        const [year, month, day] = dueDate.value.split('-').map(Number);
        dueDateTime = new Date(year, month - 1, day, 0, 0, 0, 0).toISOString();
    }

    // --- REPAIRED STRUCTURAL ASSIGNMENT ---
    const calendarCheckbox = document.getElementById('showOnCalendar');
    const showOnCalendarValue = calendarCheckbox ? calendarCheckbox.checked : true;

    const newTask = {
        id: taskId,
        username: currentUser,
        name: modalName.value,
        priority: currentDifficulty,
        xp_reward: currentXP,
        timer_duration: dueDateTime ? 0 : totalSeconds,
        due_date: dueDateTime,
        show_on_calendar: showOnCalendarValue
    };

    console.log('Task created:', newTask);
    console.log('dueDateTime:', dueDateTime, 'totalSeconds:', totalSeconds);

    // Add to UI immediately to show due date
    if (typeof createTaskElement === 'function') {
        const li = createTaskElement(newTask, handleTaskDeletion);
        taskList.appendChild(li);
        console.log('Task element added to DOM with due date:', newTask.due_date);
    }

    // Start Timer (Client-side) with automatic scheduling
    if (typeof startTaskTimer === 'function') {
        console.log('startTaskTimer function is available');
        if (dueDateTime) {
            console.log('Starting timer with due date:', dueDateTime);
            startTaskTimer(taskId, null, dueDateTime);
        } else if (totalSeconds > 0) {
            // Find next available time slot automatically
            const endTime = findNextAvailableTimeSlot(totalSeconds);

            // Extract local date components safely
            const year = endTime.getFullYear();
            const month = String(endTime.getMonth() + 1).padStart(2, '0');
            const day = String(endTime.getDate()).padStart(2, '0');
            const hours = String(endTime.getHours()).padStart(2, '0');
            const minutes = String(endTime.getMinutes()).padStart(2, '0');
            const seconds = String(endTime.getSeconds()).padStart(2, '0');

            // Create a local ISO string without shifting the timezone
            const autoDueDateTime = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;

            // Update task with automatic due date
            newTask.due_date = autoDueDateTime;
            newTask.timer_duration = 0;

            console.log('Starting timer with auto-scheduled due date:', autoDueDateTime);
            startTaskTimer(taskId, null, autoDueDateTime);

            // Show user the scheduled time
            const scheduledTime = endTime.toLocaleString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });

            // Display notification to user
            const notification = document.createElement('div');
            notification.className = 'auto-schedule-notification';
            notification.textContent = `Task automatically scheduled for ${scheduledTime}`;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #4CAF50;
                color: white;
                padding: 15px 20px;
                border-radius: 5px;
                z-index: 1000;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                animation: slideIn 0.3s ease-out;
            `;
            document.body.appendChild(notification);

            setTimeout(() => {
                notification.style.animation = 'slideOut 0.3s ease-out';
                setTimeout(() => notification.remove(), 300);
            }, 5000);

            console.log(`Task automatically scheduled for: ${scheduledTime}`);
        } else {
            console.log('Starting count-up timer');
            startTaskTimer(taskId);
        }
    } else {
        console.log('startTaskTimer function is NOT available');
    }

    // Save to Backend
    if (currentUser !== 'Default' && typeof addTaskToBackend === 'function') {
        await addTaskToBackend(newTask);
    }

    // Sync to calendar if task has due date
    if (newTask.due_date) {
        syncTaskToCalendar(newTask);
    }

    // Tasks can't overlap: if the new task's window intersects an existing task
    // (or heavily overlaps a calendar event), force the user to delete one.
    if (currentUser !== 'Default' && newTask.due_date) {
        checkCreationConflict(newTask);
    }

    // Force refresh the task element to ensure due date is displayed
    const taskElement = document.getElementById(`task-${taskId}`);
    if (taskElement && newTask.due_date) {
        const newLi = createTaskElement(newTask, handleTaskDeletion);
        taskElement.replaceWith(newLi);
        console.log('Task element refreshed to show due date');
    }

    modalName.value = "";
    closeModal();
}



async function handleTaskDeletion(taskId, taskXP, liElement) {

    // Log the completed task's XP. The signal reaches the goals page through the
    // backend (the goals page polls /api/last_task_completion for this).
    console.log('Task Completed(' + taskXP + ' xp)');

    const taskList = document.getElementById('taskList');



    // Disable the delete button to prevent multiple clicks

    const deleteButton = liElement.querySelector('.delete-btn');

    if (deleteButton) {

        deleteButton.disabled = true;

        deleteButton.style.opacity = '0.5';

        deleteButton.style.cursor = 'not-allowed';

    }



    // Animation

    liElement.classList.add('removing');



    if (typeof stopTaskTimer === 'function') {

        stopTaskTimer(taskId);

    }



    // Remove task from DOM immediately to prevent multiple clicks
    setTimeout(() => {
        if (liElement.parentNode) {
            taskList.removeChild(liElement);
        }
    }, 520);

    // Sync with Backend - Use backend for all calculations
    if (currentUser !== 'Default') {
        // Use new growth tracking system
        const result = await trackTaskCompletion(taskId, currentUser, taskXP);

        if (result && result.success) {
            console.log('Task completed successfully, UI updated');
            // Refresh user data to get updated streak (this will filter out completed tasks)
            await loadUserData();
            // A completed task can finish a "tasks" goal server-side — check now so
            // the "{goal} was completed!" toast appears immediately, not on the next poll.
            if (typeof window.checkGoalCompletions === 'function') {
                window.checkGoalCompletions();
            }
        } else {
            console.error('Task completion failed:', result);
            // Re-enable button if completion failed
            if (deleteButton) {
                deleteButton.disabled = false;
                deleteButton.style.opacity = '1';
                deleteButton.style.cursor = 'pointer';
            }
        }
    } else {

        // Default user: Update UI locally only

        xp += taskXP;

        tasksCompleted++;



        if (typeof showXPPopup === 'function') {

            showXPPopup(taskXP);

        }


        // Calculate level with infinite progression

        let calculatedLevel = 1;

        let xpNeededForLevel = 100;

        let tempXp = xp;



        while (tempXp >= xpNeededForLevel) {

            tempXp -= xpNeededForLevel;

            calculatedLevel++;

            xpNeededForLevel = calculatedLevel * 100;

        }



        level = calculatedLevel;

        xpRequired = xpNeededForLevel;



        if (typeof updateStatsUI === 'function') {

            updateStatsUI(xp, level, xpRequired, tasksCompleted);

        }

    }

}



// Allow Enter key

modalName.addEventListener("keypress", function(event) {

    if (event.key === "Enter") {

        addTaskFromModal();

    }

});






// Growth Dropdown and Navigation Popup Functions

function showGrowthDropdown() {

    const dropdown = document.getElementById('growthDropdown');

    if (dropdown) {

        dropdown.style.display = 'block';

    }

}



function hideGrowthDropdown() {

    const dropdown = document.getElementById('growthDropdown');

    if (dropdown) {

        dropdown.style.display = 'none';

    }

}



function showNavigationPopup() {

    const popup = document.getElementById('navigationPopup');

    if (popup) {

        popup.style.display = 'flex';

    }

}



function hideNavigationPopup() {

    const popup = document.getElementById('navigationPopup');

    if (popup) {

        popup.style.display = 'none';

    }

}



function navigateToGrowth() {

    window.location.href = '/growth';

}



function navigateToHome() {

    window.location.href = '/home';

}



function navigateToCalendar() {

    window.location.href = '/calendar';

}



function navigateToGoals() {

    window.location.href = '/goals';

}



// Sync dashboard task to calendar

function syncTaskToCalendar(task) {

    if (!task.due_date) return;

    if (task.show_on_calendar === false) return;



    // Get existing dashboard tasks from localStorage

    let dashboardTasks = [];

    const storedTasks = localStorage.getItem('dashboardTasks');

    if (storedTasks) {

        try {

            dashboardTasks = JSON.parse(storedTasks);

        } catch (e) {

            console.error('Error loading dashboard tasks:', e);

        }

    }



    // Check if task already exists

    const existingIndex = dashboardTasks.findIndex(t => t.id === task.id);

    if (existingIndex === -1) {

        dashboardTasks.push(task);

        localStorage.setItem('dashboardTasks', JSON.stringify(dashboardTasks));

        console.log('Task synced to calendar:', task.name);

    }

}



// Remove dashboard task from calendar when completed

function removeDashboardTaskFromCalendar(taskId) {

    let dashboardTasks = [];

    const storedTasks = localStorage.getItem('dashboardTasks');

    if (storedTasks) {

        try {

            dashboardTasks = JSON.parse(storedTasks);

        } catch (e) {

            console.error('Error loading dashboard tasks:', e);

        }

    }



    const taskIndex = dashboardTasks.findIndex(t => t.id === taskId);

    if (taskIndex !== -1) {

        dashboardTasks.splice(taskIndex, 1);

        localStorage.setItem('dashboardTasks', JSON.stringify(dashboardTasks));

        console.log('Task removed from calendar:', taskId);

    }

}



// --- Overlap conflict check at task-creation time ----------------------------
// A new task spans from its creation (now) to its due date. Tasks aren't allowed
// to overlap at all: if the new task's active window intersects ANY existing
// pending task's window, pop up a blocking chooser to delete one of the two.
// (Calendar events keep a looser >75% bar so a multi-day task isn't blocked by
// every event it happens to cross.)

// Overlap fraction measured against the LONGER span (0..1): used with a >0 bar
// for tasks (any intersection) and a >0.75 bar for calendar events.
function spanOverlapFrac(aS, aE, bS, bE) {
    const o = Math.min(aE, bE) - Math.max(aS, bS);
    if (o <= 0) return 0;
    return o / Math.max(aE - aS, bE - bS);
}

async function checkCreationConflict(newTask) {
    const ns = Date.now();
    const ne = new Date(newTask.due_date).getTime();
    if (isNaN(ne) || ne <= ns) return;

    // 1) Existing pending tasks (span: created_at -> due_date).
    if (typeof getTasksAPI === 'function') {
        const res = await getTasksAPI(currentUser);
        if (res && res.success) {
            for (const t of res.tasks) {
                if (String(t.id) === String(newTask.id)) continue;
                if (t.status === 'done' || !t.due_date) continue;
                const ts = t.created_at ? new Date(t.created_at).getTime() : Number(t.id);
                const te = new Date(t.due_date).getTime();
                if (isNaN(ts) || isNaN(te) || te <= ts) continue;
                if (spanOverlapFrac(ns, ne, ts, te) > 0) {
                    showCreationConflictPopup(newTask, { kind: 'task', id: t.id, label: t.title || t.name || 'Task' });
                    return;
                }
            }
        }
    }

    // 2) Calendar events (from the calendar page's localStorage store).
    try {
        const data = JSON.parse(localStorage.getItem('calendarData') || '{}');
        const PLACEHOLDERS = ['Sleep Time', 'Morning session', 'Afternoon session',
                              'Late afternoon session', 'Evening session', 'Night session'];
        // Walk each day the new task's span touches.
        for (let d = new Date(ns); d.getTime() <= ne + 86400000; d.setDate(d.getDate() + 1)) {
            const key = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
            const day = data[key];
            if (!day || !Array.isArray(day.timestamps)) continue;
            for (const t of day.timestamps) {
                if (t.isDashboardTask || PLACEHOLDERS.includes(t.task)) continue;
                if (!t.startTime || !t.endTime) continue;
                const [sh, sm] = String(t.startTime).split(':').map(Number);
                const [eh, em] = String(t.endTime).split(':').map(Number);
                const es = new Date(d.getFullYear(), d.getMonth(), d.getDate(), sh || 0, sm || 0).getTime();
                let ee = new Date(d.getFullYear(), d.getMonth(), d.getDate(), eh || 0, em || 0).getTime();
                if (ee <= es) ee += 86400000;   // overnight event
                if (spanOverlapFrac(ns, ne, es, ee) > 0.75) {
                    showCreationConflictPopup(newTask, {
                        kind: 'event', dateKey: key, label: t.task,
                        startTime: t.startTime, endTime: t.endTime
                    });
                    return;
                }
            }
        }
    } catch (e) { /* localStorage unavailable/corrupt — skip the event check */ }
}

function showCreationConflictPopup(newTask, other) {
    if (document.getElementById('creationConflictBackdrop')) return;
    // Centered, blocking backdrop: overlapping tasks aren't allowed, so the user
    // must delete one before they can touch the dashboard again (no "keep both").
    const backdrop = document.createElement('div');
    backdrop.id = 'creationConflictBackdrop';
    backdrop.className = 'conflict-backdrop';

    const pop = document.createElement('div');
    pop.id = 'creationConflictPopup';
    pop.className = 'conflict-popup';

    const msg = document.createElement('span');
    msg.className = 'conflict-popup-msg';
    msg.textContent = `"${newTask.name}" overlaps "${other.label}". Delete one to continue:`;
    pop.appendChild(msg);

    const btn = (text, onClick) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'conflict-popup-btn';
        b.textContent = text;
        b.addEventListener('click', () => { backdrop.remove(); onClick && onClick(); });
        return b;
    };

    // Delete the just-created task (no XP tracking — it was never worked on).
    pop.appendChild(btn(`Delete "${newTask.name}"`, () => {
        if (typeof stopTaskTimer === 'function') stopTaskTimer(newTask.id);
        if (typeof deleteTaskFromBackendWithoutTracking === 'function') {
            deleteTaskFromBackendWithoutTracking(newTask.id);
        }
        const el = document.getElementById(`task-${newTask.id}`);
        if (el && el.parentNode) el.parentNode.removeChild(el);
        removeDashboardTaskFromCalendar(newTask.id);
    }));

    // Delete the conflicting existing task/event instead.
    pop.appendChild(btn(`Delete "${other.label}"`, () => {
        if (other.kind === 'task') {
            if (typeof deleteTaskFromBackendWithoutTracking === 'function') {
                deleteTaskFromBackendWithoutTracking(other.id);
            }
            const el = document.getElementById(`task-${other.id}`);
            if (el && el.parentNode) el.parentNode.removeChild(el);
            removeDashboardTaskFromCalendar(other.id);
        } else {
            try {
                const data = JSON.parse(localStorage.getItem('calendarData') || '{}');
                const day = data[other.dateKey];
                if (day && Array.isArray(day.timestamps)) {
                    day.timestamps = day.timestamps.filter(t =>
                        !(t.task === other.label && t.startTime === other.startTime && t.endTime === other.endTime));
                    localStorage.setItem('calendarData', JSON.stringify(data));
                }
            } catch (e) { /* ignore */ }
        }
    }));

    backdrop.appendChild(pop);
    document.body.appendChild(backdrop);
}

