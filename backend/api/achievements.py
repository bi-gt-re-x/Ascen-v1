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
written: `_sync_catalogue` reconciles it on first read — inserting what is
missing and rewriting what has changed — so the schema stays the description of
the app it belongs to and a reader querying the database directly sees the same
hundred badges the page does.

## Earned once, dated forever

A badge is earned the first time the figure reaches the threshold, and the row
written to `user_achievements` is what fixes the date. That matters for the
ones that can go down again: a streak badge earned in March stays earned in
July, because the row remembers a thing that happened rather than describing
the account as it is now. Progress on an unearned badge is recomputed every
time, because that is a statement about now.

## Every metric is measured, none is invented

Twenty-one metrics, and every one is a count over a table the app already
keeps: tasks and when they were finished, the focus ledger, the XP ledger,
goals, notes, records, calendar events. Nothing here maintains a counter of its
own and nothing here writes to the account's own totals — the same rule
records.py follows, that a page which scores the record does not get to change
it.

That constraint is what the hundred badges are built around. "Finish 200 tasks
before 8am" is a badge because `completed_at` is a timestamp; "read 50 articles"
is not a badge, because nothing in this app knows what an article is.

## Achievement XP is a score, not currency

Every badge carries an `xp_reward` and the endpoint returns the sum of the
earned ones. **It is never added to the account's XP.** It is a way of weighing
a wall — fifty easy badges against three brutal ones — and the page labels it
as its own figure for that reason. Awarding it would mean this endpoint could
change the level of an account by being read, which is exactly what the rule
above forbids.

## Hidden badges

Five of the hundred are `hidden`: the page does not name them until they are
earned. They exist so that the wall has a floor nobody can see the bottom of,
and they are deliberately out of reach on any ordinary account — a five-hundred
day streak, ten thousand hours of focus, level 250. The last of those is
`Ascended`, the only badge in the catalogue that confers a title, and at
3,112,500 XP (see `level_for_total_xp`: level N costs N x 100) it is the
hardest thing in the app by an order of magnitude.

