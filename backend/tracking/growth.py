"""Growth: the day-by-day series and the graded report card.

Two things the growth page asks for:

  * `series(username)` — one row per day from account creation to today, with
    XP, tasks, focus minutes and running totals. Days with nothing recorded are
    still rows, so the chart's x-axis is real time rather than a list of active
    days.
  * `ratings(username)` — five independent metrics, each scored 0-100 with a
    letter grade, plus a weighted overall and week-over-week momentum for each.
    No streak / charge / milestone dependencies: every number is derived from
    the XP ledger, the completed tasks and the focus history.

The five metrics:

    productivity   XP earned per day since the account was made
    quality        average XP per completed task (how hard the work was)
    consistency    share of days the user showed up at all
    efficiency     half deadlines met, half how fast tasks were finished
    focus          tracked focus time against the daily focus goal
"""
from datetime import date, timedelta

from backend.database import connection as db
from backend.tracking import focus as focus_tracking
from backend.tracking import xp as xp_tracking
from backend.tracking.auth import created_date_for, find_user

# How many days of the series the growth chart shows.
SERIES_WINDOW = 30


# --------------------------------------------------------------------------
# Grading
# --------------------------------------------------------------------------
def grade_for_score(score):
    """Map a 0-100 score to the global letter grade."""
    if score >= 95:
        return 'S'
    if score >= 85:
        return 'A'
    if score >= 72:
        return 'B'
    if score >= 65:
        return 'C'
    if score >= 40:
        return 'D'
    return 'F'


def _speed_score_from_minutes(minutes):
    """Map average completion time (minutes) to a 0-100 speed score."""
    if minutes <= 30:
        return 100
    if minutes <= 60:
        return 85
    if minutes <= 80:
        return 70
    if minutes <= 120:
        return 55
    return 30


def _clamp(value, low=0, high=100):
    return max(low, min(high, value))


def _message(metric_scores):
    """Short qualitative note based on the strongest / weakest metric."""
    phrases = {
        'productivity': ('strong daily output', 'raise your daily XP'),
        'quality': ('tackling hard tasks', 'take on harder tasks'),
        'consistency': ('showing up daily', 'show up more often'),
        'efficiency': ('fast, on-time work', 'work faster and beat deadlines'),
        'focus': ('locked-in focus sessions', 'hit your daily focus goal'),
    }
    if not metric_scores:
        return "Complete tasks to build your rating."
    best = max(metric_scores, key=metric_scores.get)
    worst = min(metric_scores, key=metric_scores.get)
    if metric_scores[worst] >= 85:
        return "Excellent across the board — keep it up."
    if best == worst:
        return phrases[best][0].capitalize() + "."
    return "{} — {}.".format(phrases[best][0].capitalize(), phrases[worst][1])


def _trend(current, previous):
    """Week-over-week movement as a direction and a percentage."""
    if previous > 0:
        pct = round((current - previous) / previous * 100)
    elif current > 0:
        pct = 100
    else:
        pct = 0
    return {
        'direction': 'up' if pct > 0 else ('down' if pct < 0 else 'flat'),
        'pct': pct,
    }


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
    history = focus_tracking.history_for(user)

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


