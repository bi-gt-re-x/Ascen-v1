"""Task-completion -> XP goal automation.

When a task is completed on the dashboard, its XP flows (through the backend) to
the goals page, which calls the endpoint below to automatically progress the
user's active XP-type goals and complete any that reach their target.

Kept separate from paths.py so the automation feature is self-contained.
"""
from flask import Blueprint, request, jsonify

from app.paths import GOALS_JSON, read_json_file, write_json_file

automation_bp = Blueprint('automation', __name__)


def apply_task_xp_to_goals(username, xp):
    """Add ``xp`` to every active XP-type goal owned by ``username``.

    Each XP goal represents "earn N XP", so a completed task's XP counts toward
    all of them. Progress is capped at the target and a goal is marked completed
    once it reaches it. Returns a summary of what changed.
    """
    try:
        xp = int(xp)
    except (ValueError, TypeError):
        xp = 0

    if not username or xp <= 0:
        return {"updated": [], "completed": []}

    goals = read_json_file(GOALS_JSON)
    updated = []
    completed = []
    changed = False

    for goal in goals:
        if goal.get('user_id') != username:
            continue
        if goal.get('goal_type', 'xp') != 'xp':
            continue
        if goal.get('status') == 'completed':
            continue

        target = goal.get('target_xp', 0) or 0
        current = goal.get('current_xp', 0) or 0
        new_value = current + xp
        if target and new_value > target:
            new_value = target

        is_done = bool(target) and new_value >= target
        goal['current_xp'] = new_value
        goal['progress'] = round((new_value / target) * 100, 1) if target else 0
        goal['target_value'] = target
        goal['status'] = 'completed' if is_done else 'active'
        changed = True

        info = {
            "id": goal.get('id'),
            "title": goal.get('title'),
            "current_xp": new_value,
            "target_xp": target,
            "status": goal['status'],
        }
        updated.append(info)
        if is_done:
            completed.append(info)

    if changed:
        write_json_file(GOALS_JSON, goals)

    return {"updated": updated, "completed": completed}


@automation_bp.route('/api/auto_apply_task_xp', methods=['POST'])
def auto_apply_task_xp():
    """Apply a completed task's XP to the user's active XP goals."""
    data = request.json or {}
    username = data.get('username')
    xp = data.get('xp', 0)

    if not username:
        return jsonify({"success": False, "message": "Username required"})

    result = apply_task_xp_to_goals(username, xp)
    return jsonify({"success": True, **result})
