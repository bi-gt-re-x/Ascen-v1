import os
import json
import re
import sqlite3
import sys
import random
import tempfile
from flask import Blueprint, render_template, request, jsonify, session
from datetime import datetime, date, timedelta

# --- Path Constants ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)
DATABASE_PATH = os.path.join(ROOT_DIR, 'database.db')
DATA_DIR = os.path.join(ROOT_DIR, 'data')
# Templates live with the rest of the frontend; static assets are split into
# top-level styles/ (css), utilities/js/ (scripts) and images/ folders — see
# the custom /static route in __init__.py that keeps their classic URLs.
TEMPLATE_FOLDER = os.path.join(ROOT_DIR, 'frontend', 'templates')

# JSON file paths
USERS_JSON = os.path.join(DATA_DIR, 'users.json')
TASKS_JSON = os.path.join(DATA_DIR, 'tasks.json')
CALENDAR_JSON = os.path.join(DATA_DIR, 'calendar.json')
XPEVENT_JSON = os.path.join(DATA_DIR, 'xpevents.json')
GOALS_JSON = os.path.join(DATA_DIR, 'goals.json')
# Tracks every hex colour already assigned to a calendar event, so each new
# event can be given a colour that is a good amount different from the others.
EVENTCOLORS_JSON = os.path.join(DATA_DIR, 'eventcolors.json')

# How long the theme cookie lives (1 year) — it just needs to outlive the session.
THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

# Import task_backend for XP data access
sys.path.append(ROOT_DIR)
import task_backend

# --- JSON Helper Functions ---
def read_json_file(filepath):
    """Read data from a JSON file"""
    try:
        if os.path.exists(filepath):
            with open(filepath, 'r') as f:
                return json.load(f)
        return []
    except (json.JSONDecodeError, FileNotFoundError):
        return []

def write_json_file(filepath, data):
    """Write data to a JSON file atomically.

    Writing to a temp file in the same directory and then os.replace()-ing it
    over the target means a concurrent reader always sees either the complete old
    file or the complete new one — never a half-written, truncated file. This
    matters because the threaded dev server can read one JSON store on one request
    while another request is rewriting it (e.g. the live streak decay)."""
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

def get_current_theme():
    """Return the light/dark theme to render for the current request.

    Preference order:
      1. the `theme` cookie — set on every change and on login, so it is sent with
         every request and lets the server pick the theme with no dependence on JS
         timing or the session staying alive;
      2. the signed-in account's stored theme in users.json (durable per account);
      3. light.

    Because this drives <html data-theme="..."> at render time, the correct theme is
    in the very first bytes of the page — navigation never flashes or reverts.
    """
    cookie_theme = request.cookies.get('theme')
    if cookie_theme in ('light', 'dark'):
        return cookie_theme
    username = session.get('username')
    if username:
        for u in read_json_file(USERS_JSON):
            if u.get('username') == username:
                theme = u.get('theme', 'light')
                return theme if theme in ('light', 'dark') else 'light'
    return 'light'

# --- Routes Blueprint ---
bp = Blueprint('main', __name__)

@bp.app_context_processor
def inject_theme():
    """Expose per-request context to every template:
      - `current_theme`: the signed-in account's theme, so pages can render
        <html data-theme="..."> server-side with no flash;
      - `current_user`: the signed-in username from the session, so a page can
        recover it into localStorage when this browser has none (e.g. storage was
        cleared) and still load the account's data."""
    return {'current_theme': get_current_theme(), 'current_user': session.get('username', '')}

@bp.route('/home')
def home():
    return render_template('mainpage.html')

@bp.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@bp.route('/calendar')
def calendar():
    return render_template('calendar.html')

# Calendar API endpoints
@bp.route('/api/calendar', methods=['GET'])
def get_calendar_entries():
    """Get all calendar entries for a user from JSON file"""
    username = request.args.get('username')
    if not username:
        return jsonify({"success": False, "message": "Username required"})

    # Read calendar entries from JSON file
    calendar_entries = read_json_file(CALENDAR_JSON)
    
    # Filter entries by username
    user_entries = [entry for entry in calendar_entries if entry.get('user_id') == username]

    return jsonify({
        "success": True,
        "entries": user_entries
    })

@bp.route('/api/calendar', methods=['POST'])
def create_calendar_entry():
    """Create a new calendar entry and save to JSON file"""
    data = request.json
    username = data.get('username')
    
    if not username:
        return jsonify({"success": False, "message": "Username required"})

    # Read existing calendar entries
    calendar_entries = read_json_file(CALENDAR_JSON)
    
    # Generate entry ID if not provided
    entry_id = data.get('id', str(int(datetime.now().timestamp() * 1000)))
    
    # Create calendar entry object with proper structure
    new_entry = {
        "id": entry_id,
        "user_id": username,
        "date": data.get('date', ''),
        "time_block": data.get('time_block', ''),
        "task_id": data.get('task_id', None),
        "created_at": datetime.now().isoformat()
    }
    
    calendar_entries.append(new_entry)
    write_json_file(CALENDAR_JSON, calendar_entries)
    
    return jsonify({
        "success": True,
        "entry_id": entry_id
    })

@bp.route('/api/calendar/<entry_id>', methods=['PUT'])
def update_calendar_entry(entry_id):
    """Update an existing calendar entry in JSON file"""
    data = request.json
    username = data.get('username')
    
    if not username:
        return jsonify({"success": False, "message": "Username required"})

    # Read existing calendar entries
    calendar_entries = read_json_file(CALENDAR_JSON)
    
    # Find and update the entry
    entry_found = False
    for entry in calendar_entries:
        if entry.get('id') == entry_id and entry.get('user_id') == username:
            # Update fields that are provided
            if 'date' in data:
                entry['date'] = data['date']
            if 'time_block' in data:
                entry['time_block'] = data['time_block']
            if 'task_id' in data:
                entry['task_id'] = data['task_id']
            entry_found = True
            break
    
    if not entry_found:
        return jsonify({"success": False, "message": "Calendar entry not found"})
    
    # Write back to JSON file
    write_json_file(CALENDAR_JSON, calendar_entries)
    
    return jsonify({"success": True})

@bp.route('/api/calendar/<entry_id>', methods=['DELETE'])
def delete_calendar_entry(entry_id):
    """Delete a calendar entry from JSON file"""
    username = request.args.get('username')
    
    # Read existing calendar entries
    calendar_entries = read_json_file(CALENDAR_JSON)
    
    # Filter out the entry to delete
    if username:
        calendar_entries = [entry for entry in calendar_entries if not (entry.get('id') == entry_id and entry.get('user_id') == username)]
    else:
        calendar_entries = [entry for entry in calendar_entries if entry.get('id') != entry_id]
    
    # Write back to JSON file
    write_json_file(CALENDAR_JSON, calendar_entries)
    
    return jsonify({"success": True})

# Calendar progress tracking endpoints that use task_backend.py
@bp.route('/api/mark_task_completed_in_calendar', methods=['POST'])
def mark_task_completed_in_calendar():
    """Mark a task as completed in the calendar system using task_backend.py"""
    data = request.json
    task_id = data.get('task_id')
    username = data.get('username')
    
    if not task_id or not username:
        return jsonify({"success": False, "message": "Task ID and username required"})
    
    # Call task_backend.py function
    try:
        import task_backend
        result = task_backend.mark_task_completed_in_calendar(task_id, username)
        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "message": f"Error: {str(e)}"})

@bp.route('/api/get_calendar_progress', methods=['GET'])
def get_calendar_progress():
    """Get calendar progress data for a user using task_backend.py"""
    username = request.args.get('username')
    
    if not username:
        return jsonify({"success": False, "message": "Username required"})
    
    # Call task_backend.py function
    try:
        import task_backend
        result = task_backend.get_calendar_progress(username)
        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "message": f"Error: {str(e)}"})

@bp.route('/api/sync_task_to_calendar', methods=['POST'])
def sync_task_to_calendar():
    """Sync a task to the calendar system using task_backend.py"""
    data = request.json
    task_id = data.get('task_id')
    username = data.get('username')
    date = data.get('date')
    time_block = data.get('time_block')
    recurrence_month = data.get('recurrence-month')
    recurrence_week = data.get('recurrence-week')
    end_date = data.get('end_date')
    name = data.get('name')
    
    if not task_id or not username or not date:
        return jsonify({"success": False, "message": "Task ID, username, and date required"})
    
    # Call task_backend.py function
    try:
        import task_backend
        result = task_backend.sync_task_to_calendar(task_id, username, date, time_block, recurrence_month, recurrence_week, end_date, name)
        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "message": f"Error: {str(e)}"})

