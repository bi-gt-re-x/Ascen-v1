"""The light/dark theme switch.

Every page renders <html data-theme="..."> server-side, so the theme is in the
very first bytes of the response and navigation never flashes or reverts. That
needs the answer before any JS runs, which is what the cookie set here is for —
the account's stored theme is the durable copy, the cookie is the one read on
every request. See backend/middleware/context.py for the read side.
"""
from flask import Blueprint, jsonify, request, session

from backend.config.settings import THEME_COOKIE_MAX_AGE
from backend.database import connection as db
from backend.tracking.auth import load_user

bp = Blueprint('theme', __name__)


@bp.route('/api/set_theme', methods=['POST'])
def set_theme():
    data = request.json or {}
    theme = data.get('theme')
    if theme not in ('light', 'dark'):
        return jsonify({"success": False, "message": "Theme must be 'light' or 'dark'."}), 400

    persisted = False
    users, user = load_user(session.get('username'))
    if user:
        user['theme'] = theme
        db.save_users(users)
        persisted = True

    resp = jsonify({"success": True, "persisted": persisted})
    resp.set_cookie('theme', theme, max_age=THEME_COOKIE_MAX_AGE, samesite='Lax')
    return resp
