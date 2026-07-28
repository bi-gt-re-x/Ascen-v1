"""Goals — "earn N XP", "reach an N-day streak", "complete N tasks", "focus N minutes".

Only XP and task goals are hand-fed, and even those are fed by the app rather
than by the user: completing a task adds its XP to every active XP goal and
counts one toward every active tasks goal.

Streak and focus goals track themselves. A streak goal simply follows the
account's live streak — up as it grows, back to zero when it breaks — and a
focus goal measures the focus time accumulated *since the goal was set*, by
remembering the account's lifetime focus total at creation as a baseline. Both
are re-synced on every read, so the goals page and the toast watcher polling it
always see live values.
"""
from datetime import datetime

from flask import Blueprint, jsonify, render_template, request

from backend.database import connection as db
from backend.tracking import focus as focus_tracking
from backend.tracking import xp as xp_tracking
from backend.tracking.auth import load_user

bp = Blueprint('goals', __name__)

# The four kinds of goal, and which pair of fields each one counts with.
GOAL_FIELDS = {
    'xp': ('current_xp', 'target_xp'),
    'streak': ('current_streak', 'target_streak'),
    'tasks': ('current_tasks', 'target_tasks'),
    'focus': ('current_focus', 'target_focus'),
}


@bp.route('/goals')
def page():
    return render_template('goals.html')


def _clamp_priority(value):
    """Priority rank 1-10 (default 5) — tolerate junk input."""
    try:
        return max(1, min(10, int(value)))
    except (ValueError, TypeError):
        return 5


def _progress(value, target):
    return round((value / target) * 100, 1) if target else 0


def _goals_of(goals, username, goal_type=None, unfinished=False):
    out = []
    for goal in goals:
        if goal.get('user_id') != username:
            continue
        if goal_type and goal.get('goal_type') != goal_type:
            continue
        if unfinished and goal.get('status') == 'completed':
            continue
        out.append(goal)
    return out


# --------------------------------------------------------------------------
# Automation: what a completed task does to the user's goals
# --------------------------------------------------------------------------
def apply_task_xp(username, xp):
    """Add `xp` to every active XP goal, completing any that reach their target.

    Each XP goal means "earn N XP", so a completed task's XP counts toward all
    of them. Returns a summary of what changed.
    """
    try:
        xp = int(xp)
    except (ValueError, TypeError):
        xp = 0

    if not username or xp <= 0:
        return {"updated": [], "completed": []}

    goals = db.goals()
    updated = []
    completed = []

    for goal in _goals_of(goals, username, 'xp', unfinished=True):
        target = goal.get('target_xp', 0) or 0
        new_value = (goal.get('current_xp', 0) or 0) + xp
        if target and new_value > target:
            new_value = target
        is_done = bool(target) and new_value >= target

        goal['current_xp'] = new_value
        goal['progress'] = _progress(new_value, target)
        goal['target_value'] = target
        goal['status'] = 'completed' if is_done else 'active'

        info = {"id": goal.get('id'), "title": goal.get('title'),
                "current_xp": new_value, "target_xp": target,
                "status": goal['status']}
        updated.append(info)
        if is_done:
            completed.append(info)

    if updated:
        db.save_goals(goals)
    return {"updated": updated, "completed": completed}


def apply_task_completion(username):
    """Count one completed task toward every active "complete N tasks" goal.

    Mirrors how earned XP advances every active XP goal. Runs server-side on
    each completion, so the goals page reflects it whether or not it is open.
    """
    goals = db.goals()
    changed = False
    for goal in _goals_of(goals, username, 'tasks', unfinished=True):
        target = goal.get('target_tasks', 0) or 0
        new_value = (goal.get('current_tasks', 0) or 0) + 1
        if target and new_value > target:
            new_value = target
        goal['current_tasks'] = new_value
        goal['target_value'] = target
        goal['progress'] = _progress(new_value, target)
        goal['status'] = 'completed' if (target and new_value >= target) else 'active'
        changed = True
    if changed:
        db.save_goals(goals)


@bp.route('/api/auto_apply_task_xp', methods=['POST'])
def auto_apply_task_xp():
    """Apply a completed task's XP to the user's active XP goals."""
    data = request.json or {}
    username = data.get('username')
    if not username:
        return jsonify({"success": False, "message": "Username required"})
    return jsonify({"success": True, **apply_task_xp(username, data.get('xp', 0))})


