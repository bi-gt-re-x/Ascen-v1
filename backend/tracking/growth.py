"""Growth: the day-by-day series behind the chart.

`series(username)` is one row per day from account creation to today, with XP,
tasks, focus minutes and running totals. Days with nothing recorded are still
rows, so the chart's x-axis is real time rather than a list of active days.

The graded report card that shares the page lives in [analytics.py](analytics.py).
"""
from datetime import date, timedelta

from backend.database import connection as db
from backend.tracking import focus as focus_tracking
from backend.tracking import xp as xp_tracking
from backend.tracking.auth import created_date_for, find_user

# How many days of the series the growth chart shows.
SERIES_WINDOW = 30


# --------------------------------------------------------------------------
# The day-by-day series
# --------------------------------------------------------------------------
def series(username):
    """The growth chart's data, or None when the account doesn't exist."""
    user = find_user(db.users(), username=username)
    if not user:
        return None

    created = created_date_for(user)
    totals = xp_tracking.daily_totals(username)
    history = focus_tracking.history_for(username)

    today = date.today()
    days = []
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

        days.append({
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
        "growth_data": days[-SERIES_WINDOW:],
    }

