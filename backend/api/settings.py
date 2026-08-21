"""Settings — the preferences an account can change about itself.

Two endpoints over three different stores, which is the whole difficulty here
and the reason this module exists at all rather than the page writing to each
of them directly.

    users.name          the display name
    users.theme         light or dark, and also a cookie (backend/routes/theme)
    users.daily_goal    the XP target the dashboard ring fills against
    user_settings       everything since, as key/value

The split is historical and not worth undoing: theme and daily_goal are on the
user row because they existed before there was anywhere else to put them, and
data/sql/settings.sql says as much. What matters is that a page setting three
preferences makes one request and gets one answer back, so this module reads
and writes both shapes and presents them as one flat object.

## Only what is sent is written

`model_fields_set`, the same rule tasks.py applies, and for the same reason: a
page that sends the whole form back would otherwise overwrite a preference the
reader never touched with whatever the client last happened to hold.

## What is not here

The avatar (POST /api/avatar) and the theme cookie (POST /api/set_theme) keep
their own endpoints. Both are called from places that are not this page — the
avatar from the menu under it, the theme from the top bar toggle on every page
— and moving them would mean the top bar depending on a settings module to
change a colour. Theme is accepted here too, because a settings page that
cannot set the theme is a settings page missing its most-used control; the
cookie is refreshed alongside the stored value so the next page load agrees.
"""
from typing import Optional

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from backend.api.reply import fail, ok
from backend.config.settings import THEME_COOKIE_MAX_AGE
from backend.database import connection as db
from backend.tracking import avatar as avatars
from backend.tracking.auth import load_user

router = APIRouter(tags=['settings'])

#: The display name is shown in the greeting and nowhere it could overflow a
#: layout, but it is still a string a caller controls entirely.
NAME_MAX = 60

#: Matches the CHECK on users.daily_goal, so a value that passes here is a
#: value the column will accept.
GOAL_MIN, GOAL_MAX = 10, 2000

THEMES = ('light', 'dark')
WEEK_STARTS = ('monday', 'sunday')

#: Preferences that live in user_settings rather than on the user row, with the
#: value assumed when an account has never set one. A key absent from the table
#: is a real state — see `user_setting` — so the default is applied on read
#: rather than written on signup.
KEYED_DEFAULTS = {
    'week_start': 'monday',
    'confirm_delete': True,
}


class UpdateSettings(BaseModel):
    """Every field optional; only the ones actually sent are applied."""
    username: Optional[str] = None
    name: Optional[str] = None
    theme: Optional[str] = None
    daily_goal: Optional[int] = None
    week_start: Optional[str] = None
    confirm_delete: Optional[bool] = None


def _keyed(username):
    """The user_settings half, with defaults filled in for anything unset."""
    out = {}
    for key, fallback in KEYED_DEFAULTS.items():
        stored = db.user_setting(username, key)
        out[key] = fallback if stored is None else stored
    return out


def _shape(user):
    """One flat object per account, whichever store each value came from."""
    username = user['username']
    return {
        # Editable.
        'name': user.get('name') or '',
        'theme': user.get('theme') or 'light',
        'daily_goal': user.get('daily_goal') or 100,
        **_keyed(username),
        # Read-only, and here so the page can show who it is editing without a
        # second request to the auth endpoint.
        'username': username,
        'email': user.get('email') or '',
        'created_at': user.get('created_at') or '',
        'level': int(user.get('level') or 1),
        'xp': int(user.get('xp') or 0),
        'avatar': '/static/' + avatars.avatar_path(avatars.avatar_for(user)),
    }


@router.get('/api/settings')
def get_settings(username: str = ''):
    _, user = load_user((username or '').strip())
    if not user:
        return fail('Account not found')
    return ok(settings=_shape(user))


@router.post('/api/settings')
def update_settings(request: Request, body: UpdateSettings):
    users, user = load_user((body.username or '').strip())
    if not user:
        return fail('Account not found')

    sent = body.model_fields_set
    theme_changed = None

    if 'name' in sent:
        user['name'] = (body.name or '').strip()[:NAME_MAX]

    if 'theme' in sent:
        if body.theme not in THEMES:
            return fail("Theme must be 'light' or 'dark'.", status=400)
        user['theme'] = body.theme
        theme_changed = body.theme

    if 'daily_goal' in sent:
        try:
            goal = int(body.daily_goal)
        except (TypeError, ValueError):
            return fail('Daily goal must be a number.', status=400)
        # Clamped rather than rejected: the number input's min and max are
        # advice to the spinner, and a reader who typed 5000 meant "as high as
        # it goes" rather than "fail my whole save".
        user['daily_goal'] = max(GOAL_MIN, min(GOAL_MAX, goal))

    if 'week_start' in sent:
        if body.week_start not in WEEK_STARTS:
            return fail("Week must start on 'monday' or 'sunday'.", status=400)
        db.set_user_setting(user['username'], 'week_start', body.week_start)

    if 'confirm_delete' in sent:
        db.set_user_setting(user['username'], 'confirm_delete', bool(body.confirm_delete))

    db.save_users(users)

    # The stored theme is the durable copy and the cookie is the one every
    # request reads, so a change here has to touch both or the next page load
    # renders the old one. Same pairing as backend/routes/theme.py.
    payload = ok(settings=_shape(user))
    if theme_changed is None:
        return payload
    response = JSONResponse(payload)
    response.set_cookie('theme', theme_changed,
                        max_age=THEME_COOKIE_MAX_AGE, samesite='lax')
    return response
