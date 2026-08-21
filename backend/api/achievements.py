"""Achievements — what the record has already earned.

One endpoint. The page asks for an account's badges and gets every badge that
exists, each carrying whether it is earned, the figure it is measured against,
and how far along that figure is.

## The catalogue is code; the earning is a row

data/sql/achievements.sql splits these deliberately — the catalogue is the same
for everybody and only the earning is per-account — and this module keeps that
split while moving the catalogue itself into `CATALOGUE` below.

It is defined here rather than seeded as data because a badge is a rule, and a
rule that lives in a table has to be migrated to change. The table is still
written: `_sync_catalogue` inserts anything missing on first read, so the
schema stays the description of the app it belongs to and a reader querying the
database directly sees the same list the page does.

## Earned once, dated forever

A badge is earned the first time the figure reaches the threshold, and the row
written to `user_achievements` is what fixes the date. That matters for the
ones that can go down again: a streak badge earned in March stays earned in
July, because the row remembers a thing that happened rather than describing
the account as it is now. Progress on an unearned badge is recomputed every
time, because that is a statement about now.

## Where the figures come from

Everything is read off tables the app already keeps — no counter is maintained
for this page, and nothing here writes to the account's own totals. That is the
same rule records.py follows: a page that scores the record does not get to
change it.
"""
from datetime import datetime

from fastapi import APIRouter

from backend.api.reply import fail, ok
from backend.database import connection as db
from backend.tracking.auth import load_user

router = APIRouter(tags=['achievements'])

#: Every badge, as (id, name, description, metric, threshold, tier).
#:
#: Tiers are the badge wall's rows and its difficulty ordering: 1 is the first
#: week of using the app, 4 is a year of it. Thresholds inside a metric climb
#: so a reader always has exactly one next rung on each — which is the point of
#: having four XP badges rather than one at a number nobody reaches.
CATALOGUE = (
    # Getting started.
    ('first-task',   'First step',      'Finish your first task.',                 'tasks',   1,      1),
    ('tasks-50',     'Fifty in',        'Finish 50 tasks.',                        'tasks',   50,     2),
    ('tasks-500',    'Five hundred',    'Finish 500 tasks.',                       'tasks',   500,    3),
    ('tasks-2000',   'Two thousand',    'Finish 2,000 tasks.',                     'tasks',   2000,   4),

    # XP, which is the app's own measure of everything above.
    ('xp-1000',      'Getting going',   'Earn 1,000 XP.',                          'xp',      1000,   1),
    ('xp-10000',     'Ten thousand',    'Earn 10,000 XP.',                         'xp',      10000,  2),
    ('xp-50000',     'Fifty thousand',  'Earn 50,000 XP.',                         'xp',      50000,  3),
    ('xp-150000',    'Six figures',     'Earn 150,000 XP.',                        'xp',      150000, 4),

    # Streaks — the hardest row, because it is the only one that can be lost.
    ('streak-7',     'A week held',     'Hold a 7-day streak.',                    'streak',  7,      1),
    ('streak-30',    'A month held',    'Hold a 30-day streak.',                   'streak',  30,     2),
    ('streak-100',   'A hundred days',  'Hold a 100-day streak.',                  'streak',  100,    3),
    ('streak-365',   'A year held',     'Hold a 365-day streak.',                  'streak',  365,    4),

    # Levels.
    ('level-10',     'Level ten',       'Reach level 10.',                         'level',   10,     1),
    ('level-25',     'Level 25',        'Reach level 25.',                         'level',   25,     2),
    ('level-50',     'Level 50',        'Reach level 50.',                         'level',   50,     3),

    # Focus time, in hours.
    ('focus-10',     'Ten hours',       'Log 10 hours of focus.',                  'focus',   10,     1),
    ('focus-100',    'A hundred hours', 'Log 100 hours of focus.',                 'focus',   100,    3),

    # Goals actually finished, which is the only one about finishing rather
    # than accumulating.
    ('goal-first',   'Goal reached',    'Finish a goal.',                          'goals',   1,      2),
    ('goal-5',       'Five reached',    'Finish 5 goals.',                         'goals',   5,      3),
)

#: What each metric is called on the page, so a locked badge can say "412 / 500
#: tasks" without the client holding a second copy of this list.
METRIC_LABELS = {
    'tasks': 'tasks',
    'xp': 'XP',
    'streak': 'days',
    'level': 'level',
    'focus': 'hours',
    'goals': 'goals',
}


def _sync_catalogue():
    """Insert any badge the table does not have yet. Never deletes.

    A badge removed from `CATALOGUE` keeps its row and anybody's earning of it,
    because deleting it would cascade `user_achievements` and take somebody's
    history with it. An obsolete row simply stops being returned.
    """
    rows = db.read_table('achievements')
    have = {row.get('id') for row in rows}
    missing = [
        {'id': i, 'name': n, 'description': d, 'icon': None,
         'metric': m, 'threshold': t, 'tier': tier}
        for i, n, d, m, t, tier in CATALOGUE
        if i not in have
    ]
    if missing:
        db.write_table('achievements', rows + missing)


def _figures(username, user):
    """The account's current value for every metric a badge is measured on."""
    focus_seconds = sum(
        float(row.get('seconds') or 0)
        for row in db.focus_days()
        if row.get('user_id') == username
    )
    finished_goals = sum(
        1 for row in db.goals()
        if row.get('user_id') == username and row.get('status') == 'completed'
    )
    return {
        'tasks': int(user.get('tasks_completed') or 0),
        'xp': int(user.get('xp') or 0),
        # The best streak, not the current one: a badge is a thing that
        # happened, and reading `current_streak` would un-earn it every time a
        # day was missed.
        'streak': int(user.get('best_streak') or 0),
        'level': int(user.get('level') or 1),
        'focus': int(focus_seconds // 3600),
        'goals': finished_goals,
    }


def _record_earned(username, earned_ids):
    """Write a row for anything newly earned, and return every earned date."""
    rows = db.read_table('user_achievements')
    mine = {
        row.get('achievement_id'): row.get('earned_at')
        for row in rows
        if row.get('user_id') == username
    }
    fresh = [i for i in earned_ids if i not in mine]
    if fresh:
        now = datetime.now().isoformat(timespec='seconds')
        rows = rows + [
            {'user_id': username, 'achievement_id': i, 'earned_at': now}
            for i in fresh
        ]
        db.write_table('user_achievements', rows)
        for i in fresh:
            mine[i] = now
    return mine


@router.get('/api/achievements')
def list_achievements(username: str = ''):
    name = (username or '').strip()
    _, user = load_user(name)
    if not user:
        return fail('Account not found')

    _sync_catalogue()
    figures = _figures(name, user)

    earned_ids = [
        badge_id for badge_id, _, _, metric, threshold, _ in CATALOGUE
        if figures.get(metric, 0) >= threshold
    ]
    dates = _record_earned(name, earned_ids)

    badges = []
    for badge_id, label, description, metric, threshold, tier in CATALOGUE:
        value = figures.get(metric, 0)
        badges.append({
            'id': badge_id,
            'name': label,
            'description': description,
            'metric': metric,
            'unit': METRIC_LABELS.get(metric, ''),
            'threshold': threshold,
            'value': min(value, threshold),
            'earned': badge_id in dates,
            'earned_at': dates.get(badge_id),
            'tier': tier,
        })

    return ok(
        achievements=badges,
        earned=len(dates),
        total=len(badges),
        figures=figures,
    )
