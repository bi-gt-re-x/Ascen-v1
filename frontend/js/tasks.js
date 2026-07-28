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

    const xpEl = document.getElementById('xp');
    const levelEl = document.getElementById('level');
    const xpReqEl = document.getElementById('xpRequired');
    const tasksCompEl = document.getElementById('tasksCompleted');
    const xpBarFill = document.getElementById('xpBarFill');

    // Level-up detection: compare against the last level this UI rendered.
    // (Read BEFORE writing the new level into the DOM.) On the very first
    // render there's nothing to compare against, so no animation fires on load.
    const prevLevel = xpBarFill ? parseInt(xpBarFill.dataset.lastLevel || '', 10) : NaN;
    const leveledUp = !isNaN(prevLevel) && level > prevLevel;
    if (xpBarFill) xpBarFill.dataset.lastLevel = String(level);

    if (xpEl) xpEl.innerText = xp;
    if (levelEl) levelEl.innerText = level;
    if (xpReqEl) xpReqEl.innerText = xpRequired;
    if (tasksCompEl) tasksCompEl.innerText = tasksCompleted;

    if (leveledUp) {
        popXpBar();
        showLevelUpFx(level);
    }

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

// Level up! Make the XP bar pop (glow + brighten) and jump (bounce), and give
// the Level stat a little pop too. Classes are removed on a timer so the
// animation can re-fire on the next level.
function popXpBar() {
    const bar = document.querySelector('.xp-bar-container');
    const fill = document.getElementById('xpBarFill');
    const levelEl = document.getElementById('level');
    [bar, fill, levelEl].forEach(el => {
        if (!el) return;
        el.classList.remove('level-up');
        void el.offsetWidth; // restart the animation if it's mid-flight
        el.classList.add('level-up');
        setTimeout(() => el.classList.remove('level-up'), 1200);
    });
}

// The level-up celebration: a "LEVEL UP!" badge bursts in mid-screen with
// sparks flying outward. Every 5th level is a milestone — a bigger golden
// badge with a crown, an expanding shockwave ring, more sparks, and the
// bottom-corner confetti cannons join in.
function showLevelUpFx(level) {
    const milestone = level % 5 === 0;
    const overlay = document.createElement('div');
    overlay.className = 'levelup-overlay' + (milestone ? ' milestone' : '');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML =
        '<div class="levelup-badge">' +
            (milestone ? '<div class="levelup-crown">👑</div>' : '') +
            '<div class="levelup-title">' + (milestone ? 'MILESTONE!' : 'LEVEL UP!') + '</div>' +
            '<div class="levelup-level">Level ' + level + '</div>' +
        '</div>';

    // Sparks radiate from the badge — more of them (and further) on milestones.
    const sparkCount = milestone ? 20 : 10;
    for (let i = 0; i < sparkCount; i++) {
        const s = document.createElement('span');
        s.className = 'levelup-spark';
        s.style.setProperty('--a', Math.round((360 / sparkCount) * i + Math.random() * 18) + 'deg');
        s.style.setProperty('--d', Math.round(70 + Math.random() * (milestone ? 170 : 90)) + 'px');
        s.style.animationDelay = (Math.random() * 0.15).toFixed(2) + 's';
        overlay.appendChild(s);
    }

    document.body.appendChild(overlay);
    if (milestone && window.Celebrate && typeof window.Celebrate.confetti === 'function') {
        window.Celebrate.confetti();
    }
    setTimeout(() => overlay.remove(), milestone ? 2600 : 1800);
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

// Updated task deletion function with growth tracking integration
async function handleTaskDeletionWithGrowthTracking(taskId, taskXP, liElement, currentUser) {
    // Instantly remove from DOM tree context if it hasn't been detached yet
    if (liElement && liElement.parentNode) {
        liElement.parentNode.removeChild(liElement);
    }
    if (typeof updateTaskSectionEmptyStates === 'function') updateTaskSectionEmptyStates();

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
