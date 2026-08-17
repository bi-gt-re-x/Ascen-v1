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
from typing import Any, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from backend.api.goals import apply_task_completion
from backend.api.reply import fail, ok
from backend.api import subjects as user_subjects
from backend.config import subjects as subject_catalogue
from backend.database import connection as db
from backend.tracking import xp as xp_tracking
from backend.tracking.auth import load_user

router = APIRouter(tags=['tasks'])


# --------------------------------------------------------------------------
# What the endpoints accept
# --------------------------------------------------------------------------
class CreateTask(BaseModel):
    username: Optional[str] = None
    id: Optional[str] = None
    name: str = ''
    priority: str = 'medium'
    xp_reward: int = 0
    due_date: Optional[str] = None
    show_on_calendar: bool = True
    created_at: Optional[str] = None
    subject: Optional[str] = None


class UpdateTask(BaseModel):
    """Every field is optional and only the ones actually sent are applied —
    which is why this uses `model_fields_set` rather than truthiness below.
    `completed: false` has to be distinguishable from "not mentioned"."""
    username: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    xp_reward: Optional[int] = None
    timer_duration: Optional[Any] = None
    due_date: Optional[str] = None
    completed: Optional[bool] = None
    subject: Optional[str] = None


class DeleteTask(BaseModel):
    id: Optional[str] = None
    username: Optional[str] = None


class TaskId(BaseModel):
    task_id: Optional[str] = None


class UpdateDueDate(BaseModel):
    id: Optional[str] = None
    username: Optional[str] = None
    due_date: Optional[str] = None


class CompleteTask(BaseModel):
    username: Optional[str] = None
    task_id: Optional[str] = None


class RateTask(BaseModel):
    """What the person thought of a task they just finished.

    Both ratings are optional and independent: the prompt asks two questions
    and a reader is allowed to answer one of them. See `rate_task`.
    """

    username: Optional[str] = None
    task_id: Optional[str] = None
    #: How hard it was, 1-5. Null means not answered.
    difficulty: Optional[int] = None
    #: How well it went, 1-5. Null means not answered.
    execution: Optional[int] = None


#: What a star rating is allowed to be, both ends inclusive.
RATING_RANGE = (1, 5)


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
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


def _delete(task_id, username=None):
    tasks = db.tasks()
    if username:
        kept = [t for t in tasks
                if not (t.get('id') == task_id and t.get('user_id') == username)]
    else:
        kept = [t for t in tasks if t.get('id') != task_id]
    db.save_tasks(kept)


def _subject(raw, username=None):
    """A subject id this account may file a task under, or None.

    Two things can recognise one: the catalogue, and the account's own list of
    subjects it made itself (backend/api/subjects.py). Anything else — a stale
    id from an older build, a typo, a value someone posted by hand — is dropped
    rather than stored. A task with no subject is a perfectly ordinary task, so
    there is nothing to fail here; storing a value nothing can draw an icon for
    would be the worse outcome.

    The account is asked for by name because a custom subject belongs to one:
    without it, one user's `own_thesis_plan` would validate against another's.
    Called with no username the catalogue is the only answer, which is the
    behaviour this had before custom subjects existed.
    """
    found = subject_catalogue.get(raw)
    if found:
        return found['id']
    if username and raw and raw in user_subjects.own_ids(username):
        return raw
    return None


def _create(body: CreateTask):
    """Shared by POST /api/tasks and its older name, /api/add_task."""
    if not body.username:
        return fail('Username required')

    tasks = db.tasks()
    task_id = body.id or db.new_id('tasks')
    tasks.append({
        "id": task_id,
        "user_id": body.username,
        "title": body.name,
        "description": '',
        "priority": body.priority,
        "status": "todo",
        "xp_value": body.xp_reward,
        "due_date": body.due_date,
        "show_on_calendar": body.show_on_calendar,
        # Honor a client-supplied created_at (the week calendar's drag-to-create
        # task uses it to place the block on the dragged slot); default to now.
        "created_at": body.created_at or datetime.now().isoformat(),
        "subject": _subject(body.subject, body.username),
    })
    db.save_tasks(tasks)
    return ok(task_id=task_id)


# --------------------------------------------------------------------------
# CRUD
# --------------------------------------------------------------------------
@router.get('/api/tasks')
def list_tasks(username: str = ''):
    if not username:
        return fail('Username required')
    return ok(tasks=[t for t in db.tasks() if t.get('user_id') == username])


@router.post('/api/tasks')
def create_task(body: CreateTask):
    return _create(body)


@router.put('/api/tasks/{task_id}')
def update_task(task_id: str, body: UpdateTask):
    if not body.username:
        return fail('Username required')

    tasks = db.tasks()
    task = _find(tasks, task_id, body.username)
    if not task:
        return fail('Task not found')

    sent = body.model_fields_set

    if 'name' in sent:
        task['title'] = body.name
    if 'description' in sent:
        task['description'] = ''
    if 'priority' in sent:
        task['priority'] = body.priority
    if 'xp_reward' in sent:
        task['xp_value'] = body.xp_reward
    if 'timer_duration' in sent:
        task['timer_duration'] = body.timer_duration
    if 'due_date' in sent:
        task['due_date'] = body.due_date
    if 'subject' in sent:
        task['subject'] = _subject(body.subject, body.username)
    if 'completed' in sent:
        task['status'] = 'done' if body.completed else 'todo'
        # Record the completion time (the task's "end") when finishing; clear it
        # when re-opening. A task with no due date uses this as its calendar end.
        task['completed_at'] = datetime.now().isoformat() if body.completed else None

    db.save_tasks(tasks)
    return ok()


