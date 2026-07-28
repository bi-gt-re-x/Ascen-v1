"""Tasks — everything the dashboard's task list does.

Tasks are the unit of work the whole app is built on: they carry the XP, they
drive the streak, and completing one is the single moment that moves an
account forward. That moment is `/api/complete_task`, which in one pass:

  * stamps the task done and records how long it took and whether it beat its
    deadline (the growth report card's efficiency metric reads those);
  * awards the XP, recalculates the level and extends the streak;
  * writes a row to the XP ledger;
  * counts the completion toward the user's "complete N tasks" goals.

The older /api/add_task and /api/delete_task endpoints are kept because older
scripts still call them.
"""
from datetime import datetime

from flask import Blueprint, jsonify, request

from backend.database import connection as db
from backend.pages.goals import apply_task_completion
from backend.tracking import xp as xp_tracking
from backend.tracking.auth import load_user

bp = Blueprint('tasks', __name__)


def _parse_dt(raw):
    """A datetime from any of the shapes a stored date can take.

    Due dates may be local ISO ("...T11:00:00") or a UTC ISO string with a
    trailing 'Z' (from JS toISOString()); strip the 'Z' so both parse.
    """
    if isinstance(raw, str) and raw.endswith('Z'):
        raw = raw[:-1]
    for fmt in ('%Y-%m-%dT%H:%M:%S.%f', '%Y-%m-%dT%H:%M:%S',
                '%Y-%m-%d %H:%M:%S', '%Y-%m-%d'):
        try:
            return datetime.strptime(raw, fmt)
        except (ValueError, TypeError):
            continue
    return None


def _find(tasks, task_id, username=None):
    for task in tasks:
        if task.get('id') != task_id:
            continue
        if username and task.get('user_id') != username:
            continue
        return task
    return None


# --------------------------------------------------------------------------
# CRUD
# --------------------------------------------------------------------------
@bp.route('/api/tasks', methods=['GET'])
def list_tasks():
    username = request.args.get('username')
    if not username:
        return jsonify({"success": False, "message": "Username required"})
    return jsonify({
        "success": True,
        "tasks": [t for t in db.tasks() if t.get('user_id') == username],
    })


@bp.route('/api/tasks', methods=['POST'])
def create_task():
    data = request.json or {}
    username = data.get('username')
    if not username:
        return jsonify({"success": False, "message": "Username required"})

    tasks = db.tasks()
    task_id = data.get('id') or db.new_id('tasks')
    tasks.append({
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
        "created_at": data.get('created_at') or datetime.now().isoformat(),
    })
    db.save_tasks(tasks)
    return jsonify({"success": True, "task_id": task_id})


@bp.route('/api/tasks/<task_id>', methods=['PUT'])
def update_task(task_id):
    data = request.json or {}
    username = data.get('username')
    if not username:
        return jsonify({"success": False, "message": "Username required"})

    tasks = db.tasks()
    task = _find(tasks, task_id, username)
    if not task:
        return jsonify({"success": False, "message": "Task not found"})

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
        # Record the completion time (the task's "end") when finishing; clear it
        # when re-opening. A task with no due date uses this as its calendar end.
        task['completed_at'] = datetime.now().isoformat() if data['completed'] else None

    db.save_tasks(tasks)
    return jsonify({"success": True})


@bp.route('/api/tasks/<task_id>', methods=['DELETE'])
def delete_task_by_id(task_id):
    _delete(task_id, request.args.get('username'))
    return jsonify({"success": True})


def _delete(task_id, username=None):
    tasks = db.tasks()
    if username:
        kept = [t for t in tasks
                if not (t.get('id') == task_id and t.get('user_id') == username)]
    else:
        kept = [t for t in tasks if t.get('id') != task_id]
    db.save_tasks(kept)


@bp.route('/api/add_task', methods=['POST'])
def add_task():
    """Older name for POST /api/tasks."""
    return create_task()


@bp.route('/api/delete_task', methods=['POST'])
def delete_task():
    """Older name for DELETE /api/tasks/<id>, with the id in the body."""
    data = request.json or {}
    _delete(data.get('id'), data.get('username'))
    return jsonify({"success": True})


@bp.route('/api/delete_task_no_tracking', methods=['POST'])
def delete_task_no_tracking():
    """Drop a task without any XP / streak / count side effects.

    Used when a timer is terminated: the task never happened, so nothing about
    the account's progression should move.
    """
    _delete((request.json or {}).get('id'))
    return jsonify({"success": True})


