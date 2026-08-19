"""Seed an account's records, milestones and outcome goals.

The companion to seed_year.py, which fills a year of tasks. That gives the app
work to count; this gives it the things a person is actually proud of, and the
long-horizon goals those things ladder up to — the two halves the Records and
Goals pages are built to show and which cannot be inferred from a task list.

## What it writes

Three tables, all scoped to one account:

    records            personal bests and milestones — the hall of fame
    goals              outcome goals: a target, a category, a reason, a date
    goal_milestones    the checkpoints under each of those goals

## Records are entries, not bests

The important part, and the reason a "best" here is several rows. A record in
the reader's sense — "AMC 8, best 25" — is every row named "AMC 8", and the
page takes the largest as the best, the earliest as the starting point and the
whole set as the evolution (see frontend/src/utils/records.ts). So this seeds
the *progression*: 18 in Jan 2024, then 20, 21, 23, and 25 last August. A
single row per record would draw a page with no lines on it.

## What it does not touch

Tasks, XP, streaks, notes and the counter goals. seed_year.py owns the first
three, and the counter goals are an account's own history — this only ever adds
outcome goals beside them. `--clear` removes exactly what this wrote and
nothing else, by the same id-prefix mark seed_year.py uses.
"""
from __future__ import annotations

import argparse
import os
import sqlite3
import sys
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.config.settings import DB_PATH  # noqa: E402
# The app's own rule for what a goal's progress and status come to. Imported
# rather than restated: `get_goals` only ever reads those two columns —
# `_recompute` is what writes them, on every write path — so a seeder that
# invented its own percentages would put rows in the database that the app
# would never have produced, and they would stay wrong until something edited
# them. See backend/api/goals.py.
from backend.api.goals import _recompute  # noqa: E402

# Rows this script wrote carry ids beginning with this, so `--clear` can find
# them again without touching anything the app or another seeder created. Same
# device as seed_year.py, for the same reason: there is no `seeded` column and
# adding one to mark demo data would be a schema change for a demo's benefit.
MARK = 'sc'


def _id(kind: str, n: int) -> str:
    return f'{MARK}{kind}{n:04d}'


# ---------------------------------------------------------------------------
# The records
# ---------------------------------------------------------------------------
# (name, category, unit, target, [(days_ago, value), ...])
#
# Dated backwards from the run date so the page always looks current: the most
# recent bests land inside the "this month" tile, and the oldest entries sit far
# enough back that the evolution chart has a real span to draw.
RECORDS = [
    ('AMC 8', 'Competitive Math', 'points', 25,
     [(950, 18), (700, 20), (430, 21), (180, 23), (7, 25)]),
    ('MathCounts Sprint', 'Competitive Math', 'points', 40,
     [(880, 27), (540, 31), (240, 34), (11, 36)]),
    ('AIME Problems Solved', 'Competitive Math', 'problems', 15,
     [(500, 1), (300, 2), (120, 3), (21, 4)]),
    ('Alcumus Level', 'Competitive Math', 'level', 0,
     [(600, 14), (380, 19), (200, 22), (21, 25)]),
    ('Longest coding session', 'Coding', 'minutes', 0,
     [(520, 178), (300, 214), (90, 240), (5, 258)]),
    ('Largest project', 'Coding', 'lines', 0,
     [(460, 12000), (250, 31000), (60, 75000)]),
    ('Codeforces rating', 'Coding', 'rating', 0,
     [(400, 287), (250, 331), (120, 402), (30, 442)]),
    ('Longest coding streak', 'Coding', 'days', 0,
     [(340, 8), (150, 14), (26, 19)]),
    ('Practice streak', 'Music', 'days', 0,
     [(420, 12), (210, 21), (9, 31)]),
    ('Longest practice session', 'Music', 'minutes', 0,
     [(380, 55), (170, 78), (9, 102)]),
    ('Highest piece level', 'Music', 'level', 0,
     [(700, 6), (400, 7), (160, 8), (9, 9)]),
    ('RCM exams passed', 'Music', 'problems', 0,
     [(700, 2), (300, 4), (40, 5)]),
    ('Longest study streak', 'Habits', 'days', 0,
     [(300, 7), (120, 11), (29, 14)]),
    ('Best week', 'Habits', 'minutes', 0,
     [(200, 640), (80, 780), (16, 902)]),
    ('5k run', 'Fitness', 'minutes', 0,
     [(300, 31), (140, 28), (45, 26)]),
]

