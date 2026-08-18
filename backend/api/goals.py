"""Goals — what the account is trying to accomplish, and the checkpoints to it.

## Two kinds of goal, one table

This file began as four counters — "earn N XP", "reach an N-day streak",
"complete N tasks", "focus N minutes" — and those still work exactly as they
did. XP and task goals are fed by the app when a task is completed. Streak and
focus goals track themselves: a streak goal follows the account's live streak,
and a focus goal measures the focus time accumulated *since it was set*, by
remembering the lifetime total at creation as a baseline. Both are re-synced on
every read, so the goals page and the toast watcher polling it see live values.

What is new is the layer over them. A counter is a good way to hold "focus for
2,000 hours" and a bad way to hold "reach USACO Gold" — the second is an
outcome, and an outcome is measured either by a number the app has no way to
count (a rating, a contest score, a user count) or by the checkpoints on the
way to it. `measure` is the column that says which:

    'xp' | 'streak' | 'tasks' | 'focus'   the counters, unchanged
    'number'                              current_value against target_number
    'milestones'                          no number; checkpoints completed

An empty `measure` is a row written before the column existed and reads as its
`goal_type` — see `_measure_of`. Nothing back-fills it.

## Progress is derived, never accumulated

`progress` on a goal row is a cache of a calculation, and this module is the
only thing allowed to write it. `_recompute` is that calculation and every
write path ends in it, which is what stops a milestone being ticked off and the
goal's percentage disagreeing with its own checkpoint list.

What it deliberately does *not* do is count tasks. A goal with forty linked
tasks and four milestones is not 2.5% done when one task is finished — tasks
are evidence that the work is happening, and they belong to the health and the
analytics on the page, not to the percentage. See utils/goalHealth.ts on the
front end, which is where "is this on track" is decided.
"""
from datetime import date, datetime, timedelta
from typing import Any, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from backend.api.reply import fail, ok
from backend.database import connection as db
from backend.tracking import focus as focus_tracking
from backend.tracking import planner
from backend.tracking import xp as xp_tracking
from backend.tracking.auth import load_user

router = APIRouter(tags=['goals'])

# The four kinds of goal, and which pair of fields each one counts with.
GOAL_FIELDS = {
    'xp': ('current_xp', 'target_xp'),
    'streak': ('current_streak', 'target_streak'),
    'tasks': ('current_tasks', 'target_tasks'),
    'focus': ('current_focus', 'target_focus'),
}

# Everything `measure` is allowed to be. The first four name a counter above;
# the last two are the outcome measures that have no counter behind them.
MEASURES = ('xp', 'streak', 'tasks', 'focus', 'number', 'milestones')

# What a goal can be about. Loose on purpose — the front end draws an icon and
# a colour per entry and falls back to 'other', so an unknown value degrades to
# a plain goal rather than to an error.
CATEGORIES = ('math', 'coding', 'ai', 'school', 'music', 'fitness',
              'projects', 'personal', 'other')

# What /api/update_goal is allowed to write straight through from the request.
EDITABLE = ('title', 'description', 'status', 'goal_type',
            'deadline', 'current_xp', 'current_streak', 'current_tasks',
            'current_focus', 'target_xp', 'target_streak', 'target_tasks',
            'target_focus',
            'category', 'why', 'start_date', 'unit', 'current_value',
            'target_number', 'subject_ids')


# --------------------------------------------------------------------------
# What the endpoints accept
# --------------------------------------------------------------------------
class AddGoal(BaseModel):
    username: Optional[str] = None
    id: Optional[str] = None
    title: Optional[str] = None
    description: str = ''
    goal_type: str = 'xp'
    target_xp: int = 0
    target_streak: int = 0
    target_tasks: int = 0
    target_focus: int = 0          # minutes of tracked focus time
    priority: Any = 5
    deadline: str = ''

    # The outcome layer. `measure` defaults to the empty string so a caller
    # that predates it — the old modal still posts exactly the old fields —
    # lands on its goal_type and behaves as it always has.
    measure: str = ''
    category: str = 'other'
    why: str = ''
    start_date: str = ''
    unit: str = ''
    current_value: float = 0
    target_number: float = 0
    subject_ids: str = ''
    # Checkpoint titles to create with the goal, in execution order.
    milestones: List[str] = []


