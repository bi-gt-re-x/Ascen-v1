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

`/api/adopted_advice` is the third, and it exists to answer the question the
Recommendations tab could not: *did the change work.* The tab would compute
that closing your three-day gaps was worth four thousand XP a year, the reader
would agree and press the button, and then nothing ever came back. A page built
entirely on "here is the number behind this claim" was missing the only number
that would have proved any of it.

**What is stored is an id and a date, and nothing else.** Not the measurement
at the time — that would be a figure written once and never checkable again.
The day series already holds every day this account has ever had, so the
"before" side of the comparison can be recomputed from it whenever it is asked
for, which means the verdict can never drift out of step with the arithmetic
that produced it. The same rule the goals table follows: progress is derived,
never accumulated. The measuring itself lives on the client in
utils/followup.ts, next to the rules whose promises it is checking.
"""
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend.api.guard import current_username
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

    username: str = Depends(current_username)
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

#: Where the adopted recommendations live in `user_settings`.
ADOPTED_KEY = 'analytics_adopted'

#: How many adoptions one account may carry.
#:
#: A cap rather than a rule about behaviour: every one of these is measured on
#: every render of the tab, and an account that pressed every button on every
#: visit for a year would be asking the page to run a hundred before/after
#: comparisons to draw one panel. Fifty is far more than anybody will adopt and
#: still a number. The oldest fall off first — see `_remember`.
ADOPTED_LIMIT = 50


class AdoptAdvice(BaseModel):
    """A recommendation the reader has said they will act on.

    The title rides along and is stored beside the id on purpose. Ids are
    stable but the rules behind them are not — a rule can be retitled, retuned
    or deleted between the day somebody adopts it and the day they come back to
    see whether it worked — and a follow-up panel that could only say
    "close-gaps" about a rule that no longer exists would be worse than one that
    remembers what the reader actually agreed to.
    """

    username: str = Depends(current_username)
    id: str = ''
    title: str = ''


class DropAdvice(BaseModel):
    username: str = Depends(current_username)
    id: str = ''


@router.get('/api/standing')
def get_standing(username: str = Depends(current_username)):
    """Where this account places against the others, measure by measure.

    Returns the placements, the size of the cohort behind them, and whether
    that cohort was big enough to place against at all — see the module note in
    tracking/standing.py for why the last of those is a field rather than an
    assumption.
    """

    placement = standing_tracking.standing(username)
    if placement is None:
        return fail('User not found')
    return ok(**placement)


@router.get('/api/metric_history')
def get_metric_history(username: str = Depends(current_username), metric: str = 'overall'):
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

    rows = analytics_tracking.history(username, metric)
    return ok(metric=metric, points=[
        {'date': row.get('date'), 'score': row.get('score'), 'grade': row.get('grade')}
        for row in rows if row.get('date') is not None
    ])


@router.get('/api/metric_histories')
def get_metric_histories(username: str = Depends(current_username)):
    """Every graded metric's past readings at once, grouped by metric.

    The endpoint above answers about one metric and is what the score panel
    reads. This answers about all of them, and exists for the follow-up on the
    Recommendations tab: a reader who adopted "your consistency score is the one
    holding the grade down" needs that metric's history to find out whether it
    moved, and which metric it is depends on what they adopted.

    One call rather than one per adopted metric. The rows all come out of the
    same table read either way, so fanning out would be several round trips to
    answer a question one already can.
    """

    series: dict = {}
    for row in analytics_tracking.history(username):
        name = row.get('metric')
        if not name or row.get('date') is None:
            continue
        series.setdefault(name, []).append({
            'date': row.get('date'),
            'score': row.get('score'),
            'grade': row.get('grade'),
        })

    return ok(series=series)


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
def get_baseline(username: str = Depends(current_username)):
    """What this account said it was aiming at, or nothing.

    `baseline: null` is a real answer and the page depends on it — it is what
    puts a new reader on the setup screen instead of a wall of countdowns.
    """

    _, user = load_user(username)
    if not user:
        return fail('User not found')

    return ok(baseline=_clean(db.user_setting(username, BASELINE_KEY)))


@router.post('/api/baseline')
def set_baseline(body: SetBaseline, username: str = Depends(current_username)):
    """Record what the account is aiming at.

    Both numbers are required and bounded. `focus_subject` is not: a reader who
    works across four subjects evenly has no one answer, and forcing one would
    put a wrong figure into every comparison drawn from it.

    Writing a baseline stamps the day it was set, which is the field that makes
    it worth anything later — a target set eight months ago and never revisited
    is a different thing from one set last week, and the page says which.
    """

    if body.active_days is None or body.session_minutes is None:
        return fail('A baseline needs both how often and how long.')

    if not (ACTIVE_DAYS[0] <= body.active_days <= ACTIVE_DAYS[1]):
        return fail('Days a week must be between {} and {}.'.format(*ACTIVE_DAYS))

    if not (SESSION_MINUTES[0] <= body.session_minutes <= SESSION_MINUTES[1]):
        return fail('A sitting must be between {} and {} minutes.'.format(*SESSION_MINUTES))

    _, user = load_user(username)
    if not user:
        return fail('User not found')

    stored = db.set_user_setting(username, BASELINE_KEY, {
        'active_days': int(body.active_days),
        'session_minutes': int(body.session_minutes),
        'focus_subject': str(body.focus_subject or ''),
        'set_on': date.today().isoformat(),
    })

    return ok(baseline=_clean(stored))


# --------------------------------------------------------------------------
# Adopted recommendations
# --------------------------------------------------------------------------
def _adopted(raw) -> List[dict]:
    """The stored adoptions, oldest first, with anything unusable dropped.

    Defensive for the same reason `_clean` is, and with one addition that
    matters more here: a row without a readable date is discarded rather than
    kept, because the date is the entire basis of the comparison drawn from it.
    An adoption with no date cannot be measured, and a row that cannot be
    measured but still appears in the list would be a permanent "waiting" entry
    that never resolves.
    """
    if not isinstance(raw, list):
        return []

    out = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        ident = str(item.get('id') or '')
        on = str(item.get('on') or '')
        if not ident or not on:
            continue
        try:
            date.fromisoformat(on)
        except ValueError:
            continue
        out.append({'id': ident, 'title': str(item.get('title') or ident), 'on': on})

    out.sort(key=lambda row: row['on'])
    return out


def _remember(rows: List[dict], ident: str, title: str) -> List[dict]:
    """Add an adoption, keeping the original date if there already is one.

    Pressing the button twice on the same card is not a new decision, and
    re-stamping it with today would quietly reset a comparison that had been
    accumulating for three weeks. The title *is* refreshed, so a rule that has
    been reworded since reads as its current self.
    """
    for row in rows:
        if row['id'] == ident:
            row['title'] = title or row['title']
            return rows

    rows.append({'id': ident, 'title': title or ident, 'on': date.today().isoformat()})
    return rows[-ADOPTED_LIMIT:]


@router.get('/api/adopted_advice')
def get_adopted(username: str = Depends(current_username)):
    """Every recommendation this account has said it would act on, oldest first."""

    _, user = load_user(username)
    if not user:
        return fail('User not found')

    return ok(adopted=_adopted(db.user_setting(username, ADOPTED_KEY)))


@router.post('/api/adopt_advice')
def adopt_advice(body: AdoptAdvice, username: str = Depends(current_username)):
    """Record that the reader is acting on a recommendation, dated today.

    Dated today rather than tomorrow, even though the task this creates is due
    tomorrow: the decision is what is being recorded here, and the comparison
    that follows wants the day the reader changed their mind about how they
    work. A day either way is inside the noise of a fortnight-long window
    anyway, and "the day I pressed the button" is the one a reader can
    remember.
    """
    if not username or not body.id:
        return fail('Username and id required')

    _, user = load_user(username)
    if not user:
        return fail('User not found')

    rows = _adopted(db.user_setting(username, ADOPTED_KEY))
    stored = db.set_user_setting(
        username, ADOPTED_KEY, _remember(rows, body.id, body.title))

    return ok(adopted=_adopted(stored))


@router.post('/api/drop_advice')
def drop_advice(body: DropAdvice, username: str = Depends(current_username)):
    """Forget an adoption.

    This deletes the record of the decision and nothing else — any task the
    adoption created stays where it is. Undoing "I said I would do this" is not
    the same as undoing the work, and silently deleting somebody's task on a
    second click is not what either button meant.
    """
    if not username or not body.id:
        return fail('Username and id required')

    _, user = load_user(username)
    if not user:
        return fail('User not found')

    rows = [row for row in _adopted(db.user_setting(username, ADOPTED_KEY))
            if row['id'] != body.id]
    stored = db.set_user_setting(username, ADOPTED_KEY, rows)

    return ok(adopted=_adopted(stored))