@bp.route('/api/update_task_due_date', methods=['POST'])
def update_task_due_date():
    """Push a task's due date out — the "add more time" button."""
    data = request.json or {}
    task_id = data.get('id')
    username = data.get('username')
    new_due_date = data.get('due_date')

    if not task_id or not username or not new_due_date:
        return jsonify({"success": False, "message": "Missing required fields"})

    tasks = db.tasks()
    task = _find(tasks, task_id, username)
    if not task:
        return jsonify({"success": False, "message": "Task not found"})

    task['due_date'] = new_due_date
    db.save_tasks(tasks)
    return jsonify({"success": True})


# --------------------------------------------------------------------------
# Status and timers
# --------------------------------------------------------------------------
@bp.route('/api/get_task_status', methods=['POST'])
def get_task_status():
    task_id = (request.json or {}).get('task_id')
    if not task_id:
        return jsonify({"success": False, "message": "Task ID required"})

    task = _find(db.tasks(), task_id)
    if not task:
        return jsonify({"success": False, "message": "Task not found"})

    return jsonify({
        "success": True,
        "status": task.get('status', 'todo'),
        "completed": task.get('status') == 'done',
    })


@bp.route('/api/timer_expired', methods=['POST'])
def timer_expired():
    """Record that a task's timer ran out before it was finished."""
    task_id = (request.json or {}).get('task_id')
    if not task_id:
        return jsonify({"success": False, "message": "Task ID required"})

    tasks = db.tasks()
    task = _find(tasks, task_id)
    if not task:
        return jsonify({"success": False, "message": "Task not found"})

    task['timer_expired'] = True
    task['status'] = 'expired'
    db.save_tasks(tasks)

    return jsonify({"success": True,
                    "message": "Timer expiration recorded",
                    "task_id": task_id})


# --------------------------------------------------------------------------
# Completion
# --------------------------------------------------------------------------
@bp.route('/api/complete_task', methods=['POST'])
def complete_task():
    data = request.json or {}
    username = data.get('username')
    task_id = data.get('task_id')

    if not username or not task_id:
        return jsonify({"success": False, "message": "Username and task_id required"})

    tasks = db.tasks()
    task = _find(tasks, task_id, username)
    if not task:
        return jsonify({"success": False, "message": "Task not found"})

    users, user = load_user(username)
    if not user:
        return jsonify({"success": False, "message": "User not found"})

    xp_reward = task.get('xp_value', 0)
    now = datetime.now()

    # Stamp the task done, and record the timing the efficiency metric reads:
    # how long it took (creation -> completion) and, when it had a due date,
    # whether it beat that deadline. Tasks completed before this was added lack
    # these fields and are simply left out of the efficiency scores.
    task['status'] = 'done'
    task['completed_at'] = now.isoformat()

    created_dt = _parse_dt(task.get('created_at'))
    if created_dt is not None:
        task['completion_seconds'] = round(max(0, (now - created_dt).total_seconds()))

    due_dt = _parse_dt(task.get('due_date')) if task.get('due_date') else None
    if due_dt is not None:
        task['met_deadline'] = now <= due_dt

    # XP in, level recalculated, streak extended.
    levels = xp_tracking.award_task_completion(user, xp_reward)

    db.save_tasks(tasks)
    db.save_users(users)

    xp_tracking.log_event(username, xp_reward, 'task_completion', tasks_completed=1)

    # Count this completion toward the user's active "complete N tasks" goals.
    apply_task_completion(username)

    return jsonify({
        "success": True,
        "message": "Task completed successfully!",
        "xp_earned": xp_reward,
        "new_xp": levels['xp_in_level'],
        "new_level": levels['level'],
        "new_tasks_completed": user['tasks_completed'],
        "xp_required": levels['xp_required'],
        "current_streak": user['current_streak'],
        "best_streak": user['best_streak'],
        "task_id": task_id,
        "completion_status": "done",
    })


@bp.route('/api/last_task_completion', methods=['GET'])
def last_task_completion():
    """The most recent completed-task XP. The goals page polls this so a
    dashboard completion signals through to its console."""
    username = request.args.get('username')
    if not username:
        return jsonify({"success": False, "message": "Username required"})

    latest = xp_tracking.last_task_completion(username)
    if latest is None:
        return jsonify({"success": True, "xp": None, "at": None})
    return jsonify({"success": True,
                    "xp": latest.get('amount', 0),
                    "at": str(latest.get('id'))})