class UpdateGoal(BaseModel):
    """Only the fields actually sent are written, so every one is optional and
    the write below reads `model_fields_set` rather than testing truthiness."""
    id: Optional[str] = None
    username: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    progress: Optional[float] = None
    goal_type: Optional[str] = None
    deadline: Optional[str] = None
    current_xp: Optional[float] = None
    current_streak: Optional[float] = None
    current_tasks: Optional[float] = None
    current_focus: Optional[float] = None
    target_xp: Optional[float] = None
    target_streak: Optional[float] = None
    target_tasks: Optional[float] = None
    target_focus: Optional[float] = None
    priority: Optional[Any] = None

    measure: Optional[str] = None
    category: Optional[str] = None
    why: Optional[str] = None
    start_date: Optional[str] = None
    unit: Optional[str] = None
    current_value: Optional[float] = None
    target_number: Optional[float] = None
    subject_ids: Optional[str] = None


class DeleteGoal(BaseModel):
    goal_id: Optional[str] = None
    username: Optional[str] = None


# ---- Milestones ----------------------------------------------------------
class AddMilestone(BaseModel):
    username: Optional[str] = None
    goal_id: Optional[str] = None
    title: Optional[str] = None
    note: str = ''
    target_date: str = ''


class UpdateMilestone(BaseModel):
    username: Optional[str] = None
    id: Optional[str] = None
    title: Optional[str] = None
    note: Optional[str] = None
    status: Optional[str] = None
    target_date: Optional[str] = None


class DeleteMilestone(BaseModel):
    username: Optional[str] = None
    id: Optional[str] = None


class ReorderMilestones(BaseModel):
    username: Optional[str] = None
    goal_id: Optional[str] = None
    # Milestone ids in the order they should be executed.
    order: List[str] = []


class SuggestMilestones(BaseModel):
    """Ask the model for a goal's checkpoints. Writes nothing.

    Either identify an existing goal by `goal_id` — everything the account has
    said about it is read from the row — or pass a `title` for a goal that does
    not exist yet, which is what the creation wizard has.
    """
    username: Optional[str] = None
    goal_id: Optional[str] = None
    title: Optional[str] = None
    why: str = ''
    description: str = ''
    category: str = ''


class SetMilestones(BaseModel):
    username: Optional[str] = None
    goal_id: Optional[str] = None
    # The checkpoint titles the goal should have, in execution order.
    titles: List[str] = []


class UpdateGoalProgress(BaseModel):
    goal_id: Optional[str] = None
    xp_to_add: float = 0
    streak_to_add: float = 0
    tasks_to_add: float = 0


class AutoApplyTaskXp(BaseModel):
    username: Optional[str] = None
    xp: Any = 0


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
def _clamp_priority(value):
    """Priority rank 1-10 (default 5) — tolerate junk input."""
    try:
        return max(1, min(10, int(value)))
    except (ValueError, TypeError):
        return 5


def _progress(value, target):
    return round((value / target) * 100, 1) if target else 0


def _measure_of(goal):
    """How this goal's progress is read.

    A row written before `measure` existed has none, and the honest answer for
    it is its `goal_type` — that is what it was being measured by. Anything
    unrecognised falls back the same way rather than to a default, so a typo in
    a request cannot quietly turn an XP goal into a milestone one.
    """
    measure = (goal.get('measure') or '').strip()
    if measure in MEASURES:
        return measure
    goal_type = goal.get('goal_type') or 'xp'
    return goal_type if goal_type in GOAL_FIELDS else 'xp'


def _goals_of(goals, username, goal_type=None, unfinished=False):
    """This user's goals, optionally of one counter type.

    `goal_type` filters on the *measure* rather than on the column, which is
    what keeps the task automations off the outcome goals: a milestone goal
    still carries `goal_type = 'xp'` because that column's CHECK has only ever
    allowed four values, and counting a finished task toward it would advance a
    number nobody is reading.
    """
    out = []
    for goal in goals:
        if goal.get('user_id') != username:
            continue
        if goal_type and _measure_of(goal) != goal_type:
            continue
        if unfinished and goal.get('status') == 'completed':
            continue
        out.append(goal)
    return out