A hidden badge's progress is not sent while it is locked. Sending "412 / 10000"
would be naming it in everything but the string.
"""
from datetime import datetime

from fastapi import APIRouter

from backend.api.reply import fail, ok
from backend.database import connection as db
from backend.tracking.auth import load_user
from backend.tracking.xp import event_day, level_for_total_xp

router = APIRouter(tags=['achievements'])

#: The five headings the wall is filed under, in reading order.
CATEGORIES = ('Productivity', 'Consistency', 'Learning', 'Milestones', 'Special')

#: What each difficulty rating is called. 1 is a first afternoon, 5 is a year
#: of the app taken seriously.
TIER_LABELS = {
    1: 'Starter',
    2: 'Steady',
    3: 'Serious',
    4: 'Elite',
    5: 'Legendary',
}

#: What a badge of each difficulty is worth toward the achievement score.
#: Steep on purpose: a wall where thirty Starters outweigh one Legendary is a
#: wall that rewards breadth and calls it depth.
TIER_XP = {1: 25, 2: 50, 3: 100, 4: 250, 5: 500}

#: Every badge, as (id, name, description, metric, threshold, tier, category).
#:
#: Thresholds inside a metric climb, so a reader always has exactly one next
#: rung on each — which is the point of having eight task badges rather than
#: one at a number nobody reaches.
CATALOGUE = (
    # ---- Productivity: the work itself ---------------------------------
    ('first-task',   'First Step',            'Finish your first task.',                          'tasks',       1,     1, 'Productivity'),
    ('tasks-10',     'Warmed Up',             'Finish 10 tasks.',                                 'tasks',       10,    1, 'Productivity'),
    ('tasks-50',     'Half a Hundred',        'Finish 50 tasks.',                                 'tasks',       50,    2, 'Productivity'),
    ('tasks-100',    'Century',               'Finish 100 tasks.',                                'tasks',       100,   2, 'Productivity'),
    ('tasks-250',    'Quarter Thousand',      'Finish 250 tasks.',                                'tasks',       250,   3, 'Productivity'),
    ('tasks-500',    'Task Crusher',          'Finish 500 tasks.',                                'tasks',       500,   3, 'Productivity'),
    ('tasks-1000',   'Four Figures',          'Finish 1,000 tasks.',                              'tasks',       1000,  4, 'Productivity'),
    ('tasks-2500',   'The Long Haul',         'Finish 2,500 tasks.',                              'tasks',       2500,  5, 'Productivity'),
    ('hard-10',      'Triage',                'Finish 10 high-priority tasks.',                   'priority',    10,    1, 'Productivity'),
    ('hard-50',      'Heavy Lifter',          'Finish 50 high-priority tasks.',                   'priority',    50,    2, 'Productivity'),
    ('hard-200',     'Firefighter',           'Finish 200 high-priority tasks.',                  'priority',    200,   4, 'Productivity'),
    ('day-5',        'Productive Day',        'Finish 5 tasks in a single day.',                  'day_tasks',   5,     1, 'Productivity'),
    ('day-10',       'Double Digits',         'Finish 10 tasks in a single day.',                 'day_tasks',   10,    2, 'Productivity'),
    ('day-20',       'Relentless',            'Finish 20 tasks in a single day.',                 'day_tasks',   20,    4, 'Productivity'),
    ('day-30',       'Machine Mode',          'Finish 30 tasks in a single day.',                 'day_tasks',   30,    5, 'Productivity'),
    ('events-10',    'Scheduled',             'Complete 10 calendar events.',                     'events',      10,    1, 'Productivity'),
    ('events-50',    'Calendar Keeper',       'Complete 50 calendar events.',                     'events',      50,    3, 'Productivity'),
    ('events-200',   'Master of the Week',    'Complete 200 calendar events.',                    'events',      200,   4, 'Productivity'),

    # ---- Consistency: turning up, and keeping turning up ----------------
    ('streak-3',     'Three in a Row',        'Hold a 3-day streak.',                             'streak',      3,     1, 'Consistency'),
    ('streak-7',     'Week Warrior',          'Hold a 7-day streak.',                             'streak',      7,     1, 'Consistency'),
    ('streak-14',    'Fortnight',             'Hold a 14-day streak.',                            'streak',      14,    2, 'Consistency'),
    ('streak-30',    'Unstoppable',           'Hold a 30-day streak.',                            'streak',      30,    2, 'Consistency'),
    ('streak-60',    'Two Months Deep',       'Hold a 60-day streak.',                            'streak',      60,    3, 'Consistency'),
    ('streak-100',   'Hundred Days',          'Hold a 100-day streak.',                           'streak',      100,   4, 'Consistency'),
    ('streak-365',   'Year of Fire',          'Hold a 365-day streak.',                           'streak',      365,   5, 'Consistency'),
    ('days-30',      'Regular',               'Do work on 30 separate days.',                     'active_days', 30,    1, 'Consistency'),
    ('days-100',     'Hundred Days In',       'Do work on 100 separate days.',                    'active_days', 100,   2, 'Consistency'),
    ('days-250',     'Devoted',               'Do work on 250 separate days.',                    'active_days', 250,   3, 'Consistency'),
    ('days-500',     'Half a Thousand Days',  'Do work on 500 separate days.',                    'active_days', 500,   5, 'Consistency'),
    ('goal-day-5',   'On Target',             'Hit your daily focus goal 5 times.',               'perfect_days', 5,    1, 'Consistency'),
    ('goal-day-25',  'Consistent Aim',        'Hit your daily focus goal 25 times.',              'perfect_days', 25,   2, 'Consistency'),
    ('goal-day-100', 'Dead Centre',           'Hit your daily focus goal 100 times.',             'perfect_days', 100,  4, 'Consistency'),
    ('goal-day-250', 'Unerring',              'Hit your daily focus goal 250 times.',             'perfect_days', 250,  5, 'Consistency'),
    ('early-10',     'Early Bird',            'Finish 10 tasks before 8am.',                      'early',       10,    1, 'Consistency'),
    ('early-50',     'Dawn Patrol',           'Finish 50 tasks before 8am.',                      'early',       50,    3, 'Consistency'),
    ('early-200',    'Sunrise Discipline',    'Finish 200 tasks before 8am.',                     'early',       200,   4, 'Consistency'),
    ('weekend-10',   'Weekend Warrior',       'Finish 10 tasks on a Saturday or Sunday.',         'weekend',     10,    1, 'Consistency'),
    ('weekend-50',   'No Days Off',           'Finish 50 tasks on a Saturday or Sunday.',         'weekend',     50,    2, 'Consistency'),
    ('weekend-150',  'Saturday Scholar',      'Finish 150 tasks on a Saturday or Sunday.',        'weekend',     150,   4, 'Consistency'),
    ('months-3',     'Quarter Year',          'Be active in 3 different months.',                 'months',      3,     1, 'Consistency'),
    ('months-6',     'Half a Year',           'Be active in 6 different months.',                 'months',      6,     2, 'Consistency'),
    ('months-12',    'Full Circle',           'Be active in 12 different months.',                'months',      12,    4, 'Consistency'),

    # ---- Learning: depth, breadth and the writing down ------------------
    ('focus-1',      'First Hour',            'Log 1 hour of focus.',                             'focus',       1,     1, 'Learning'),
    ('focus-10',     'Ten Deep',              'Log 10 hours of focus.',                           'focus',       10,    1, 'Learning'),
    ('focus-50',     'Fifty Down',            'Log 50 hours of focus.',                           'focus',       50,    2, 'Learning'),
    ('focus-100',    'Knowledge Seeker',      'Log 100 hours of focus.',                          'focus',       100,   3, 'Learning'),
    ('focus-250',    'Deep Diver',            'Log 250 hours of focus.',                          'focus',       250,   3, 'Learning'),
    ('focus-500',    'Five Hundred Hours',    'Log 500 hours of focus.',                          'focus',       500,   4, 'Learning'),
    ('focus-1000',   'The Thousand',          'Log 1,000 hours of focus.',                        'focus',       1000,  5, 'Learning'),
    ('fdays-10',     'Showing Up',            'Focus on 10 separate days.',                       'focus_days',  10,    1, 'Learning'),
    ('fdays-50',     'Fifty Sittings',        'Focus on 50 separate days.',                       'focus_days',  50,    2, 'Learning'),
    ('fdays-150',    'Practised',             'Focus on 150 separate days.',                      'focus_days',  150,   3, 'Learning'),
    ('fdays-365',    'A Year of Focus',       'Focus on 365 separate days.',                      'focus_days',  365,   5, 'Learning'),
    ('deep-3',       'Long Session',          'Focus for 3 hours in a single day.',               'focus_best',  3,     1, 'Learning'),
    ('deep-6',       'Marathon Mind',         'Focus for 6 hours in a single day.',               'focus_best',  6,     3, 'Learning'),
    ('deep-10',      'All Day Deep',          'Focus for 10 hours in a single day.',              'focus_best',  10,    4, 'Learning'),
    ('subj-3',       'Broadening',            'Finish tasks in 3 different subjects.',            'subjects',    3,     1, 'Learning'),
    ('subj-8',       'Well Rounded',          'Finish tasks in 8 different subjects.',            'subjects',    8,     2, 'Learning'),
    ('subj-15',      'Renaissance',           'Finish tasks in 15 different subjects.',           'subjects',    15,    4, 'Learning'),
    ('subj-25',      'Wide Field',            'Finish tasks in 25 different subjects.',           'subjects',    25,    5, 'Learning'),
    ('notes-1',      'First Note',            'Write your first note.',                           'notes',       1,     1, 'Learning'),
    ('notes-10',     'Note Taker',            'Write 10 notes.',                                  'notes',       10,    1, 'Learning'),
    ('notes-50',     'Notebook Filler',       'Write 50 notes.',                                  'notes',       50,    2, 'Learning'),
    ('notes-200',    'Archivist',             'Write 200 notes.',                                 'notes',       200,   3, 'Learning'),
    ('notes-500',    'A Library of Your Own', 'Write 500 notes.',                                 'notes',       500,   5, 'Learning'),

    # ---- Milestones: the numbers the app counts in ----------------------
    ('xp-1000',      'Getting Going',         'Earn 1,000 XP.',                                   'xp',          1000,  1, 'Milestones'),
    ('xp-5000',      'Five Thousand',         'Earn 5,000 XP.',                                   'xp',          5000,  1, 'Milestones'),
    ('xp-10000',     'Ten Thousand',          'Earn 10,000 XP.',                                  'xp',          10000, 2, 'Milestones'),
    ('xp-25000',     'Twenty-Five K',         'Earn 25,000 XP.',                                  'xp',          25000, 2, 'Milestones'),
    ('xp-50000',     'Fifty Thousand',        'Earn 50,000 XP.',                                  'xp',          50000, 3, 'Milestones'),
    ('xp-100000',    'Six Figures',           'Earn 100,000 XP.',                                 'xp',        100000,  4, 'Milestones'),
    ('xp-250000',    'Quarter Million',       'Earn 250,000 XP.',                                 'xp',        250000,  5, 'Milestones'),
    ('xp-500000',    'Half a Million',        'Earn 500,000 XP.',                                 'xp',        500000,  5, 'Milestones'),
    ('level-5',      'Level Five',            'Reach level 5.',                                   'level',       5,     1, 'Milestones'),
    ('level-10',     'Level Ten',             'Reach level 10.',                                  'level',       10,    1, 'Milestones'),
    ('level-25',     'Ascending',             'Reach level 25.',                                  'level',       25,    2, 'Milestones'),
    ('level-50',     'Halfway to a Hundred',  'Reach level 50.',                                  'level',       50,    3, 'Milestones'),
    ('level-75',     'Seventy-Five',          'Reach level 75.',                                  'level',       75,    4, 'Milestones'),
    ('level-100',    'Centurion',             'Reach level 100.',                                 'level',       100,   4, 'Milestones'),
    ('level-150',    'Beyond',                'Reach level 150.',                                 'level',       150,   5, 'Milestones'),
    ('dayxp-500',    'Big Day',               'Earn 500 XP in a single day.',                     'day_xp',      500,   1, 'Milestones'),
    ('dayxp-1500',   'Huge Day',              'Earn 1,500 XP in a single day.',                   'day_xp',      1500,  3, 'Milestones'),
    ('dayxp-3000',   'Record Day',            'Earn 3,000 XP in a single day.',                   'day_xp',      3000,  4, 'Milestones'),
    ('goal-1',       'Goal Getter',           'Finish a goal.',                                   'goals',       1,     1, 'Milestones'),
    ('goal-5',       'Five Reached',          'Finish 5 goals.',                                  'goals',       5,     2, 'Milestones'),
    ('goal-15',      'Goal Machine',          'Finish 15 goals.',                                 'goals',       15,    3, 'Milestones'),
    ('goal-30',      'Thirty Down',           'Finish 30 goals.',                                 'goals',       30,    4, 'Milestones'),
    ('goal-50',      'Finisher',              'Finish 50 goals.',                                 'goals',       50,    5, 'Milestones'),
    ('rec-1',        'On the Board',          'Log your first personal record.',                  'records',     1,     1, 'Milestones'),
    ('rec-10',       'Record Keeper',         'Log 10 personal records.',                         'records',     10,    2, 'Milestones'),
    ('rec-25',       'Statistician',          'Log 25 personal records.',                         'records',     25,    3, 'Milestones'),
    ('rec-50',       'Your Own Worst Rival',  'Log 50 personal records.',                         'records',     50,    4, 'Milestones'),

    # ---- Special: the odd ones, and the five nobody is told about -------
    ('night-10',     'Night Owl',             'Finish 10 tasks between midnight and 4am.',        'night',       10,    2, 'Special'),
    ('dayxp-5000',   'Once in a Lifetime',    'Earn 5,000 XP in a single day.',                   'day_xp',      5000,  5, 'Special'),
    ('deep-14',      'Fourteen Hours',        'Focus for 14 hours in a single day.',              'focus_best',  14,    5, 'Special'),
)

#: The five nobody is told about until they have them, as
#: (id, name, description, metric, threshold, title).
#:
#: All Legendary, all Special, and all far past the end of the visible ladder on
#: their own metric — the visible streak badge stops at 365 and this one wants
#: 500; the visible focus badge stops at 1,000 hours and this one wants ten
#: thousand. That gap is the point: a hidden badge a reader could stumble into
#: while chasing a visible one is not hidden, it is just unlabelled.
#:
#: `Ascended` is last because it is the hardest: level 250 is 3,112,500 XP on a
#: ladder where level N costs N x 100. It is the only badge that carries a
#: title, and the title is the reason it exists.
HIDDEN = (
    ('hidden-nocturne',  'Nocturne',           'Finish 100 tasks between midnight and 4am.', 'night',    100,   None),
    ('hidden-polymath',  'Polymath',           'Finish tasks in 40 different subjects.',     'subjects', 40,    None),
    ('hidden-iron-will', 'Iron Will',          'Hold a 500-day streak.',                     'streak',   500,   None),
    ('hidden-10k-hours', 'Ten Thousand Hours', 'Log 10,000 hours of focus.',                 'focus',    10000, None),
    ('hidden-ascended',  'Ascended',           'Reach level 250.',                           'level',    250,   'Ascended'),
)

#: What each metric is called on the page, so a locked badge can say "412 / 500
#: tasks" without the client holding a second copy of this list.
METRIC_LABELS = {
    'tasks': 'tasks',
    'priority': 'tasks',
    'day_tasks': 'in a day',
    'events': 'events',
    'xp': 'XP',
    'day_xp': 'in a day',
    'streak': 'days',
    'active_days': 'days',
    'perfect_days': 'days',
    'early': 'tasks',
    'weekend': 'tasks',
    'night': 'tasks',
    'months': 'months',
    'level': 'level',
    'focus': 'hours',
    'focus_days': 'days',
    'focus_best': 'hours',
    'subjects': 'subjects',
    'notes': 'notes',
    'goals': 'goals',
    'records': 'records',
}


def _rows():
    """The whole catalogue as uniform dicts, visible ones first.

    Two literals above rather than one because a hidden badge is a different
    kind of entry — it has no category to choose and no tier to weigh up, being
    always Special and always Legendary — and giving them one shape here means
    nothing downstream has to know there were two.
    """
    out = []
    for badge_id, name, description, metric, threshold, tier, category in CATALOGUE:
        out.append({
            'id': badge_id, 'name': name, 'description': description,
            'metric': metric, 'threshold': threshold, 'tier': tier,
            'category': category, 'xp_reward': TIER_XP[tier],
            'hidden': False, 'title': None,
        })
    for badge_id, name, description, metric, threshold, title in HIDDEN:
        out.append({
            'id': badge_id, 'name': name, 'description': description,
            'metric': metric, 'threshold': threshold, 'tier': 5,
            'category': 'Special',
            # Worth more than any visible badge, and the title-bearer worth ten
            # times a Legendary. The score is a weighing of a wall; a wall with
            # Ascended on it is not the same wall.
            'xp_reward': 5000 if title else 1000,
            'hidden': True, 'title': title,
        })
    return out


ALL = _rows()


def _row_for(badge):
    """One catalogue entry in the table's shape."""
    return {
        'id': badge['id'], 'name': badge['name'],
        'description': badge['description'], 'icon': None,
        'metric': badge['metric'], 'threshold': badge['threshold'],
        'tier': badge['tier'], 'category': badge['category'],
        'xp_reward': badge['xp_reward'], 'hidden': 1 if badge['hidden'] else 0,
        'title': badge['title'],
    }


