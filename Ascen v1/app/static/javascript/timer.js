// Timer Logic
let timers = {};

// Load timers from localStorage on startup
function loadTimers() {
    const storedTimers = localStorage.getItem('taskTimers');
    if (storedTimers) { 
        const parsedTimers = JSON.parse(storedTimers);
        const now = Date.now();

        for (const taskId in parsedTimers) {
            const timerData = parsedTimers[taskId];

            // If it's a countdown and finished while away
            if (
                (timerData.type === 'countdown' ||
                timerData.type === 'due_date_countdown')
                && timerData.endTime
                && now >= timerData.endTime
            ) {
                timers[taskId] = timerData;
                restoreOverdueState(taskId);
                continue;
            }
        }
    }
}

function saveTimers() {
    localStorage.setItem('taskTimers', JSON.stringify(timers));
}

function startTaskTimer(taskId, durationSeconds = null, dueDate = null) {
    const now = Date.now();

    if (dueDate) {
        // Countdown to due date
        const dueDateTime = new Date(dueDate).getTime();
        console.log('Timer start - dueDate:', dueDate, 'dueDateTime:', dueDateTime, 'now:', now);
        timers[taskId] = {
            type: 'due_date_countdown',
            startTime: now,
            endTime: dueDateTime,
            dueDate: dueDate
        };
    } else if (durationSeconds) {
        // Countdown with duration
        timers[taskId] = {
            type: 'countdown',
            startTime: now,
            endTime: now + (durationSeconds * 1000),
            duration: durationSeconds
        };
    } else {
        // Count up (Stopwatch)
        timers[taskId] = {
            type: 'countup',
            startTime: now
        };
    }

    saveTimers();
    startTimerInterval(taskId);

    // Update display immediately for all timer types
    updateTimerDisplay(taskId);
}

function stopTaskTimer(taskId) {
    if (timers[taskId]) {
        clearInterval(timers[taskId].intervalId);
        delete timers[taskId];
        saveTimers();

        const displayElement = document.getElementById(`timer-${taskId}`);
        if (displayElement) {
            displayElement.textContent = "";
        }
    }
}

function startTimerInterval(taskId) {
    // Clear existing interval if any
    if (timers[taskId].intervalId) {
        clearInterval(timers[taskId].intervalId);
    }

    // Set interval to update every second
    timers[taskId].intervalId = setInterval(() => {
        updateTimerDisplay(taskId);
    }, 1000);

    // For countdown timers, update display after a small delay to show exact initial time
    const timerData = timers[taskId];
    if (timerData && (timerData.type === 'countdown' || timerData.type === 'due_date_countdown')) {
        setTimeout(() => {
            updateTimerDisplay(taskId);
        }, 50); // Small delay to ensure exact time display
    }
}

function updateTimerDisplay(taskId) {
    const timerData = timers[taskId];
    if (!timerData) {
        console.log('No timer data for task:', taskId);
        return;
    }

    const displayElement = document.getElementById(`timer-${taskId}`);
    if (!displayElement) {
        console.log('No display element for task:', taskId);
        return;
    }

    const now = Date.now();
    let timeString = "";

    if (timerData.type === 'due_date_countdown') {
        const remaining = timerData.endTime - now;
        console.log('Updating due_date_countdown - remaining:', remaining, 'endTime:', timerData.endTime, 'now:', now);

        if (remaining <= 0) {
            timeString = "Time's up!";
            timerData.completed = true;
            saveTimers();
            // Clear the interval to prevent multiple completions
            if (timerData.intervalId) {
                clearInterval(timerData.intervalId);
                timerData.intervalId = null;
            }
            // Trigger UI changes
            onTimerComplete(taskId);
        } else {
            const remainingTime = formatTime(remaining);
            timeString = remainingTime;
        }
    } else if (timerData.type === 'countdown') {
        const remaining = timerData.endTime - now;

        if (remaining <= 0) {
            timeString = "Time's up!";
            timerData.completed = true;
            saveTimers();
            // Clear the interval to prevent multiple completions
            if (timerData.intervalId) {
                clearInterval(timerData.intervalId);
                timerData.intervalId = null;
            }
            // Trigger UI changes
            onTimerComplete(taskId);
            // Optional: Play sound or alert
        } else {
            const remainingTime = formatTime(remaining);
            timeString = remainingTime;
        }
    } else {
        // Count up
        const elapsed = now - timerData.startTime;
        timeString = formatTime(elapsed);
    }

    displayElement.textContent = timeString;
}