def _fresh_milestone_id(rows):
    """An id no row in `rows` is already using.

    `db.new_id` steps past the ids in the *table*, which is the right answer
    for one insert and the wrong one for a batch: creating a goal with four
    checkpoints allocates all four before any of them is saved, and ids are
    millisecond timestamps, so all four came back the same millisecond and the
    write failed on the primary key. This steps past what is staged as well.
    """
    taken = {str(row.get('id')) for row in rows}
    candidate = int(db.new_id('goal_milestones'))
    while str(candidate) in taken:
        candidate += 1
    return str(candidate)


def _spread_dates(count, deadline, today=None):
    """A first date for each checkpoint, from today to the goal's deadline.

    Every milestone was written with `target_date: ''`, and the only way to
    put one on was an API call nothing in the app made — so a goal created with
    five checkpoints arrived with five undated rows, and every view that orders
    by date drew them in whatever order they came out of the table.

    These are a starting position, not a plan: the reader moves any of them
    from the goal timeline. What makes them worth writing is that they are
    ordered and spaced, so the rail reads as a sequence from the moment the
    goal exists.

    With a deadline, the checkpoints divide the run-up to it evenly and the
    last one lands on the day itself — five checkpoints before a date twenty
    weeks out are four weeks apart. Without one, they fall a fortnight apart
    from today, which is a pace rather than a promise and is the honest answer
    when the reader declined to give a date.

    A deadline already past, or today, gets nothing: back-dating a checkpoint
    to before the goal was written would make the timeline open on a row that
    was late the moment it was created.
    """
    if count <= 0:
        return []
    start = (today or datetime.now()).date()

    end = None
    if deadline:
        try:
            end = date.fromisoformat(str(deadline)[:10])
        except ValueError:
            end = None
    if end is not None and end <= start:
        end = None

    if end is None:
        return [(start + timedelta(days=14 * (i + 1))).isoformat() for i in range(count)]

    span = (end - start).days
    return [
        (start + timedelta(days=round(span * (i + 1) / count))).isoformat()
        for i in range(count)
    ]


def _milestones_of(rows, goal_id):
    """One goal's checkpoints, in execution order."""
    mine = [row for row in rows if row.get('goal_id') == goal_id]
    return sorted(mine, key=lambda row: (row.get('position') or 0,
                                         str(row.get('id') or '')))


def _recompute(goal, milestones=None):
    """Set a goal's `progress`, `target_value` and `status` from its own truth.

    The one place any of the three is written. Which truth depends on the
    measure: a counter reads its pair of columns, a number goal reads
    current_value against target_number, and a milestone goal counts the
    checkpoints that are done.

    Completion is derived with it rather than remembered, and that matters in
    both directions — a streak goal that breaks goes back to active, and a
    milestone goal whose last checkpoint is reopened does too. The exception is
    a goal with nothing to measure against (no target at all): it stays at
    whatever status it was given, because a goal with no target cannot be
    finished by arithmetic and only the user can say it is done.
    """
    measure = _measure_of(goal)

    if measure == 'milestones':
        rows = milestones or []
        total = len(rows)
        done = len([row for row in rows if row.get('status') == 'done'])
        goal['target_value'] = total
        goal['progress'] = _progress(done, total)
        if total:
            goal['status'] = 'completed' if done >= total else 'active'
        return goal

    if measure == 'number':
        current = float(goal.get('current_value') or 0)
        target = float(goal.get('target_number') or 0)
        goal['target_value'] = target
        goal['progress'] = min(100.0, _progress(current, target))
        if target:
            goal['status'] = 'completed' if current >= target else 'active'
        return goal

    current_field, target_field = GOAL_FIELDS[measure]
    current = float(goal.get(current_field) or 0)
    target = float(goal.get(target_field) or 0)
    goal['target_value'] = target
    goal['progress'] = min(100.0, _progress(current, target))
    if target:
        goal['status'] = 'completed' if current >= target else 'active'
    return goal