@bp.route('/api/create_calendar_event', methods=['POST'])
def create_calendar_event():
    """Create a new calendar event using task_backend.py"""
    data = request.json
    name = data.get('name')
    date = data.get('date')
    time_block = data.get('time_block')
    recurrence_month = data.get('recurrence-month')
    recurrence_week = data.get('recurrence-week')
    end_date = data.get('end_date')
    description = ''
    
    if not name or not date or not time_block:
        return jsonify({"success": False, "message": "Name, date, and time_block required"})
    
    # Call task_backend.py function
    try:
        import task_backend
        result = task_backend.create_calendar_event(name, date, time_block, recurrence_month, recurrence_week, end_date, description)
        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "message": f"Error: {str(e)}"})

@bp.route('/api/delete_calendar_event/<event_id>', methods=['DELETE'])
def delete_calendar_event(event_id):
    """Delete a calendar event using task_backend.py"""
    try:
        import task_backend
        result = task_backend.delete_calendar_event(event_id)
        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "message": f"Error: {str(e)}"})

@bp.route('/api/get_default_events', methods=['GET'])
def get_default_events():
    """Get all default calendar events using task_backend.py"""
    try:
        import task_backend
        events = task_backend.get_default_events()
        return jsonify({"success": True, "events": events})
    except Exception as e:
        return jsonify({"success": False, "message": f"Error: {str(e)}"})

@bp.route('/api/get_custom_events', methods=['GET'])
def get_custom_events():
    """Get all custom calendar events using task_backend.py"""
    try:
        import task_backend
        events = task_backend.get_custom_events()
        return jsonify({"success": True, "events": events})
    except Exception as e:
        return jsonify({"success": False, "message": f"Error: {str(e)}"})

def _read_event_colors():
    """Return the tracked list of event hex colours (tolerates list or dict)."""
    data = read_json_file(EVENTCOLORS_JSON)
    if isinstance(data, dict):
        colors = data.get('colors', [])
    elif isinstance(data, list):
        colors = data
    else:
        colors = []
    return [c for c in colors if isinstance(c, str)]

@bp.route('/api/get_event_colors', methods=['GET'])
def get_event_colors():
    """Return the hex colours already assigned to calendar events. The client
    uses these to pick a new colour that is visibly different from all of them."""
    try:
        return jsonify({"success": True, "colors": _read_event_colors()})
    except Exception as e:
        return jsonify({"success": False, "message": f"Error: {str(e)}", "colors": []})

@bp.route('/api/add_event_color', methods=['POST'])
def add_event_color():
    """Append a newly-assigned event colour to eventcolors.json."""
    try:
        payload = request.get_json(silent=True) or {}
        color = str(payload.get('color', '')).strip().lower()
        if not re.match(r'^#[0-9a-f]{6}$', color):
            return jsonify({"success": False, "message": "Invalid colour"}), 400
        colors = _read_event_colors()
        if color not in colors:
            colors.append(color)
            write_json_file(EVENTCOLORS_JSON, {"colors": colors})
        return jsonify({"success": True, "colors": colors})
    except Exception as e:
        return jsonify({"success": False, "message": f"Error: {str(e)}"})

@bp.route('/growth')
def growth():
    return render_template('growth.html')

@bp.route('/goals')
def goals():
    return render_template('goals.html')

@bp.route('/daily_xp')
def daily_xp():
    return render_template('daily_xp.html')

@bp.route('/privacy-policy')
def privacy_policy():
    return render_template('Misc HTML/privacy_policy.html')

@bp.route('/terms-of-service')
def terms_of_service():
    return render_template('Misc HTML/terms_of_service.html')

@bp.route('/about-us')
def about_us():
    return render_template('Misc HTML/about_us.html')

@bp.route('/contact-support')
def contact_support():
    return render_template('Misc HTML/contact_support.html')

@bp.route('/careers')
def careers():
    return render_template('Misc HTML/careers.html')

@bp.route('/test-dashboard')
def test_dashboard():
    return render_template('test_dashboard.html')

@bp.route('/api/signup', methods=['POST'])
def signup():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"success": False, "message": "Username and password are required."})

    # Read existing users from JSON file
    users = read_json_file(USERS_JSON)
    
    # Check if user already exists
    for user in users:
        if user.get('username') == username:
            return jsonify({"success": False, "message": "Account already exists."})

    # Create new user with proper structure. Record the creation time so the
    # growth chart's "3 days after account creation" gate accumulates correctly.
    new_user = {
        "id": str(int(datetime.now().timestamp() * 1000)),
        "username": username,
        "password_hash": password,  # Note: In production, this should be properly hashed
        "xp": 0,
        "level": 1,
        "theme": "light",
        "created_at": datetime.now().isoformat()
    }
    
    users.append(new_user)
    write_json_file(USERS_JSON, users)
    
    return jsonify({"success": True, "message": "Account created successfully! Please log in."})

@bp.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    # Read users from JSON file
    users = read_json_file(USERS_JSON)
    
    # Find user
    user = None
    for u in users:
        if u.get('username') == username and u.get('password_hash') == password:
            user = u
            break
    
    if user:
        # Remember who is signed in so the server can route them on the next visit.
        session['username'] = user['username']
        theme = user.get('theme', 'light')
        if theme not in ('light', 'dark'):
            theme = 'light'
        resp = jsonify({"success": True, "message": "Login successful!", "user": {"username": user['username'], "id": user['id'], "theme": theme}})
        # Seed the theme cookie from the account so every page this device loads
        # renders in the right theme immediately, even before any JS runs.
        resp.set_cookie('theme', theme, max_age=THEME_COOKIE_MAX_AGE, samesite='Lax')
        return resp
    else:
        return jsonify({"success": False, "message": "Account doesn't exist or invalid credentials."})

@bp.route('/api/logout', methods=['POST'])
def logout():
    # Clear the server-side session so the root route stops redirecting to the dashboard.
    session.pop('username', None)
    resp = jsonify({"success": True, "message": "Logged out."})
    # Drop the theme cookie so logged-out pages fall back to light.
    resp.delete_cookie('theme')
    return resp

@bp.route('/api/set_theme', methods=['POST'])
def set_theme():
    """Persist the light/dark theme.

    Writes to the signed-in account's users.json entry (durable) and always mirrors
    the choice into the `theme` cookie, which is what the server reads on every page
    load to render <html data-theme="...">. The cookie makes navigation reliable
    regardless of session state or client-side script timing.
    """
    data = request.json or {}
    theme = data.get('theme')
    if theme not in ('light', 'dark'):
        return jsonify({"success": False, "message": "Theme must be 'light' or 'dark'."}), 400

    persisted = False
    username = session.get('username')
    if username:
        users = read_json_file(USERS_JSON)
        for u in users:
            if u.get('username') == username:
                u['theme'] = theme
                write_json_file(USERS_JSON, users)
                persisted = True
                break

    resp = jsonify({"success": True, "persisted": persisted})
    resp.set_cookie('theme', theme, max_age=THEME_COOKIE_MAX_AGE, samesite='Lax')
    return resp

def refresh_user_streak(user):
    """Decay a stale streak so every page reads the same live value.

    A streak counts consecutive days with at least one completed task. It stays
    alive only while the last completed task was today or yesterday; once a whole
    day passes with no completion (last task 2+ days ago), the current streak is
    lost (reset to 0). best_streak is the all-time record and is never lowered.
    At the start of a new day the day_state flips back to 'newday' so the next
    completion extends the streak. Returns True if the user record changed, so
    the caller can persist it.
    """
    last = user.get('last_task_date')
    if not last:
        return False
    try:
        last_date = datetime.strptime(str(last)[:10], '%Y-%m-%d').date()
    except (ValueError, TypeError):
        return False

    gap = (date.today() - last_date).days
    changed = False
    if gap >= 2:
        # A full day went by with no completed task — the streak is broken.
        if user.get('current_streak', 0) != 0:
            user['current_streak'] = 0
            changed = True
        if user.get('day_state') != 'newday':
            user['day_state'] = 'newday'
            changed = True
    elif gap == 1:
        # New day, streak still alive but not yet extended today.
        if user.get('day_state') != 'newday':
            user['day_state'] = 'newday'
            changed = True
    return changed


