"""Growth: the day-by-day series behind the chart.

`series(username)` is one row per day from account creation to today, with XP,
tasks, focus minutes and running totals. Days with nothing recorded are still
rows, so the chart's x-axis is real time rather than a list of active days.

`days` is how many of the most recent to return, and **0 means all of them**.
The growth page asks for all: it lets the reader choose 7, 30, 90 or the whole
account, and every figure on it that says "vs the previous 30 days" needs the
30 before the 30 on screen. Slicing on the client rather than making a request
per range is the cheaper trade by a wide margin — a three-year-old account is
about a thousand small rows, and the alternative is six endpoints' worth of
windowing to avoid sending them.

The graded report card that shares the page lives in [analytics.py](analytics.py).
"""
from datetime import date, timedelta

from backend.database import connection as db
from backend.tracking import focus as focus_tracking
from backend.tracking import xp as xp_tracking
from backend.tracking.auth import created_date_for, find_user

# How many days the chart shows when the caller does not say.
SERIES_WINDOW = 30


# --------------------------------------------------------------------------
# The day-by-day series
# --------------------------------------------------------------------------
def series(username, days=SERIES_WINDOW):
    """The growth chart's data, or None when the account doesn't exist.

    `days` of 0 (or less) returns every day since the account was created.
    """
    user = find_user(db.users(), username=username)
    if not user:
        return None

    created = created_date_for(user)
    totals = xp_tracking.daily_totals(username)
    history = focus_tracking.history_for(username)

    today = date.today()
    rows = []
    cumulative_xp = 0
    cumulative_focus_min = 0
    day = min(created, today)
    day_number = 1

    while day <= today:
        iso = day.isoformat()
        bucket = totals.get(iso, {'xp': 0, 'tasks': 0})
        cumulative_xp += bucket['xp']

        record = history.get(iso) or {}
        try:
            focus_minutes = round(float(record.get('seconds', 0) or 0) / 60)
        except (TypeError, ValueError, AttributeError):
            focus_minutes = 0
        cumulative_focus_min += focus_minutes

        rows.append({
            'date': iso,
            'day_number': day_number,
            'xp_earned': bucket['xp'],
            'tasks_completed': bucket['tasks'],
            'cumulative_xp': cumulative_xp,
            'avg_task_xp': round(bucket['xp'] / bucket['tasks']) if bucket['tasks'] else 0,
            'focus_minutes': focus_minutes,
            'cumulative_focus_minutes': cumulative_focus_min,
        })
        day += timedelta(days=1)
        day_number += 1

    return {
        "created_date": created.isoformat(),
        "days_since_creation": (today - created).days,
        "growth_data": rows[-days:] if days and days > 0 else rows,
    }