# --------------------------------------------------------------------------
# Self-tracking goals
# --------------------------------------------------------------------------
def sync_streak_goals(username):
    """Keep every streak goal in lockstep with the account's live streak.

    A streak goal means "reach an N-day streak", so its current value should
    follow the real streak — the same number the dashboard shows — tracking it
    up as it grows and back down to zero when it breaks. Completion follows the
    same number: completed once the streak reaches the target, active again if
    it falls back below.
    """
    users, user = load_user(username)
    if not user:
        return
    # Decay a stale streak first so goals follow the same live value everywhere.
    if xp_tracking.refresh_streak(user):
        db.save_users(users)
    current_streak = user.get('current_streak', 0) or 0

    goals = db.goals()
    changed = False
    for goal in _goals_of(goals, username, 'streak'):
        target = goal.get('target_streak', 0) or 0
        # Cap at the target so a completed goal reads "N / N Days".
        new_value = min(current_streak, target) if target else current_streak
        new_status = 'completed' if (target and new_value >= target) else 'active'
        new_progress = _progress(new_value, target)
        if (goal.get('current_streak') != new_value
                or goal.get('status') != new_status
                or goal.get('progress') != new_progress
                or goal.get('target_value') != target):
            goal['current_streak'] = new_value
            goal['status'] = new_status
            goal['progress'] = new_progress
            goal['target_value'] = target
            changed = True
    if changed:
        db.save_goals(goals)


def sync_focus_goals(username):
    """Advance focus goals from the tracked focus history.

    A focus goal's current value is the focus time accumulated since it was set
    — the account's lifetime tracked seconds minus the baseline recorded at
    creation — and it completes on its own the moment that reaches the target.
    """
    goals = db.goals()
    pending = _goals_of(goals, username, 'focus', unfinished=True)
    if not pending:
        return

    total_now = focus_tracking.total_seconds(username)
    changed = False
    for goal in pending:
        target_min = goal.get('target_focus', 0) or 0
        try:
            baseline = max(0.0, float(goal.get('focus_baseline_seconds', 0) or 0))
        except (ValueError, TypeError):
            baseline = 0.0
        earned_min = max(0.0, (total_now - baseline) / 60.0)
        new_value = round(min(earned_min, target_min) if target_min else earned_min, 1)
        new_status = 'completed' if (target_min and earned_min >= target_min) else 'active'
        new_progress = _progress(new_value, target_min)
        if (goal.get('current_focus') != new_value
                or goal.get('status') != new_status
                or goal.get('progress') != new_progress):
            goal['current_focus'] = new_value
            goal['status'] = new_status
            goal['progress'] = new_progress
            goal['target_value'] = target_min
            changed = True
    if changed:
        db.save_goals(goals)


# --------------------------------------------------------------------------
# The API
# --------------------------------------------------------------------------
@bp.route('/api/add_goal', methods=['POST'])
def add_goal():
    data = request.json or {}
    username = data.get('username')
    title = data.get('title')
    goal_type = data.get('goal_type', 'xp')

    if not username or not title:
        return jsonify({"success": False, "message": "Username and title are required"})

    targets = {
        'xp': data.get('target_xp', 0),
        'streak': data.get('target_streak', 0),
        'tasks': data.get('target_tasks', 0),
        'focus': data.get('target_focus', 0),   # minutes of tracked focus time
    }
    missing = {
        'xp': "Target XP is required for XP goals",
        'streak': "Target streak is required for streak goals",
        'tasks': "Target tasks is required for task goals",
        'focus': "Target focus time is required for focus goals",
    }
    if goal_type in targets and not targets[goal_type]:
        return jsonify({"success": False, "message": missing[goal_type]})

    goals = db.goals()
    goals.append({
        "id": data.get('id') or db.new_id('goals'),
        "user_id": username,
        "title": title,
        "description": data.get('description', ''),
        "progress": 0,
        "target_value": targets.get(goal_type, targets['xp']),
        "goal_type": goal_type,
        "target_xp": targets['xp'],
        "current_xp": 0,
        "target_streak": targets['streak'],
        "current_streak": 0,
        "target_tasks": targets['tasks'],
        "current_tasks": 0,
        "target_focus": targets['focus'],
        "current_focus": 0,
        # Focus goals count time from now on, so remember the lifetime total
        # they start from: progress is (total later - this baseline).
        "focus_baseline_seconds": (focus_tracking.total_seconds(username)
                                   if goal_type == 'focus' else 0),
        "priority": _clamp_priority(data.get('priority', 5)),
        "deadline": data.get('deadline', ''),
        "status": "active",
        "created_at": datetime.now().isoformat(),
    })
    db.save_goals(goals)
    return jsonify({"success": True, "message": "Goal added successfully"})