@bp.route('/api/get_user_data', methods=['GET'])
def get_user_data():
    username = request.args.get('username')
    if not username:
        return jsonify({"success": False, "message": "Username required"})

    # Read users from JSON file
    users = read_json_file(USERS_JSON)
    
    # Find user
    user = None
    for u in users:
        if u.get('username') == username:
            user = u
            break
    
    if not user:
        return jsonify({"success": False, "message": "User not found"})

    # Decay a stale streak (lost after a full day with no task) before reporting.
    if refresh_user_streak(user):
        write_json_file(USERS_JSON, users)

    # Read tasks from JSON file
    tasks = read_json_file(TASKS_JSON)
    user_tasks = [task for task in tasks if task.get('user_id') == username]

    # Create stats object from user data
    stats = {
        "level": user.get('level', 1),
        "xp": user.get('xp', 0),
        "tasks_completed": user.get('tasks_completed', 0),
        "current_streak": user.get('current_streak', 0),
        "best_streak": user.get('best_streak', 0),
        "charge": user.get('charge', 0)
    }

    return jsonify({
        "success": True,
        "stats": stats,
        "tasks": user_tasks
    })

@bp.route('/api/update_stats', methods=['POST'])
def update_stats():
    data = request.json
    username = data.get('username')
    level = data.get('level')
    xp = data.get('xp')
    tasks_completed = data.get('tasks_completed')
    
    # Read users from JSON file
    users = read_json_file(USERS_JSON)
    
    # Find and update user's stats
    for user in users:
        if user.get('username') == username:
            user['level'] = level
            user['xp'] = xp
            user['tasks_completed'] = tasks_completed
            break
    
    write_json_file(USERS_JSON, users)
    
    return jsonify({"success": True})

@bp.route('/api/tasks', methods=['GET'])
def get_tasks():
    """Get all tasks for a user from JSON file"""
    username = request.args.get('username')
    if not username:
        return jsonify({"success": False, "message": "Username required"})

    # Read tasks from JSON file
    tasks = read_json_file(TASKS_JSON)
    
    # Filter tasks by username
    user_tasks = [task for task in tasks if task.get('user_id') == username]

    return jsonify({
        "success": True,
        "tasks": user_tasks
    })

@bp.route('/api/tasks', methods=['POST'])
def create_task():
    """Create a new task and save to JSON file"""
    data = request.json
    username = data.get('username')
    
    if not username:
        return jsonify({"success": False, "message": "Username required"})

    # Read existing tasks
    tasks = read_json_file(TASKS_JSON)
    
    # Generate task ID if not provided
    task_id = data.get('id', str(int(datetime.now().timestamp() * 1000)))
    
    # Create task object with proper structure
    new_task = {
        "id": task_id,
        "user_id": username,
        "title": data.get('name', ''),
        "description": '',
        "priority": data.get('priority', 'medium'),
        "status": "todo",
        "xp_value": data.get('xp_reward', 0),
        "due_date": data.get('due_date', None),
        "show_on_calendar": data.get('show_on_calendar', True),
        # Honor a client-supplied created_at (the week calendar's drag-to-create
        # task uses it to place the block on the dragged slot); default to now.
        "created_at": data.get('created_at') or datetime.now().isoformat()
    }

    # Add to tasks list
    tasks.append(new_task)

    # Write back to JSON file
    write_json_file(TASKS_JSON, tasks)

    return jsonify({
        "success": True,
        "task_id": task_id
    })

@bp.route('/api/tasks/<task_id>', methods=['PUT'])
def update_task(task_id):
    """Update an existing task in JSON file"""
    data = request.json
    username = data.get('username')
    
    if not username:
        return jsonify({"success": False, "message": "Username required"})

    # Read existing tasks
    tasks = read_json_file(TASKS_JSON)
    
    # Find and update the task
    task_found = False
    for task in tasks:
        if task.get('id') == task_id and task.get('user_id') == username:
            # Update fields that are provided
            if 'name' in data:
                task['title'] = data['name']
            if 'description' in data:
                task['description'] = ''
            if 'priority' in data:
                task['priority'] = data['priority']
            if 'xp_reward' in data:
                task['xp_value'] = data['xp_reward']
            if 'timer_duration' in data:
                task['timer_duration'] = data['timer_duration']
            if 'due_date' in data:
                task['due_date'] = data['due_date']
            if 'completed' in data:
                task['status'] = 'done' if data['completed'] else 'todo'
                # Record the completion time (the task's "end") when finishing;
                # clear it when re-opening. A no-due-date task uses this as its
                # calendar end time/date.
                if data['completed']:
                    task['completed_at'] = datetime.now().isoformat()
                else:
                    task['completed_at'] = None
            task_found = True
            break
    
    if not task_found:
        return jsonify({"success": False, "message": "Task not found"})
    
    # Write back to JSON file
    write_json_file(TASKS_JSON, tasks)
    
    return jsonify({"success": True})

@bp.route('/api/tasks/<task_id>', methods=['DELETE'])
def delete_task_endpoint(task_id):
    """Delete a task from JSON file"""
    username = request.args.get('username')
    
    # Read existing tasks
    tasks = read_json_file(TASKS_JSON)
    
    # Filter out the task to delete
    if username:
        tasks = [task for task in tasks if not (task.get('id') == task_id and task.get('user_id') == username)]
    else:
        tasks = [task for task in tasks if task.get('id') != task_id]
    
    # Write back to JSON file
    write_json_file(TASKS_JSON, tasks)
    
    return jsonify({"success": True})

# Keep old endpoints for backward compatibility
@bp.route('/api/add_task', methods=['POST'])
def add_task():
    """Old endpoint - redirects to new create_task endpoint"""
    return create_task()

@bp.route('/api/delete_task', methods=['POST'])
def delete_task():
    """Old endpoint - redirects to new delete_task_endpoint"""
    data = request.json
    task_id = data.get('id')
    username = data.get('username')
    
    # Read tasks from JSON file
    tasks = read_json_file(TASKS_JSON)
    
    # Filter out the task to delete
    if username:
        tasks = [task for task in tasks if not (task.get('id') == task_id and task.get('user_id') == username)]
    else:
        tasks = [task for task in tasks if task.get('id') != task_id]
    
    # Write back to JSON file
    write_json_file(TASKS_JSON, tasks)
    
    return jsonify({"success": True})

@bp.route('/api/delete_task_no_tracking', methods=['POST'])
def delete_task_no_tracking():
    """Delete task without tracking XP/streak/tasks completed (for timer termination)"""
    data = request.json
    task_id = data.get('id')
    
    # Read tasks from JSON file
    tasks = read_json_file(TASKS_JSON)
    
    # Filter out the task to delete
    tasks = [task for task in tasks if task.get('id') != task_id]
    
    # Write back to JSON file
    write_json_file(TASKS_JSON, tasks)
    
    return jsonify({"success": True})

@bp.route('/api/update_task_due_date', methods=['POST'])
def update_task_due_date():
    """Update task due date when more time is added"""
    data = request.json
    task_id = data.get('id')
    username = data.get('username')
    new_due_date = data.get('due_date')
    
    if not task_id or not username or not new_due_date:
        return jsonify({"success": False, "message": "Missing required fields"})
    
    # Read tasks from JSON file
    tasks = read_json_file(TASKS_JSON)
    
    # Find and update the task
    task_found = False
    for task in tasks:
        if task.get('id') == task_id and task.get('user_id') == username:
            task['due_date'] = new_due_date
            task_found = True
            break
    
    if not task_found:
        return jsonify({"success": False, "message": "Task not found"})
    
    # Write back to JSON file
    write_json_file(TASKS_JSON, tasks)
    
    return jsonify({"success": True})


# Add these functions to your paths.py file

# Add this import at the top:
# from datetime import datetime, date

