// goal-notify.js
// Dashboard notifications for finished goals.
//
// A goal can be completed through several paths (a task completion advancing a
// "tasks" goal server-side, the XP-goal automation, the +1/Set buttons, or an
// edit on the goals page), but every path ends the same way: the goal's status
// becomes "completed" in goals.json. So rather than hook each path, this watcher
// polls the user's goals and pops a toast — "Goal {goal_name} was completed" —
// the moment a goal it hasn't already announced shows up completed.
//
// A per-user marker of already-announced goal ids (persisted in localStorage)
// means each finished goal is announced exactly once, pre-existing completions
// never fire on first load, and a goal that finished on another page still gets
// announced the next time the dashboard is open.

(function () {
    function getUser() {
        return localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    }

    // Per-user list of goal ids we've already announced as completed.
    function markerKey(u) { return 'dashboardNotifiedGoals_' + u; }

    function readNotified(username) {
        try {
            const raw = localStorage.getItem(markerKey(username));
            if (raw === null) return null; // null => never baselined for this user
            const arr = JSON.parse(raw);
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            return [];
        }
    }

    function writeNotified(username, ids) {
        try {
            localStorage.setItem(markerKey(username), JSON.stringify(ids));
        } catch (e) {}
    }

    // --- Toast UI -----------------------------------------------------------
    function ensureToastStyles() {
        if (document.getElementById('goal-notify-styles')) return;
        const style = document.createElement('style');
        style.id = 'goal-notify-styles';
        style.textContent = `
            #goalNotifyContainer {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 2000;
                display: flex;
                flex-direction: column;
                gap: 10px;
                pointer-events: none;
            }
            .goal-notify-toast {
                pointer-events: auto;
                display: flex;
                align-items: center;
                gap: 10px;
                min-width: 240px;
                max-width: 360px;
                padding: 14px 18px;
                background: #2C302E;
                color: #fff;
                border-left: 4px solid #A38A70;
                border-radius: 8px;
                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
                font-family: 'Inter', system-ui, sans-serif;
                font-size: 14px;
                line-height: 1.35;
                animation: goalNotifyIn 0.35s ease-out;
            }
            .goal-notify-toast.leaving {
                animation: goalNotifyOut 0.35s ease-in forwards;
            }
            .goal-notify-toast .goal-notify-check {
                flex-shrink: 0;
                width: 22px;
                height: 22px;
                color: #A38A70;
            }
            .goal-notify-toast strong { color: #C9B79C; }
            @keyframes goalNotifyIn {
                from { opacity: 0; transform: translateX(30px); }
                to   { opacity: 1; transform: translateX(0); }
            }
            @keyframes goalNotifyOut {
                from { opacity: 1; transform: translateX(0); }
                to   { opacity: 0; transform: translateX(30px); }
            }`;
        document.head.appendChild(style);
    }

    function getContainer() {
        let container = document.getElementById('goalNotifyContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'goalNotifyContainer';
            document.body.appendChild(container);
        }
        return container;
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function showToast(goalName) {
        ensureToastStyles();
        const container = getContainer();

        const toast = document.createElement('div');
        toast.className = 'goal-notify-toast';
        toast.innerHTML = `
            <svg class="goal-notify-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="m9 12 2 2 4-4"/>
            </svg>
            <span>Goal <strong>${escapeHtml(goalName)}</strong> was completed</span>`;
        container.appendChild(toast);

        // Auto-dismiss after a few seconds with a graceful exit.
        setTimeout(() => {
            toast.classList.add('leaving');
            setTimeout(() => toast.remove(), 360);
        }, 4500);
    }

    // --- Watcher ------------------------------------------------------------
    async function check() {
        const username = getUser();
        if (!username || username === 'Default') return;

        let goals;
        try {
            const res = await fetch(`/api/get_goals?username=${encodeURIComponent(username)}`);
            const data = await res.json();
            if (!data || !data.success) return;
            goals = data.goals || [];
        } catch (e) {
            return;
        }

        const completedIds = goals
            .filter(g => g.status === 'completed')
            .map(g => String(g.id));

        let notified = readNotified(username);

        // First time we've ever looked for this account: baseline to whatever is
        // already completed so historical completions don't all toast at once.
        if (notified === null) {
            writeNotified(username, completedIds);
            return;
        }

        const notifiedSet = new Set(notified);
        let changed = false;

        goals.forEach(goal => {
            if (goal.status !== 'completed') return;
            const id = String(goal.id);
            if (notifiedSet.has(id)) return;
            showToast(goal.title || 'Goal');
            notifiedSet.add(id);
            changed = true;
        });

        if (changed) {
            writeNotified(username, Array.from(notifiedSet));
        }
    }

    // Expose so a task completion can trigger an immediate check (see dashboard).
    window.checkGoalCompletions = check;

    document.addEventListener('DOMContentLoaded', check);
    setInterval(check, 2000);
})();