def _sync_catalogue():
    """Make the table say what the catalogue says. Never deletes.

    Inserts what is missing **and rewrites what has changed**. Insert-only was
    not enough once a badge could be renamed: sixteen ids in this catalogue were
    in the table already under earlier names and thresholds, and a table holding
    "Fifty in" for a badge the page calls "Half a Hundred" makes the claim at
    the top of this module — that a reader querying the database sees the same
    hundred badges — false.

    A badge removed from the catalogue keeps its row and anybody's earning of
    it, because deleting it would cascade `user_achievements` and take
    somebody's history with it. An obsolete row simply stops being returned.
    That is the one direction this does not sync, and it is deliberate.
    """
    rows = db.read_table('achievements')
    wanted = {badge['id']: _row_for(badge) for badge in ALL}
    changed = False

    updated = []
    for row in rows:
        fresh = wanted.pop(row.get('id'), None)
        if fresh is None:
            updated.append(row)
            continue
        merged = {**row, **fresh}
        if merged != row:
            changed = True
        updated.append(merged)

    if wanted:
        updated.extend(wanted.values())
        changed = True
    if changed:
        db.write_table('achievements', updated)


def _hour_and_day(stamp):
    """The hour and weekday of a completion timestamp, or (None, None).

    Rows written before the app recorded a time, and rows written by an import,
    carry a date with no clock on it. Those cannot answer "before 8am" and are
    left out of the badges that ask rather than counted as midnight — which
    would hand every one of them to Night Owl.
    """
    text = str(stamp or '')
    if len(text) < 16:
        return None, None
    try:
        when = datetime.fromisoformat(text.replace('Z', '+00:00'))
    except ValueError:
        return None, None
    return when.hour, when.weekday()


