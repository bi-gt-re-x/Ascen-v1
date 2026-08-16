"""Analytics: the graded report card.

Five independent metrics, each scored 0-100 with a plain letter grade, plus an
overall and week-over-week momentum for each. No streak / charge / milestone
dependencies: every number is derived from the XP ledger, the completed tasks
and the focus history.

    productivity   XP earned per day since the account was made
    quality        how well the work was done, times how hard it was
    consistency    share of days the user showed up at all
    efficiency     half deadlines met, half how fast tasks were finished
    focus          tracked focus time against the daily focus goal

Every computation is written to analytics.sql — one row per user per day per
metric, replacing that day's row — so the report card accumulates a history
instead of only ever showing the current number.

## What quality is measured from

Quality used to be `avg XP per task * 1.75`, under a comment that claimed it
was average task difficulty. It was not: XP is set when a task is *created*, by
the person who is about to do it, so the metric graded how ambitiously somebody
filled in a form. It never saw the work.

It is now the two things only the person who did the task knows — how well it
went and how hard it was — multiplied together, over the tasks they rated. The
product is deliberate rather than a mean of the two: an easy task done perfectly
and a brutal one botched both average to the middle, and they are not the same
week. Multiplying separates them, on a 1-25 scale where 25 is a brutal task done
excellently.

**Ratings are optional and this metric may not assume otherwise.** The prompt
after a completed task can be skipped, and about half of them are. An account
that never answers it must not be graded 0 for quality — that would turn an
optional question into a mandatory one by way of the scoreboard, and would drop
its Growth Score by up to two points for declining to answer. So quality falls
back to the old XP-per-task proxy when there is nothing rated, and `basis` says
which of the two the reader is looking at. Every surface that prints the figure
prints the basis with it; see `metricLines` on the client.
"""
from datetime import date

from backend.database import connection as db
from backend.tracking import focus as focus_tracking
from backend.tracking import xp as xp_tracking
from backend.tracking.auth import created_date_for, find_user

METRICS = ('productivity', 'quality', 'consistency', 'efficiency', 'focus')


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


# --------------------------------------------------------------------------
# Task ratings
# --------------------------------------------------------------------------
#: The best a single task can score: 5 for difficulty times 5 for execution.
QUALITY_MAX = 25


def rating_of(task):
    """A task's quality score, or None when it was not rated on both rows.

    Both halves or neither. The prompt lets somebody answer one star row and
    close the dialog, and that is a real answer to the row they filled in — but
    it is not a quality score, because half of the product is missing and there
    is no honest number to stand in for it. Treating an unanswered difficulty as
    an average one would invent the very opinion the prompt exists to collect.
    """
    difficulty = task.get('difficulty')
    execution = task.get('execution')
    if not isinstance(difficulty, (int, float)) or not isinstance(execution, (int, float)):
        return None
    if not (1 <= difficulty <= 5 and 1 <= execution <= 5):
        return None
    return int(difficulty) * int(execution)


def rating_summary(tasks):
    """Mean quality, mean difficulty, mean execution and the counts behind them.

    `rated` is the denominator that matters and is returned rather than left for
    the caller to infer: "16.2 out of 25" from four tasks and from four hundred
    are different claims, and a panel that prints the first without the second is
    inviting the wrong one.
    """
    scores = []
    difficulties = []
    executions = []
    for task in tasks:
        score = rating_of(task)
        if score is None:
            continue
        scores.append(score)
        difficulties.append(int(task['difficulty']))
        executions.append(int(task['execution']))

    rated = len(scores)
    mean = (lambda values: sum(values) / len(values) if values else 0)
    return {
        'rated': rated,
        'avg_quality': mean(scores),
        'avg_difficulty': mean(difficulties),
        'avg_execution': mean(executions),
    }


