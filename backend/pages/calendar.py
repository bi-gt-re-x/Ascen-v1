"""The calendar — Month, Week and Day views over the same data.

Everything the three views need is here: the entries and events themselves
(backed by tracking/event.py), the per-day focus note the views share, the XP a
day earned (straight from the ledger, so "XP Earned" always means "since 12 AM
today"), and the palette bookkeeping that keeps two events from looking alike.
"""
import re

from flask import Blueprint, jsonify, render_template, request

from backend.tracking import event as event_tracking
from backend.tracking import focus as focus_tracking
from backend.tracking import xp as xp_tracking

bp = Blueprint('calendar', __name__)

DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')


@bp.route('/calendar')
def page():
    return render_template('calendar.html')


# --------------------------------------------------------------------------
# Entries
# --------------------------------------------------------------------------
@bp.route('/api/calendar', methods=['GET'])
def list_entries():
    username = request.args.get('username')
    if not username:
        return jsonify({"success": False, "message": "Username required"})
    return jsonify({"success": True, "entries": event_tracking.entries_for(username)})


@bp.route('/api/calendar', methods=['POST'])
def create_entry():
    data = request.json or {}
    username = data.get('username')
    if not username:
        return jsonify({"success": False, "message": "Username required"})
    entry_id = event_tracking.create_entry(username, data)
    return jsonify({"success": True, "entry_id": entry_id})


@bp.route('/api/calendar/<entry_id>', methods=['PUT'])
def update_entry(entry_id):
    data = request.json or {}
    username = data.get('username')
    if not username:
        return jsonify({"success": False, "message": "Username required"})
    if not event_tracking.update_entry(entry_id, username, data):
        return jsonify({"success": False, "message": "Calendar entry not found"})
    return jsonify({"success": True})


@bp.route('/api/calendar/<entry_id>', methods=['DELETE'])
def delete_entry(entry_id):
    event_tracking.delete_entry(entry_id, request.args.get('username'))
    return jsonify({"success": True})


# --------------------------------------------------------------------------
# Events and task sync
# --------------------------------------------------------------------------
@bp.route('/api/create_calendar_event', methods=['POST'])
def create_event():
    data = request.json or {}
    name = data.get('name')
    day = data.get('date')
    time_block = data.get('time_block')

    if not name or not day or not time_block:
        return jsonify({"success": False, "message": "Name, date, and time_block required"})

    return jsonify(event_tracking.create_event(
        name, day, time_block,
        recurrence_month=data.get('recurrence-month'),
        recurrence_week=data.get('recurrence-week'),
        end_date=data.get('end_date'),
    ))


@bp.route('/api/delete_calendar_event/<event_id>', methods=['DELETE'])
def delete_event(event_id):
    return jsonify(event_tracking.delete_event(event_id))


@bp.route('/api/get_default_events', methods=['GET'])
def get_default_events():
    return jsonify({"success": True, "events": event_tracking.default_events()})


@bp.route('/api/get_custom_events', methods=['GET'])
def get_custom_events():
    return jsonify({"success": True, "events": event_tracking.custom_events()})


@bp.route('/api/sync_task_to_calendar', methods=['POST'])
def sync_task_to_calendar():
    data = request.json or {}
    task_id = data.get('task_id')
    username = data.get('username')
    day = data.get('date')

    if not task_id or not username or not day:
        return jsonify({"success": False, "message": "Task ID, username, and date required"})

    return jsonify(event_tracking.sync_task(
        task_id, username, day,
        time_block=data.get('time_block'),
        recurrence_month=data.get('recurrence-month'),
        recurrence_week=data.get('recurrence-week'),
        end_date=data.get('end_date'),
        name=data.get('name'),
    ))


@bp.route('/api/mark_task_completed_in_calendar', methods=['POST'])
def mark_task_completed_in_calendar():
    data = request.json or {}
    task_id = data.get('task_id')
    username = data.get('username')
    if not task_id or not username:
        return jsonify({"success": False, "message": "Task ID and username required"})
    return jsonify(event_tracking.mark_task_completed(task_id, username))


@bp.route('/api/get_calendar_progress', methods=['GET'])
def get_calendar_progress():
    username = request.args.get('username')
    if not username:
        return jsonify({"success": False, "message": "Username required"})
    return jsonify(event_tracking.progress_for(username))


# --------------------------------------------------------------------------
# Event colours
# --------------------------------------------------------------------------
@bp.route('/api/get_event_colors', methods=['GET'])
def get_event_colors():
    """The colours already in use, so the client can pick a distinct new one."""
    return jsonify({"success": True, "colors": event_tracking.colors()})


@bp.route('/api/add_event_color', methods=['POST'])
def add_event_color():
    payload = request.get_json(silent=True) or {}
    colors = event_tracking.add_color(payload.get('color'))
    if colors is None:
        return jsonify({"success": False, "message": "Invalid colour"}), 400
    return jsonify({"success": True, "colors": colors})


# --------------------------------------------------------------------------
# What a day amounted to
# --------------------------------------------------------------------------
@bp.route('/api/day_focus', methods=['GET'])
def get_day_focus():
    """Every saved day-focus note for a user, keyed by ISO date."""
    username = request.args.get('username')
    if not username:
        return jsonify({"success": False, "message": "Username required"})
    notes = focus_tracking.day_notes(username)
    if notes is None:
        return jsonify({"success": False, "message": "User not found"})
    return jsonify({"success": True, "day_focus": notes})


@bp.route('/api/day_focus', methods=['POST'])
def set_day_focus():
    """Upsert one day's focus text; an empty text deletes the entry."""
    data = request.get_json(silent=True) or {}
    username = data.get('username')
    day = str(data.get('date') or '')
    text = str(data.get('text') or '').strip()[:200]

    if not username or not DATE_RE.match(day):
        return jsonify({"success": False, "message": "Username and date required"})
    if not focus_tracking.set_day_note(username, day, text):
        return jsonify({"success": False, "message": "User not found"})
    return jsonify({"success": True, "date": day, "text": text})


@bp.route('/api/xp_earned_on', methods=['GET'])
def xp_earned_on():
    """XP a user earned on one calendar day, straight from the ledger."""
    username = request.args.get('username')
    day = str(request.args.get('date') or '')
    if not username or not DATE_RE.match(day):
        return jsonify({"success": False, "message": "Username and date required"})

    totals = xp_tracking.earned_on(username, day)
    return jsonify({"success": True, "date": day, **totals})
