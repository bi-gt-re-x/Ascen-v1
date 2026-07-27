"""Focus time: how long the user actually sat down and worked.

The session itself runs client-side (frontend/js/focus.js keeps the timer in
localStorage). What is tracked here is each day's total, mirrored into the
account as `focus_history`: {"YYYY-MM-DD": {"seconds": n, "goal_hours": n}} —
so the calendar's Weekly Focus Time panel, the growth chart and focus-type
goals all read one number that survives a cleared browser.

Also here: the one-line "Focus" note attached to a calendar day
(`day_focus`: {"YYYY-MM-DD": "text"}), which the Week, Day and Month views all
show, so an edit in one view lands everywhere.
"""
from datetime import datetime

from backend.database import connection as db
from backend.tracking.auth import find_user, load_user


def history_for(user):
    """A user record's per-day focus totals, tolerating missing/bad data."""
    hist = user.get('focus_history')
    return hist if isinstance(hist, dict) else {}


def record_day(username, day, seconds, goal_hours):
    """Store one day's focus total. Returns the stored record, or None.

    Never lets a stale client (an old tab with cleared localStorage, say)
    shrink a day's already-recorded total.
    """
    users, user = load_user(username)
    if not user:
        return None

    hist = user.get('focus_history')
    if not isinstance(hist, dict):
        hist = {}
        user['focus_history'] = hist

    previous = hist.get(day) or {}
    hist[day] = {
        'seconds': round(max(seconds, float(previous.get('seconds', 0) or 0)), 1),
        'goal_hours': goal_hours,
    }
    db.save_users(users)
    return hist[day]


def history_range(username, start='', end=''):
    """{iso: {seconds, goal_hours}} within a date range, or None if no user.

    Days with no record are simply absent — nothing was tracked and nothing was
    planned.
    """
    user = find_user(db.users(), username=username)
    if not user:
        return None

    days = {}
    for day, record in history_for(user).items():
        if start and day < start:
            continue
        if end and day > end:
            continue
        try:
            days[day] = {
                'seconds': max(0.0, float((record or {}).get('seconds', 0) or 0)),
                'goal_hours': max(0.0, float((record or {}).get('goal_hours', 0) or 0)),
            }
        except (TypeError, ValueError):
            continue
    return days


def total_seconds(username):
    """An account's all-time tracked focus seconds."""
    user = find_user(db.users(), username=username)
    if not user:
        return 0.0
    total = 0.0
    for record in history_for(user).values():
        try:
            total += max(0.0, float((record or {}).get('seconds', 0) or 0))
        except (ValueError, TypeError):
            continue
    return total


def seconds_in_window(user, lo_days, hi_days, today):
    """Focused seconds recorded between `lo_days` and `hi_days` ago."""
    total = 0.0
    for day, record in history_for(user).items():
        try:
            d = datetime.strptime(str(day)[:10], '%Y-%m-%d').date()
            if lo_days <= (today - d).days <= hi_days:
                total += float(record.get('seconds', 0) or 0)
        except (ValueError, TypeError, AttributeError):
            continue
    return total


# --------------------------------------------------------------------------
# The per-day focus note
# --------------------------------------------------------------------------
def day_notes(username):
    """Every saved day-focus note for a user, keyed by ISO date. None if no user."""
    user = find_user(db.users(), username=username)
    if not user:
        return None
    notes = user.get('day_focus')
    return notes if isinstance(notes, dict) else {}


def set_day_note(username, day, text):
    """Upsert one day's focus text; empty text deletes the entry."""
    users, user = load_user(username)
    if not user:
        return False

    notes = user.get('day_focus')
    if not isinstance(notes, dict):
        notes = {}
        user['day_focus'] = notes
    if text:
        notes[day] = text
    else:
        notes.pop(day, None)
    db.save_users(users)
    return True
