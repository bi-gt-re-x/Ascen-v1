"""What every template gets for free.

  * `current_theme` — so a page can render <html data-theme="..."> server-side
    with no flash of the wrong theme;
  * `current_user` — the signed-in username, so a page can recover it into
    localStorage when this browser has none (storage cleared, say) and still
    load the account's data;
  * `current_avatar` — the static path of the account's profile picture, so
    the top bar can draw it without a round trip.

Theme preference order: the `theme` cookie (set on every change and on login,
so it arrives with every request and needs neither JS timing nor a live
session), then the signed-in account's stored theme, then light.

The account row is fetched once here and used for both the theme and the
picture, rather than each asking for it separately.
"""
from flask import request, session

from backend.database import connection as db
from backend.tracking.auth import find_user
from backend.tracking.avatar import FALLBACK, avatar_for, avatar_path


def register(app):
    app.context_processor(inject_context)


def current_theme(user):
    cookie_theme = request.cookies.get('theme')
    if cookie_theme in ('light', 'dark'):
        return cookie_theme
    theme = (user or {}).get('theme', 'light')
    return theme if theme in ('light', 'dark') else 'light'


def inject_context():
    username = session.get('username', '')
    user = find_user(db.users(), username=username) if username else None
    return {
        'current_theme': current_theme(user),
        'current_user': username,
        'current_avatar': avatar_path(avatar_for(user) if user else FALLBACK),
    }