@router.delete('/api/tasks/{task_id}')
def delete_task_by_id(task_id: str, username: str = ''):
    _delete(task_id, username or None)
    return ok()


@router.post('/api/add_task')
def add_task(body: CreateTask):
    """Older name for POST /api/tasks."""
    return _create(body)


@router.post('/api/delete_task')
def delete_task(body: DeleteTask):
    """Older name for DELETE /api/tasks/<id>, with the id in the body."""
    _delete(body.id, body.username)
    return ok()


@router.post('/api/delete_task_no_tracking')
def delete_task_no_tracking(body: DeleteTask):
    """Drop a task without any XP / streak / count side effects.

    Used when a timer is terminated: the task never happened, so nothing about
    the account's progression should move.
    """
    _delete(body.id)
    return ok()


@router.post('/api/update_task_due_date')
def update_task_due_date(body: UpdateDueDate):
    """Push a task's due date out — the "add more time" button."""
    if not body.id or not body.username or not body.due_date:
        return fail('Missing required fields')

    tasks = db.tasks()
    task = _find(tasks, body.id, body.username)
    if not task:
        return fail('Task not found')

    task['due_date'] = body.due_date
    db.save_tasks(tasks)
    return ok()


# --------------------------------------------------------------------------
# Status and timers
# --------------------------------------------------------------------------
@router.post('/api/get_task_status')
def get_task_status(body: TaskId):
    if not body.task_id:
        return fail('Task ID required')

    task = _find(db.tasks(), body.task_id)
    if not task:
        return fail('Task not found')

    return ok(status=task.get('status', 'todo'),
              completed=task.get('status') == 'done')


@router.post('/api/timer_expired')
def timer_expired(body: TaskId):
    """Record that a task's timer ran out before it was finished."""
    if not body.task_id:
        return fail('Task ID required')

    tasks = db.tasks()
    task = _find(tasks, body.task_id)
    if not task:
        return fail('Task not found')

    task['timer_expired'] = True
    task['status'] = 'expired'
    db.save_tasks(tasks)

    return ok(message='Timer expiration recorded', task_id=body.task_id)


# --------------------------------------------------------------------------
# Completion
# --------------------------------------------------------------------------
@router.post('/api/complete_task')
def complete_task(body: CompleteTask):
    if not body.username or not body.task_id:
        return fail('Username and task_id required')

    tasks = db.tasks()
    task = _find(tasks, body.task_id, body.username)
    if not task:
        return fail('Task not found')

    users, user = load_user(body.username)
    if not user:
        return fail('User not found')

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

    xp_tracking.log_event(body.username, xp_reward, 'task_completion', tasks_completed=1)

    # Count this completion toward the user's active "complete N tasks" goals.
    apply_task_completion(body.username)

    return ok(
        message='Task completed successfully!',
        xp_earned=xp_reward,
        new_xp=levels['xp_in_level'],
        new_level=levels['level'],
        new_tasks_completed=user['tasks_completed'],
        xp_required=levels['xp_required'],
        current_streak=user['current_streak'],
        best_streak=user['best_streak'],
        task_id=body.task_id,
        completion_status='done',
    )


@router.post('/api/rate_task')
def rate_task(body: RateTask):
    """Record what the person said about a task they just finished.

    A separate call from `/api/complete_task` on purpose. Completing is the act
    and the rating is an opinion about it, and the two must not share a failure:
    a task marked done has to stay done whether or not the prompt that follows
    it is answered, reaches the server, or is dismissed. Anything else would put
    somebody's XP behind a dialog.

    Both fields are optional and each is stored on its own, so a reader who
    answers one star row and closes the dialog keeps the answer they gave. Out
    of range is a failure rather than a clamp — a 7 is a caller bug, and
    silently filing it as a 5 would put a number in the record that nobody
    chose.
    """
    if not body.username or not body.task_id:
        return fail('Username and task_id required')

    if body.difficulty is None and body.execution is None:
        return fail('Nothing to record.')

    for name, value in (('Difficulty', body.difficulty), ('Execution', body.execution)):
        if value is not None and not (RATING_RANGE[0] <= value <= RATING_RANGE[1]):
            return fail('{} must be between {} and {}.'.format(name, *RATING_RANGE))

    tasks = db.tasks()
    task = _find(tasks, body.task_id, body.username)
    if not task:
        return fail('Task not found')

    if body.difficulty is not None:
        task['difficulty'] = int(body.difficulty)
    if body.execution is not None:
        task['execution'] = int(body.execution)

    db.save_tasks(tasks)

    return ok(
        task_id=body.task_id,
        difficulty=task.get('difficulty'),
        execution=task.get('execution'),
    )


@router.get('/api/last_task_completion')
def last_task_completion(username: str = ''):
    """The most recent completed-task XP. The goals page polls this so a
    dashboard completion signals through to its console."""
    if not username:
        return fail('Username required')

    latest = xp_tracking.last_task_completion(username)
    if latest is None:
        return ok(xp=None, at=None)
    return ok(xp=latest.get('amount', 0), at=str(latest.get('id')))
