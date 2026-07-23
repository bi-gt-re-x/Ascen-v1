"""Day-focus API — the one-line "Focus" note attached to each calendar day.

The Week, Day and Month calendar views all show the same per-day focus text;
this blueprint is its single source of truth so an edit in one view (or one
browser) shows up everywhere. Stored per user in users.json as
`day_focus`: {"YYYY-MM-DD": "text"}.

First real module in the new app/routes/ layout — registered in
app/__init__.py alongside the legacy paths.py blueprint.
"""
import re

from flask import Blueprint, jsonify, request

from backend.paths import USERS_JSON, read_json_file, write_json_file

dayfocus_bp = Blueprint('dayfocus', __name__)

_DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')


def _find_user(users, username):
    return next((u for u in users if u.get('username') == username), None)


@dayfocus_bp.route('/api/day_focus', methods=['GET'])
def get_day_focus():
    """Every saved day-focus note for a user, keyed by ISO date."""
    username = request.args.get('username')
    if not username:
        return jsonify({"success": False, "message": "Username required"})
    user = _find_user(read_json_file(USERS_JSON), username)
    if not user:
        return jsonify({"success": False, "message": "User not found"})
    focus = user.get('day_focus')
    return jsonify({"success": True,
                    "day_focus": focus if isinstance(focus, dict) else {}})


@dayfocus_bp.route('/api/day_focus', methods=['POST'])
def set_day_focus():
    """Upsert one day's focus text; an empty text deletes the entry."""
    data = request.get_json(silent=True) or {}
    username = data.get('username')
    day = str(data.get('date') or '')
    text = str(data.get('text') or '').strip()[:200]
    if not username or not _DATE_RE.match(day):
        return jsonify({"success": False, "message": "Username and date required"})

    users = read_json_file(USERS_JSON)
    user = _find_user(users, username)
    if not user:
        return jsonify({"success": False, "message": "User not found"})

    focus = user.get('day_focus')
    if not isinstance(focus, dict):
        focus = {}
        user['day_focus'] = focus
    if text:
        focus[day] = text
    else:
        focus.pop(day, None)
    write_json_file(USERS_JSON, users)
    return jsonify({"success": True, "date": day, "text": text})
