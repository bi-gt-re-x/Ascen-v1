"""The dashboard — the account's live stats and its task list.

`/api/get_user_data` is the page's first call and the one most other pages
piggyback on: it returns the stats block (level, XP, tasks completed, streaks)
plus every task the account owns. The streak is decayed on read, so a streak
lost overnight is gone the moment any page asks, not whenever a task is next
completed.
"""
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from backend.api.reply import fail, ok
from backend.database import connection as db
from backend.tracking import xp as xp_tracking
from backend.tracking.auth import load_user

router = APIRouter(tags=['dashboard'])


class TrackDailyXp(BaseModel):
    username: Optional[str] = None
    xp_earned: int = 0
    tasks_completed: int = 0


class UpdateStats(BaseModel):
    username: Optional[str] = None
    level: Optional[int] = None
    xp: Optional[int] = None
    tasks_completed: Optional[int] = None


@router.get('/api/get_user_data')
def get_user_data(username: str = ''):
    if not username:
        return fail('Username required')

    users, user = load_user(username)
    if not user:
        return fail('User not found')

    # Decay a stale streak (lost after a full day with no task) before reporting.
    if xp_tracking.refresh_streak(user):
        db.save_users(users)

    user_tasks = [t for t in db.tasks() if t.get('user_id') == username]

    return ok(
        stats={
            "level": user.get('level', 1),
            "xp": user.get('xp', 0),
            "tasks_completed": user.get('tasks_completed', 0),
            "current_streak": user.get('current_streak', 0),
            "best_streak": user.get('best_streak', 0),
            "charge": user.get('charge', 0),
        },
        tasks=user_tasks,
    )


@router.post('/api/track_daily_xp')
def track_daily_xp(body: TrackDailyXp):
    """Roll a batch of XP and completions into today's single ledger row."""
    if not body.username:
        return fail('Username required')

    xp_tracking.track_daily(body.username, body.xp_earned, body.tasks_completed)
    return ok(message='Daily XP tracked successfully')


@router.post('/api/update_stats')
def update_stats(body: UpdateStats):
    """Write back level / XP / task count the client has recalculated."""
    users, user = load_user(body.username)
    if user:
        user['level'] = body.level
        user['xp'] = body.xp
        user['tasks_completed'] = body.tasks_completed
        db.save_users(users)
    return ok()