def _recompute_goal(goal_id, username):
    """Re-derive one goal after something under it changed. Saves if it moved."""
    goals = db.goals()
    goal = next((g for g in goals
                 if g.get('id') == goal_id and g.get('user_id') == username), None)
    if not goal:
        return None
    before = (goal.get('progress'), goal.get('status'), goal.get('target_value'))
    _recompute(goal, _milestones_of(db.goal_milestones(), goal_id))
    if (goal.get('progress'), goal.get('status'), goal.get('target_value')) != before:
        db.save_goals(goals)
    return goal


# --------------------------------------------------------------------------
# Automation: what a completed task does to the user's goals
# --------------------------------------------------------------------------
def apply_task_xp(username, xp):
    """Add `xp` to every active XP goal, completing any that reach their target.

    Each XP goal means "earn N XP", so a completed task's XP counts toward all
    of them. Returns a summary of what changed.
    """
    try:
        xp = int(xp)
    except (ValueError, TypeError):
        xp = 0

    if not username or xp <= 0:
        return {"updated": [], "completed": []}

    goals = db.goals()
    updated = []
    completed = []

    for goal in _goals_of(goals, username, 'xp', unfinished=True):
        target = goal.get('target_xp', 0) or 0
        new_value = (goal.get('current_xp', 0) or 0) + xp
        if target and new_value > target:
            new_value = target

        goal['current_xp'] = new_value
        _recompute(goal)
        is_done = goal['status'] == 'completed'

        info = {"id": goal.get('id'), "title": goal.get('title'),
                "current_xp": new_value, "target_xp": target,
                "status": goal['status']}
        updated.append(info)
        if is_done:
            completed.append(info)

    if updated:
        db.save_goals(goals)
    return {"updated": updated, "completed": completed}


def apply_task_completion(username):
    """Count one completed task toward every active "complete N tasks" goal.

    Mirrors how earned XP advances every active XP goal. Runs server-side on
    each completion, so the goals page reflects it whether or not it is open.
    """
    goals = db.goals()
    changed = False
    for goal in _goals_of(goals, username, 'tasks', unfinished=True):
        target = goal.get('target_tasks', 0) or 0
        new_value = (goal.get('current_tasks', 0) or 0) + 1
        if target and new_value > target:
            new_value = target
        goal['current_tasks'] = new_value
        _recompute(goal)
        changed = True
    if changed:
        db.save_goals(goals)


@router.post('/api/auto_apply_task_xp')
def auto_apply_task_xp(body: AutoApplyTaskXp):
    """Apply a completed task's XP to the user's active XP goals."""
    if not body.username:
        return fail('Username required')
    return ok(**apply_task_xp(body.username, body.xp))


# --------------------------------------------------------------------------
# Self-tracking goals
# --------------------------------------------------------------------------
def sync_streak_goals(username):
    """Keep every streak goal in lockstep with the account's live streak.

    A streak goal means "reach an N-day streak", so its current value should
    follow the real streak — the same number the dashboard shows — tracking it
    up as it grows and back down to zero when it breaks. Completion follows the
    same number: completed once the streak reaches the target, active again if
    it falls back below.
    """
    users, user = load_user(username)
    if not user:
        return
    # Decay a stale streak first so goals follow the same live value everywhere.
    if xp_tracking.refresh_streak(user):
        db.save_users(users)
    current_streak = user.get('current_streak', 0) or 0

    goals = db.goals()
    changed = False
    for goal in _goals_of(goals, username, 'streak'):
        target = goal.get('target_streak', 0) or 0
        # Cap at the target so a completed goal reads "N / N Days".
        new_value = min(current_streak, target) if target else current_streak
        before = (goal.get('current_streak'), goal.get('status'),
                  goal.get('progress'), goal.get('target_value'))
        goal['current_streak'] = new_value
        _recompute(goal)
        if (goal.get('current_streak'), goal.get('status'),
                goal.get('progress'), goal.get('target_value')) != before:
            changed = True
    if changed:
        db.save_goals(goals)