function onTimerComplete(taskId) {
    const taskElement = document.getElementById(`task-${taskId}`);
    const timerDisplay = document.getElementById(`timer-${taskId}`);
    
    // Send timer expiration notification to backend
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser && typeof fetch === 'function') {
        fetch('/api/timer_expired', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                task_id: taskId,
                username: currentUser
            })
        }).then(response => response.json())
        .then(data => {
            console.log('✅ Timer expiration sent to backend:', data);
        })
        .catch(error => {
            console.error('❌ Error sending timer expiration to backend:', error);
        });
    }
    
    if (taskElement) {
        // Add red styling to timer display specifically
        if (timerDisplay) {
            timerDisplay.classList.add('expired');
        }
        
        // Also add red styling to entire task element (existing behavior)
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
                terminateTask(taskId);
            };

            // Check if More Time button already exists
            let moreTimeBtn = taskElement.querySelector('.more-time-btn');
            if (!moreTimeBtn) {
                // Add More Time button only if it doesn't exist
                moreTimeBtn = document.createElement('button');
                moreTimeBtn.textContent = 'More Time';
                moreTimeBtn.className = 'more-time-btn';
                moreTimeBtn.onclick = function() {
                    addMoreTime(taskId);
                };

                const taskRight = taskElement.querySelector('.task-right');
                if (taskRight) {
                    taskRight.insertBefore(moreTimeBtn, deleteBtn);
                }
            }
        }
    }
}

function restoreOverdueState(taskId) {
    const taskElement = document.getElementById(`task-${taskId}`);
    const timerDisplay = document.getElementById(`timer-${taskId}`);
    
    // Clear the timer interval to prevent it from running in the background
    if (timers[taskId] && timers[taskId].intervalId) {
        clearInterval(timers[taskId].intervalId);
        timers[taskId].intervalId = null;
    }
    
    if (taskElement && timerDisplay) {
        // Set timer display to "Time's up!"
        timerDisplay.textContent = "Time's up!";
        
        // Add red styling to timer display specifically
        timerDisplay.classList.add('expired');
        
        // Also add red styling and flashing animation to entire task element (existing behavior)
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
                terminateTask(taskId);
            };

            // Check if More Time button already exists
            let moreTimeBtn = taskElement.querySelector('.more-time-btn');
            if (!moreTimeBtn) {
                // Add More Time button only if it doesn't exist
                moreTimeBtn = document.createElement('button');
                moreTimeBtn.textContent = 'More Time';
                moreTimeBtn.className = 'more-time-btn';
                moreTimeBtn.onclick = function() {
                    addMoreTime(taskId);
                };

                const taskRight = taskElement.querySelector('.task-right');
                if (taskRight) {
                    taskRight.insertBefore(moreTimeBtn, deleteBtn);
                }
            }
        }
    }
}

function terminateTask(taskId) {
    const taskElement = document.getElementById(`task-${taskId}`);
    if (taskElement) {
        // Remove immediately without animation
        stopTaskTimer(taskId);

        if (taskElement.parentNode) {
            taskElement.parentNode.removeChild(taskElement);
        }

        // Delete from backend without tracking completion
        if (typeof deleteTaskFromBackendWithoutTracking === 'function') {
            deleteTaskFromBackendWithoutTracking(taskId);
        }

        // Remove from calendar data structure
        if (typeof removeTaskFromCalendar === 'function') {
            removeTaskFromCalendar(taskId);
        }
    }
}

