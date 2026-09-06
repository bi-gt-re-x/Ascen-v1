"""Who the caller is — and the only place an endpoint is allowed to find out.

Every endpoint under /api that touches an account's data depends on
`current_username` (or `current_user`, when it needs the row too). Both read
`request.session`, which is a signed cookie the browser cannot forge, and
neither looks at anything the caller sent.

## Why this module exists

The endpoints used to take the account as a parameter:

    @router.get('/api/achievements')
    def list_achievements(username: str = ''):
        _, user = load_user(username)      # whoever was named, not whoever asked

`backend/middleware/gate.py` guards the *page* paths — /dashboard, /notes,
/achievements — so a signed-out visitor never sees those screens. Nothing
guarded /api. A request with no cookie at all could read any account by name:

    curl 'http://127.0.0.1:5050/api/achievements?username=Alpha'   # 200, full record

and the writes were the same shape, so `DELETE /api/tasks/<id>?username=<them>`
deleted somebody else's task. The parameter was the vulnerability: an endpoint
that accepts an identity is an endpoint that trusts the caller's word for it.

## The rule

**The account acted on is the account signed in.** Nothing else is consulted.
The Pydantic bodies still declare `username`, because the frontend still sends
it and stripping it would mean editing every service in one go for no gain —
but no endpoint reads it any more, and `ignored_username` says so at each site
where the field survives. It is a value the server receives and drops.

## The other half: ownership

A session says *who* is asking; it does not say whether the row they named is
theirs. An endpoint keyed by a row id — `DELETE /api/tasks/{task_id}`,
`/api/delete_goal`, `/api/notes/delete` — needs the second check, and `owned`
is it: fetch the row, compare `user_id`, refuse otherwise. The two together are
what "signed in as me" has to mean.

## Failures are 401, and they say so in the body

`fail(..., status=401)` sends the `{"success": false}` envelope the client
already reads (see reply.py) *and* a real status code, so a fetch can tell
"signed out" from "no such task" without parsing prose. `services/api.ts`
turns a 401 into a sign-out rather than an error banner.
"""
from fastapi import Request

from backend.api.reply import fail
from backend.tracking.auth import find_user, signed_in_user
from backend.database import connection as db


class NotSignedIn(Exception):
    """No usable session on the request. Answered as 401 by the handler."""


def current_user(request: Request):
    """The signed-in account's row, or 401.

    The row rather than the name, for the endpoints that go on to mutate it —
    they would otherwise read it again a line later.
    """
    user = signed_in_user(request)
    if not user:
        raise NotSignedIn()
    return user


def current_username(request: Request) -> str:
    """The signed-in account's username, or 401.

    What most endpoints want: they pass a name to a tracking function and never
    touch the row.
    """
    return current_user(request)['username']


def optional_username(request: Request):
    """The signed-in account's username, or None. Never raises.

    For the handful of endpoints that answer differently for a visitor rather
    than refusing them — the daily quote, the theme.
    """
    user = signed_in_user(request)
    return user['username'] if user else None


def ignored_username(_value=None):
    """Marks a `username` a caller sent that the server deliberately drops.

    Written at the call site rather than deleted from the Pydantic model so
    that reading a handler shows the decision instead of leaving a silent gap
    where a parameter used to be read. See the note above.
    """
    return None


def owned(rows, row_id, username, key='id'):
    """One row from `rows`, only if it belongs to `username`.

    Returns None both when the id does not exist and when it belongs to
    somebody else, and on purpose: telling the two apart tells a caller which
    ids are real, which is the whole of an enumeration attack.
    """
    for row in rows:
        if str(row.get(key)) == str(row_id):
            return row if row.get('user_id') == username else None
    return None


def not_signed_in():
    """The 401 body. One message, so the client matches on one thing."""
    return fail('Sign in to continue.', status=401)


def user_row(username):
    """The account row for a name already known to be the signed-in one."""
    return find_user(db.users(), username=username)