def sync_focus_goals(username):
    """Advance focus goals from the tracked focus history.

    A focus goal's current value is the focus time accumulated since it was set
    — the account's lifetime tracked seconds minus the baseline recorded at
    creation — and it completes on its own the moment that reaches the target.
    """
    goals = db.goals()
    pending = _goals_of(goals, username, 'focus', unfinished=True)
    if not pending:
        return

    total_now = focus_tracking.total_seconds(username)
    changed = False
    for goal in pending:
        target_min = goal.get('target_focus', 0) or 0
        try:
            baseline = max(0.0, float(goal.get('focus_baseline_seconds', 0) or 0))
        except (ValueError, TypeError):
            baseline = 0.0
        earned_min = max(0.0, (total_now - baseline) / 60.0)
        new_value = round(min(earned_min, target_min) if target_min else earned_min, 1)
        before = (goal.get('current_focus'), goal.get('status'),
                  goal.get('progress'), goal.get('target_value'))
        goal['current_focus'] = new_value
        _recompute(goal)
        if (goal.get('current_focus'), goal.get('status'),
                goal.get('progress'), goal.get('target_value')) != before:
            changed = True
    if changed:
        db.save_goals(goals)


# --------------------------------------------------------------------------
# The API
# --------------------------------------------------------------------------
@router.post('/api/add_goal')
def add_goal(body: AddGoal):
    if not body.username or not body.title:
        return fail('Username and title are required')

    targets = {
        'xp': body.target_xp,
        'streak': body.target_streak,
        'tasks': body.target_tasks,
        'focus': body.target_focus,
    }
    missing = {
        'xp': "Target XP is required for XP goals",
        'streak': "Target streak is required for streak goals",
        'tasks': "Target tasks is required for task goals",
        'focus': "Target focus time is required for focus goals",
        'number': "A target figure is required when you are measuring a number",
    }

    # An unrecognised measure is the caller's goal_type, which is what every
    # request written before this column existed means.
    measure = body.measure if body.measure in MEASURES else (
        body.goal_type if body.goal_type in GOAL_FIELDS else 'xp')

    if measure in targets and not targets[measure]:
        return fail(missing[measure])
    if measure == 'number' and not body.target_number:
        return fail(missing['number'])
    # A milestone goal is allowed to start with none: the wizard's last step is
    # optional and a goal you have not broken down yet is still a goal.

    goal_id = body.id or db.new_id('goals')
    category = body.category if body.category in CATEGORIES else 'other'

    goals = db.goals()
    goal = {
        "id": goal_id,
        "user_id": body.username,
        "title": body.title,
        "description": body.description,
        "progress": 0,
        "target_value": targets.get(measure, targets['xp']),
        # The column keeps its four values; `measure` is what is read.
        "goal_type": body.goal_type if body.goal_type in GOAL_FIELDS else 'xp',
        "measure": measure,
        "target_xp": targets['xp'],
        "current_xp": 0,
        "target_streak": targets['streak'],
        "current_streak": 0,
        "target_tasks": targets['tasks'],
        "current_tasks": 0,
        "target_focus": targets['focus'],
        "current_focus": 0,
        # Focus goals count time from now on, so remember the lifetime total
        # they start from: progress is (total later - this baseline).
        "focus_baseline_seconds": (focus_tracking.total_seconds(body.username)
                                   if measure == 'focus' else 0),
        "priority": _clamp_priority(body.priority),
        "deadline": body.deadline,
        "status": "active",
        "created_at": datetime.now().isoformat(),

        "category": category,
        "why": body.why,
        # A goal with no start date started when it was made. Pace is measured
        # from this, so it cannot be left empty and guessed at later.
        "start_date": body.start_date or datetime.now().date().isoformat(),
        "unit": body.unit,
        "current_value": body.current_value,
        "target_number": body.target_number,
        "subject_ids": body.subject_ids,
    }

    titles = [title.strip() for title in body.milestones if title and title.strip()]
    rows = db.goal_milestones()
    if titles:
        now = datetime.now().isoformat()
        dates = _spread_dates(len(titles), body.deadline)
        for position, title in enumerate(titles):
            rows.append({
                "id": _fresh_milestone_id(rows),
                "goal_id": goal_id,
                "user_id": body.username,
                "title": title,
                "note": '',
                "position": position,
                "status": 'pending',
                "target_date": dates[position],
                "created_at": now,
            })

    _recompute(goal, _milestones_of(rows, goal_id))
    goals.append(goal)
    # Goals first: a milestone row names a goal that has to exist by the time
    # the milestone write runs its foreign-key check.
    db.save_goals(goals)
    if titles:
        db.save_goal_milestones(rows)
    return ok(message='Goal added successfully', id=goal_id)


