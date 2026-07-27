// api.js - Handles all API calls with improved error handling and cache busting

/**
 * Helper function to handle boilerplate for all API calls.
 * This ensures we always check if the server actually succeeded.
 */
async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',   // always pull fresh data (e.g. live streak) on every call
        ...options,
    });

    // Check if the response is in the 200-299 range
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP Error: ${response.status}`);
    }

    return response.json();
}

/**
 * Fetches a daily quote from API Ninjas with categories success,wisdom
 */
async function fetchDailyQuoteAPI() {
    try {
        const url = 'https://api.api-ninjas.com/v2/randomquotes?categories=success,wisdom';

        const response = await fetch(url, {
            headers: {
                'X-Api-Key': 'rwDm3Irql9pyouTq9m0bdbHfZA2D8hjLFr9aDHeY'
            }
        });

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();

        if (data && data.length > 0) {
            return {
                content: data[0].quote,
                author: data[0].author
            };
        }

        return null;
    } catch (error) {
        console.error('Error fetching quote:', error);
        return null;
    }
}

async function saveStatsToBackend(username, level, xp, tasksCompleted) {
    try {
        return await apiRequest('/api/update_stats', {
            method: 'POST',
            body: JSON.stringify({
                username,
                level,
                xp,
                tasks_completed: tasksCompleted
            })
        });
    } catch (error) {
        console.error('Error saving stats:', error);
    }
}

async function addTaskToBackend(task) {
    try {
        return await apiRequest('/api/add_task', {
            method: 'POST',
            body: JSON.stringify(task)
        });
    } catch (error) {
        console.error('Error adding task:', error);
    }
}

/**
 * IMPROVED: Uses the DELETE method (standard practice)
 */
async function deleteTaskFromBackend(taskId) {
    try {
        return await apiRequest('/api/delete_task', {
            method: 'POST', // Use POST if your Flask route is set to methods=['POST']
            body: JSON.stringify({ id: taskId })
        });
    } catch (error) {
        console.error('Error deleting task:', error);
    }
}

/**
 * Delete task without tracking XP/streak/tasks completed (for timer termination)
 */
async function deleteTaskFromBackendWithoutTracking(taskId) {
    try {
        return await apiRequest('/api/delete_task_no_tracking', {
            method: 'POST',
            body: JSON.stringify({ id: taskId })
        });
    } catch (error) {
        console.error('Error deleting task without tracking:', error);
    }
}

async function getUserDataAPI(username) {
    try {
        // Encodes the username to handle spaces or special characters safely
        const safeUsername = encodeURIComponent(username);
        return await apiRequest(`/api/get_user_data?username=${safeUsername}`);
    } catch (error) {
        console.error('Error loading user data:', error);
        return null;
    }
}

async function getTasksAPI(username) {
    try {
        const safeUsername = encodeURIComponent(username);
        return await apiRequest(`/api/tasks?username=${safeUsername}`);
    } catch (error) {
        console.error('Error loading tasks:', error);
        return null;
    }
}

async function createTaskAPI(taskData) {
    try {
        return await apiRequest('/api/tasks', {
            method: 'POST',
            body: JSON.stringify(taskData)
        });
    } catch (error) {
        console.error('Error creating task:', error);
        return { success: false, message: error.message };
    }
}

async function updateTaskAPI(taskId, taskData) {
    try {
        return await apiRequest(`/api/tasks/${taskId}`, {
            method: 'PUT',
            body: JSON.stringify(taskData)
        });
    } catch (error) {
        console.error('Error updating task:', error);
        return { success: false, message: error.message };
    }
}

async function deleteTaskAPI(taskId, username) {
    try {
        const safeUsername = encodeURIComponent(username);
        return await apiRequest(`/api/tasks/${taskId}?username=${safeUsername}`, {
            method: 'DELETE'
        });
    } catch (error) {
        console.error('Error deleting task:', error);
        return { success: false, message: error.message };
    }
}

async function signupAPI(username, password) {
    try {
        return await apiRequest('/api/signup', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    } catch (error) {
        console.error('Error signing up:', error);
        return { success: false, message: error.message };
    }
}

async function loginAPI(username, password) {
    try {
        return await apiRequest('/api/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    } catch (error) {
        console.error('Error logging in:', error);
        return { success: false, message: "Invalid credentials or server error." };
    }
}

async function trackTaskCompletion(taskId, username, taskXP) {
    try {

        // Call the complete_task endpoint to handle XP, stats, and task status
        const completeResponse = await apiRequest('/api/complete_task', {
            method: 'POST',
            body: JSON.stringify({
                username: username,
                task_id: taskId
            })
        });

        if (completeResponse.success) {

            // Update UI with backend-calculated values
            if (typeof updateStatsUI === 'function') {
                updateStatsUI(
                    completeResponse.new_xp,
                    completeResponse.new_level,
                    completeResponse.xp_required,
                    completeResponse.new_tasks_completed
                );
            }

            // Send task completion data to calendar.js for green completion state

            if (typeof markTaskCompletedInCalendar === 'function') {
                markTaskCompletedInCalendar(completeResponse.task_id, completeResponse.completion_status);
            } else if (typeof window.markTaskCompletedInCalendar === 'function') {
                window.markTaskCompletedInCalendar(completeResponse.task_id, completeResponse.completion_status);
            } else if (typeof window.markDashboardTaskCompletedInCalendar === 'function') {
                window.markDashboardTaskCompletedInCalendar(completeResponse.task_id, completeResponse.completion_status);
            } else {
                console.error('❌ markTaskCompletedInCalendar is not available!');
                console.error('❌ Available window functions:', Object.keys(window).filter(key => key.includes('mark')));
            }

            // Mark task as completed in calendar using task_backend.py
            await apiRequest('/api/mark_task_completed_in_calendar', {
                method: 'POST',
                body: JSON.stringify({
                    task_id: taskId,
                    username: username
                })
            });

            return completeResponse;
        } else {
            console.error('❌ TASK COMPLETION FAILED:', completeResponse);
            return { success: false, message: 'Task completion failed' };
        }
    } catch (error) {
        console.error('❌ ERROR COMPLETING TASK:', error);
        return { success: false, message: error.message };
    }
}

async function signupAPI(username, password) {
    try {
        return await apiRequest('/api/signup', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    } catch (error) {
        console.error('Error signing up:', error);
        return { success: false, message: error.message };
    }
}

async function updateTaskDueDate(taskId, username, newDueDate) {
    try {
        const response = await apiRequest('/api/update_task_due_date', {
            method: 'POST',
            body: JSON.stringify({
                id: taskId,
                username: username,
                due_date: newDueDate
            })
        });

        return response;
    } catch (error) {
        console.error('Error updating task due date:', error);
        return { success: false, message: error.message };
    }
}