@bp.route('/api/track_daily_xp', methods=['POST'])
def track_daily_xp():
    data = request.json
    username = data.get('username')
    xp_earned = data.get('xp_earned', 0)
    tasks_completed = data.get('tasks_completed', 0)

    if not username:
        return jsonify({"success": False, "message": "Username required"})

    today = date.today().isoformat()

    # Read XP events from JSON file
    xp_events = read_json_file(XPEVENT_JSON)
    
    # Check if there's already an entry for today
    today_entry = None
    for event in xp_events:
        if event.get('user_id') == username and event.get('date') == today:
            today_entry = event
            break
    
    if today_entry:
        # Update existing entry
        today_entry['amount'] += xp_earned
        today_entry['tasks_completed'] += tasks_completed
        today_entry['avg_task_xp'] = today_entry['amount'] / today_entry['tasks_completed'] if today_entry['tasks_completed'] > 0 else 0
    else:
        # Create new entry
        new_event = {
            "id": str(int(datetime.now().timestamp() * 1000)),
            "user_id": username,
            "amount": xp_earned,
            "reason": "daily_xp",
            "timestamp": datetime.now().isoformat(),
            "date": today,
            "tasks_completed": tasks_completed,
            "avg_task_xp": xp_earned / tasks_completed if tasks_completed > 0 else 0
        }
        xp_events.append(new_event)
    
    write_json_file(XPEVENT_JSON, xp_events)
    
    return jsonify({"success": True, "message": "Daily XP tracked successfully"})


@bp.route('/api/focus_sync', methods=['POST'])
def focus_sync():
    """Persist a user's daily focus state (dashboard Focus panel).

    The focus session itself is tracked client-side (focus.js, localStorage);
    this endpoint mirrors each day's totals into users.json (per-user
    `focus_history`: {iso_date: {seconds, goal_hours}}) so the growth page can
    chart focus history and grade it server-side.
    """
    data = request.get_json(silent=True) or {}
    username = data.get('username')
    day = str(data.get('date') or '')
    if not username or not re.match(r'^\d{4}-\d{2}-\d{2}$', day):
        return jsonify({"success": False, "message": "Username and date required"})
    try:
        seconds = max(0.0, min(86400.0, float(data.get('focused_seconds', 0))))
        goal_hours = max(0.5, min(12.0, float(data.get('goal_hours', 2.0))))
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "Invalid focus values"})

    users = read_json_file(USERS_JSON)
    user = next((u for u in users if u.get('username') == username), None)
    if not user:
        return jsonify({"success": False, "message": "User not found"})

    hist = user.get('focus_history')
    if not isinstance(hist, dict):
        hist = {}
        user['focus_history'] = hist
    prev = hist.get(day) or {}
    # Never let a stale client (e.g. an old tab with cleared localStorage)
    # shrink a day's already-recorded focus total.
    hist[day] = {
        'seconds': round(max(seconds, float(prev.get('seconds', 0) or 0)), 1),
        'goal_hours': goal_hours,
    }
    write_json_file(USERS_JSON, users)
    return jsonify({"success": True, "focus": hist[day]})


def _focus_history_for(user):
    """The user's per-day focus record, tolerating missing/bad data."""
    hist = user.get('focus_history')
    return hist if isinstance(hist, dict) else {}


