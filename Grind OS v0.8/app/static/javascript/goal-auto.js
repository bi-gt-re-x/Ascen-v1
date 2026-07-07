// goal-auto.js
// Auto-complete XP goals from task completions.
//
// Flow: a task is completed on the dashboard -> the backend records its XP ->
// this script (on the goals page) polls the backend for the latest completed
// task XP, logs it, and calls the automation endpoint to apply that XP to the
// user's active XP goals (completing any that reach their target), then
// refreshes the list so the progress/completion is visible.
//
// Logs only:  Task Completed(<xp> xp)

(function () {
    function getUser() {
        return localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    }

    // Per-user marker of the last completion we've already applied, persisted so
    // the credit survives navigation/reloads and is never applied twice.
    function markerKey(u) { return 'goalAutoLastTaskAt_' + u; }

    async function applyXpToGoals(username, xp) {
        try {
            const res = await fetch('/api/auto_apply_task_xp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username, xp: xp })
            });
            const data = await res.json();
            if (data && data.success) {
                // Refresh the visible goals so the new progress/completion shows.
                // filterGoals() (used by loadGoals) only creates missing items and
                // won't refresh an existing goal's content, so drop the current
                // goal elements first and let loadGoals() rebuild them from fresh
                // data.
                const list = document.getElementById('goalsList');
                if (list) {
                    list.querySelectorAll('.goal-item').forEach(function (el) { el.remove(); });
                }
                if (typeof loadGoals === 'function') {
                    loadGoals();
                }
            }
            return data;
        } catch (e) {
            return null;
        }
    }

    async function poll() {
        const username = getUser();
        if (!username) return;

        let data;
        try {
            const res = await fetch(`/api/last_task_completion?username=${encodeURIComponent(username)}`);
            data = await res.json();
        } catch (e) {
            return;
        }
        if (!data || !data.success) return;

        const at = parseInt(data.at || 0, 10) || 0;
        const key = markerKey(username);
        const stored = localStorage.getItem(key);

        // First time we ever see this account: baseline to the latest completion
        // so pre-existing completions (from before this feature) aren't applied.
        if (stored === null) {
            localStorage.setItem(key, String(at));
            return;
        }

        // Already applied this completion (live, or on a previous visit)? Skip.
        if (at <= (parseInt(stored, 10) || 0)) return;

        // New completion — mark it applied first so it can never double-apply the
        // cumulative XP, then log + apply. This also catches up completions that
        // happened while the goals page was closed, so the added XP shows on
        // re-entry without pressing +1.
        localStorage.setItem(key, String(at));
        const xp = data.xp || 0;
        console.log('Task Completed(' + xp + ' xp)');
        applyXpToGoals(username, xp);
    }

    // Expose for tests / manual triggering.
    window.autoApplyTaskXp = applyXpToGoals;

    poll();
    setInterval(poll, 2000);
})();
