"""The dashboard — the account's live stats and its task list.

`/api/get_user_data` is the page's first call and the one most other pages
piggyback on: it returns the stats block (level, XP, tasks completed, streaks)
plus every task the account owns. The streak is decayed on read, so a streak
lost overnight is gone the moment any page asks, not whenever a task is next
completed.
"""
from flask import Blueprint, jsonify, render_template, request

from backend.database import connection as db
from backend.tracking import xp as xp_tracking
from backend.tracking.auth import load_user

bp = Blueprint('dashboard', __name__)


@bp.route('/dashboard')
def page():
    return render_template('dashboard.html')


@bp.route('/api/get_user_data', methods=['GET'])
def get_user_data():
    username = request.args.get('username')
    if not username:
        return jsonify({"success": False, "message": "Username required"})

    users, user = load_user(username)
    if not user:
        return jsonify({"success": False, "message": "User not found"})

    # Decay a stale streak (lost after a full day with no task) before reporting.
    if xp_tracking.refresh_streak(user):
        db.save_users(users)

    user_tasks = [t for t in db.tasks() if t.get('user_id') == username]

    return jsonify({
        "success": True,
        "stats": {
            "level": user.get('level', 1),
            "xp": user.get('xp', 0),
            "tasks_completed": user.get('tasks_completed', 0),
            "current_streak": user.get('current_streak', 0),
            "best_streak": user.get('best_streak', 0),
            "charge": user.get('charge', 0),
        },
        "tasks": user_tasks,
    })


@bp.route('/api/track_daily_xp', methods=['POST'])
def track_daily_xp():
    """Roll a batch of XP and completions into today's single ledger row."""
    data = request.json or {}
    username = data.get('username')
    if not username:
        return jsonify({"success": False, "message": "Username required"})

    xp_tracking.track_daily(username,
                            data.get('xp_earned', 0),
                            data.get('tasks_completed', 0))
    return jsonify({"success": True, "message": "Daily XP tracked successfully"})


@bp.route('/api/update_stats', methods=['POST'])
def update_stats():
    """Write back level / XP / task count the client has recalculated."""
    data = request.json or {}
    users, user = load_user(data.get('username'))
    if user:
        user['level'] = data.get('level')
        user['xp'] = data.get('xp')
        user['tasks_completed'] = data.get('tasks_completed')
        db.save_users(users)
    return jsonify({"success": True})