function addMoreTime(taskId) {
    // Open the custom modal instead of using prompt
    if (typeof openMoreTimeModal === 'function') {
        openMoreTimeModal(taskId);
    }
}

function addMoreTimeToTask(taskId, additionalSeconds) {
    console.log("ADD MORE TIME RUNNING");
    console.log("taskId:", taskId);
    console.log("timerData:", timers[taskId]);

    const timerData = timers[taskId];

    if (timerData && (timerData.type === 'countdown' || timerData.type === 'due_date_countdown')) {
        // Clear existing interval before updating data
        if (timerData.intervalId) {
            clearInterval(timerData.intervalId);
            timerData.intervalId = null;
        }
        
        const now = Date.now();

    if (timerData.endTime <= now) {
    // Task already overdue, restart from now
    timerData.endTime = now + (additionalSeconds * 1000);
} else {
    // Task still active, extend existing deadline
    timerData.endTime += (additionalSeconds * 1000);
}

        timerData.completed = false;
        saveTimers();

        // Update backend with new due date
        const currentUser = localStorage.getItem('currentUser');
        if (currentUser && typeof updateTaskDueDate === 'function') {
            const newDueDate = new Date(timerData.endTime).toISOString();
            updateTaskDueDate(taskId, currentUser, newDueDate);
        }

        // Remove red styling from both timer display and task element
        const taskElement = document.getElementById(`task-${taskId}`);
        const timerDisplay = document.getElementById(`timer-${taskId}`);
        
        if (timerDisplay) {
            timerDisplay.classList.remove('expired');
        }
        
        if (taskElement) {
            taskElement.classList.remove('timer-completed');

            // Remove More Time button and restore Done button
            const moreTimeBtn = taskElement.querySelector('.more-time-btn');
            if (moreTimeBtn) {
                moreTimeBtn.remove();
            }

            const deleteBtn = taskElement.querySelector('.delete-btn');
            if (deleteBtn) {
                deleteBtn.textContent = 'Done';
                deleteBtn.onclick = function() {
                    // Get task XP for callback
                    const taskXP = deleteBtn.dataset.xpReward || 0;
                    // Use the appropriate deletion handler based on what's available
                    if (typeof handleTaskDeletion === 'function') {
                        handleTaskDeletion(taskId, taskXP, taskElement);
                    } else if (typeof handleTaskDeletionWithGrowthTracking === 'function') {
                        handleTaskDeletionWithGrowthTracking(taskId, taskXP, taskElement, currentUser);
                    }
                };
            }

            // Update dashboard due date display
            const dueDateDiv = taskElement.querySelector('.task-due-date');
            if (dueDateDiv) {
                const newDueDate = new Date(timerData.endTime);
                const formattedDate = newDueDate.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                });
                const formattedTime = newDueDate.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                });
                dueDateDiv.textContent = `Due: ${formattedDate} at ${formattedTime}`;
            }
        }

        // Update calendar due date if task has due date
        if (typeof updateTaskDueDateInCalendar === 'function') {
            const newDueDate = new Date(timerData.endTime);
            updateTaskDueDateInCalendar(taskId, newDueDate);
        }

        // Restart the timer interval and update display immediately
        startTimerInterval(taskId);
        updateTimerDisplay(taskId);
        
        console.log('Task rescheduled on calendar with new due date:', new Date(timerData.endTime));
    }
}

function formatTime(ms) {
    // Handle negative or zero time
    if (ms <= 0) {
        return "00:00";
    }

    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (num) => num.toString().padStart(2, '0');

    if (hours > 0) {
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    } else {
        return `${pad(minutes)}:${pad(seconds)}`;
    }
}

function formatDueTime(endTime) {
    const dueDate = new Date(endTime);
    const now = new Date();
    
    // If due date is today, show time only
    if (dueDate.toDateString() === now.toDateString()) {
        return dueDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    } else {
        // If due date is tomorrow or later, show date and time
        return dueDate.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', loadTimers);