def _figures(username, user):
    """The account's current value for every metric a badge is measured on.

    One pass over each table. Everything is counted off what the app already
    stores — see the module note — so a figure here is always a re-reading of
    the record rather than a number this endpoint keeps.
    """
    mine = [row for row in db.tasks() if row.get('user_id') == username]
    done = [row for row in mine if row.get('status') == 'done']

    per_day = {}
    early = night = weekend = priority = 0
    subjects = set()
    months = set()
    for row in done:
        stamp = row.get('completed_at') or ''
        day = str(stamp)[:10]
        if day:
            per_day[day] = per_day.get(day, 0) + 1
            months.add(day[:7])
        if (row.get('priority') or '') == 'high':
            priority += 1
        subject = (row.get('subject') or '').strip()
        if subject:
            subjects.add(subject)
        hour, weekday = _hour_and_day(stamp)
        if hour is not None:
            if hour < 8:
                early += 1
            if hour < 4:
                night += 1
            if weekday >= 5:
                weekend += 1

    focus_rows = [row for row in db.focus_days() if row.get('user_id') == username]
    focus_seconds = sum(float(row.get('seconds') or 0) for row in focus_rows)
    focus_best = max((float(row.get('seconds') or 0) for row in focus_rows), default=0)
    # A day counts as hit only where a goal was actually set on it. `goal_hours`
    # defaults to 2 in the schema, so a zero means somebody turned the goal off
    # rather than met one of nothing.
    perfect = sum(
        1 for row in focus_rows
        if float(row.get('goal_hours') or 0) > 0
        and float(row.get('seconds') or 0) >= float(row.get('goal_hours')) * 3600
    )

    xp_per_day = {}
    for event in db.xp_events():
        if event.get('user_id') != username:
            continue
        day = event_day(event)
        if day:
            xp_per_day[day] = xp_per_day.get(day, 0) + float(event.get('amount') or 0)

    return {
        'tasks': int(user.get('tasks_completed') or 0),
        'priority': priority,
        'day_tasks': max(per_day.values(), default=0),
        'events': sum(
            1 for row in db.calendar_events()
            if row.get('user_id') == username and row.get('completed')
        ),
        'xp': int(user.get('xp') or 0),
        'day_xp': int(max(xp_per_day.values(), default=0)),
        # The best streak, not the current one: a badge is a thing that
        # happened, and reading `current_streak` would un-earn it every time a
        # day was missed.
        'streak': int(user.get('best_streak') or 0),
        'active_days': len(per_day),
        'perfect_days': perfect,
        'early': early,
        'weekend': weekend,
        'night': night,
        'months': len(months),
        'level': int(user.get('level') or 1),
        'focus': int(focus_seconds // 3600),
        'focus_days': sum(1 for row in focus_rows if float(row.get('seconds') or 0) > 0),
        'focus_best': int(focus_best // 3600),
        'subjects': len(subjects),
        'notes': sum(1 for row in db.notes() if row.get('user_id') == username),
        'goals': sum(
            1 for row in db.goals()
            if row.get('user_id') == username and row.get('status') == 'completed'
        ),
        'records': sum(1 for row in db.records() if row.get('user_id') == username),
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
        badge['id'] for badge in ALL
        if figures.get(badge['metric'], 0) >= badge['threshold']
    ]
    dates = _record_earned(name, earned_ids)

    badges = []
    for badge in ALL:
        value = figures.get(badge['metric'], 0)
        earned = badge['id'] in dates
        # A locked hidden badge sends nothing that describes it. Its name, its
        # description and its threshold are all withheld, and so is progress:
        # "412 / 10,000 hours" names it in everything but the string.
        secret = badge['hidden'] and not earned
        badges.append({
            'id': badge['id'],
            'name': '???' if secret else badge['name'],
            'description': (
                'A hidden achievement. Keep going.' if secret else badge['description']
            ),
            'metric': '' if secret else badge['metric'],
            'unit': '' if secret else METRIC_LABELS.get(badge['metric'], ''),
            'threshold': 0 if secret else badge['threshold'],
            'value': 0 if secret else min(value, badge['threshold']),
            'earned': earned,
            'earned_at': dates.get(badge['id']),
            'tier': badge['tier'],
            'tier_label': TIER_LABELS[badge['tier']],
            'category': badge['category'],
            'xp_reward': badge['xp_reward'],
            'hidden': badge['hidden'],
            'title': badge['title'] if earned else None,
        })

    # The category band. Counted here rather than on the page so the page has
    # one fewer thing that could disagree with the list under it.
    categories = [
        {
            'name': category,
            'earned': sum(1 for b in badges if b['category'] == category and b['earned']),
            'total': sum(1 for b in badges if b['category'] == category),
        }
        for category in CATEGORIES
    ]

    progress = level_for_total_xp(figures['xp'])
    return ok(
        achievements=badges,
        earned=len(dates),
        total=len(badges),
        figures=figures,
        categories=categories,
        # The sum of what has been earned, and never added to the account —
        # see the module note. `total_xp` is what a perfect wall would score,
        # which is what makes the earned figure mean anything.
        achievement_xp=sum(b['xp_reward'] for b in badges if b['earned']),
        total_xp=sum(b['xp_reward'] for b in badges),
        streak=int(user.get('current_streak') or 0),
        level=progress['level'],
        xp_to_next=max(0, progress['xp_required'] - progress['xp_in_level']),
        # The title the account has earned the right to call itself, or none.
        # Exactly one badge in the catalogue confers one.
        title=next((b['title'] for b in badges if b['title']), None),
    )
