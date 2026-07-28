"""Focus — the dashboard's Focus panel and the calendar's Weekly Focus Time.

There is no /focus page yet: the timer is a panel on the dashboard. What it
needs from the server is a place to mirror each day's total into, and a way to
read those totals back for a date range.
"""
import re

from flask import Blueprint, jsonify, request

from backend.tracking import focus as focus_tracking

bp = Blueprint('focus', __name__)

DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')

# A day can hold at most 24h of focus, and a daily goal is 30 min to 12 hours.
MAX_FOCUS_SECONDS = 86400.0
MIN_GOAL_HOURS = 0.5
MAX_GOAL_HOURS = 12.0


@bp.route('/api/focus_sync', methods=['POST'])
def focus_sync():
    """Mirror a day's focus total from the client into the account."""
    data = request.get_json(silent=True) or {}
    username = data.get('username')
    day = str(data.get('date') or '')

    if not username or not DATE_RE.match(day):
        return jsonify({"success": False, "message": "Username and date required"})

    try:
        seconds = max(0.0, min(MAX_FOCUS_SECONDS, float(data.get('focused_seconds', 0))))
        goal_hours = max(MIN_GOAL_HOURS, min(MAX_GOAL_HOURS, float(data.get('goal_hours', 2.0))))
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "Invalid focus values"})

    record = focus_tracking.record_day(username, day, seconds, goal_hours)
    if record is None:
        return jsonify({"success": False, "message": "User not found"})
    return jsonify({"success": True, "focus": record})


@bp.route('/api/focus_history', methods=['GET'])
def focus_history():
    """Tracked focus for a date range: {iso: {seconds, goal_hours}}.

    The calendar's Weekly Focus Time panel reads this to show focused time
    against the time that was planned.
    """
    username = request.args.get('username')
    if not username:
        return jsonify({"success": False, "message": "Username required"})

    days = focus_tracking.history_range(username,
                                        request.args.get('start') or '',
                                        request.args.get('end') or '')
    if days is None:
        return jsonify({"success": False, "message": "User not found"})
    return jsonify({"success": True, "days": days})