@bp.route('/api/get_growth_data', methods=['GET'])
def get_growth_data():
    username = request.args.get('username')
    if not username:
        return jsonify({"success": False, "message": "Username required"})

    # Read users from JSON file
    users = read_json_file(USERS_JSON)
    
    # Find user to get creation date
    user = None
    for u in users:
        if u.get('username') == username:
            user = u
            break
    
    if not user:
        return jsonify({"success": False, "message": "User not found"})

    # Determine when the account was created. Prefer the stored created_at;
    # otherwise fall back to the account id, which is the creation timestamp in
    # milliseconds. This makes the day counter accumulate from the real creation
    # date even for accounts that were never active and predate created_at.
    created_date = None
    created_at_raw = user.get('created_at')
    if created_at_raw:
        for fmt in ('%Y-%m-%dT%H:%M:%S.%f', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S'):
            try:
                created_date = datetime.strptime(created_at_raw, fmt).date()
                break
            except (ValueError, TypeError):
                continue
    if created_date is None:
        try:
            created_date = datetime.fromtimestamp(int(user.get('id')) / 1000).date()
        except (ValueError, TypeError, OSError, OverflowError):
            created_date = date.today()

    # Read XP events from JSON file
    xp_events = read_json_file(XPEVENT_JSON)

    # Aggregate this user's XP per day. Events carry an ISO 'timestamp'
    # (and older/daily events may also have a 'date'); derive the day from
    # whichever is present so real task completions are counted.
    daily_totals = {}
    for event in xp_events:
        if event.get('user_id') != username:
            continue
        day = event.get('date')
        if not day:
            ts = event.get('timestamp', '')
            day = ts[:10] if ts else None
        if not day:
            continue
        totals = daily_totals.setdefault(day, {'xp': 0, 'tasks': 0})
        totals['xp'] += event.get('amount', 0)
        # daily_xp events pre-aggregate task counts; task_completion events are one task each
        totals['tasks'] += event.get('tasks_completed', 1)

    # Per-day tracked focus time (synced from the dashboard Focus panel).
    focus_history = _focus_history_for(user)

    # Build a continuous day-by-day series from account creation to today,
    # keeping cumulative XP correct, then return the most recent 30 days.
    end_date = date.today()
    all_days = []
    cumulative_xp = 0
    cumulative_focus_min = 0
    current_day = min(created_date, end_date)
    day_number = 1
    while current_day <= end_date:
        current_day_str = current_day.isoformat()
        totals = daily_totals.get(current_day_str, {'xp': 0, 'tasks': 0})
        xp_earned = totals['xp']
        tasks_completed = totals['tasks']
        cumulative_xp += xp_earned
        avg_task_xp = round(xp_earned / tasks_completed) if tasks_completed > 0 else 0
        focus_rec = focus_history.get(current_day_str) or {}
        try:
            focus_minutes = round(float(focus_rec.get('seconds', 0) or 0) / 60)
        except (TypeError, ValueError, AttributeError):
            focus_minutes = 0
        cumulative_focus_min += focus_minutes
        all_days.append({
            'date': current_day_str,
            'day_number': day_number,
            'xp_earned': xp_earned,
            'tasks_completed': tasks_completed,
            'cumulative_xp': cumulative_xp,
            'avg_task_xp': avg_task_xp,
            'focus_minutes': focus_minutes,
            'cumulative_focus_minutes': cumulative_focus_min
        })
        current_day += timedelta(days=1)
        day_number += 1

    growth_data = all_days[-30:]

    return jsonify({
        "success": True,
        "created_date": created_date.isoformat(),
        "days_since_creation": (date.today() - created_date).days,
        "growth_data": growth_data
    })


# ---------------------------------------------------------------------------
# Growth Ratings v2 — a graded performance report card.
#
# Four independent metrics, each scored 0-100 with a plain letter grade, plus a
# weighted overall score. No streak / charge / milestone dependencies.
# ---------------------------------------------------------------------------

def _grade_for_score(score):
    """Map a 0-100 score to the GLOBAL letter grade."""
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


def _clamp_score(value, low=0, high=100):
    return max(low, min(high, value))


def _ratings_message(metric_scores):
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


@bp.route('/api/get_growth_ratings', methods=['GET'])
def get_growth_ratings():
    """Return the 4-metric graded report card for a user."""
    username = request.args.get('username')
    if not username:
        return jsonify({"success": False, "message": "Username required"})

    users = read_json_file(USERS_JSON)
    user = next((u for u in users if u.get('username') == username), None)
    if not user:
        return jsonify({"success": False, "message": "User not found"})

    # --- Account age: days since creation, inclusive, minimum 1 ---
    created_date = None
    created_at_raw = user.get('created_at')
    if created_at_raw:
        for fmt in ('%Y-%m-%dT%H:%M:%S.%f', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S'):
            try:
                created_date = datetime.strptime(created_at_raw, fmt).date()
                break
            except (ValueError, TypeError):
                continue
    if created_date is None:
        try:
            created_date = datetime.fromtimestamp(int(user.get('id')) / 1000).date()
        except (ValueError, TypeError, OSError, OverflowError):
            created_date = date.today()
    total_days = max((date.today() - created_date).days + 1, 1)

    # --- Total XP earned + distinct active days, from the event log ---
    xp_events = read_json_file(XPEVENT_JSON)
    total_xp = 0
    active_day_set = set()
    for event in xp_events:
        if event.get('user_id') != username:
            continue
        total_xp += event.get('amount', 0) or 0
        day = event.get('date')
        if not day:
            ts = event.get('timestamp', '')
            day = ts[:10] if ts else None
        if day:
            active_day_set.add(day)
    active_days = min(len(active_day_set), total_days)

    # --- Completed tasks: difficulty + efficiency inputs ---
    tasks = read_json_file(TASKS_JSON)
    done = [t for t in tasks
            if t.get('user_id') == username and t.get('status') == 'done']
    total_tasks = len(done)
    total_task_xp = sum(t.get('xp_value', 0) or 0 for t in done)

    avg_daily_xp = total_xp / total_days
    avg_task_xp = (total_task_xp / total_tasks) if total_tasks else 0

    # 1. Productivity — XP earned per day.
    productivity_score = round(_clamp_score(avg_daily_xp / 3))
    # 2. Quality — average task difficulty.
    quality_score = round(_clamp_score(avg_task_xp * 1.75))
    # 3. Consistency — share of days the user showed up.
    consistency_rate = (active_days / total_days) * 100
    consistency_score = round(_clamp_score(consistency_rate))

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
    on_time_pct = round(deadline_score)

    efficiency_score = round(_clamp_score(deadline_score * 0.5 + speed_score * 0.5))

    # 5. Focus — tracked focus time vs the daily focus goal (dashboard panel).
    #    Graded on the ratio of total focused time to the total goal across
    #    every day with a synced focus record.
    focus_history = _focus_history_for(user)
    focused_sec = 0.0
    focus_goal_sec = 0.0
    for rec in focus_history.values():
        try:
            focused_sec += float(rec.get('seconds', 0) or 0)
            focus_goal_sec += float(rec.get('goal_hours', 0) or 0) * 3600.0
        except (TypeError, ValueError, AttributeError):
            continue
    focus_ratio = (focused_sec / focus_goal_sec) if focus_goal_sec > 0 else 0.0
    focus_score = round(_clamp_score(focus_ratio * 100))

    # --- Overall = simple average of the five metric scores ---
    parts = {
        'productivity': productivity_score,
        'quality': quality_score,
        'consistency': consistency_score,
        'efficiency': efficiency_score,
        'focus': focus_score,
    }
    overall_score = round(_clamp_score(sum(parts.values()) / len(parts)))

    # --- Week-over-week momentum, for the hero and every card ---
    today = date.today()

    def _window_stats(lo_days, hi_days):
        """XP, task count and distinct active days from events in a day window."""
        xp = 0
        tasks = 0
        days = set()
        for event in xp_events:
            if event.get('user_id') != username:
                continue
            day = event.get('date') or (event.get('timestamp', '')[:10])
            if not day:
                continue
            try:
                d = datetime.strptime(day[:10], '%Y-%m-%d').date()
            except (ValueError, TypeError):
                continue
            if lo_days <= (today - d).days <= hi_days:
                xp += event.get('amount', 0) or 0
                tasks += event.get('tasks_completed', 1) or 0
                days.add(day[:10])
        return {'xp': xp, 'tasks': tasks, 'active_days': len(days)}

    def _window_efficiency(lo_days, hi_days):
        """Efficiency score over tasks completed within a day window, or None."""
        secs = []
        met = []
        for t in done:
            completed = t.get('completed_at')
            if not completed:
                continue
            try:
                d = datetime.strptime(completed[:10], '%Y-%m-%d').date()
            except (ValueError, TypeError):
                continue
            if not (lo_days <= (today - d).days <= hi_days):
                continue
            if isinstance(t.get('completion_seconds'), (int, float)):
                secs.append(t['completion_seconds'])
            if 'met_deadline' in t:
                met.append(bool(t['met_deadline']))
        if not secs and not met:
            return None
        spd = _speed_score_from_minutes((sum(secs) / len(secs)) / 60.0) if secs else 0
        dln = (sum(1 for x in met if x) / len(met) * 100) if met else 0
        return _clamp_score(dln * 0.5 + spd * 0.5)

    def _trend(current, previous):
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

    def _window_focus(lo_days, hi_days):
        """Total focused seconds recorded within a day window."""
        total = 0.0
        for day_str, rec in focus_history.items():
            try:
                d = datetime.strptime(day_str[:10], '%Y-%m-%d').date()
                if lo_days <= (today - d).days <= hi_days:
                    total += float(rec.get('seconds', 0) or 0)
            except (ValueError, TypeError, AttributeError):
                continue
        return total

    this_w = _window_stats(0, 6)
    prev_w = _window_stats(7, 13)
    this_quality = (this_w['xp'] / this_w['tasks']) if this_w['tasks'] else 0
    prev_quality = (prev_w['xp'] / prev_w['tasks']) if prev_w['tasks'] else 0
    eff_this = _window_efficiency(0, 6)
    eff_prev = _window_efficiency(7, 13)

    productivity_trend = _trend(this_w['xp'], prev_w['xp'])
    quality_trend = _trend(this_quality, prev_quality)
    consistency_trend = _trend(this_w['active_days'], prev_w['active_days'])
    efficiency_trend = _trend(eff_this or 0, eff_prev or 0)
    focus_trend = _trend(_window_focus(0, 6), _window_focus(7, 13))

    return jsonify({
        "success": True,
        "overall": {
            "score": overall_score,
            "grade": _grade_for_score(overall_score),
            "message": _ratings_message(parts),
            "trend": productivity_trend,
        },
        "metrics": {
            "productivity": {
                "score": productivity_score,
                "grade": _grade_for_score(productivity_score),
                "avg_daily_xp": round(avg_daily_xp),
                "trend": productivity_trend,
            },
            "quality": {
                "score": quality_score,
                "grade": _grade_for_score(quality_score),
                "avg_task_xp": round(avg_task_xp),
                "trend": quality_trend,
            },
            "consistency": {
                "score": consistency_score,
                "grade": _grade_for_score(consistency_score),
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
                "grade": _grade_for_score(efficiency_score),
                "on_time_pct": on_time_pct,
                "has_timing": bool(timed),
                "trend": efficiency_trend,
            },
            "focus": {
                "score": focus_score,
                "grade": _grade_for_score(focus_score),
                "focused_minutes": round(focused_sec / 60),
                "goal_minutes": round(focus_goal_sec / 60),
                "pct_of_goal": round(focus_ratio * 100),
                "trend": focus_trend,
            },
        },
    })


@bp.route('/api/get_xp_data', methods=['GET'])
def get_xp_data():
    """Get XP data directly from database via task_backend"""
    username = request.args.get('username')
    if not username:
        return jsonify({"success": False, "message": "Username required"})
    
    try:
        # Use the task_backend function to get XP data
        xp_data = task_backend.get_xp_data_for_js(username)
        return jsonify(xp_data)
    except Exception as e:
        return jsonify({"success": False, "message": f"Error: {str(e)}"})


@bp.route('/api/get_task_status', methods=['POST'])
def get_task_status():
    data = request.json
    task_id = data.get('task_id')
    
    if not task_id:
        return jsonify({"success": False, "message": "Task ID required"})
    
    # Read tasks from JSON file
    tasks = read_json_file(TASKS_JSON)
    
    # Find task
    task = None
    for t in tasks:
        if t.get('id') == task_id:
            task = t
            break
    
    if not task:
        return jsonify({"success": False, "message": "Task not found"})
    
    return jsonify({
        "success": True,
        "status": task.get('status', 'todo'),
        "completed": task.get('status') == 'done'
    })

@bp.route('/api/timer_expired', methods=['POST'])
def timer_expired():
    data = request.json
    task_id = data.get('task_id')
    
    if not task_id:
        return jsonify({"success": False, "message": "Task ID required"})
    
    # Read tasks from JSON file
    tasks = read_json_file(TASKS_JSON)
    
    # Find task
    task = None
    for t in tasks:
        if t.get('id') == task_id:
            task = t
            break
    
    if not task:
        return jsonify({"success": False, "message": "Task not found"})
    
    # Mark task as expired in the task data
    task['timer_expired'] = True
    task['status'] = 'expired'
    
    # Write updated task data back to JSON file
    write_json_file(TASKS_JSON, tasks)
    
    return jsonify({
        "success": True,
        "message": "Timer expiration recorded",
        "task_id": task_id
    })

def apply_task_completion_to_goals(username):
    """Count one completed task toward every active 'tasks'-type goal for the user.

    A completed task advances all of the user's "complete N tasks" goals — mirroring
    how earned XP advances every active XP goal. Progress is capped at the target and
    a goal is marked completed once it's reached. No-op if there are no active tasks
    goals. Runs server-side on each completion so the goals page reflects it whether
    or not it's open.
    """
    goals = read_json_file(GOALS_JSON)
    changed = False
    for goal in goals:
        if goal.get('user_id') != username:
            continue
        if goal.get('goal_type') != 'tasks':
            continue
        if goal.get('status') == 'completed':
            continue
        target = goal.get('target_tasks', 0) or 0
        new_value = (goal.get('current_tasks', 0) or 0) + 1
        if target and new_value > target:
            new_value = target
        goal['current_tasks'] = new_value
        goal['target_value'] = target
        goal['progress'] = round((new_value / target) * 100, 1) if target else 0
        goal['status'] = 'completed' if (target and new_value >= target) else 'active'
        changed = True
    if changed:
        write_json_file(GOALS_JSON, goals)


@bp.route('/api/complete_task', methods=['POST'])
def complete_task():
    data = request.json
    username = data.get('username')
    task_id = data.get('task_id')

    if not username or not task_id:
        return jsonify({"success": False, "message": "Username and task_id required"})

    # Read tasks from JSON file
    tasks = read_json_file(TASKS_JSON)
    
    # Find task and get XP reward
    task = None
    for t in tasks:
        if t.get('id') == task_id and t.get('user_id') == username:
            task = t
            break

    if not task:
        return jsonify({"success": False, "message": "Task not found"})

    xp_reward = task.get('xp_value', 0)

    # Read users from JSON file
    users = read_json_file(USERS_JSON)
    
    # Find user and get charge for multiplier
    user = None
    for u in users:
        if u.get('username') == username:
            user = u
            break
    
    if not user:
        return jsonify({"success": False, "message": "User not found"})

    # Charge system removed: a task now grants its base XP with no multiplier.

    # Mark the task completed and record timing for the Growth Ratings efficiency
    # metric: how long it took (creation -> completion) and, for tasks that had a
    # due date, whether it beat that deadline. Tasks completed before this change
    # lack these fields and are simply excluded from the efficiency scores.
    now_dt = datetime.now()
    task['status'] = 'done'
    task['completed_at'] = now_dt.isoformat()

    def _parse_dt(raw):
        # Due dates may be stored as local ISO ("...T11:00:00") or as a UTC
        # ISO string with a trailing 'Z' (from JS toISOString()); strip the 'Z'
        # so both parse.
        if isinstance(raw, str) and raw.endswith('Z'):
            raw = raw[:-1]
        for fmt in ('%Y-%m-%dT%H:%M:%S.%f', '%Y-%m-%dT%H:%M:%S',
                    '%Y-%m-%d %H:%M:%S', '%Y-%m-%d'):
            try:
                return datetime.strptime(raw, fmt)
            except (ValueError, TypeError):
                continue
        return None

    created_dt = _parse_dt(task.get('created_at'))
    if created_dt is not None:
        task['completion_seconds'] = round(max(0, (now_dt - created_dt).total_seconds()))

    due_dt = _parse_dt(task.get('due_date')) if task.get('due_date') else None
    if due_dt is not None:
        task['met_deadline'] = now_dt <= due_dt
    
    # Update user XP and tasks completed
    user['xp'] = user.get('xp', 0) + xp_reward
    user['tasks_completed'] = user.get('tasks_completed', 0) + 1

    # Calculate new level
    total_xp = user['xp']
    new_level = 1
    xp_needed_for_level = 100
    current_xp_in_level = total_xp
    
    # Calculate level based on total XP (infinite progression)
    while current_xp_in_level >= xp_needed_for_level:
        current_xp_in_level -= xp_needed_for_level
        new_level += 1
        xp_needed_for_level = new_level * 100
    
    user['level'] = new_level

    # Update streak logic. The streak counts consecutive days with at least one
    # completed task: the first task the day after the last one extends it by 1,
    # another task the same day leaves it unchanged, and a gap of a full day
    # (2+ days since the last task) restarts it at 1. best_streak keeps the
    # all-time high and is never lowered.
    today = date.today()
    today_str = today.isoformat()

    current_streak = user.get('current_streak', 0)
    best_streak = user.get('best_streak', 0)
    last_task_date = user.get('last_task_date', None)

    last_date = None
    if last_task_date:
        try:
            last_date = datetime.strptime(str(last_task_date)[:10], '%Y-%m-%d').date()
        except (ValueError, TypeError):
            last_date = None

    if last_date is None:
        new_streak = 1
    else:
        gap = (today - last_date).days
        if gap <= 0:
            new_streak = max(current_streak, 1)   # another task today — no change
        elif gap == 1:
            new_streak = current_streak + 1        # next day — extend the streak
        else:
            new_streak = 1                          # missed a full day — restart

    user['current_streak'] = new_streak
    user['best_streak'] = max(best_streak, new_streak)
    user['last_task_date'] = today_str
    user['day_state'] = 'oldday'

    # Write updated data back to JSON files
    write_json_file(TASKS_JSON, tasks)
    write_json_file(USERS_JSON, users)

    # Add XP event
    xp_events = read_json_file(XPEVENT_JSON)
    xp_event = {
        "id": str(int(datetime.now().timestamp() * 1000)),
        "user_id": username,
        "amount": xp_reward,
        "reason": "task_completion",
        "timestamp": datetime.now().isoformat(),
        "date": today_str,
        "tasks_completed": 1
    }
    xp_events.append(xp_event)
    write_json_file(XPEVENT_JSON, xp_events)

    # Count this completion toward the user's active "tasks completed" goals.
    apply_task_completion_to_goals(username)

    new_xp_required = new_level * 100

    return jsonify({
        "success": True,
        "message": "Task completed successfully!",
        "xp_earned": xp_reward,
        "new_xp": current_xp_in_level,
        "new_level": new_level,
        "new_tasks_completed": user['tasks_completed'],
        "xp_required": new_xp_required,
        "current_streak": user['current_streak'],
        "best_streak": user['best_streak'],
        "task_id": task_id,
        "completion_status": "done"
    })


@bp.route('/api/last_task_completion', methods=['GET'])
def last_task_completion():
    """Return the most recent completed-task XP for a user. The goals page polls
    this so a dashboard task completion signals through to its console."""
    username = request.args.get('username')
    if not username:
        return jsonify({"success": False, "message": "Username required"})

    xp_events = read_json_file(XPEVENT_JSON)
    latest = None
    latest_id = -1
    for e in xp_events:
        if e.get('user_id') == username and e.get('reason') == 'task_completion':
            try:
                eid = int(e.get('id', 0))
            except (ValueError, TypeError):
                eid = 0
            if eid > latest_id:
                latest_id = eid
                latest = e

    if latest is None:
        return jsonify({"success": True, "xp": None, "at": None})
    return jsonify({"success": True, "xp": latest.get('amount', 0), "at": str(latest.get('id'))})

# Goals API endpoints
@bp.route('/api/add_goal', methods=['POST'])
def add_goal():
    data = request.json
    username = data.get('username')
    goal_id = data.get('id', str(int(datetime.now().timestamp() * 1000)))
    title = data.get('title')
    description = data.get('description', '')
    goal_type = data.get('goal_type', 'xp')
    target_xp = data.get('target_xp', 0)
    target_streak = data.get('target_streak', 0)
    target_tasks = data.get('target_tasks', 0)
    target_focus = data.get('target_focus', 0)  # minutes of tracked focus time
    deadline = data.get('deadline', '')
    priority = _clamp_priority(data.get('priority', 5))

    if not username or not title:
        return jsonify({"success": False, "message": "Username and title are required"})

    # Validate that the appropriate target is set based on goal type
    if goal_type == 'xp' and not target_xp:
        return jsonify({"success": False, "message": "Target XP is required for XP goals"})
    if goal_type == 'streak' and not target_streak:
        return jsonify({"success": False, "message": "Target streak is required for streak goals"})
    if goal_type == 'tasks' and not target_tasks:
        return jsonify({"success": False, "message": "Target tasks is required for task goals"})
    if goal_type == 'focus' and not target_focus:
        return jsonify({"success": False, "message": "Target focus time is required for focus goals"})

    # Read existing goals from JSON file
    goals = read_json_file(GOALS_JSON)

    target_value = {'xp': target_xp, 'streak': target_streak,
                    'tasks': target_tasks, 'focus': target_focus}.get(goal_type, target_xp)

    # Create goal object with proper structure
    new_goal = {
        "id": goal_id,
        "user_id": username,
        "title": title,
        "description": description,
        "progress": 0,
        "target_value": target_value,
        "goal_type": goal_type,
        "target_xp": target_xp,
        "current_xp": 0,
        "target_streak": target_streak,
        "current_streak": 0,
        "target_tasks": target_tasks,
        "current_tasks": 0,
        "target_focus": target_focus,
        "current_focus": 0,
        # Focus goals auto-track "focus time since the goal was set": remember
        # the user's total tracked focus seconds right now, so progress is
        # simply (total later - this baseline).
        "focus_baseline_seconds": _total_focus_seconds(username) if goal_type == 'focus' else 0,
        "priority": priority,
        "deadline": deadline,
        "status": "active",
        "created_at": datetime.now().isoformat()
    }

    goals.append(new_goal)
    write_json_file(GOALS_JSON, goals)

    return jsonify({"success": True, "message": "Goal added successfully"})

def _clamp_priority(value):
    """Priority rank 1-10 (default 5) — tolerate junk input."""
    try:
        return max(1, min(10, int(value)))
    except (ValueError, TypeError):
        return 5

def _total_focus_seconds(username):
    """The user's all-time tracked focus seconds (sum of focus_history days)."""
    users = read_json_file(USERS_JSON)
    user = next((u for u in users if u.get('username') == username), None)
    if not user:
        return 0.0
    total = 0.0
    for rec in _focus_history_for(user).values():
        try:
            total += max(0.0, float((rec or {}).get('seconds', 0) or 0))
        except (ValueError, TypeError):
            continue
    return total

def sync_focus_goals_to_user_focus(username):
    """Focus goals auto-track: their current value is the focus time accumulated
    since the goal was set (the user's total tracked seconds minus the total
    recorded as the goal's baseline at creation), and they complete on their own
    the moment that reaches the target. Runs on every get_goals so the goals
    page — and the completion-toast watcher polling it — always see live values.
    """
    goals = read_json_file(GOALS_JSON)
    focus_goals = [g for g in goals
                   if g.get('user_id') == username and g.get('goal_type') == 'focus'
                   and g.get('status') != 'completed']
    if not focus_goals:
        return

    total_now = _total_focus_seconds(username)
    changed = False
    for goal in focus_goals:
        target_min = goal.get('target_focus', 0) or 0
        try:
            baseline = max(0.0, float(goal.get('focus_baseline_seconds', 0) or 0))
        except (ValueError, TypeError):
            baseline = 0.0
        earned_min = max(0.0, (total_now - baseline) / 60.0)
        new_value = round(min(earned_min, target_min) if target_min else earned_min, 1)
        new_status = 'completed' if (target_min and earned_min >= target_min) else 'active'
        new_progress = round((new_value / target_min) * 100, 1) if target_min else 0
        if (goal.get('current_focus') != new_value or
                goal.get('status') != new_status or
                goal.get('progress') != new_progress):
            goal['current_focus'] = new_value
            goal['status'] = new_status
            goal['progress'] = new_progress
            goal['target_value'] = target_min
            changed = True
    if changed:
        write_json_file(GOALS_JSON, goals)

def sync_streak_goals_to_user_streak(username):
    """Keep every streak-type goal in lockstep with the user's live current
    streak — the same number shown on the dashboard — instead of a hand-entered
    count. A streak goal means "reach an N-day streak", so its current value
    should simply follow the real streak, tracking it up as it grows and back
    down (to 0) whenever the streak breaks. Completion follows the same number:
    completed once the live streak reaches the target, active again if it falls
    back below it. No-op when the user has no streak goals.
    """
    users = read_json_file(USERS_JSON)
    user = next((u for u in users if u.get('username') == username), None)
    if not user:
        return
    # Decay a stale streak first so goals follow the same live value everywhere.
    if refresh_user_streak(user):
        write_json_file(USERS_JSON, users)
    current_streak = user.get('current_streak', 0) or 0

    goals = read_json_file(GOALS_JSON)
    changed = False
    for goal in goals:
        if goal.get('user_id') != username:
            continue
        if goal.get('goal_type') != 'streak':
            continue
        target = goal.get('target_streak', 0) or 0
        # Follow the live streak, capped at the target so a completed goal reads
        # "N / N Days" rather than overshooting.
        new_value = min(current_streak, target) if target else current_streak
        new_status = 'completed' if (target and new_value >= target) else 'active'
        new_progress = round((new_value / target) * 100, 1) if target else 0
        if (goal.get('current_streak') != new_value or
                goal.get('status') != new_status or
                goal.get('progress') != new_progress or
                goal.get('target_value') != target):
            goal['current_streak'] = new_value
            goal['status'] = new_status
            goal['progress'] = new_progress
            goal['target_value'] = target
            changed = True
    if changed:
        write_json_file(GOALS_JSON, goals)


@bp.route('/api/get_goals', methods=['GET'])
def get_goals():
    username = request.args.get('username')
    if not username:
        return jsonify({"success": False, "message": "Username required"})

    # Mirror the user's live current streak onto their streak goals before
    # returning them, so the goals page always shows the dashboard's streak.
    sync_streak_goals_to_user_streak(username)
    # Advance focus goals from the tracked focus history (auto-completing any
    # that reached their target since the last look).
    sync_focus_goals_to_user_focus(username)

    # Read goals from JSON file
    goals = read_json_file(GOALS_JSON)

    # Filter goals by username
    user_goals = [goal for goal in goals if goal.get('user_id') == username]

    # Average XP per active day — for the goals page's "IN PROGRESS" summary card.
    xp_events = [e for e in read_json_file(XPEVENT_JSON) if e.get('user_id') == username]
    total_xp = sum(e.get('amount', 0) or 0 for e in xp_events)
    active_days = set()
    for e in xp_events:
        day = e.get('date') or (e.get('timestamp', '') or '')[:10]
        if day:
            active_days.add(day)
    avg_xp_per_day = round(total_xp / len(active_days)) if active_days else 0

    return jsonify({
        "success": True,
        "goals": user_goals,
        "avg_xp_per_day": avg_xp_per_day
    })

@bp.route('/api/update_goal', methods=['POST'])
def update_goal():
    data = request.json
    goal_id = data.get('id')
    username = data.get('username')
    
    if not goal_id or not username:
        return jsonify({"success": False, "message": "Goal ID and username required"})
    
    # Read goals from JSON file
    goals = read_json_file(GOALS_JSON)
    
    # Find and update the goal
    goal_found = False
    for goal in goals:
        if goal.get('id') == goal_id and goal.get('user_id') == username:
            # Update fields that are provided
            if 'title' in data:
                goal['title'] = data['title']
            if 'description' in data:
                goal['description'] = data['description']
            if 'status' in data:
                goal['status'] = data['status']
            if 'progress' in data:
                goal['progress'] = data['progress']
            if 'current_xp' in data:
                goal['current_xp'] = data['current_xp']
            if 'current_streak' in data:
                goal['current_streak'] = data['current_streak']
            if 'current_tasks' in data:
                goal['current_tasks'] = data['current_tasks']
            if 'current_focus' in data:
                goal['current_focus'] = data['current_focus']
            if 'goal_type' in data:
                goal['goal_type'] = data['goal_type']
            if 'target_xp' in data:
                goal['target_xp'] = data['target_xp']
            if 'target_streak' in data:
                goal['target_streak'] = data['target_streak']
            if 'target_tasks' in data:
                goal['target_tasks'] = data['target_tasks']
            if 'target_focus' in data:
                goal['target_focus'] = data['target_focus']
            if 'deadline' in data:
                goal['deadline'] = data['deadline']
            if 'priority' in data:
                goal['priority'] = _clamp_priority(data['priority'])
            goal_found = True
            break
    
    if not goal_found:
        return jsonify({"success": False, "message": "Goal not found"})
    
    # Write back to JSON file
    write_json_file(GOALS_JSON, goals)
    
    return jsonify({"success": True})

@bp.route('/api/delete_goal', methods=['POST'])
def delete_goal():
    data = request.json
    goal_id = data.get('goal_id')
    username = data.get('username')
    
    if not goal_id:
        return jsonify({"success": False, "message": "Goal ID required"})
    
    # Read goals from JSON file
    goals = read_json_file(GOALS_JSON)
    
    # Filter out the goal to delete
    if username:
        goals = [goal for goal in goals if not (goal.get('id') == goal_id and goal.get('user_id') == username)]
    else:
        goals = [goal for goal in goals if goal.get('id') != goal_id]
    
    # Write back to JSON file
    write_json_file(GOALS_JSON, goals)
    
    return jsonify({"success": True})

@bp.route('/api/update_goal_progress', methods=['POST'])
def update_goal_progress():
    data = request.json
    goal_id = data.get('goal_id')
    xp_to_add = data.get('xp_to_add', 0)
    streak_to_add = data.get('streak_to_add', 0)
    tasks_to_add = data.get('tasks_to_add', 0)

    if not goal_id:
        return jsonify({"success": False, "message": "Goal ID required"})

    # Goals are stored in the JSON file (the same store add/get/delete use).
    # The legacy SQLite path below never matched those ids ("Goal not found"),
    # so read/update/write the JSON store here and return before reaching it.
    goals = read_json_file(GOALS_JSON)
    goal_obj = next((g for g in goals if str(g.get('id')) == str(goal_id)), None)
    if not goal_obj:
        return jsonify({"success": False, "message": "Goal not found"})

    goal_type = goal_obj.get('goal_type', 'xp')
    if goal_type == 'streak':
        current = goal_obj.get('current_streak', 0)
        target = goal_obj.get('target_streak', 0)
        field, add = 'current_streak', streak_to_add
    elif goal_type == 'tasks':
        current = goal_obj.get('current_tasks', 0)
        target = goal_obj.get('target_tasks', 0)
        field, add = 'current_tasks', tasks_to_add
    else:
        goal_type = 'xp'
        current = goal_obj.get('current_xp', 0)
        target = goal_obj.get('target_xp', 0)
        field, add = 'current_xp', xp_to_add

    new_value = current + add
    if target and new_value > target:
        new_value = target
    status = 'completed' if (target and new_value >= target) else 'active'

    goal_obj[field] = new_value
    goal_obj['status'] = status
    goal_obj['progress'] = round((new_value / target) * 100, 1) if target else 0
    goal_obj['target_value'] = target
    write_json_file(GOALS_JSON, goals)

    return jsonify({
        "success": True,
        "goal_type": goal_type,
        "current": new_value,
        "target": target,
        "status": status,
        "completed": status == 'completed'
    })

    conn = sqlite3.connect(DATABASE_PATH)
    c = conn.cursor()

    try:
        # Get current goal - handle both 'type' and 'goal_type' columns
        c.execute("SELECT * FROM goals WHERE id=?", (goal_id,))
        goal = c.fetchone()

        if not goal:
            return jsonify({"success": False, "message": "Goal not found"})

        # Get column names to handle both old and new schemas
        columns = [description[0] for description in c.description]
        goal_dict = dict(zip(columns, goal))
        
        # Normalize goal type field (handle both 'type' and 'goal_type' columns)
        if 'type' in goal_dict:
            goal_type = goal_dict['type']
        elif 'goal_type' in goal_dict:
            goal_type = goal_dict['goal_type']
        else:
            goal_type = 'xp'  # default
            
        # Handle legacy goal types
        if goal_type in ['quantity', 'Number']:
            goal_type = 'xp'  # Convert quantity/Number to xp type
        elif goal_type in ['duration', 'daily', 'weekly']:
            goal_type = 'streak'  # Convert duration/daily/weekly to streak type
            
        # Handle both old and new schemas for current/target values
        if 'target' in goal_dict or 'current' in goal_dict:
            # Old schema - use target/current based on goal type
            if goal_type == 'xp':
                current_xp = goal_dict.get('current', 0)
                target_xp = goal_dict.get('target', 0)
                current_streak = 0
                target_streak = 0
                current_tasks = 0
                target_tasks = 0
            elif goal_type == 'streak':
                current_xp = 0
                target_xp = 0
                current_streak = goal_dict.get('current', 0)
                target_streak = goal_dict.get('target', 0)
                current_tasks = 0
                target_tasks = 0
            elif goal_type == 'tasks':
                current_xp = 0
                target_xp = 0
                current_streak = 0
                target_streak = 0
                current_tasks = goal_dict.get('current', 0)
                target_tasks = goal_dict.get('target', 0)
            else:
                current_xp = goal_dict.get('current', 0)
                target_xp = goal_dict.get('target', 0)
                current_streak = 0
                target_streak = 0
                current_tasks = 0
                target_tasks = 0
        else:
            # New schema - use specific columns
            current_xp = goal_dict.get('current_xp', 0)
            target_xp = goal_dict.get('target_xp', 0)
            current_streak = goal_dict.get('current_streak', 0)
            target_streak = goal_dict.get('target_streak', 0)
            current_tasks = goal_dict.get('current_tasks', 0)
            target_tasks = goal_dict.get('target_tasks', 0)

        # Update based on goal type
        status = 'active'

        if goal_type == 'xp':
            new_xp = current_xp + xp_to_add
            # Cap at target to not exceed it
            if new_xp > target_xp:
                new_xp = target_xp
            if new_xp >= target_xp:
                status = 'completed'

            # Use correct column name based on schema
            if 'target' in goal_dict or 'current' in goal_dict:
                # Old schema - update current column and completed field
                completed_value = 1 if status == 'completed' else 0
                c.execute("UPDATE goals SET current=?, status=?, completed=? WHERE id=?", (new_xp, status, completed_value, goal_id))
            else:
                # New schema - update current_xp column
                c.execute("UPDATE goals SET current_xp=?, status=? WHERE id=?", (new_xp, status, goal_id))
            conn.commit()
            return jsonify({
                "success": True,
                "goal_type": "xp",
                "current": new_xp,
                "target": target_xp,
                "status": status,
                "completed": status == 'completed'
            })
        elif goal_type == 'streak':
            new_streak = current_streak + streak_to_add
            # Cap at target to not exceed it
            if new_streak > target_streak:
                new_streak = target_streak
            if new_streak >= target_streak:
                status = 'completed'

            # Use correct column name based on schema
            if 'target' in goal_dict or 'current' in goal_dict:
                # Old schema - update current column and completed field
                completed_value = 1 if status == 'completed' else 0
                c.execute("UPDATE goals SET current=?, status=?, completed=? WHERE id=?", (new_streak, status, completed_value, goal_id))
            else:
                # New schema - update current_streak column
                c.execute("UPDATE goals SET current_streak=?, status=? WHERE id=?", (new_streak, status, goal_id))
            conn.commit()
            return jsonify({
                "success": True,
                "goal_type": "streak",
                "current": new_streak,
                "target": target_streak,
                "status": status,
                "completed": status == 'completed'
            })
        elif goal_type == 'tasks':
            new_tasks = current_tasks + tasks_to_add
            # Cap at target to not exceed it
            if new_tasks > target_tasks:
                new_tasks = target_tasks
            if new_tasks >= target_tasks:
                status = 'completed'

            # Use correct column name based on schema
            if 'target' in goal_dict or 'current' in goal_dict:
                # Old schema - update current column and completed field
                completed_value = 1 if status == 'completed' else 0
                c.execute("UPDATE goals SET current=?, status=?, completed=? WHERE id=?", (new_tasks, status, completed_value, goal_id))
            else:
                # New schema - update current_tasks column
                c.execute("UPDATE goals SET current_tasks=?, status=? WHERE id=?", (new_tasks, status, goal_id))
            conn.commit()
            return jsonify({
                "success": True,
                "goal_type": "tasks",
                "current": new_tasks,
                "target": target_tasks,
                "status": status,
                "completed": status == 'completed'
            })
        else:
            return jsonify({"success": False, "message": "Invalid goal type"})

    except Exception as e:
        return jsonify({"success": False, "message": str(e)})
    finally:
        conn.close()
