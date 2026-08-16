"""Analytics — the deeper cuts of a user's own data.

Most of the page is computed on the client from the growth series, which is why
this module stayed a stub long after the page existed: one endpoint already
carried everything a single account needs.

`/api/standing` is the exception, and the reason is structural rather than a
matter of taste. It is the one figure on the page that cannot be derived from
the reader's own record at all — it needs every other account's, which the
client has no business seeing. The rules live in backend/tracking/standing.py.

`/api/baseline` is the other, and it is the opposite case: it is the one thing
on the page that is not derived from anything, because the account has to say
it. Every other figure the analytics page draws needs weeks of record before it
means anything, which left a new account with a page of countdowns and nothing
to do. A baseline is what somebody can answer on their first day — how often
they mean to work, how long a sitting is, what it is for — and it turns the
tabs from "come back in three weeks" into "here is what you said, here is what
happened". It goes in `user_settings` — the key/value table that already exists
for exactly this, a preference rather than a measurement — under BASELINE_KEY.
"""
from datetime import date
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from backend.api.reply import fail, ok
from backend.database import connection as db
from backend.tracking import analytics as analytics_tracking
from backend.tracking import standing as standing_tracking
from backend.tracking.auth import load_user

router = APIRouter(tags=['analytics'])


class SetBaseline(BaseModel):
    """What a reader can state about their own intentions on day one.

    `username` rides in the body rather than the query because every other
    POST in this app does — see backend/api/goals.py — and one endpoint with a
    different convention is one endpoint somebody calls wrongly.
    """

    username: str = ''
    #: Days a week they mean to work. 1-7.
    active_days: Optional[int] = None
    #: What a normal sitting is, in minutes.
    session_minutes: Optional[int] = None
    #: The subject this is mostly for, by id. Empty means "no one subject".
    focus_subject: Optional[str] = None


#: What the two numbers are allowed to be. Bounds rather than validation for
#: its own sake: a baseline of 0 days or 900-minute sittings would flow into
#: every comparison the page draws and make each of them nonsense.
ACTIVE_DAYS = (1, 7)
SESSION_MINUTES = (5, 480)

#: Where the baseline lives in `user_settings`.
BASELINE_KEY = 'analytics_baseline'


@router.get('/api/standing')
def get_standing(username: str = ''):
    """Where this account places against the others, measure by measure.

    Returns the placements, the size of the cohort behind them, and whether
    that cohort was big enough to place against at all — see the module note in
    tracking/standing.py for why the last of those is a field rather than an
    assumption.
    """
    if not username:
        return fail('Username required')

    placement = standing_tracking.standing(username)
    if placement is None:
        return fail('User not found')
    return ok(**placement)


@router.get('/api/metric_history')
def get_metric_history(username: str = '', metric: str = 'overall'):
    """Past grades for one metric, oldest first.

    The snapshots have been accumulating since the report card existed — every
    read of `/api/get_growth_ratings` files a dated row per metric — and until
    now nothing read them back out. The analytics page drew its "score over
    time" line from a generated shape with the real score pinned on the end,
    which is the sort of thing that is fine right up until somebody notices.

    What it is actually for is the harder question the page could not answer:
    *what changed since I was last here.* One score is a status; two scores a
    week apart is a reason to come back.
    """
    if not username:
        return fail('Username required')

    rows = analytics_tracking.history(username, metric)
    return ok(metric=metric, points=[
        {'date': row.get('date'), 'score': row.get('score'), 'grade': row.get('grade')}
        for row in rows if row.get('date') is not None
    ])


def _clean(raw):
    """A stored baseline, or None if there isn't a usable one.

    Reads defensively because the value is written by one endpoint and read by
    a page that draws comparisons off it: a hand-edited store or an older shape
    should leave the page saying "no baseline set" rather than dividing by a
    string.
    """
    if not isinstance(raw, dict):
        return None

    try:
        active_days = int(raw.get('active_days'))
        session_minutes = int(raw.get('session_minutes'))
    except (TypeError, ValueError):
        return None

    if not (ACTIVE_DAYS[0] <= active_days <= ACTIVE_DAYS[1]):
        return None
    if not (SESSION_MINUTES[0] <= session_minutes <= SESSION_MINUTES[1]):
        return None

    return {
        'active_days': active_days,
        'session_minutes': session_minutes,
        'focus_subject': str(raw.get('focus_subject') or ''),
        'set_on': str(raw.get('set_on') or ''),
    }


@router.get('/api/baseline')
def get_baseline(username: str = ''):
    """What this account said it was aiming at, or nothing.

    `baseline: null` is a real answer and the page depends on it — it is what
    puts a new reader on the setup screen instead of a wall of countdowns.
    """
    if not username:
        return fail('Username required')

    _, user = load_user(username)
    if not user:
        return fail('User not found')

    return ok(baseline=_clean(db.user_setting(username, BASELINE_KEY)))


@router.post('/api/baseline')
def set_baseline(body: SetBaseline):
    """Record what the account is aiming at.

    Both numbers are required and bounded. `focus_subject` is not: a reader who
    works across four subjects evenly has no one answer, and forcing one would
    put a wrong figure into every comparison drawn from it.

    Writing a baseline stamps the day it was set, which is the field that makes
    it worth anything later — a target set eight months ago and never revisited
    is a different thing from one set last week, and the page says which.
    """
    if not body.username:
        return fail('Username required')

    if body.active_days is None or body.session_minutes is None:
        return fail('A baseline needs both how often and how long.')

    if not (ACTIVE_DAYS[0] <= body.active_days <= ACTIVE_DAYS[1]):
        return fail('Days a week must be between {} and {}.'.format(*ACTIVE_DAYS))

    if not (SESSION_MINUTES[0] <= body.session_minutes <= SESSION_MINUTES[1]):
        return fail('A sitting must be between {} and {} minutes.'.format(*SESSION_MINUTES))

    _, user = load_user(body.username)
    if not user:
        return fail('User not found')

    stored = db.set_user_setting(body.username, BASELINE_KEY, {
        'active_days': int(body.active_days),
        'session_minutes': int(body.session_minutes),
        'focus_subject': str(body.focus_subject or ''),
        'set_on': date.today().isoformat(),
    })

    return ok(baseline=_clean(stored))
