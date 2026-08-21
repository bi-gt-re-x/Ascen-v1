"""Settings — the preferences an account can change about itself.

## One declared schema, two stores

`FIELDS` below is the whole list of what a preference is: its default, and what
counts as a valid value. Adding one is a line there and nothing else here —
validation, defaults and the read shape all come off it.

Where a value is *kept* is a separate question, and a historical one:

    users.name, users.theme, users.daily_goal      on the user row
    everything else                                user_settings, as key/value

The first three are on the user row because they existed before there was
anywhere else to put them, and data/sql/settings.sql says as much. The page
does not know or care: one GET, one POST, one flat object.

## Only what is sent is written

`model_fields_set`, the same rule tasks.py applies. A page of independent
controls needs it — otherwise changing the theme would write back whatever
stale value the client happened to hold for every other preference.

## What is deliberately not here

No integrations, API keys, webhooks, notification schedules or leaderboards.
This app has no OAuth broker, no job runner and no second account to compare
against, so each of those would be a control that stores a value nothing reads.
A settings page whose switches do nothing is worse than a shorter one.
"""
from typing import Any, Dict, Optional

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel

from backend.api.reply import fail, ok
from backend.config.settings import THEME_COOKIE_MAX_AGE
from backend.database import connection as db
from backend.tracking import avatar as avatars
from backend.tracking.auth import load_user

router = APIRouter(tags=['settings'])

NAME_MAX = 60
GOAL_MIN, GOAL_MAX = 10, 2000


def _one_of(*allowed):
    """A validator for a fixed set of strings."""
    def check(value):
        return value if value in allowed else None
    return check


def _boolean(value):
    return bool(value) if isinstance(value, bool) else None


def _whole(low, high):
    def check(value):
        try:
            number = int(value)
        except (TypeError, ValueError):
            return None
        # Clamped rather than rejected: a reader who typed 5000 into a field
        # marked 10-2000 meant "as high as it goes", not "fail my save".
        return max(low, min(high, number))
    return check


#: Every preference kept in user_settings: default, and what a valid value is.
#: A key absent from the table is a real state — see `db.user_setting` — so the
#: default is applied on read rather than written at signup.
FIELDS: Dict[str, Any] = {
    # Appearance. 'system' follows the device rather than storing a colour.
    'theme_mode':        ('system', _one_of('system', 'light', 'dark')),
    'accent':            ('violet', _one_of('violet', 'blue', 'green', 'amber', 'rose', 'slate')),
    'reduce_motion':     (False, _boolean),

    # Dashboard.
    'show_stats':        (True, _boolean),
    'show_insights':     (True, _boolean),

    # Tasks.
    'default_priority':  ('medium', _one_of('low', 'medium', 'high')),
    'default_xp':        (30, _whole(5, 500)),
    'ask_rating':        (True, _boolean),
    'confirm_delete':    (True, _boolean),

    # Calendar and analytics.
    'calendar_view':     ('week', _one_of('day', 'week', 'month')),
    'analytics_window':  ('1y', _one_of('7d', '30d', '90d', '1y', '2y', 'all')),
}


class UpdateSettings(BaseModel):
    """Every field optional; only the ones actually sent are applied.

    The keyed preferences arrive under `values` as one object rather than as a
    field each, so adding a preference to FIELDS does not also mean adding a
    line to this model.
    """
    username: Optional[str] = None
    name: Optional[str] = None
    theme: Optional[str] = None
    daily_goal: Optional[int] = None
    values: Optional[Dict[str, Any]] = None


def _keyed(username):
    """The user_settings half, defaults filled in and types made honest.

    SQLite has no boolean, so a stored `True` comes back as 1 and a stored
    `False` as 0 — or as '0', which is the dangerous one: a string is truthy in
    the browser, and a toggle bound to it would read as on forever. Anything
    whose default is a bool is coerced back to one here, so what leaves this
    module is the type the page thinks it is getting.
    """
    out = {}
    for key, (fallback, _) in FIELDS.items():
        stored = db.user_setting(username, key)
        if stored is None:
            out[key] = fallback
        elif isinstance(fallback, bool):
            out[key] = str(stored).lower() not in ('0', 'false', '')
        else:
            out[key] = stored
    return out


