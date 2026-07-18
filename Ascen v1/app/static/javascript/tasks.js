// tasks.js - Handles task creation and management logic

// Tasks without a due date no longer count up — they just sit in the list with a
// static "No due date" label (see createTaskElement), so no ticker is needed.

function createTaskElement(task, onDeleteCallback) {
    const li = document.createElement('li');
    li.className = 'task-item';
    li.id = `task-${task.id}`;

    // Normalize fields: the JSON backend stores title/xp_value, while older
    // code paths used name/xp_reward. Accept either so names/XP always render.
    const taskName = task.name || task.title || 'Untitled';
    const taskXp = (task.xp_reward != null) ? task.xp_reward
                 : (task.xp_value != null ? task.xp_value : 0);

    // Left block wrapper
    const taskLeft = document.createElement('div');
    taskLeft.className = 'task-left';

    // 1. Checkbox goes first (Far Left)
    const checkbox = document.createElement('div');
    checkbox.className = 'task-checkbox';

    // Wire up completion toggle - checkmark first, then a sleek pop-away
    checkbox.onclick = function(e) {
        e.stopPropagation();

        // Guard against double clicks while the task is animating out
        if (li.classList.contains('completing')) return;
        li.classList.add('completing');

        // 1. Show the checkmark inside the box
        checkbox.innerHTML = '✓';
        li.classList.add('completed-state');

        // 2. Brief beat so the check is visible, then fire the callback
        //    (handleTaskDeletion adds the 'removing' animation, syncs the
        //    backend, and removes the element once it has animated out).
        setTimeout(function() {
            if (typeof onDeleteCallback === 'function') {
                onDeleteCallback(task.id, taskXp, li);
            }
        }, 220);
    };

    // 2. Task Name goes second
    const nameSpan = document.createElement('span');
    nameSpan.className = 'task-name';
    nameSpan.textContent = taskName;

    // Assemble Left Side
    taskLeft.appendChild(checkbox);
    taskLeft.appendChild(nameSpan);

    // Right block: due date + time, OR a count-up timer when there's no due date
    const dueDateSpan = document.createElement('span');
    dueDateSpan.className = 'task-due-date';

    if (task.due_date) {
        // A due_date always carries a specific time, so show both
        // (e.g., "Due: Jul 5, 6:40 PM").
        const dateObj = new Date(task.due_date);
        const datePart = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const timePart = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        dueDateSpan.textContent = `Due: ${datePart}, ${timePart}`;
    } else {
        // No due date/time -> the task just sits there waiting. No count-up timer
        // (nothing to count toward), just a quiet static label.
        dueDateSpan.classList.add('task-nodue');
        dueDateSpan.textContent = 'No due date';
    }

    // Assemble structural item
    li.appendChild(taskLeft);
    li.appendChild(dueDateSpan);

    return li;
}

function updateStatsUI(xp, level, xpRequired, tasksCompleted) {
    console.log('updateStatsUI called with:', {
        xp: xp,
        level: level,
        xpRequired: xpRequired,
        tasksCompleted: tasksCompleted
    });

    const xpEl = document.getElementById('xp');
    const levelEl = document.getElementById('level');
    const xpReqEl = document.getElementById('xpRequired');
    const tasksCompEl = document.getElementById('tasksCompleted');
    const xpBarFill = document.getElementById('xpBarFill');

    if (xpEl) xpEl.innerText = xp;
    if (levelEl) levelEl.innerText = level;
    if (xpReqEl) xpReqEl.innerText = xpRequired;
    if (tasksCompEl) tasksCompEl.innerText = tasksCompleted;

    if (xpBarFill) {
        const percentage = Math.min((xp / xpRequired) * 100, 100);
        if (!xpBarFill.dataset.initialized) {
            // First set after data loads: apply the width WITHOUT animating so the
            // bar doesn't visibly readjust on page load. Re-enable the transition
            // afterward so later XP gains still animate smoothly.
            xpBarFill.style.transition = 'none';
            xpBarFill.style.width = percentage + '%';
            void xpBarFill.offsetWidth; // force reflow before restoring transition
            xpBarFill.style.transition = ''; // let the CSS transition apply again
            xpBarFill.dataset.initialized = '1';
        } else {
            xpBarFill.style.width = percentage + '%';
        }
        // Cache so the next load can start the bar at the right width instantly.
        try {
            const user = localStorage.getItem('currentUser') || 'Default';
            localStorage.setItem('xpPct_' + user, String(percentage));
        } catch (e) {}
    }
}

function showXPPopup(amount) {
    const xpSection = document.querySelector('.xp-section');
    if (!xpSection || amount === 0) return;

    const popup = document.createElement('div');
    popup.className = 'xp-popup';
    popup.textContent = `+${amount} XP`;

    xpSection.appendChild(popup);

    setTimeout(() => {
        popup.remove();
    }, 1500);
}

function updateStreakUI(currentStreak, bestStreak) {
    console.log('Updating streak UI:', { currentStreak, bestStreak });

    const currentStreakEl = document.getElementById('currentStreak');
    const bestStreakEl = document.getElementById('bestStreak');

    if (currentStreakEl) currentStreakEl.textContent = currentStreak || 0;
    if (bestStreakEl) bestStreakEl.textContent = bestStreak || 0;

    if (typeof window !== 'undefined') {
        window.currentStreak = currentStreak || 0;
        window.bestStreak = bestStreak || 0;
    }
}

// Updated task deletion function with growth tracking integration
async function handleTaskDeletionWithGrowthTracking(taskId, taskXP, liElement, currentUser) {
    const taskList = document.getElementById('taskList');

    // Instantly remove from DOM tree context if it hasn't been detached yet
    if (liElement && liElement.parentNode) {
        liElement.parentNode.removeChild(liElement);
    }

    if (typeof stopTaskTimer === 'function') {
        stopTaskTimer(taskId);
    }

    // Sync with Backend - Use backend for all calculations
    if (currentUser !== 'Default') {
        if (typeof trackTaskCompletion === 'function') {
            await trackTaskCompletion(taskId, currentUser, taskXP);
        } else if (typeof deleteTaskFromBackend === 'function') {
            await deleteTaskFromBackend(taskId);
        }
    } else {
        console.warn('handleTaskDeletionWithGrowthTracking called for default user');
    }
}