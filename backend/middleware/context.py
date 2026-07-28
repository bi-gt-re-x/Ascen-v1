"""What every template gets for free.

  * `current_theme` — so a page can render <html data-theme="..."> server-side
    with no flash of the wrong theme;
  * `current_user` — the signed-in username, so a page can recover it into
    localStorage when this browser has none (storage cleared, say) and still
    load the account's data.

Theme preference order: the `theme` cookie (set on every change and on login,
so it arrives with every request and needs neither JS timing nor a live
session), then the signed-in account's stored theme, then light.
"""
from flask import request, session

from backend.tracking.auth import theme_for


def register(app):
    app.context_processor(inject_context)


def current_theme():
    cookie_theme = request.cookies.get('theme')
    if cookie_theme in ('light', 'dark'):
        return cookie_theme
    return theme_for(session.get('username'))


def inject_context():
    return {
        'current_theme': current_theme(),
        'current_user': session.get('username', ''),
    }