# --------------------------------------------------------------------------
# The report card
# --------------------------------------------------------------------------
def ratings(username):
    """The five-metric graded report card, or None when there's no account."""
    users = db.users()
    user = find_user(users, username=username)
    if not user:
        return None

    today = date.today()
    total_days = max((today - created_date_for(user)).days + 1, 1)

    # --- Total XP earned + distinct active days, from the ledger ---
    events = xp_tracking.events_for(username)
    total_xp = 0
    active_day_set = set()
    for event in events:
        total_xp += event.get('amount', 0) or 0
        day = xp_tracking.event_day(event)
        if day:
            active_day_set.add(day)
    active_days = min(len(active_day_set), total_days)

    # --- Completed tasks: difficulty + efficiency inputs ---
    done = [t for t in db.tasks()
            if t.get('user_id') == username and t.get('status') == 'done']
    total_tasks = len(done)
    total_task_xp = sum(t.get('xp_value', 0) or 0 for t in done)

    avg_daily_xp = total_xp / total_days
    avg_task_xp = (total_task_xp / total_tasks) if total_tasks else 0

    # 1. Productivity — XP earned per day.
    productivity_score = round(_clamp(avg_daily_xp / 3))
    # 2. Quality — average task difficulty.
    quality_score = round(_clamp(avg_task_xp * 1.75))
    # 3. Consistency — share of days the user showed up.
    consistency_rate = (active_days / total_days) * 100
    consistency_score = round(_clamp(consistency_rate))

    # 4. Efficiency — always shown: 50% deadlines met + 50% time used to finish.
    #    Tasks completed before timing was added lack these fields, so those
    #    halves score 0 until new tasks are completed (never hidden).
    timed = [t.get('completion_seconds') for t in done
             if isinstance(t.get('completion_seconds'), (int, float))]
    if timed:
        avg_minutes = (sum(timed) / len(timed)) / 60.0
        speed_score = _speed_score_from_minutes(avg_minutes)
    else:
        avg_minutes = None
        speed_score = 0

    deadline_tracked = [t for t in done if 'met_deadline' in t]
    if deadline_tracked:
        on_time = sum(1 for t in deadline_tracked if t.get('met_deadline'))
        deadline_score = (on_time / len(deadline_tracked)) * 100
    else:
        deadline_score = 0

    efficiency_score = round(_clamp(deadline_score * 0.5 + speed_score * 0.5))

    # 5. Focus — tracked focus time vs the daily focus goal, across every day
    #    with a synced record.
    history = focus_tracking.history_for(user)
    focused_sec = 0.0
    focus_goal_sec = 0.0
    for record in history.values():
        try:
            focused_sec += float(record.get('seconds', 0) or 0)
            focus_goal_sec += float(record.get('goal_hours', 0) or 0) * 3600.0
        except (TypeError, ValueError, AttributeError):
            continue
    focus_ratio = (focused_sec / focus_goal_sec) if focus_goal_sec > 0 else 0.0
    focus_score = round(_clamp(focus_ratio * 100))

    parts = {
        'productivity': productivity_score,
        'quality': quality_score,
        'consistency': consistency_score,
        'efficiency': efficiency_score,
        'focus': focus_score,
    }
    overall_score = round(_clamp(sum(parts.values()) / len(parts)))

    # --- Week-over-week momentum, for the hero and every card ---
    def window_stats(lo_days, hi_days):
        """XP, task count and distinct active days from events in a window."""
        xp = 0
        tasks = 0
        days = set()
        for event in events:
            day = xp_tracking.event_day(event)
            parsed = xp_tracking.parse_day(day)
            if parsed is None:
                continue
            if lo_days <= (today - parsed).days <= hi_days:
                xp += event.get('amount', 0) or 0
                tasks += event.get('tasks_completed', 1) or 0
                days.add(day)
        return {'xp': xp, 'tasks': tasks, 'active_days': len(days)}

    def window_efficiency(lo_days, hi_days):
        """Efficiency over tasks completed within a window, or None."""
        secs = []
        met = []
        for task in done:
            parsed = xp_tracking.parse_day(task.get('completed_at'))
            if parsed is None:
                continue
            if not (lo_days <= (today - parsed).days <= hi_days):
                continue
            if isinstance(task.get('completion_seconds'), (int, float)):
                secs.append(task['completion_seconds'])
            if 'met_deadline' in task:
                met.append(bool(task['met_deadline']))
        if not secs and not met:
            return None
        spd = _speed_score_from_minutes((sum(secs) / len(secs)) / 60.0) if secs else 0
        dln = (sum(1 for x in met if x) / len(met) * 100) if met else 0
        return _clamp(dln * 0.5 + spd * 0.5)

    this_w = window_stats(0, 6)
    prev_w = window_stats(7, 13)
    this_quality = (this_w['xp'] / this_w['tasks']) if this_w['tasks'] else 0
    prev_quality = (prev_w['xp'] / prev_w['tasks']) if prev_w['tasks'] else 0

    productivity_trend = _trend(this_w['xp'], prev_w['xp'])
    quality_trend = _trend(this_quality, prev_quality)
    consistency_trend = _trend(this_w['active_days'], prev_w['active_days'])
    efficiency_trend = _trend(window_efficiency(0, 6) or 0, window_efficiency(7, 13) or 0)
    focus_trend = _trend(focus_tracking.seconds_in_window(user, 0, 6, today),
                         focus_tracking.seconds_in_window(user, 7, 13, today))

    return {
        "overall": {
            "score": overall_score,
            "grade": grade_for_score(overall_score),
            "message": _message(parts),
            "trend": productivity_trend,
        },
        "metrics": {
            "productivity": {
                "score": productivity_score,
                "grade": grade_for_score(productivity_score),
                "avg_daily_xp": round(avg_daily_xp),
                "trend": productivity_trend,
            },
            "quality": {
                "score": quality_score,
                "grade": grade_for_score(quality_score),
                "avg_task_xp": round(avg_task_xp),
                "trend": quality_trend,
            },
            "consistency": {
                "score": consistency_score,
                "grade": grade_for_score(consistency_score),
                "active_days": active_days,
                "total_days": total_days,
                "rate": round(consistency_rate),
                "trend": consistency_trend,
            },
            "efficiency": {
                "score": efficiency_score,
                # Display floor of 1 minute so a near-instant task never reads
                # "Avg 0 Min/Task" (the raw value still drives the speed score).
                "avg_minutes": max(1, round(avg_minutes)) if avg_minutes is not None else None,
                "grade": grade_for_score(efficiency_score),
                "on_time_pct": round(deadline_score),
                "has_timing": bool(timed),
                "trend": efficiency_trend,
            },
            "focus": {
                "score": focus_score,
                "grade": grade_for_score(focus_score),
                "focused_minutes": round(focused_sec / 60),
                "goal_minutes": round(focus_goal_sec / 60),
                "pct_of_goal": round(focus_ratio * 100),
                "trend": focus_trend,
            },
        },
    }