@bp.route('/api/get_goals', methods=['GET'])
def get_goals():
    username = request.args.get('username')
    if not username:
        return jsonify({"success": False, "message": "Username required"})

    # Bring the self-tracking goals up to date before handing them over.
    sync_streak_goals(username)
    sync_focus_goals(username)

    # Average XP per active day — the goals page's "IN PROGRESS" summary card.
    events = xp_tracking.events_for(username)
    total_xp = sum(e.get('amount', 0) or 0 for e in events)
    active_days = {day for day in (xp_tracking.event_day(e) for e in events) if day}
    avg_xp_per_day = round(total_xp / len(active_days)) if active_days else 0

    return jsonify({
        "success": True,
        "goals": [g for g in db.goals() if g.get('user_id') == username],
        "avg_xp_per_day": avg_xp_per_day,
    })


@bp.route('/api/update_goal', methods=['POST'])
def update_goal():
    data = request.json or {}
    goal_id = data.get('id')
    username = data.get('username')

    if not goal_id or not username:
        return jsonify({"success": False, "message": "Goal ID and username required"})

    goals = db.goals()
    goal = next((g for g in goals
                 if g.get('id') == goal_id and g.get('user_id') == username), None)
    if not goal:
        return jsonify({"success": False, "message": "Goal not found"})

    for field in ('title', 'description', 'status', 'progress', 'goal_type',
                  'deadline', 'current_xp', 'current_streak', 'current_tasks',
                  'current_focus', 'target_xp', 'target_streak', 'target_tasks',
                  'target_focus'):
        if field in data:
            goal[field] = data[field]
    if 'priority' in data:
        goal['priority'] = _clamp_priority(data['priority'])

    db.save_goals(goals)
    return jsonify({"success": True})


@bp.route('/api/delete_goal', methods=['POST'])
def delete_goal():
    data = request.json or {}
    goal_id = data.get('goal_id')
    username = data.get('username')

    if not goal_id:
        return jsonify({"success": False, "message": "Goal ID required"})

    goals = db.goals()
    if username:
        kept = [g for g in goals
                if not (g.get('id') == goal_id and g.get('user_id') == username)]
    else:
        kept = [g for g in goals if g.get('id') != goal_id]
    db.save_goals(kept)
    return jsonify({"success": True})


@bp.route('/api/update_goal_progress', methods=['POST'])
def update_goal_progress():
    """Add to one goal's counter by hand, capped at its target."""
    data = request.json or {}
    goal_id = data.get('goal_id')
    if not goal_id:
        return jsonify({"success": False, "message": "Goal ID required"})

    goals = db.goals()
    goal = next((g for g in goals if str(g.get('id')) == str(goal_id)), None)
    if not goal:
        return jsonify({"success": False, "message": "Goal not found"})

    goal_type = goal.get('goal_type', 'xp')
    if goal_type not in ('streak', 'tasks'):
        goal_type = 'xp'
    current_field, target_field = GOAL_FIELDS[goal_type]
    added = {'xp': data.get('xp_to_add', 0),
             'streak': data.get('streak_to_add', 0),
             'tasks': data.get('tasks_to_add', 0)}[goal_type]

    target = goal.get(target_field, 0)
    new_value = (goal.get(current_field, 0) or 0) + added
    if target and new_value > target:
        new_value = target
    status = 'completed' if (target and new_value >= target) else 'active'

    goal[current_field] = new_value
    goal['status'] = status
    goal['progress'] = _progress(new_value, target)
    goal['target_value'] = target
    db.save_goals(goals)

    return jsonify({
        "success": True,
        "goal_type": goal_type,
        "current": new_value,
        "target": target,
        "status": status,
        "completed": status == 'completed',
    })