def _shape(user):
    username = user['username']
    return {
        'name': user.get('name') or '',
        'theme': user.get('theme') or 'light',
        'daily_goal': user.get('daily_goal') or 100,
        **_keyed(username),
        # Read-only, so the page can show whose account it is editing.
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
        if body.theme not in ('light', 'dark'):
            return fail("Theme must be 'light' or 'dark'.", status=400)
        user['theme'] = body.theme
        theme_changed = body.theme

    if 'daily_goal' in sent:
        goal = _whole(GOAL_MIN, GOAL_MAX)(body.daily_goal)
        if goal is None:
            return fail('Daily goal must be a number.', status=400)
        user['daily_goal'] = goal

    for key, value in (body.values or {}).items():
        if key not in FIELDS:
            # An unknown key is dropped rather than rejected, for the reason
            # `_link` in tasks.py gives: a client one version ahead should not
            # fail the whole save over a preference this build has never heard
            # of. What it does not do is store it.
            continue
        checked = FIELDS[key][1](value)
        if checked is None:
            return fail('That is not a valid value for {}.'.format(key), status=400)
        db.set_user_setting(user['username'], key, checked)

    db.save_users(users)

    payload = ok(settings=_shape(user))
    if theme_changed is None:
        return payload
    # The stored theme is durable; the cookie is what every request reads. A
    # change has to touch both or the next page load renders the old one.
    response = JSONResponse(payload)
    response.set_cookie('theme', theme_changed,
                        max_age=THEME_COOKIE_MAX_AGE, samesite='lax')
    return response


# --------------------------------------------------------------------------
# Taking your data with you
# --------------------------------------------------------------------------
#: What an export covers, and the column order each table is written in. Named
#: explicitly rather than dumped from the schema so an export is a promise
#: about shape rather than whatever the database happens to hold today.
EXPORTS = {
    'tasks': ('id', 'title', 'status', 'priority', 'xp_value', 'subject',
              'due_date', 'created_at', 'completed_at', 'goal_id'),
    'goals': ('id', 'title', 'description', 'goal_type', 'status', 'category',
              'priority', 'deadline', 'created_at'),
    'records': ('id', 'kind', 'name', 'category', 'value', 'target', 'unit',
                'note', 'achieved_on'),
    'notes': ('id', 'title', 'body', 'created_at', 'updated_at'),
    'focus_days': ('date', 'seconds', 'goal_hours'),
}


def _mine(table, username):
    return [row for row in db.read_table(table) if row.get('user_id') == username]


def _csv_cell(value):
    text = '' if value is None else str(value)
    if any(ch in text for ch in ',"\n'):
        return '"{}"'.format(text.replace('"', '""'))
    return text


@router.get('/api/settings/export')
def export_data(username: str = '', table: str = 'all', format: str = 'json'):
    """Everything this account has, as JSON or CSV.

    `table=all` in JSON is the whole account in one object. CSV is one table at
    a time, because a CSV file with five different row shapes in it is not a
    CSV file — asking for `all` as CSV therefore returns the tasks, which is
    the table anybody exporting a productivity app actually wants.
    """
    name = (username or '').strip()
    _, user = load_user(name)
    if not user:
        return fail('Account not found')

    if table != 'all' and table not in EXPORTS:
        return fail('Nothing here is called {}.'.format(table), status=400)

    if format == 'csv':
        wanted = table if table in EXPORTS else 'tasks'
        columns = EXPORTS[wanted]
        lines = [','.join(columns)]
        for row in _mine(wanted, name):
            lines.append(','.join(_csv_cell(row.get(column)) for column in columns))
        return PlainTextResponse(
            '\n'.join(lines) + '\n',
            media_type='text/csv',
            headers={'Content-Disposition':
                     'attachment; filename="ascen-{}.csv"'.format(wanted)},
        )

    names = EXPORTS.keys() if table == 'all' else (table,)
    return ok(export={
        'account': name,
        'tables': {
            key: [{column: row.get(column) for column in EXPORTS[key]}
                  for row in _mine(key, name)]
            for key in names
        },
    })
