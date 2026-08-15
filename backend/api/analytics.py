"""Analytics — the deeper cuts of a user's own data.

Most of the page is computed on the client from the growth series, which is why
this module stayed a stub long after the page existed: one endpoint already
carried everything a single account needs.

`/api/standing` is the exception, and the reason is structural rather than a
matter of taste. It is the one figure on the page that cannot be derived from
the reader's own record at all — it needs every other account's, which the
client has no business seeing. The rules live in backend/tracking/standing.py.
"""
from fastapi import APIRouter

from backend.api.reply import fail, ok
from backend.tracking import analytics as analytics_tracking
from backend.tracking import standing as standing_tracking

router = APIRouter(tags=['analytics'])


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