# (name, category, days_ago or None for one not reached yet)
MILESTONES = [
    ('First AMC 8 20+', 'Competitive Math', 440),
    ('First AIME problem solved', 'Competitive Math', 417),
    ('First full-stack project', 'Coding', 403),
    ('First RCM exam', 'Music', 374),
    ('First 100-day streak', 'Habits', None),
    ('AMC 8 24+', 'Competitive Math', 7),
    ('MathCounts State (Top 5)', 'Competitive Math', None),
    ('First 10k-line project', 'Coding', 397),
    ('RCM Level 9', 'Music', 9),
    ('1,000 XP in a day', 'Habits', 1),
    ('First Codeforces contest', 'Coding', 410),
    ('First 5k under 30 minutes', 'Fitness', 140),
]

# ---------------------------------------------------------------------------
# The goals, and the checkpoints under them
# ---------------------------------------------------------------------------
# (title, category, why, unit, current, target, days_out, priority, checkpoints)
#
# `checkpoints` is (title, status, days_out). A goal's progress is not set here:
# backend/api/goals.py recomputes it from these on the first read, which is the
# rule the whole goals page rests on — nothing writes a percentage.
GOALS = [
    ('Reach AIME', 'math', 'Qualify through AMC 10 and make the AIME floor.',
     'target score', 12, 15, 540, 9, [
         ('AMC 10 practice at 100+', 'done', -120),
         ('Consistent 105+ on mocks', 'done', -40),
         ('AMC 10 sat and cleared', 'active', 25),
         ('AIME problem set fluent', 'pending', 200),
         ('AIME qualified', 'pending', 520),
     ]),
    ('Build Ascen v2', 'projects', 'Ship the rewrite with analytics and goals.',
     'milestones', 0, 0, 460, 10, [
         ('Calendar rewritten', 'done', -150),
         ('Tasks page rebuilt', 'done', -90),
         ('Goals page rebuilt', 'done', -30),
         ('Analytics finished', 'active', 9),
         ('User authentication', 'pending', 47),
         ('100-day uptime', 'pending', 83),
         ('Public launch', 'pending', 430),
     ]),
    ('Reach USACO Gold', 'coding', 'Gold by the December contest.',
     'milestones', 0, 0, 300, 8, [
         ('Bronze solved without hints', 'done', -200),
         ('Silver greedy fluent', 'done', -110),
         ('Master DP', 'active', 32),
         ('Gold graph theory solid', 'pending', 150),
         ('Gold division reached', 'pending', 290),
     ]),
    ('Reach 5,000 Ascen users', 'projects', 'Enough users to learn from.',
     'users', 2100, 5000, 600, 7, [
         ('First 100 users', 'done', -180),
         ('First 1,000 users', 'done', -60),
         ('Launch beta', 'active', 55),
         ('2,500 users', 'pending', 300),
         ('5,000 users', 'pending', 580),
     ]),
    ('Violin ARCT', 'music', 'Finish the diploma track.',
     'milestones', 0, 0, 900, 6, [
         ('RCM Level 8', 'done', -300),
         ('RCM Level 9', 'done', -9),
         ('Complete RCM Level 10', 'active', 200),
         ('ARCT repertoire chosen', 'pending', 500),
         ('ARCT exam passed', 'pending', 880),
     ]),
    ('Codeforces rating 2000', 'coding', 'Blue, then keep it.',
     'rating', 442, 2000, 560, 5, [
         ('Rating 800', 'done', -240),
         ('Reach 1000 rating', 'active', 60),
         ('Rating 1400', 'pending', 250),
         ('Rating 1700', 'pending', 420),
         ('Rating 2000', 'pending', 550),
     ]),
]