@router.get('/api/get_goals')
def get_goals(username: str = ''):
    if not username:
        return fail('Username required')

    # Bring the self-tracking goals up to date before handing them over.
    sync_streak_goals(username)
    sync_focus_goals(username)

    # Average XP per active day — the goals page's "IN PROGRESS" summary card.
    events = xp_tracking.events_for(username)
    total_xp = sum(e.get('amount', 0) or 0 for e in events)
    active_days = {day for day in (xp_tracking.event_day(e) for e in events) if day}
    avg_xp_per_day = round(total_xp / len(active_days)) if active_days else 0

    mine = [g for g in db.goals() if g.get('user_id') == username]
    rows = db.goal_milestones()
    for goal in mine:
        # Named `measure` on the way out whatever it is on the way in, so the
        # front end never has to know that an old row leaves the column empty.
        goal['measure'] = _measure_of(goal)
        goal['milestones'] = _milestones_of(rows, goal.get('id'))

    return ok(goals=mine, avg_xp_per_day=avg_xp_per_day)


@router.post('/api/update_goal')
def update_goal(body: UpdateGoal):
    if not body.id or not body.username:
        return fail('Goal ID and username required')

    goals = db.goals()
    goal = next((g for g in goals
                 if g.get('id') == body.id and g.get('user_id') == body.username), None)
    if not goal:
        return fail('Goal not found')

    sent = body.model_fields_set
    for field in EDITABLE:
        if field in sent:
            goal[field] = getattr(body, field)
    if 'priority' in sent:
        goal['priority'] = _clamp_priority(body.priority)
    if 'measure' in sent and body.measure in MEASURES:
        goal['measure'] = body.measure
    if 'category' in sent and body.category not in CATEGORIES:
        goal['category'] = 'other'

    # `progress` and `status` are not in EDITABLE and are not taken from the
    # request: they are what the goal's own numbers come to. A caller marking a
    # goal done sends `status`, which _recompute honours only where there is no
    # target to disagree with it — see the note there.
    if 'status' in sent and body.status in ('active', 'completed'):
        goal['status'] = body.status
    _recompute(goal, _milestones_of(db.goal_milestones(), goal.get('id')))

    db.save_goals(goals)
    return ok()


@router.post('/api/delete_goal')
def delete_goal(body: DeleteGoal):
    if not body.goal_id:
        return fail('Goal ID required')

    goals = db.goals()
    if body.username:
        kept = [g for g in goals
                if not (g.get('id') == body.goal_id and g.get('user_id') == body.username)]
    else:
        kept = [g for g in goals if g.get('id') != body.goal_id]

    # The checkpoints go with it, and they go first. `write_table` swaps rows
    # with foreign keys off and checks the table it wrote on the way out, so
    # the ON DELETE CASCADE on goal_milestones.goal_id never fires — leaving
    # the milestones behind would not fail this write, it would fail the next
    # write to *that* table, from somewhere else entirely.
    rows = db.goal_milestones()
    remaining = [row for row in rows if row.get('goal_id') != body.goal_id]
    if len(remaining) != len(rows):
        db.save_goal_milestones(remaining)

    db.save_goals(kept)

    # The tasks stay. A task that was done for a goal was still done, and its
    # XP is already in the ledger; what it loses is the link, which is what
    # `the link` reads as "no goal" from here on.
    tasks = db.tasks()
    touched = False
    for task in tasks:
        if task.get('goal_id') == body.goal_id:
            task['goal_id'] = None
            task['milestone_id'] = None
            touched = True
    if touched:
        db.save_tasks(tasks)

    return ok()


