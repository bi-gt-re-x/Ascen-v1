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
