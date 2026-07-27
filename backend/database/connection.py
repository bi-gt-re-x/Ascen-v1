"""The datastore: the JSON files under data/.

Every read and write in the backend goes through this module, so there is one
answer to "where is the data and how is it written". Each store gets a
load/save pair — `users()` / `save_users(rows)` — and nothing above this layer
needs to know a file path.

Writes are atomic. Writing to a temp file in the same directory and then
os.replace()-ing it over the target means a concurrent reader always sees
either the complete old file or the complete new one, never a half-written
one — which matters because the threaded dev server can read a store on one
request while another request is rewriting it (e.g. the live streak decay).

`database.db` at the repo root is a leftover from an early SQLite attempt. It
is not read, not written, and not opened.
"""
import json
import os
import tempfile

from backend.config.settings import (CALENDAR_JSON, EVENTCOLORS_JSON,
                                     GOALS_JSON, TASKS_JSON, USERS_JSON,
                                     XPEVENT_JSON)


def read_json(filepath):
    """The rows in a JSON store, or [] if it is missing or unreadable."""
    try:
        if os.path.exists(filepath):
            with open(filepath, 'r') as f:
                return json.load(f)
        return []
    except (json.JSONDecodeError, FileNotFoundError):
        return []


def write_json(filepath, data):
    """Replace a JSON store's contents atomically."""
    dir_name = os.path.dirname(filepath) or '.'
    fd, tmp_path = tempfile.mkstemp(dir=dir_name, suffix='.tmp')
    try:
        with os.fdopen(fd, 'w') as f:
            json.dump(data, f, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_path, filepath)
    except Exception:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


# --------------------------------------------------------------------------
# One load/save pair per store
# --------------------------------------------------------------------------
def users():
    return read_json(USERS_JSON)


def save_users(rows):
    write_json(USERS_JSON, rows)


def tasks():
    return read_json(TASKS_JSON)


def save_tasks(rows):
    write_json(TASKS_JSON, rows)


def goals():
    return read_json(GOALS_JSON)


def save_goals(rows):
    write_json(GOALS_JSON, rows)


def xp_events():
    return read_json(XPEVENT_JSON)


def save_xp_events(rows):
    write_json(XPEVENT_JSON, rows)


def calendar():
    return read_json(CALENDAR_JSON)


def save_calendar(rows):
    write_json(CALENDAR_JSON, rows)


def event_colors():
    """The tracked list of event hex colours (tolerates a list or a dict)."""
    data = read_json(EVENTCOLORS_JSON)
    if isinstance(data, dict):
        colors = data.get('colors', [])
    elif isinstance(data, list):
        colors = data
    else:
        colors = []
    return [c for c in colors if isinstance(c, str)]


def save_event_colors(colors):
    write_json(EVENTCOLORS_JSON, {"colors": colors})
