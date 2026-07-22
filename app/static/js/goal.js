// Theme (light/dark) is handled globally by theme.js, sourced from users.json.
// When it changes we only need to re-apply the active filter so goals stay visible.
document.addEventListener('themechange', () => {
    if (allGoals.length > 0) {
        filterGoals(currentFilter);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // Reveal the page only once the goals have loaded, so it fades in fully built
    // (finally: reveal even if the load errors, so the page never stays hidden).
    loadGoals().finally(function () {
        if (typeof window.revealPage === 'function') window.revealPage();
    });
});

// The task-completion signal + XP-goal automation lives in goal-auto.js.

const goalModal = document.getElementById("goalModal");
const deleteModal = document.getElementById("deleteModal");
const completionModal = document.getElementById("completionModal");
const giveUpModal = document.getElementById("giveUpModal");
let goalToDelete = null;
let pendingGoalData = null;
let goalToGiveUp = null;

function openGoalModal() {
    goalModal.style.display = "block";
    document.getElementById('goalTitle').focus();
    
    // Set minimum date to tomorrow for goal deadline, but allow any future year
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    document.getElementById('goalDeadline').setAttribute('min', tomorrowStr);
    // Remove any max attribute to allow future years
    document.getElementById('goalDeadline').removeAttribute('max');
    
    // Add event listeners to remove invalid classes when user starts typing
    addInputValidationListeners();
}

function addInputValidationListeners() {
    const titleInput = document.getElementById('goalTitle');
    const targetXPInput = document.getElementById('targetXP');
    const targetStreakInput = document.getElementById('targetStreak');
    const targetTasksInput = document.getElementById('targetTasks');
    const deadlineInput = document.getElementById('goalDeadline');
    
    // Remove invalid classes on input
    titleInput.addEventListener('input', () => titleInput.classList.remove('invalid-input'));
    targetXPInput.addEventListener('input', () => targetXPInput.classList.remove('invalid-input'));
    targetStreakInput.addEventListener('input', () => targetStreakInput.classList.remove('invalid-input'));
    targetTasksInput.addEventListener('input', () => targetTasksInput.classList.remove('invalid-input'));
    deadlineInput.addEventListener('input', () => deadlineInput.classList.remove('invalid-date'));
}

function openDeleteModal(goalId) {
    goalToDelete = goalId;
    deleteModal.style.display = "block";
}

function closeDeleteModal() {
    deleteModal.style.display = "none";
    goalToDelete = null;
}

function openCompletionModal(goalData) {
    pendingGoalData = goalData;
    completionModal.style.display = "block";
}

function closeCompletionModal() {
    completionModal.style.display = "none";
    pendingGoalData = null;
    closeGoalModal();
}

function confirmCompletion() {
    if (!pendingGoalData) {
        return;
    }

    // Set status to completed
    pendingGoalData.status = 'completed';

    // Proceed with the update
    updateGoalWithCompletion(pendingGoalData);
    closeCompletionModal();
}

async function updateGoalWithCompletion(goalData) {
    try {
        const response = await fetch('/api/update_goal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(goalData)
        });
        const data = await response.json();
        if (data.success) {
            // Update the goal in the allGoals array
            const goalIndex = allGoals.findIndex(g => g.id === goalData.id);
            if (goalIndex !== -1) {
                allGoals[goalIndex] = {
                    ...allGoals[goalIndex],
                    title: goalData.title,
                    description: goalData.description,
                    goal_type: goalData.goal_type,
                    target_xp: goalData.target_xp,
                    target_streak: goalData.target_streak,
                    target_tasks: goalData.target_tasks,
                    deadline: goalData.deadline,
                    status: 'completed'
                };
                // Update the DOM element directly
                updateGoalElement(goalData.id, allGoals[goalIndex]);
            }
            closeGoalModal();
        } else {
            alert('Error updating goal: ' + (data.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error updating goal:', error);
        alert('Error updating goal. Please try again.');
    }
}

function closeGoalModal() {
    goalModal.style.display = "none";
    document.getElementById('goalTitle').value = '';
    document.getElementById('goalDescription').value = '';
    document.getElementById('targetXP').value = '';
    document.getElementById('targetStreak').value = '';
    document.getElementById('targetTasks').value = '';
    document.getElementById('goalDeadline').value = '';
    document.getElementById('goalType').value = 'xp';
    document.getElementById('editingGoalId').value = '';
    document.getElementById('modalTitle').textContent = 'Add New Goal';
    document.getElementById('saveGoalBtn').textContent = 'Add Goal';
    
    // Clear all invalid classes when modal is closed
    document.getElementById('goalTitle').classList.remove('invalid-input');
    document.getElementById('targetXP').classList.remove('invalid-input');
    document.getElementById('targetStreak').classList.remove('invalid-input');
    document.getElementById('targetTasks').classList.remove('invalid-input');
    document.getElementById('goalDeadline').classList.remove('invalid-date');
    
    updateGoalTypeInputs();
}

function updateGoalTypeInputs() {
    const goalType = document.getElementById('goalType').value;
    const targetXPLabel = document.getElementById('targetXPLabel');
    const targetXPInput = document.getElementById('targetXP');
    const targetStreakLabel = document.getElementById('targetStreakLabel');
    const targetStreakInput = document.getElementById('targetStreak');
    const targetTasksLabel = document.getElementById('targetTasksLabel');
    const targetTasksInput = document.getElementById('targetTasks');

    // Hide all first
    targetXPLabel.style.display = 'none';
    targetXPInput.style.display = 'none';
    targetStreakLabel.style.display = 'none';
    targetStreakInput.style.display = 'none';
    targetTasksLabel.style.display = 'none';
    targetTasksInput.style.display = 'none';

    // Show based on type
    if (goalType === 'xp') {
        targetXPLabel.style.display = 'block';
        targetXPInput.style.display = 'block';
    } else if (goalType === 'streak') {
        targetStreakLabel.style.display = 'block';
        targetStreakInput.style.display = 'block';
    } else if (goalType === 'tasks') {
        targetTasksLabel.style.display = 'block';
        targetTasksInput.style.display = 'block';
    }
}

window.onclick = function(event) {
    if (event.target == goalModal) {
        closeGoalModal();
    }
    if (event.target == deleteModal) {
        closeDeleteModal();
    }
    if (event.target == completionModal) {
        closeCompletionModal();
    }
    if (event.target == giveUpModal) {
        closeGiveUpModal();
    }
}

let currentUser = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
let allGoals = [];
let currentFilter = 'active';
let goalTimers = {};

async function loadGoals() {
    if (!currentUser) {
        document.getElementById('noGoals').style.display = 'block';
        return;
    }

    try {
        const response = await fetch(`/api/get_goals?username=${encodeURIComponent(currentUser)}`, { cache: 'no-store' });
        const data = await response.json();

        if (data.success) {
            allGoals = data.goals || [];
            filterGoals(currentFilter);
            updateStatCounts();
            checkGoalDeadlines(); // Check for overdue goals
        } else {
            console.error('API error loading goals:', data.message);
            // Show error state but don't break the UI
            document.getElementById('noGoals').style.display = 'block';
            document.getElementById('noGoals').querySelector('p').textContent = 'Error loading goals. Please try again.';
        }
    } catch (error) {
        console.error('Error loading goals:', error);
        // Show error state but don't break the UI
        document.getElementById('noGoals').style.display = 'block';
        document.getElementById('noGoals').querySelector('p').textContent = 'Error loading goals. Please try again.';
    }
}

function checkGoalDeadlines() {
    const now = new Date();
    
    allGoals.forEach(goal => {
        if (goal.deadline && goal.status === 'active') {
            const deadline = new Date(goal.deadline);
            if (deadline < now) {
                // Goal is overdue
                markGoalAsOverdue(goal.id);
            } else {
                // Start countdown timer for goal
                startGoalTimer(goal.id, deadline);
            }
        }
    });
}

function startGoalTimer(goalId, deadline) {
    // Clear existing timer if any
    if (goalTimers[goalId]) {
        clearInterval(goalTimers[goalId]);
    }
    
    const now = new Date();
    const deadlineTime = deadline.getTime();
    
    // Calculate remaining time
    const remaining = deadlineTime - now.getTime();
    
    if (remaining > 0) {
        // Start timer to check when goal becomes overdue
        goalTimers[goalId] = setTimeout(() => {
            markGoalAsOverdue(goalId);
        }, remaining);
    }
}

function markGoalAsOverdue(goalId) {
    const goalElement = document.getElementById(`goal-${goalId}`);
    if (goalElement) {
        goalElement.classList.add('overdue');
        
        // Update utility buttons to show Give up and More Time
        const utilityButtons = goalElement.querySelector('.goal-utility-buttons');
        if (utilityButtons) {
            utilityButtons.innerHTML = `
                <button class="goal-utility-btn give-up" onclick="giveUpGoal('${goalId}')">Give up</button>
                <button class="goal-utility-btn more-time" onclick="openGoalMoreTimeModal('${goalId}')">More Time</button>
            `;
        }

        // Hide goal controls to prevent adding progress
        const goalControls = goalElement.querySelector('.goal-controls');
        if (goalControls) {
            goalControls.style.display = 'none';
        }

        // Move the goal to the top of the list
        const goalsList = document.getElementById('goalsList');
        if (goalsList && goalsList.firstChild) {
            goalsList.insertBefore(goalElement, goalsList.firstChild);
        }
    }
}

function giveUpGoal(goalId) {
    goalToGiveUp = goalId;
    giveUpModal.style.display = "block";
}

function closeGiveUpModal() {
    giveUpModal.style.display = "none";
    goalToGiveUp = null;
}

function confirmGiveUp() {
    if (goalToGiveUp) {
        deleteGoalWithoutTracking(goalToGiveUp);
    }
    closeGiveUpModal();
}

async function deleteGoalWithoutTracking(goalId) {
    try {
        const response = await fetch('/api/delete_goal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ goal_id: goalId })
        });

        const data = await response.json();

        if (data.success) {
            // Clear timer
            if (goalTimers[goalId]) {
                clearTimeout(goalTimers[goalId]);
                delete goalTimers[goalId];
            }
            loadGoals();
        }
    } catch (error) {
        console.error('Error deleting goal:', error);
    }
}

let currentGoalIdForMoreTime = null;

function openGoalMoreTimeModal(goalId) {
    currentGoalIdForMoreTime = goalId;
    const moreTimeModal = document.getElementById('goalMoreTimeModal');
    moreTimeModal.style.display = 'block';
    
    // Set minimum date to tomorrow (can't be today or in the past)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    document.getElementById('newGoalDeadline').setAttribute('min', tomorrowStr);
    // Remove any max attribute to allow future years
    document.getElementById('newGoalDeadline').removeAttribute('max');
    // Remove any error styling
    document.getElementById('newGoalDeadline').classList.remove('invalid-date');
}

function closeGoalMoreTimeModal() {
    const moreTimeModal = document.getElementById('goalMoreTimeModal');
    moreTimeModal.style.display = 'none';
    currentGoalIdForMoreTime = null;
    document.getElementById('newGoalDeadline').value = '';
}

async function updateGoalDeadline() {
    if (!currentGoalIdForMoreTime) return;
    
    const newDeadline = document.getElementById('newGoalDeadline').value;
    const deadlineInput = document.getElementById('newGoalDeadline');
    
    if (!newDeadline) {
        deadlineInput.classList.add('invalid-date');
        return;
    }

    // Validate deadline - cannot be today or in the past
    // Parse the deadline date as local time (not UTC)
    const deadlineParts = newDeadline.split('-');
    const deadlineDate = new Date(deadlineParts[0], deadlineParts[1] - 1, deadlineParts[2]);
    
    // Get today's date at midnight local time
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (deadlineDate <= today) {
        deadlineInput.classList.add('invalid-date');
        return;
    }

    // Remove error styling if date is valid
    deadlineInput.classList.remove('invalid-date');
    
    const goal = allGoals.find(g => g.id === currentGoalIdForMoreTime);
    if (!goal) return;
    
    try {
        const response = await fetch('/api/update_goal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: currentGoalIdForMoreTime,
                username: currentUser,
                title: goal.title,
                description: goal.description,
                goal_type: goal.goal_type,
                target_xp: goal.target_xp,
                current_xp: goal.current_xp,
                target_streak: goal.target_streak,
                current_streak: goal.current_streak,
                target_tasks: goal.target_tasks,
                current_tasks: goal.current_tasks,
                deadline: newDeadline,
                status: goal.status
            })
        });
        
        const data = await response.json();
        if (data.success) {
            // Clear existing timer
            if (goalTimers[currentGoalIdForMoreTime]) {
                clearTimeout(goalTimers[currentGoalIdForMoreTime]);
                delete goalTimers[currentGoalIdForMoreTime];
            }
            
            // Update goal in array
            const goalIndex = allGoals.findIndex(g => g.id === currentGoalIdForMoreTime);
            if (goalIndex !== -1) {
                allGoals[goalIndex].deadline = newDeadline;
            }
            
            // Remove overdue class and show goal controls again
            const goalElement = document.getElementById(`goal-${currentGoalIdForMoreTime}`);
            if (goalElement) {
                goalElement.classList.remove('overdue');
                const goalControls = goalElement.querySelector('.goal-controls');
                if (goalControls) {
                    goalControls.style.display = 'flex';
                }
                
                // Restore normal utility buttons
                const utilityButtons = goalElement.querySelector('.goal-utility-buttons');
                if (utilityButtons) {
                    utilityButtons.innerHTML = `
                        <button type="button" class="goal-utility-btn" onclick="addProgressToGoal('${currentGoalIdForMoreTime}', 1)">+1</button>
                        <button class="goal-utility-btn edit" onclick="editGoal('${currentGoalIdForMoreTime}')">Edit</button>
                        <button class="goal-utility-btn delete" onclick="deleteGoal('${currentGoalIdForMoreTime}')">Delete</button>
                    `;
                }
            }
            
            // Start new timer for the updated deadline
            const deadlineDate = new Date(newDeadline);
            const now = new Date();
            if (deadlineDate > now) {
                startGoalTimer(currentGoalIdForMoreTime, deadlineDate);
            }
            
            // Update the deadline display in the DOM
            const deadlineSpan = goalElement.querySelector('.goal-deadline');
            if (deadlineSpan) {
                deadlineSpan.textContent = `Deadline: ${formatDate(newDeadline)}`;
            }
            
            closeGoalMoreTimeModal();
        } else {
            alert('Error updating deadline: ' + (data.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error updating deadline:', error);
        alert('Error updating deadline. Please try again.');
    }
}

function filterGoals(filter) {
    currentFilter = filter;
    const goalsList = document.getElementById('goalsList');

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtnId = 'btn-' + filter;
    document.getElementById(activeBtnId)?.classList.add('active');

    // Get existing goal items
    const goalItems = goalsList.querySelectorAll('.goal-item');
    const existingGoalIds = new Set();
    goalItems.forEach(item => {
        existingGoalIds.add(item.id.replace('goal-', ''));
    });

    // Create DOM elements for goals that don't have one yet
    allGoals.forEach(goal => {
        if (!existingGoalIds.has(goal.id)) {
            const goalElement = createGoalElement(goal);
            goalsList.appendChild(goalElement);
            existingGoalIds.add(goal.id);
        }
    });

    // Now hide/show all goal items based on filter
    const allGoalItems = goalsList.querySelectorAll('.goal-item');
    allGoalItems.forEach(item => {
        const goalId = item.id.replace('goal-', '');
        const goal = allGoals.find(g => g.id === goalId);
        
        if (goal) {
            let shouldShow = false;
            if (filter === 'all') {
                shouldShow = true;
            } else if (filter === 'active') {
                shouldShow = goal.status === 'active';
            } else if (filter === 'completed') {
                shouldShow = goal.status === 'completed';
            }

            if (shouldShow) {
                // Safety net: a goal we're about to show must never be stuck in the
                // collapsed pop-away state left over from an in-session completion.
                item.classList.remove('removing');
            }
            item.style.display = shouldShow ? 'block' : 'none';
        } else {
            // Goal no longer exists in allGoals, remove it
            item.remove();
        }
    });

    // Count visible goals
    let visibleCount = 0;
    allGoalItems.forEach(item => {
        if (item.style.display !== 'none') {
            visibleCount++;
        }
    });

    if (visibleCount > 0) {
        document.getElementById('noGoals').style.display = 'none';
    } else {
        // Set different message based on filter
        const noGoalsElement = document.getElementById('noGoals');
        if (filter === 'active') {
            noGoalsElement.querySelector('p').textContent = 'No active goals. Create a goal to start tracking your progress!';
        } else if (filter === 'completed') {
            noGoalsElement.querySelector('p').textContent = 'Complete goals for them to show up here!';
        } else {
            noGoalsElement.querySelector('p').textContent = 'No goals yet. Create your first goal to start tracking your progress!';
        }
        noGoalsElement.style.display = 'flex';
    }
}

function renderGoals(goals) {
    const goalsList = document.getElementById('goalsList');
    
    // Remove all goal items but keep the no-goals element
    const goalItems = goalsList.querySelectorAll('.goal-item');
    goalItems.forEach(item => item.remove());

    let completedCount = 0;
    let activeCount = 0;

    goals.forEach(goal => {
        const goalElement = createGoalElement(goal);
        goalsList.appendChild(goalElement);

        if (goal.status === 'completed') {
            completedCount++;
        } else {
            activeCount++;
        }
    });

    // Update the stat counts
    document.getElementById('completedCount').textContent = completedCount;
    document.getElementById('activeCount').textContent = activeCount;
}

function handleProgressInputKeypress(event, goalId) {
    if (event.key === 'Enter') {
        event.preventDefault();
        setProgressToGoal(goalId);
    }
}

async function setProgressToGoal(goalId) {
    // Find the goal to determine its type
    const goal = allGoals.find(g => g.id === goalId);
    if (!goal) {
        return;
    }

    // Check if goal is overdue (red mode) - prevent adding progress
    const goalElement = document.getElementById(`goal-${goalId}`);
    if (goalElement && goalElement.classList.contains('overdue')) {
        alert('Cannot set progress on an overdue goal. Please extend the deadline or give up on this goal.');
        return;
    }

    const goalType = goal.goal_type || 'xp';
    const input = document.getElementById(`progress-input-${goalId}`);
    if (!input) {
        return;
    }
    
    const targetValue = parseInt(input.value);
    if (!targetValue || targetValue < 0) {
        return;
    }
    
    // Clear input after getting value
    input.value = '';

    // Calculate current progress
    let currentProgress = 0;
    let targetProgress = 0;
    
    if (goalType === 'xp') {
        currentProgress = goal.current_xp || 0;
        targetProgress = goal.target_xp || 0;
    } else if (goalType === 'streak') {
        currentProgress = goal.current_streak || 0;
        targetProgress = goal.target_streak || 0;
    } else if (goalType === 'tasks') {
        currentProgress = goal.current_tasks || 0;
        targetProgress = goal.target_tasks || 0;
    }

    // Calculate the difference to add (or subtract if targetValue < currentProgress)
    let progressToAdd = targetValue - currentProgress;
    
    // Cap the progress to not exceed the target
    const maxAllowed = targetProgress - currentProgress;
    if (progressToAdd > maxAllowed && maxAllowed > 0) {
        progressToAdd = maxAllowed;
    }

    // If trying to set to a value less than current, we need to handle it differently
    // For now, we'll just not allow decreasing progress
    if (progressToAdd < 0) {
        alert('Cannot decrease progress. Use the +1 button to add progress.');
        return;
    }

    const payload = {
        goal_id: goalId,
        xp_to_add: 0,
        streak_to_add: 0,
        tasks_to_add: 0
    };

    if (goalType === 'xp') {
        payload.xp_to_add = progressToAdd;
    } else if (goalType === 'streak') {
        payload.streak_to_add = progressToAdd;
    } else if (goalType === 'tasks') {
        payload.tasks_to_add = progressToAdd;
    }

    try {
        const response = await fetch('/api/update_goal_progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.success) {
            // Update the specific goal in the allGoals array
            const goalIndex = allGoals.findIndex(g => g.id === goalId);
            if (goalIndex !== -1) {
                // Update the goal data with new progress
                if (goalType === 'xp') {
                    allGoals[goalIndex].current_xp = data.current;
                } else if (goalType === 'streak') {
                    allGoals[goalIndex].current_streak = data.current;
                } else if (goalType === 'tasks') {
                    allGoals[goalIndex].current_tasks = data.current;
                }
                allGoals[goalIndex].status = data.status;

                // If goal was completed, handle completion with conditional removal
                if (data.completed) {
                    const goalElement = document.getElementById(`goal-${goalId}`);
                    updateStatCounts();
                    if (goalElement && currentFilter === 'active') {
                        // On the active tab a completed goal leaves the list —
                        // pop it away sleekly (like the dashboard), then drop the
                        // element so it re-renders cleanly on the All/Completed tabs
                        // instead of lingering stuck in the collapsed pop-away state.
                        goalElement.classList.add('removing');
                        setTimeout(() => {
                            goalElement.remove();
                            filterGoals(currentFilter);
                        }, 520);
                    } else if (goalElement) {
                        // Otherwise just refresh it in place (shows completed state).
                        updateGoalElement(goalId, allGoals[goalIndex]);
                        filterGoals(currentFilter);
                    }
                } else {
                    // Just update the goal element in place without any movement
                    updateGoalElement(goalId, allGoals[goalIndex]);
                }
            }
        }
    } catch (error) {
        console.error('Error setting goal progress:', error);
    }
}

async function addProgressToGoal(goalId, amount = null) {
    // Find the goal to determine its type
    const goal = allGoals.find(g => g.id === goalId);
    if (!goal) {
        return;
    }

    // Check if goal is overdue (red mode) - prevent adding progress
    const goalElement = document.getElementById(`goal-${goalId}`);
    if (goalElement && goalElement.classList.contains('overdue')) {
        alert('Cannot add progress to an overdue goal. Please extend the deadline or give up on this goal.');
        return;
    }

    const goalType = goal.goal_type || 'xp';
    let progressToAdd = amount;

    if (!progressToAdd) {
        const input = document.getElementById(`progress-input-${goalId}`);
        if (!input) {
            return;
        }
        progressToAdd = parseInt(input.value);
        if (!progressToAdd || progressToAdd < 1) {
            return;
        }
        // Clear input after getting value
        input.value = '';
    }

    // Calculate current progress and cap at target
    let currentProgress = 0;
    let targetProgress = 0;
    
    if (goalType === 'xp') {
        currentProgress = goal.current_xp || 0;
        targetProgress = goal.target_xp || 0;
    } else if (goalType === 'streak') {
        currentProgress = goal.current_streak || 0;
        targetProgress = goal.target_streak || 0;
    } else if (goalType === 'tasks') {
        currentProgress = goal.current_tasks || 0;
        targetProgress = goal.target_tasks || 0;
    }

    // Cap the progress to not exceed the target
    const maxAllowed = targetProgress - currentProgress;
    if (progressToAdd > maxAllowed && maxAllowed > 0) {
        progressToAdd = maxAllowed;
    }

    const payload = {
        goal_id: goalId,
        xp_to_add: 0,
        streak_to_add: 0,
        tasks_to_add: 0
    };

    if (goalType === 'xp') {
        payload.xp_to_add = progressToAdd;
    } else if (goalType === 'streak') {
        payload.streak_to_add = progressToAdd;
    } else if (goalType === 'tasks') {
        payload.tasks_to_add = progressToAdd;
    }

    try {
        const response = await fetch('/api/update_goal_progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.success) {
            // Update the specific goal in the allGoals array
            const goalIndex = allGoals.findIndex(g => g.id === goalId);
            if (goalIndex !== -1) {
                // Update the goal data with new progress
                if (goalType === 'xp') {
                    allGoals[goalIndex].current_xp = data.current;
                } else if (goalType === 'streak') {
                    allGoals[goalIndex].current_streak = data.current;
                } else if (goalType === 'tasks') {
                    allGoals[goalIndex].current_tasks = data.current;
                }
                allGoals[goalIndex].status = data.status;

                // If goal was completed, handle completion with conditional removal
                if (data.completed) {
                    const goalElement = document.getElementById(`goal-${goalId}`);
                    updateStatCounts();
                    if (goalElement && currentFilter === 'active') {
                        // On the active tab a completed goal leaves the list —
                        // pop it away sleekly (like the dashboard), then drop the
                        // element so it re-renders cleanly on the All/Completed tabs
                        // instead of lingering stuck in the collapsed pop-away state.
                        goalElement.classList.add('removing');
                        setTimeout(() => {
                            goalElement.remove();
                            filterGoals(currentFilter);
                        }, 520);
                    } else if (goalElement) {
                        // Otherwise just refresh it in place (shows completed state).
                        updateGoalElement(goalId, allGoals[goalIndex]);
                        filterGoals(currentFilter);
                    }
                } else {
                    // Just update the goal element in place without any movement
                    updateGoalElement(goalId, allGoals[goalIndex]);
                }
            }
        }
    } catch (error) {
        console.error('Error updating goal progress:', error);
    }
}

function updateGoalElement(goalId, goalData) {
    const goalElement = document.getElementById(`goal-${goalId}`);
    if (!goalElement) {
        return;
    }
    
    // Update the goal element in place without replacing it
    updateGoalElementInPlace(goalElement, goalData);
    
    // Update the stat counts
    updateStatCounts();
}

function updateGoalElementInPlace(goalElement, goalData) {
    const goalType = goalData.goal_type || 'xp';
    let current, target, label, progress;
    const isCompleted = goalData.status === 'completed';

    if (goalType === 'xp') {
        current = goalData.current_xp || 0;
        target = goalData.target_xp || 0;
        label = 'XP';
        progress = target > 0 ? Math.min((current / target) * 100, 100) : 0;
    } else if (goalType === 'streak') {
        current = goalData.current_streak || 0;
        target = goalData.target_streak || 0;
        label = 'Days';
        progress = target > 0 ? Math.min((current / target) * 100, 100) : 0;
    } else if (goalType === 'tasks') {
        current = goalData.current_tasks || 0;
        target = goalData.target_tasks || 0;
        label = 'Tasks';
        progress = target > 0 ? Math.min((current / target) * 100, 100) : 0;
    } else {
        current = goalData.current_xp || 0;
        target = goalData.target_xp || 0;
        label = 'XP';
        progress = target > 0 ? Math.min((current / target) * 100, 100) : 0;
    }

    // For completed goals, show full progress bar
    if (isCompleted) {
        progress = 100;
    }

    // Update the goal element's classes
    goalElement.className = `goal-item ${isCompleted ? 'completed' : ''}`;

    // Update only the dynamic elements without touching title and description
    const goalMetric = goalElement.querySelector('.goal-metric');
    if (goalMetric) {
        goalMetric.textContent = `${current} / ${target} ${label}`;
    }

    const progressBarFill = goalElement.querySelector('.progress-bar-fill');
    if (progressBarFill) {
        progressBarFill.style.width = `${progress}%`;
        if (isCompleted) {
            progressBarFill.classList.add('completed');
        } else {
            progressBarFill.classList.remove('completed');
        }
    }

    const progressText = goalElement.querySelector('.progress-text');
    if (progressText) {
        progressText.textContent = `${progress.toFixed(1)}%`;
    }

    const goalTypeBadge = goalElement.querySelector('.goal-type-badge');
    if (goalTypeBadge) {
        goalTypeBadge.textContent = goalType.toUpperCase();
        if (isCompleted) {
            goalTypeBadge.classList.add('completed');
        } else {
            goalTypeBadge.classList.remove('completed');
        }
    }

    // Update utility buttons based on completion status
    const utilityButtons = goalElement.querySelector('.goal-utility-buttons');
    if (utilityButtons) {
        if (isCompleted) {
            utilityButtons.innerHTML = `<button class="goal-utility-btn delete" onclick="deleteGoal('${goalData.id}')">Delete</button>`;
        } else {
            utilityButtons.innerHTML = `
                <button type="button" class="goal-utility-btn" onclick="addProgressToGoal('${goalData.id}', 1)">+1</button>
                <button class="goal-utility-btn edit" onclick="editGoal('${goalData.id}')">Edit</button>
                <button class="goal-utility-btn delete" onclick="deleteGoal('${goalData.id}')">Delete</button>
            `;
        }
    }

    // Update completed badge
    const existingCompletedBadge = goalElement.querySelector('.goal-completed-badge');
    if (isCompleted && !existingCompletedBadge) {
        const statsBox = goalElement.querySelector('.goal-stats');
        if (statsBox) {
            const badge = document.createElement('span');
            badge.className = 'goal-completed-badge';
            badge.textContent = '✓ COMPLETED';
            statsBox.appendChild(badge);
        }
    } else if (!isCompleted && existingCompletedBadge) {
        existingCompletedBadge.remove();
    }
}

function removeGoalElement(goalId) {
    const goalElement = document.getElementById(`goal-${goalId}`);
    if (goalElement) {
        goalElement.remove();
        updateStatCounts();
    }
}

function updateStatCounts() {
    let completedCount = 0;
    let activeCount = 0;
    
    // Count from allGoals array instead of DOM elements
    allGoals.forEach(goal => {
        if (goal.status === 'completed') {
            completedCount++;
        } else {
            activeCount++;
        }
    });
    
    document.getElementById('completedCount').textContent = completedCount;
    document.getElementById('activeCount').textContent = activeCount;
}

function editGoal(goalId) {
    const goal = allGoals.find(g => g.id === goalId);
    if (!goal) return;

    // Set editing mode
    document.getElementById('editingGoalId').value = goalId;
    document.getElementById('modalTitle').textContent = 'Edit Goal';
    document.getElementById('saveGoalBtn').textContent = 'Save Changes';

    // Populate modal with existing data
    document.getElementById('goalTitle').value = goal.title;
    document.getElementById('goalDescription').value = goal.description || '';
    document.getElementById('goalType').value = goal.goal_type || 'xp';
    document.getElementById('targetXP').value = goal.target_xp || '';
    document.getElementById('targetStreak').value = goal.target_streak || '';
    document.getElementById('targetTasks').value = goal.target_tasks || '';
    document.getElementById('goalDeadline').value = goal.deadline || '';

    // Update input visibility based on goal type
    updateGoalTypeInputs();

    // Open modal
    openGoalModal();
}

function createGoalElement(goal) {
    const div = document.createElement('div');
    div.className = `goal-item ${goal.status === 'completed' ? 'completed' : ''}`;
    div.id = `goal-${goal.id}`;

    const goalType = goal.goal_type || 'xp';
    let current, target, label, progress;
    const isCompleted = goal.status === 'completed';

    if (goalType === 'xp') {
        current = goal.current_xp || 0;
        target = goal.target_xp || 0;
        label = 'XP';
        progress = target > 0 ? Math.min((current / target) * 100, 100) : 0;
    } else if (goalType === 'streak') {
        current = goal.current_streak || 0;
        target = goal.target_streak || 0;
        label = 'Days';
        progress = target > 0 ? Math.min((current / target) * 100, 100) : 0;
    } else if (goalType === 'tasks') {
        current = goal.current_tasks || 0;
        target = goal.target_tasks || 0;
        label = 'Tasks';
        progress = target > 0 ? Math.min((current / target) * 100, 100) : 0;
    } else {
        current = goal.current_xp || 0;
        target = goal.target_xp || 0;
        label = 'XP';
        progress = target > 0 ? Math.min((current / target) * 100, 100) : 0;
    }

    // For completed goals, show full progress bar
    if (isCompleted) {
        progress = 100;
    }

    div.innerHTML = `
        <div class="goal-content">
            <h3 class="goal-title">${goal.title}</h3>
            ${goal.description ? `<p class="goal-description">${goal.description}</p>` : ''}
        </div>
        <div class="goal-header">
            <div class="goal-type-badge ${isCompleted ? 'completed' : ''}">${goalType.toUpperCase()}</div>
            <div class="goal-utility-buttons">
                ${!isCompleted ? `<button type="button" class="goal-utility-btn" onclick="addProgressToGoal('${goal.id}', 1)">+1</button>` : ''}
                ${!isCompleted ? `<button class="goal-utility-btn edit" onclick="editGoal('${goal.id}')">Edit</button>` : ''}
                <button class="goal-utility-btn delete" onclick="deleteGoal('${goal.id}')">Delete</button>
            </div>
        </div>
        <div class="goal-stats">
            <span class="goal-metric">${current} / ${target} ${label}</span>
            ${goal.deadline ? `<span class="goal-deadline">Deadline: ${formatDate(goal.deadline)}</span>` : ''}
            ${isCompleted ? `<span class="goal-completed-badge">✓ COMPLETED</span>` : ''}
        </div>
        <div class="progress-bar-container">
            <div class="progress-bar-fill ${isCompleted ? 'completed' : ''}" style="width: ${progress}%"></div>
        </div>
        <div class="progress-text">${progress.toFixed(1)}%</div>
        ${!isCompleted ? `
        <div class="goal-controls">
            <input type="number" id="progress-input-${goal.id}" placeholder="${label}" min="1" onkeypress="handleProgressInputKeypress(event, '${goal.id}')">
            <button type="button" onclick="setProgressToGoal('${goal.id}')">Set</button>
        </div>
        ` : ''}
    `;

    return div;
}

async function saveGoal() {
    const editingGoalId = document.getElementById('editingGoalId').value;
    const titleInput = document.getElementById('goalTitle');
    const title = titleInput.value.trim();
    const description = document.getElementById('goalDescription').value.trim();
    const goalType = document.getElementById('goalType').value;
    const targetXPInput = document.getElementById('targetXP');
    const targetXP = parseInt(targetXPInput.value) || 0;
    const targetStreakInput = document.getElementById('targetStreak');
    const targetStreak = parseInt(targetStreakInput.value) || 0;
    const targetTasksInput = document.getElementById('targetTasks');
    const targetTasks = parseInt(targetTasksInput.value) || 0;
    const deadline = document.getElementById('goalDeadline').value;
    const deadlineInput = document.getElementById('goalDeadline');

    let hasError = false;

    if (!title) {
        titleInput.classList.add('invalid-input');
        hasError = true;
    } else {
        titleInput.classList.remove('invalid-input');
    }

    if (goalType === 'xp' && !targetXP) {
        targetXPInput.classList.add('invalid-input');
        hasError = true;
    } else {
        targetXPInput.classList.remove('invalid-input');
    }
    
    if (goalType === 'streak' && !targetStreak) {
        targetStreakInput.classList.add('invalid-input');
        hasError = true;
    } else {
        targetStreakInput.classList.remove('invalid-input');
    }
    
    if (goalType === 'tasks' && !targetTasks) {
        targetTasksInput.classList.add('invalid-input');
        hasError = true;
    } else {
        targetTasksInput.classList.remove('invalid-input');
    }

    // Validate deadline - cannot be today or in the past
    if (deadline) {
        // Parse the deadline date as local time (not UTC)
        const deadlineParts = deadline.split('-');
        const deadlineDate = new Date(deadlineParts[0], deadlineParts[1] - 1, deadlineParts[2]);
        
        // Get today's date at midnight local time
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (deadlineDate <= today) {
            deadlineInput.classList.add('invalid-date');
            hasError = true;
        } else {
            deadlineInput.classList.remove('invalid-date');
        }
    } else {
        deadlineInput.classList.remove('invalid-date');
    }

    if (hasError) {
        return;
    }

    if (!currentUser) {
        alert('Please log in to create goals');
        return;
    }

    const goalData = {
        username: currentUser,
        title: title,
        description: description,
        goal_type: goalType,
        target_xp: targetXP,
        target_streak: targetStreak,
        target_tasks: targetTasks,
        deadline: deadline
    };

    if (editingGoalId) {
        // Edit existing goal - preserve current progress
        const existingGoal = allGoals.find(g => g.id === editingGoalId);
        if (existingGoal) {
            goalData.id = editingGoalId;
            goalData.current_xp = existingGoal.current_xp || 0;
            goalData.current_streak = existingGoal.current_streak || 0;
            goalData.current_tasks = existingGoal.current_tasks || 0;
            goalData.status = existingGoal.status;

            // Check if editing would complete the goal
            let wouldComplete = false;
            if (goalType === 'xp' && targetXP <= existingGoal.current_xp) {
                wouldComplete = true;
            } else if (goalType === 'streak' && targetStreak <= existingGoal.current_streak) {
                wouldComplete = true;
            } else if (goalType === 'tasks' && targetTasks <= existingGoal.current_tasks) {
                wouldComplete = true;
            }

            if (wouldComplete) {
                // Show completion confirmation modal
                openCompletionModal(goalData);
                return;
            }
        }

        try {
            const response = await fetch('/api/update_goal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(goalData)
            });
            const data = await response.json();
            if (data.success) {
                // Update the goal in the allGoals array
                const goalIndex = allGoals.findIndex(g => g.id === editingGoalId);
                if (goalIndex !== -1) {
                    allGoals[goalIndex] = {
                        ...allGoals[goalIndex],
                        title: title,
                        description: description,
                        goal_type: goalType,
                        target_xp: targetXP,
                        target_streak: targetStreak,
                        target_tasks: targetTasks,
                        deadline: deadline
                    };
                    // Update the DOM element directly
                    updateGoalElement(editingGoalId, allGoals[goalIndex]);
                }
                closeGoalModal();
            } else {
                alert('Error updating goal: ' + (data.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error updating goal:', error);
            alert('Error updating goal. Please try again.');
        }
    } else {
        // Add new goal
        try {
                const response = await fetch('/api/add_goal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(goalData)
            });

            const data = await response.json();

            if (data.success) {
                closeGoalModal();
                loadGoals();
            } else {
                alert('Error adding goal: ' + (data.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error adding goal:', error);
            alert('Error adding goal. Please try again.');
        }
    }
}

async function deleteGoal(goalId) {
    openDeleteModal(goalId);
}

async function confirmDelete() {
    if (!goalToDelete) {
        return;
    }

    try {
        const response = await fetch('/api/delete_goal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ goal_id: goalToDelete })
        });

        const data = await response.json();

        if (data.success) {
            // Capture the id before closeDeleteModal() clears goalToDelete.
            const deletedId = goalToDelete;
            closeDeleteModal();
            // Sleek pop-away, then reload the list (like the dashboard tasks).
            const el = document.getElementById(`goal-${deletedId}`);
            if (el) {
                el.classList.add('removing');
                setTimeout(() => loadGoals(), 520);
            } else {
                loadGoals();
            }
        }
    } catch (error) {
        console.error('Error deleting goal:', error);
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

document.getElementById('goalTitle').addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        addGoal();
    }
});