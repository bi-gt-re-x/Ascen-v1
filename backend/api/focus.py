"""Focus — the dashboard's Focus panel and the calendar's Weekly Focus Time.

There is no /focus page yet: the timer is a panel on the dashboard. What it
needs from the server is a place to mirror each day's total into, and a way to
read those totals back for a date range.

Two ways in, and the difference between them matters:

    /api/focus_sync   the timer mirroring itself. Takes the larger of what is
                      held and what is sent, so a stale tab cannot shrink a day.
    /api/focus_log    a person typing in work they did and did not track. Adds.

They are not the same claim — see `log_day` in backend/tracking/focus.py — so
they are not the same endpoint with a flag.
"""
import re
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend.api.guard import current_username
from backend.api.reply import fail, ok
from backend.tracking import focus as focus_tracking

router = APIRouter(tags=['focus'])

DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')

# A day can hold at most 24h of focus, and a daily goal is 30 min to 12 hours.
MAX_FOCUS_SECONDS = 86400.0
MIN_GOAL_HOURS = 0.5
MAX_GOAL_HOURS = 12.0


class FocusSync(BaseModel):
    date: Optional[str] = None
    # Read as strings-or-numbers and coerced below, so junk lands on the
    # "Invalid focus values" reply rather than a 422 the client can't read.
    focused_seconds: Optional[object] = 0
    goal_hours: Optional[object] = 2.0


@router.post('/api/focus_sync')
def focus_sync(body: FocusSync, username: str = Depends(current_username)):
    """Mirror a day's focus total from the client into the account."""
    day = str(body.date or '')

    if not username or not DATE_RE.match(day):
        return fail('Username and date required')

    try:
        seconds = max(0.0, min(MAX_FOCUS_SECONDS, float(body.focused_seconds)))
        goal_hours = max(MIN_GOAL_HOURS, min(MAX_GOAL_HOURS, float(body.goal_hours)))
    except (TypeError, ValueError):
        return fail('Invalid focus values')

    record = focus_tracking.record_day(username, day, seconds, goal_hours)
    if record is None:
        return fail('User not found')
    return ok(focus=record)


class FocusLog(BaseModel):
    """One past day's work, typed in rather than timed.

    Read as strings-or-numbers for the same reason FocusSync is: junk should
    land on a reply the client can read rather than on a 422 it cannot.
    """
    date: Optional[str] = None
    #: How long, in minutes. The dashboard asks in hours and minutes and adds
    #: them up before sending, because one figure is one thing to validate.
    minutes: Optional[object] = 0
    #: The goal to give the day, used only if it has no row yet.
    goal_hours: Optional[object] = 2.0


#: The most one catch-up entry may claim. A day holds 24 hours and a person
#: typing 2000 into a minutes box has slipped, not worked.
MAX_LOG_MINUTES = 1440.0


@router.post('/api/focus_log')
def focus_log(body: FocusLog, username: str = Depends(current_username)):
    """Add hand-entered focus time to one past day.

    This is what the dashboard's catch-up prompt writes: the reader is asked
    what they did on the days since they were last here, and the answer lands
    in the same table the timer writes to, so it reaches consistency, the
    focus score, the growth series and every "days you worked" count in the
    app without any of them needing to know where it came from.
    """
    day = str(body.date or '')

    if not username or not DATE_RE.match(day):
        return fail('Username and date required')

    try:
        minutes = max(0.0, min(MAX_LOG_MINUTES, float(body.minutes)))
        goal_hours = max(MIN_GOAL_HOURS, min(MAX_GOAL_HOURS, float(body.goal_hours)))
    except (TypeError, ValueError):
        return fail('Invalid focus values')

    if minutes <= 0:
        return fail('Nothing to log')

    record = focus_tracking.log_day(username, day, minutes * 60.0, goal_hours)
    if record is None:
        return fail('User not found')
    return ok(focus=record)


@router.get('/api/focus_history')
def focus_history(username: str = Depends(current_username), start: str = '', end: str = ''):
    """Tracked focus for a date range: {iso: {seconds, goal_hours}}.

    The calendar's Weekly Focus Time panel reads this to show focused time
    against the time that was planned.
    """

    days = focus_tracking.history_range(username, start or '', end or '')
    if days is None:
        return fail('User not found')
    return ok(days=days)