def _message(metric_scores):
    """Short qualitative note based on the strongest / weakest metric."""
    phrases = {
        'productivity': ('strong daily output', 'raise your daily XP'),
        'quality': ('hard work done well', 'take on harder tasks, or finish them better'),
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
# The report card
# --------------------------------------------------------------------------
def ratings(username, record=True):
    """The five-metric graded report card, or None when there's no account.

    Writing the result is the default: every look at the report card leaves a
    dated row per metric behind in analytics.sql.
    """
    user = find_user(db.users(), username=username)
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
    # 2. Quality — how well the work went, times how hard it was, over the tasks
    #    that were rated. Falls back to the XP proxy when none were; see the
    #    module docstring for why an unrated account is not graded zero.
    rated = rating_summary(done)
    quality_basis = 'ratings' if rated['rated'] else 'xp'
    if quality_basis == 'ratings':
        quality_score = round(_clamp(rated['avg_quality'] / QUALITY_MAX * 100))
    else:
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
    history = focus_tracking.history_for(username)
    focused_sec = 0.0
    focus_goal_sec = 0.0
    for record_row in history.values():
        try:
            focused_sec += float(record_row.get('seconds', 0) or 0)
            focus_goal_sec += float(record_row.get('goal_hours', 0) or 0) * 3600.0
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

    def window_tasks(lo_days, hi_days):
        """Completed tasks finished inside a window, for the quality trend."""
        rows = []
        for task in done:
            parsed = xp_tracking.parse_day(task.get('completed_at'))
            if parsed is not None and lo_days <= (today - parsed).days <= hi_days:
                rows.append(task)
        return rows

    this_w = window_stats(0, 6)
    prev_w = window_stats(7, 13)

    # The trend has to be measured on the same basis as the score, or the arrow
    # beside the figure is about a different quantity than the figure — an
    # account whose ratings improved while its XP-per-task fell would read
    # "16.2 / 25 ↓". Both halves fall back together.
    if quality_basis == 'ratings':
        this_quality = rating_summary(window_tasks(0, 6))['avg_quality']
        prev_quality = rating_summary(window_tasks(7, 13))['avg_quality']
    else:
        this_quality = (this_w['xp'] / this_w['tasks']) if this_w['tasks'] else 0
        prev_quality = (prev_w['xp'] / prev_w['tasks']) if prev_w['tasks'] else 0

    productivity_trend = _trend(this_w['xp'], prev_w['xp'])
    quality_trend = _trend(this_quality, prev_quality)
    consistency_trend = _trend(this_w['active_days'], prev_w['active_days'])
    efficiency_trend = _trend(window_efficiency(0, 6) or 0, window_efficiency(7, 13) or 0)
    focus_trend = _trend(focus_tracking.seconds_in_window(username, 0, 6, today),
                         focus_tracking.seconds_in_window(username, 7, 13, today))

    card = {
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
                # Which of the two the score came from, and the counts behind
                # it. `rated_tasks` against `total_tasks` is the coverage the
                # client prints beside the figure — see the module docstring.
                "basis": quality_basis,
                "rated_tasks": rated['rated'],
                "total_tasks": total_tasks,
                "avg_quality": round(rated['avg_quality'], 1),
                "avg_difficulty": round(rated['avg_difficulty'], 1),
                "avg_execution": round(rated['avg_execution'], 1),
                "max_quality": QUALITY_MAX,
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

    if record:
        save_snapshot(username, card)
    return card


# --------------------------------------------------------------------------
# History
# --------------------------------------------------------------------------
def save_snapshot(username, card, day=None):
    """Write today's grades to analytics.sql, replacing today's if present."""
    day = day or date.today().isoformat()
    rows = [r for r in db.metric_snapshots()
            if not (r.get('user_id') == username and r.get('date') == day)]

    for name in METRICS:
        metric = card['metrics'][name]
        rows.append({
            'user_id': username,
            'date': day,
            'metric': name,
            'score': metric['score'],
            'grade': metric['grade'],
            'detail': {k: v for k, v in metric.items() if k not in ('score', 'grade')},
        })
    rows.append({
        'user_id': username,
        'date': day,
        'metric': 'overall',
        'score': card['overall']['score'],
        'grade': card['overall']['grade'],
        'detail': {k: v for k, v in card['overall'].items() if k not in ('score', 'grade')},
    })

    db.save_metric_snapshots(rows)


def history(username, metric=None):
    """Past grades for an account, oldest first."""
    rows = [r for r in db.metric_snapshots() if r.get('user_id') == username]
    if metric:
        rows = [r for r in rows if r.get('metric') == metric]
    return sorted(rows, key=lambda r: (r.get('date') or '', r.get('metric') or ''))