# --------------------------------------------------------------------------
# Milestones
# --------------------------------------------------------------------------
@router.post('/api/add_milestone')
def add_milestone(body: AddMilestone):
    if not body.username or not body.goal_id or not body.title:
        return fail('Username, goal and title are required')

    goals = db.goals()
    if not any(g.get('id') == body.goal_id and g.get('user_id') == body.username
               for g in goals):
        return fail('Goal not found')

    rows = db.goal_milestones()
    mine = _milestones_of(rows, body.goal_id)
    rows.append({
        "id": _fresh_milestone_id(rows),
        "goal_id": body.goal_id,
        "user_id": body.username,
        "title": body.title,
        "note": body.note,
        # On the end. A checkpoint added later is one the plan grew, not one
        # that was always meant to come third.
        "position": len(mine),
        "status": 'pending',
        "target_date": body.target_date,
        "created_at": datetime.now().isoformat(),
    })
    db.save_goal_milestones(rows)
    _recompute_goal(body.goal_id, body.username)
    return ok()


@router.post('/api/update_milestone')
def update_milestone(body: UpdateMilestone):
    if not body.username or not body.id:
        return fail('Username and milestone ID required')

    rows = db.goal_milestones()
    row = next((r for r in rows
                if r.get('id') == body.id and r.get('user_id') == body.username), None)
    if not row:
        return fail('Milestone not found')

    sent = body.model_fields_set
    for field in ('title', 'note', 'target_date'):
        if field in sent and getattr(body, field) is not None:
            row[field] = getattr(body, field)

    if 'status' in sent and body.status in ('pending', 'active', 'done'):
        row['status'] = body.status
        # The date it was reached, kept only while it is reached. Reopening a
        # checkpoint clears it rather than leaving a completion date on
        # something that is not complete.
        row['completed_at'] = datetime.now().isoformat() if body.status == 'done' else None

    db.save_goal_milestones(rows)
    _recompute_goal(row.get('goal_id'), body.username)
    return ok()


@router.post('/api/delete_milestone')
def delete_milestone(body: DeleteMilestone):
    if not body.username or not body.id:
        return fail('Username and milestone ID required')

    rows = db.goal_milestones()
    row = next((r for r in rows
                if r.get('id') == body.id and r.get('user_id') == body.username), None)
    if not row:
        return fail('Milestone not found')
    goal_id = row.get('goal_id')

    kept = [r for r in rows if r is not row]
    # Close the gap, so the remaining checkpoints are 0..n-1 with no hole where
    # the deleted one was.
    for position, remaining in enumerate(_milestones_of(kept, goal_id)):
        remaining['position'] = position
    db.save_goal_milestones(kept)

    tasks = db.tasks()
    touched = False
    for task in tasks:
        if task.get('milestone_id') == body.id:
            task['milestone_id'] = None
            touched = True
    if touched:
        db.save_tasks(tasks)

    _recompute_goal(goal_id, body.username)
    return ok()


@router.post('/api/reorder_milestones')
def reorder_milestones(body: ReorderMilestones):
    """Write a new execution order for one goal's checkpoints.

    Ids the goal does not own are ignored rather than rejected, and any of its
    own the caller left out keep their existing order behind the ones it named.
    A reorder is a drag on a list, and a list that refuses to move because the
    page was a moment out of date is worse than one that does its best.
    """
    if not body.username or not body.goal_id:
        return fail('Username and goal ID required')

    rows = db.goal_milestones()
    mine = _milestones_of(rows, body.goal_id)
    if not mine:
        return fail('Goal has no milestones')
    if any(row.get('user_id') != body.username for row in mine):
        return fail('Goal not found')

    by_id = {row.get('id'): row for row in mine}
    ordered = [by_id[mid] for mid in body.order if mid in by_id]
    ordered += [row for row in mine if row not in ordered]
    for position, row in enumerate(ordered):
        row['position'] = position

    db.save_goal_milestones(rows)
    return ok()


