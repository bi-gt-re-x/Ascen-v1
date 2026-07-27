"""Calendar events: what is on the calendar and when.

Two kinds of row share data/calendar.json:

  * **entries** — a task placed on a day (`task_id`, `time_block`), which is
    how the calendar shows work that also exists on the dashboard;
  * **events** — a standalone block created on the calendar itself (`name`,
    optional weekly/monthly recurrence and an end date).

Both are dicts in the same list, told apart by which fields they carry, and
`is_default` marks the built-in events that cannot be deleted.

Event colours live in their own store: every hex colour handed out so far, so
the client can pick a new one that is visibly different from the rest.
"""
import re
from datetime import datetime

from backend.database import connection as db

HEX_COLOR_RE = re.compile(r'^#[0-9a-f]{6}$')


def _new_id():
    return str(int(datetime.now().timestamp() * 1000))


# --------------------------------------------------------------------------
# Entries: a task on a day
# --------------------------------------------------------------------------
def entries_for(username):
    return [e for e in db.calendar() if e.get('user_id') == username]


def create_entry(username, data):
    """Place a task (or a bare time block) on a day."""
    entries = db.calendar()
    entry_id = data.get('id', _new_id())
    entries.append({
        "id": entry_id,
        "user_id": username,
        "date": data.get('date', ''),
        "time_block": data.get('time_block', ''),
        "task_id": data.get('task_id', None),
        "created_at": datetime.now().isoformat(),
    })
    db.save_calendar(entries)
    return entry_id


def update_entry(entry_id, username, data):
    """Change a placed entry's day, block or task. False if it isn't theirs."""
    entries = db.calendar()
    for entry in entries:
        if entry.get('id') == entry_id and entry.get('user_id') == username:
            for field in ('date', 'time_block', 'task_id'):
                if field in data:
                    entry[field] = data[field]
            db.save_calendar(entries)
            return True
    return False


def delete_entry(entry_id, username=None):
    """Drop an entry — scoped to one account when a username is given."""
    entries = db.calendar()
    if username:
        kept = [e for e in entries
                if not (e.get('id') == entry_id and e.get('user_id') == username)]
    else:
        kept = [e for e in entries if e.get('id') != entry_id]
    db.save_calendar(kept)


# --------------------------------------------------------------------------
# Events: standalone calendar blocks
# --------------------------------------------------------------------------
def create_event(name, day, time_block, recurrence_month=None,
                 recurrence_week=None, end_date=None, description=''):
    """A new standalone calendar event."""
    entries = db.calendar()
    event = {
        "id": _new_id(),
        "name": name,
        "recurrence-month": recurrence_month or None,
        "recurrence-week": recurrence_week or None,
        "end_date": end_date or None,
        "date": day,
        "time_block": time_block,
        "description": description or '',
        "completed": False,
        "created_at": datetime.now().isoformat(),
        "is_default": False,
    }
    entries.append(event)
    db.save_calendar(entries)
    return {"success": True, "entry_id": event["id"], "message": "Calendar event created"}


def delete_event(event_id):
    """Delete a custom event. Built-in (default) events are protected."""
    entries = db.calendar()
    event = next((e for e in entries if e.get('id') == event_id), None)
    if not event:
        return {"success": False, "message": "Event not found"}
    if event.get('is_default', False):
        return {"success": False, "message": "Cannot delete default events"}
    db.save_calendar([e for e in entries if e.get('id') != event_id])
    return {"success": True, "message": "Calendar event deleted"}


def default_events():
    return [e for e in db.calendar() if e.get('is_default', False)]


def custom_events():
    return [e for e in db.calendar() if not e.get('is_default', False)]


def sync_task(task_id, username, day, time_block=None, recurrence_month=None,
              recurrence_week=None, end_date=None, name=None):
    """Put an existing task on the calendar as an event block."""
    task = next((t for t in db.tasks()
                 if t.get('id') == task_id and t.get('user_id') == username), None)

    entries = db.calendar()
    entry = {
        "id": _new_id(),
        "name": name or (task.get('title', 'Untitled') if task else 'Untitled'),
        "recurrence-month": recurrence_month or None,
        "recurrence-week": recurrence_week or None,
        "end_date": end_date or None,
        "date": day,
        "time_block": time_block,
        "description": '',
        "completed": False,
        "created_at": datetime.now().isoformat(),
    }
    entries.append(entry)
    db.save_calendar(entries)
    return {"success": True, "entry_id": entry["id"], "message": "Task synced to calendar"}


def mark_task_completed(task_id, username):
    """Complete a task and tick off every calendar entry pointing at it."""
    tasks = db.tasks()
    task = next((t for t in tasks
                 if t.get('id') == task_id and t.get('user_id') == username), None)
    if not task:
        return {"success": False, "message": "Task not found"}

    task['status'] = 'done'
    db.save_tasks(tasks)

    entries = db.calendar()
    updated = 0
    for entry in entries:
        if entry.get('task_id') == task_id and entry.get('user_id') == username:
            entry['completed'] = True
            entry['completed_at'] = datetime.now().isoformat()
            updated += 1
    db.save_calendar(entries)

    return {"success": True,
            "message": "Task marked as completed in calendar. "
                       "{} calendar entries updated.".format(updated)}


def progress_for(username):
    """How much of a user's calendar is ticked off, overall and per day."""
    entries = entries_for(username)
    total = len(entries)
    completed = len([e for e in entries if e.get('completed', False)])

    by_date = {}
    for entry in entries:
        by_date.setdefault(entry.get('date', 'Unknown'), []).append(entry)

    return {
        "success": True,
        "total_entries": total,
        "completed_entries": completed,
        "completion_rate": (completed / total * 100) if total else 0,
        "entries_by_date": by_date,
        "entries": entries,
    }


# --------------------------------------------------------------------------
# Event colours
# --------------------------------------------------------------------------
def colors():
    return db.event_colors()


def add_color(color):
    """Track a newly-assigned colour. Returns the full list, or None if invalid."""
    color = str(color or '').strip().lower()
    if not HEX_COLOR_RE.match(color):
        return None
    tracked = db.event_colors()
    if color not in tracked:
        tracked.append(color)
        db.save_event_colors(tracked)
    return tracked
