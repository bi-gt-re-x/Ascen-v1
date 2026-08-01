"""What every template gets for free.

  * `current_theme` — so a page can render <html data-theme="..."> server-side
    with no flash of the wrong theme;
  * `current_user` — the signed-in username, so a page can recover it into
    localStorage when this browser has none (storage cleared, say) and still
    load the account's data;
  * `current_avatar` / `current_avatar_name` — the account's profile picture,
    as a static path and as a bare name, so the top bar can draw it without a
    round trip and mark it in the picker;
  * `avatar_choices` — all fifty, for the picker in the account menu;
  * `request` — the templates read `request.path` to mark the current tab in
    the top bar, and nothing else, so they get an object with just that on it
    rather than the live Request.

Theme preference order: the `theme` cookie (set on every change and on login,
so it arrives with every request and needs neither JS timing nor a live
session), then the signed-in account's stored theme, then light.

The account row is fetched once here and used for both the theme and the
picture, rather than each asking for it separately.

Flask injected this into every render through a context processor. FastAPI has
no such hook, so backend/routes/pages.py calls `for_request` on the way into a
template — which is one explicit line instead of a global, and means a render
outside a request is possible at all.
"""
from starlette.requests import Request

from backend.database import connection as db
from backend.tracking.auth import find_user
from backend.tracking.avatar import AVATARS, FALLBACK, avatar_for, avatar_path


class TemplateRequest(Request):
    """The live request, plus the `.path` the templates read.

    The top bar marks the current tab with `request.path.startswith('/goals')`
    — Flask's spelling. Starlette puts it at `request.url.path`, so this adds
    the shorter name back.

    It has to stay a real Request rather than a stand-in carrying one
    attribute: Starlette reads `request["extensions"]` off whatever sits under
    the `request` key when it renders, and only a Request is a mapping over the
    ASGI scope.
    """

    @property
    def path(self):
        return self.url.path


def current_theme(request, user):
    cookie_theme = request.cookies.get('theme')
    if cookie_theme in ('light', 'dark'):
        return cookie_theme
    theme = (user or {}).get('theme', 'light')
    return theme if theme in ('light', 'dark') else 'light'


def for_request(request):
    """The context every template renders with."""
    username = request.session.get('username', '')
    user = find_user(db.users(), username=username) if username else None
    avatar = avatar_for(user) if user else FALLBACK
    return {
        'request': TemplateRequest(request.scope, request.receive),
        'current_theme': current_theme(request, user),
        'current_user': username,
        'current_avatar': avatar_path(avatar),
        'current_avatar_name': avatar,
        'avatar_choices': AVATARS,
    }