def build(user: str, today: date):
    """Every row this script writes, as three lists ready to insert."""
    records, goals, checkpoints = [], [], []
    n = 0

    def iso(days_ago: int) -> str:
        return (today - timedelta(days=days_ago)).isoformat()

    for name, category, unit, target, entries in RECORDS:
        for days_ago, value in entries:
            n += 1
            records.append((
                _id('r', n), user, 'record', name, category,
                value, target, unit, '', iso(days_ago),
                iso(days_ago) + 'T12:00:00', iso(days_ago) + 'T12:00:00',
            ))

    for name, category, days_ago in MILESTONES:
        n += 1
        records.append((
            _id('r', n), user, 'milestone', name, category,
            0, 0, '', '', '' if days_ago is None else iso(days_ago),
            iso(days_ago or 0) + 'T12:00:00', iso(days_ago or 0) + 'T12:00:00',
        ))

    for g, (title, category, why, unit, current, target, out, priority, rows) in enumerate(GOALS, 1):
        goal_id = _id('g', g)
        measure = 'number' if target else 'milestones'
        for position, (name, status, when) in enumerate(rows):
            n += 1
            checkpoints.append((
                _id('m', n), goal_id, user, name, '', position, status,
                (today + timedelta(days=when)).isoformat(),
                (today + timedelta(days=when)).isoformat() + 'T12:00:00'
                if status == 'done' else None,
                iso(220),
            ))

        # What the app would have computed for these rows. `_recompute` reads
        # `measure`, `current_value`/`target_number` and the checkpoint
        # statuses, and writes `progress`, `target_value` and `status`.
        shape = {
            'measure': measure,
            'current_value': current,
            'target_number': target,
            'status': 'active',
        }
        _recompute(shape, [{'status': st} for _, st, _ in rows])

        goals.append((
            # goal_type stays 'xp': the column is CHECKed against the four
            # legacy counters and an outcome goal carries its real semantics
            # in `measure`. That is what the app itself writes — see the rows
            # backend/api/goals.py creates.
            goal_id, user, title, why, 'xp', shape['status'],
            priority, (today + timedelta(days=out)).isoformat(),
            iso(220), category, why,
            (today - timedelta(days=220)).isoformat(),
            measure, unit if target else '', current, target, '',
            shape['progress'], shape['target_value'],
        ))

    return records, goals, checkpoints


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--user', default='Alpha')
    ap.add_argument('--clear', action='store_true',
                    help='remove the rows this script wrote and stop')
    args = ap.parse_args()

    today = date.today()
    con = sqlite3.connect(DB_PATH)
    try:
        con.execute('PRAGMA foreign_keys = ON')

        # Always clears first, so running it twice is not running it twice.
        gone = 0
        for table in ('records', 'goal_milestones', 'goals'):
            cur = con.execute(
                f"DELETE FROM {table} WHERE user_id = ? AND id LIKE '{MARK}%'",
                (args.user,))
            gone += cur.rowcount
        con.commit()

        if args.clear:
            print(f'removed {gone} seeded rows for {args.user}')
            return 0

        records, goals, checkpoints = build(args.user, today)

        con.executemany(
            'INSERT INTO records (id, user_id, kind, name, category, value,'
            ' target, unit, note, achieved_on, created_at, updated_at)'
            ' VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', records)
        # Goals before checkpoints: goal_milestones.goal_id has a foreign key
        # onto goals.id and it is checked as each row goes in.
        con.executemany(
            'INSERT INTO goals (id, user_id, title, description, goal_type,'
            ' status, priority, deadline, created_at, category, why,'
            ' start_date, measure, unit, current_value, target_number,'
            ' subject_ids, progress, target_value)'
            ' VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', goals)
        con.executemany(
            'INSERT INTO goal_milestones (id, goal_id, user_id, title, note,'
            ' position, status, target_date, completed_at, created_at)'
            ' VALUES (?,?,?,?,?,?,?,?,?,?)', checkpoints)
        con.commit()

        bests = len({r[3] for r in records if r[2] == 'record'})
        print(f'{args.user}: replaced {gone} seeded rows')
        print(f'  {len(records)} record rows across {bests} personal bests'
              f' + {sum(1 for r in records if r[2] == "milestone")} milestones')
        print(f'  {len(goals)} outcome goals, {len(checkpoints)} checkpoints')
    finally:
        con.close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
