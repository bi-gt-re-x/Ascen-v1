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

Each row also carries what the person said about the tasks they finished that
day — see `_ratings_by_day`. Those fields are the only ones here that can be
absent for a day that had work on it, because the prompt behind them is optional
and skipping it is a supported answer; `rated_tasks` is on every row so a reader
of the series can always tell "rated badly" from "not rated".

The graded report card that shares the page lives in [analytics.py](analytics.py).
"""
from datetime import date, timedelta

from backend.database import connection as db
from backend.tracking import analytics as analytics_tracking
from backend.tracking import focus as focus_tracking
from backend.tracking import xp as xp_tracking
from backend.tracking.auth import created_date_for, find_user

# How many days the chart shows when the caller does not say.
SERIES_WINDOW = 30


def _ratings_by_day(username):
    """Per-day quality, difficulty and execution over the tasks rated that day.

    Keyed on `completed_at`, which is when the work was finished rather than
    when the prompt was answered — a task rated the next morning belongs to the
    day it was done, or the series would report quality on days nothing happened.

    Only tasks rated on both rows are counted; `rating_of` is the authority on
    that, so the day series and the report card cannot disagree about what
    counts as rated.
    """
    buckets = {}
    for task in db.tasks_for(username):
        if task.get('status') != 'done':
            continue
        score = analytics_tracking.rating_of(task)
        if score is None:
            continue
        day = str(task.get('completed_at') or '')[:10]
        if not day:
            continue
        bucket = buckets.setdefault(day, {'scores': [], 'difficulty': [], 'execution': []})
        bucket['scores'].append(score)
        bucket['difficulty'].append(int(task['difficulty']))
        bucket['execution'].append(int(task['execution']))

    out = {}
    for day, bucket in buckets.items():
        count = len(bucket['scores'])
        out[day] = {
            'rated_tasks': count,
            'quality_score': round(sum(bucket['scores']) / count, 1),
            'avg_difficulty': round(sum(bucket['difficulty']) / count, 1),
            'avg_execution': round(sum(bucket['execution']) / count, 1),
        }
    return out


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
    rated = _ratings_by_day(username)

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

        # Zeros rather than absent keys on an unrated day, so every row has the
        # same shape — but `rated_tasks` is what a reader must branch on, never
        # `quality_score`, because 0 there means "nobody said" and not "bad".
        say = rated.get(iso) or {
            'rated_tasks': 0,
            'quality_score': 0,
            'avg_difficulty': 0,
            'avg_execution': 0,
        }

        rows.append({
            'date': iso,
            'day_number': day_number,
            'xp_earned': bucket['xp'],
            'tasks_completed': bucket['tasks'],
            'cumulative_xp': cumulative_xp,
            'avg_task_xp': round(bucket['xp'] / bucket['tasks']) if bucket['tasks'] else 0,
            'focus_minutes': focus_minutes,
            'cumulative_focus_minutes': cumulative_focus_min,
            'rated_tasks': say['rated_tasks'],
            'quality_score': say['quality_score'],
            'avg_difficulty': say['avg_difficulty'],
            'avg_execution': say['avg_execution'],
        })
        day += timedelta(days=1)
        day_number += 1

    return {
        "created_date": created.isoformat(),
        "days_since_creation": (today - created).days,
        "growth_data": rows[-days:] if days and days > 0 else rows,
    }

