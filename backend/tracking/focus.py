"""Focus time: how long the user actually sat down and worked.

The session itself runs client-side (frontend/js/focus.js keeps the timer in
localStorage). What is tracked here is each day's total, one row per user per
day in focus.sql — so the calendar's Weekly Focus Time panel, the growth chart
and focus-type goals all read one number that survives a cleared browser.

Also here: the one-line "Focus" note attached to a calendar day, which the
Week, Day and Month views all show, so an edit in one view lands everywhere.
"""
from datetime import datetime

from backend.database import connection as db
from backend.tracking.auth import find_user


def _rows_for(username):
    return [r for r in db.focus_days() if r.get('user_id') == username]


def _seconds(row):
    try:
        return max(0.0, float(row.get('seconds', 0) or 0))
    except (TypeError, ValueError):
        return 0.0


def _goal_hours(row):
    try:
        return max(0.0, float(row.get('goal_hours', 0) or 0))
    except (TypeError, ValueError):
        return 0.0


def history_for(username):
    """{iso_date: {seconds, goal_hours}} for one account."""
    return {r['date']: {'seconds': _seconds(r), 'goal_hours': _goal_hours(r)}
            for r in _rows_for(username) if r.get('date')}


def record_day(username, day, seconds, goal_hours):
    """Store one day's focus total. Returns the stored record, or None.

    Never lets a stale client (an old tab with cleared localStorage, say)
    shrink a day's already-recorded total.
    """
    if not find_user(db.users(), username=username):
        return None

    rows = db.focus_days()
    row = next((r for r in rows
                if r.get('user_id') == username and r.get('date') == day), None)
    if row is None:
        row = {'user_id': username, 'date': day, 'seconds': 0.0, 'goal_hours': goal_hours}
        rows.append(row)

    row['seconds'] = round(max(seconds, _seconds(row)), 1)
    row['goal_hours'] = goal_hours
    db.save_focus_days(rows)
    return {'seconds': row['seconds'], 'goal_hours': row['goal_hours']}


def history_range(username, start='', end=''):
    """{iso: {seconds, goal_hours}} within a date range, or None if no user.

    Days with no record are simply absent — nothing was tracked and nothing was
    planned.
    """
    if not find_user(db.users(), username=username):
        return None
    return {day: rec for day, rec in history_for(username).items()
            if (not start or day >= start) and (not end or day <= end)}


def total_seconds(username):
    """An account's all-time tracked focus seconds."""
    return sum(_seconds(r) for r in _rows_for(username))


def seconds_in_window(username, lo_days, hi_days, today):
    """Focused seconds recorded between `lo_days` and `hi_days` ago."""
    total = 0.0
    for row in _rows_for(username):
        try:
            d = datetime.strptime(str(row.get('date'))[:10], '%Y-%m-%d').date()
        except (ValueError, TypeError):
            continue
        if lo_days <= (today - d).days <= hi_days:
            total += _seconds(row)
    return total


# --------------------------------------------------------------------------
# The per-day focus note
# --------------------------------------------------------------------------
def day_notes(username):
    """Every saved day-focus note for a user, keyed by ISO date. None if no user."""
    if not find_user(db.users(), username=username):
        return None
    return {r['date']: r.get('text', '') for r in db.day_focus_notes()
            if r.get('user_id') == username and r.get('date')}


def set_day_note(username, day, text):
    """Upsert one day's focus text; empty text deletes the entry."""
    if not find_user(db.users(), username=username):
        return False

    rows = [r for r in db.day_focus_notes()
            if not (r.get('user_id') == username and r.get('date') == day)]
    if text:
        rows.append({'user_id': username, 'date': day, 'text': text})
    db.save_day_focus_notes(rows)
    return True