@router.post('/api/suggest_milestones')
def suggest_milestones(body: SuggestMilestones):
    """Five checkpoint titles for a goal, from the model. Writes nothing.

    A draft, not a plan: the page puts these in five editable fields and only
    /api/set_milestones below saves them. Every failure comes back as a
    readable message rather than an error status, because the page shows it on
    the goal — a suggestion that cannot be made is not a broken request.
    """
    if not body.username:
        return fail('Username required')

    title = (body.title or '').strip()
    why, description, category = body.why, body.description, body.category
    unit = target = ''

    if body.goal_id:
        goal = next((g for g in db.goals()
                     if g.get('id') == body.goal_id
                     and g.get('user_id') == body.username), None)
        if not goal:
            return fail('Goal not found')
        # The row is the better source: it has what the wizard collected, and
        # the caller only has what is on screen.
        title = title or (goal.get('title') or '')
        why = why or (goal.get('why') or '')
        description = description or (goal.get('description') or '')
        category = category or (goal.get('category') or '')
        unit = goal.get('unit') or ''
        if _measure_of(goal) == 'number' and goal.get('target_number'):
            target = str(goal.get('target_number'))

    if not title:
        return fail('A goal title is required')

    try:
        titles = planner.suggest_milestones(
            title, why=why, description=description, category=category,
            unit=unit, target=target)
    except planner.PlannerUnavailable as exc:
        return fail(str(exc))
    return ok(milestones=titles)


@router.post('/api/set_milestones')
def set_milestones(body: SetMilestones):
    """Write a goal's whole checkpoint list at once.

    The suggestion flow's other half, and the one write that had no endpoint:
    accepting five drafts one `add_milestone` at a time would be five writes,
    five recomputes and five re-reads for a single action the user thinks of as
    one.

    Existing rows are reused by position rather than deleted and recreated, so
    a checkpoint that keeps its place keeps its id, its status and its date —
    renaming the third checkpoint does not reopen it or cut the tasks pointed
    at it loose. Rows past the end of the list are deleted, and their tasks are
    unlinked exactly as `delete_milestone` does it.
    """
    if not body.username or not body.goal_id:
        return fail('Username and goal ID required')

    titles = [str(title).strip() for title in body.titles if str(title).strip()]
    if not titles:
        return fail('At least one checkpoint is required')
    if len(titles) > planner.COUNT:
        return fail('A goal takes at most {} checkpoints'.format(planner.COUNT))

    goals = db.goals()
    if not any(g.get('id') == body.goal_id and g.get('user_id') == body.username
               for g in goals):
        return fail('Goal not found')

    rows = db.goal_milestones()
    mine = _milestones_of(rows, body.goal_id)
    now = datetime.now().isoformat()

    for position, title in enumerate(titles):
        if position < len(mine):
            mine[position]['title'] = title
            mine[position]['position'] = position
            continue
        rows.append({
            "id": _fresh_milestone_id(rows),
            "goal_id": body.goal_id,
            "user_id": body.username,
            "title": title,
            "note": '',
            "position": position,
            "status": 'pending',
            "target_date": '',
            "created_at": now,
        })

    dropped = {row.get('id') for row in mine[len(titles):]}
    if dropped:
        rows = [row for row in rows if row.get('id') not in dropped]
        tasks = db.tasks()
        touched = False
        for task in tasks:
            if task.get('milestone_id') in dropped:
                task['milestone_id'] = None
                touched = True
        if touched:
            db.save_tasks(tasks)

    db.save_goal_milestones(rows)
    _recompute_goal(body.goal_id, body.username)
    return ok()


@router.post('/api/update_goal_progress')
def update_goal_progress(body: UpdateGoalProgress):
    """Add to one goal's counter by hand, capped at its target."""
    if not body.goal_id:
        return fail('Goal ID required')

    goals = db.goals()
    goal = next((g for g in goals if str(g.get('id')) == str(body.goal_id)), None)
    if not goal:
        return fail('Goal not found')

    goal_type = goal.get('goal_type', 'xp')
    if goal_type not in ('streak', 'tasks'):
        goal_type = 'xp'
    current_field, target_field = GOAL_FIELDS[goal_type]
    added = {'xp': body.xp_to_add,
             'streak': body.streak_to_add,
             'tasks': body.tasks_to_add}[goal_type]

    target = goal.get(target_field, 0)
    new_value = (goal.get(current_field, 0) or 0) + added
    if target and new_value > target:
        new_value = target
    status = 'completed' if (target and new_value >= target) else 'active'

    goal[current_field] = new_value
    goal['status'] = status
    goal['progress'] = _progress(new_value, target)
    goal['target_value'] = target
    db.save_goals(goals)

    return ok(
        goal_type=goal_type,
        current=new_value,
        target=target,
        status=status,
        completed=status == 'completed',
    )
