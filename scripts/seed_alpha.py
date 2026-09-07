"""Alpha's real timetable, a year of it ahead and a year of record behind.

    python3 scripts/seed_alpha.py            # write it
    python3 scripts/seed_alpha.py --clear    # take it all back out

## What this is, next to seed_year.py

seed_year writes *a* year — an invented week for an invented student, to see
what the app's views do against a life rather than against ten rows. This
writes *this* week: the actual timetable Alpha keeps, forward a year as a
calendar, and a matching year behind as finished work with the analytics that
come off it.

The two do not overlap. seed_year owns ids 1.00e12-1.099e12; this owns
1.10e12-1.199e12, and both stay 13 digits and below the millisecond timestamps
real ids are made of, so neither can collide with the other or with anything
the app writes. `--clear` here removes only what this wrote.

## The three things it writes

**The year ahead** (`WEEK`) is the timetable as calendar blocks: Ready Up and
school every weekday, the clubs and lessons on their own days. They are `todo`
and they earn nothing yet, which is the point of a calendar — they are what is
going to happen, and the XP on them is what finishing one will be worth.

**The year behind** is the same week already lived: every block finished, plus
the study that fills an evening, each carrying a subject, a difficulty and an
execution rating so the quality grid and the subject split have something real
underneath them. The focus timer and the report card are written to match, day
by day, so the Growth tab has two comparable years rather than one year and a
blank.

**The level.** Alpha is meant to read as an account five years deep, and its
ledger said 92 XP a day against its own 300-a-day goal — the arithmetic of an
account that was seeded thinly, not of a person. The shortfall to level 100 is
spread back across the days it already worked, which brings that average to
about 327 and leaves every individual day plausible. The ledger stays the
authority: `users.xp` is recomputed from it at the end, never set beside it.
"""
from __future__ import annotations

import argparse
import os
import random
import sqlite3
import sys
from datetime import date, datetime, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from backend.config.settings import DB_PATH                    # noqa: E402
from backend.config.subjects import BY_ID                      # noqa: E402
from backend.tracking.analytics import grade_for_score         # noqa: E402
from backend.tracking.xp import level_for_total_xp             # noqa: E402

DB = DB_PATH

# --------------------------------------------------------------------------
# The window this script owns
# --------------------------------------------------------------------------
# Same reasoning as seed_year.py's, one block up: real ids are millisecond
# timestamps (1.79e12 and climbing) and will never come back down, so a 13-digit
# range below them is reserved by construction. seed_year has 1.0e12; this has
# 1.1e12, and the two cannot meet.
ID_LOW = 1_100_000_000_000
ID_HIGH = 1_199_999_999_999
TASK_BASE = 1_100_000_000_000     # tasks:     1.100e12 - 1.119e12
EVENT_BASE = 1_120_000_000_000    # xp_events: 1.120e12 - 1.139e12

OWNED = 'user_id = ? AND id >= ? AND id <= ? AND length(id) = 13'


def owned_args(user):
    return (user, str(ID_LOW), str(ID_HIGH))


# --------------------------------------------------------------------------
# The week
# --------------------------------------------------------------------------
# (weekday, title, subject, start, end, xp, study)
#
# `study` is whether the block is deliberate work or merely attendance, and
# it is what `focus_sessions` counts on. It used to be read off the subject —
# a block filed under `lectures` was a lesson and did not count — but the
# lectures here are filed under what they are *about*, because that is what
# joins them to a skill tree. Two questions were riding on one field, and
# they have different answers: a machine-learning lecture is machine
# learning, and sitting in it is still not an hour of focus.
#
# Monday is 0. Alpha is a computer-science undergraduate: the degree is the
# software, the machine learning and the web work, the mathematics is Math 55
# and Putnam training rather than coursework, and the violin is the thing that
# is not any of that. XP is scaled to what the block costs to actually do — an
# hour of lectures is not an hour of a problem set — and the numbers are
# deliberately round, because they are a currency and a reader who finishes a
# lecture and sees 40 should not have to wonder why not 38.
#
# Subjects are catalogue ids from backend/config/subjects.py, and they are the
# join to the skill trees: `machine_learning`, `web_design`, `programming`,
# `computer_science` and `mathematics` each open a different lattice, which is
# what makes this timetable readable on the skill-tree page as well as on the
# calendar.
WEEK = (
    # The lectures, in the order the week holds them.
    (0, 'Math 55 lecture', 'mathematics', '09:00', '10:30', 45, False),
    (2, 'Math 55 lecture', 'mathematics', '09:00', '10:30', 45, False),
    (4, 'Math 55 lecture', 'mathematics', '09:00', '10:30', 45, False),
    (0, 'Machine Learning lecture', 'machine_learning', '11:00', '12:30', 45, False),
    (2, 'Machine Learning lecture', 'machine_learning', '11:00', '12:30', 45, False),
    (1, 'Algorithms lecture', 'computer_science', '10:00', '11:30', 45, False),
    (3, 'Algorithms lecture', 'computer_science', '10:00', '11:30', 45, False),
    (1, 'Systems lecture', 'programming', '13:00', '14:30', 45, False),
    (3, 'Databases lecture', 'databases', '13:00', '14:30', 40, False),

    # The sections and labs the lectures hang off.
    (1, 'Math 55 section', 'mathematics', '16:00', '17:00', 35, True),
    (3, 'ML lab', 'machine_learning', '15:00', '17:00', 60, True),
    (4, 'Systems lab', 'programming', '14:00', '16:00', 60, True),

    # Monday and Thursday — the Putnam seminar and the problem session it
    # feeds. The seminar is where the problems are handed out; Thursday is
    # where the week's attempt gets taken apart.
    (0, 'Putnam seminar', 'mathematics', '17:30', '19:00', 55, True),
    (3, 'Putnam problem session', 'mathematics', '19:00', '20:30', 55, True),

    # Wednesday — the violin, which is the one thing on here that is not the
    # degree.
    (2, 'Violin lesson', 'music', '17:00', '18:00', 40, True),

    # Friday — the project the degree does not set.
    (4, 'Side project standup', 'web_design', '17:00', '17:30', 20, True),

    # Every weekday, either end of it.
    *[(d, 'Morning review', 'planning', '08:15', '08:45', 10, False) for d in range(5)],
    *[(d, 'Gym', 'gym', '07:00', '08:00', 25, False) for d in (0, 2, 4)],
)

#: The day's subject, written onto the calendar as its Focus note.
#:
#: Tied to what the day actually holds rather than rotated for variety: Monday
#: and Thursday are the Putnam seminar and its problem session, Wednesday is
#: the violin lesson, Friday is the project. The two that are not anchored to
#: anything alternate, because a Tuesday that is always Algorithms is a
#: timetable nobody keeps.
FOCUS_DAYS = {
    0: ('Putnam',),
    1: ('Algorithms', 'Systems'),
    2: ('Machine learning',),
    3: ('Putnam',),
    4: ('Web development',),
    5: ('Side project', 'Deep work'),
    6: ('Reading', 'Rest and reset'),
}

# --------------------------------------------------------------------------
# The study that fills the year behind
# --------------------------------------------------------------------------
# (title, subject, minutes, xp). Drawn from to top a finished day up to
# something like a real one — the timetable alone is about 200 XP on an average
# weekday, and an undergraduate taking this seriously is closer to 450.
#
# Weighted toward the three things Alpha actually spends its evenings on:
# writing software, the mathematics, and the model that is training. The violin
# is here once, which is what "some violin" means on a week like this one.
EVENING = (
    ('Math 55 problem set', 'mathematics', 120, 110),
    ('Putnam problems', 'mathematics', 90, 90),
    ('Algorithms problem set', 'computer_science', 90, 85),
    ('LeetCode session', 'programming', 60, 55),
    ('ML paper reading', 'machine_learning', 60, 60),
    ('Training run + writeup', 'machine_learning', 75, 70),
    ('Kaggle notebook', 'data_science', 90, 80),
    ('Side project — frontend', 'web_design', 90, 80),
    ('Side project — API', 'web_design', 75, 70),
    ('Refactor and code review', 'programming', 60, 55),
    ('Systems reading', 'programming', 45, 45),
    ('Schema and query work', 'databases', 45, 45),
    ('Violin practice', 'music', 45, 40),
    ('Lecture notes tidy-up', 'lectures', 30, 25),
    ('Flashcards', 'flashcards', 20, 20),
)

WEEKEND = (
    ('Putnam mock', 'mathematics', 240, 180),
    ('Math 55 proof grinding', 'mathematics', 150, 130),
    ('Side project — ship a feature', 'web_design', 180, 150),
    ('ML project training', 'machine_learning', 150, 130),
    ('Open source contribution', 'programming', 120, 110),
    ('Long violin practice', 'music', 90, 70),
    ('Reading', 'reading', 60, 40),
    ('Gym', 'gym', 75, 45),
    ('Week review', 'planning', 30, 30),
    ('Chores', 'chores', 45, 25),
)


def stamp(day: date, hhmm: str) -> str:
    return '{}T{}:00'.format(day.isoformat(), hhmm)


def minutes(hhmm: str) -> int:
    h, m = hhmm.split(':')
    return int(h) * 60 + int(m)


def add_minutes(day: date, hhmm: str, span: int) -> str:
    start = datetime.combine(day, datetime.min.time()) + timedelta(minutes=minutes(hhmm))
    return (start + timedelta(minutes=span)).isoformat()


# --------------------------------------------------------------------------
# Building
# --------------------------------------------------------------------------
def forward_rows(user: str, start: date, days: int, first_id: int):
    """The timetable ahead, as unfinished calendar blocks."""
    rows = []
    for offset in range(days):
        day = start + timedelta(days=offset)
        for weekday, title, subject, begin, end, xp, _study in WEEK:
            if day.weekday() != weekday:
                continue
            rows.append((
                str(first_id + len(rows)), user, title, '', 'medium', 'todo',
                xp, subject, stamp(day, end), 1, stamp(day, begin),
                None, None, None, None, None,
            ))
    return rows


def behind_rows(user: str, start: date, days: int, first_id: int, rng: random.Random):
    """The same week already lived, plus the study around it.

    Everything here is finished, rated and timed, because that is what the
    analytics pages read: the quality grid needs difficulty against execution,
    the efficiency metric needs a duration and a deadline it either met or did
    not, and the subject split needs a subject on every row.
    """
    rows = []

    def finish(day, title, subject, begin, span, xp, on_cal):
        """One finished task. `begin` is a clock time, `span` is minutes."""
        started = stamp(day, begin)
        due = add_minutes(day, begin, span)
        # Most things land on time; the ones that do not are what stops the
        # efficiency score being a flat 100 and therefore meaningless.
        late = rng.random() < 0.12
        done_at = add_minutes(day, begin, span + (rng.randint(10, 90) if late else 0))
        # Difficulty and execution: a real record is mostly competent work at a
        # sensible level, with enough spread to make the grid worth drawing.
        difficulty = rng.choices([2, 3, 4, 5], weights=[12, 34, 38, 16])[0]
        execution = max(1, min(5, difficulty + rng.choices(
            [-2, -1, 0, 1], weights=[6, 22, 54, 18])[0]))
        rows.append((
            str(first_id + len(rows)), user, title, '', 'medium', 'done',
            xp, subject, due, on_cal, started,
            done_at, span * 60 + (rng.randint(0, 600)), 0 if late else 1,
            difficulty, execution,
        ))

    for offset in range(days):
        day = start + timedelta(days=offset)
        # Four days off a month, taken as whole days rather than sprinkled —
        # that is what a break looks like in a record, and it is what gives the
        # habits and consistency pages a shape to find.
        if rng.random() < 0.13:
            continue

        for weekday, title, subject, begin, end, xp, _study in WEEK:
            if day.weekday() == weekday:
                finish(day, title, subject, begin,
                       minutes(end) - minutes(begin), xp, 1)

        pool = WEEKEND if day.weekday() >= 5 else EVENING
        clock = 9 * 60 if day.weekday() >= 5 else 19 * 60 + 30
        for title, subject, span, xp in rng.sample(pool, rng.randint(3, 5)):
            begin = '{:02d}:{:02d}'.format(clock // 60, clock % 60)
            if clock + span > 22 * 60 + 30:
                break
            finish(day, title, subject, begin, span, xp, 0)
            clock += span + 15

    return rows


def focus_notes(user: str, start: date, days: int):
    """The day's subject, written where the calendar shows it."""
    rows = []
    for offset in range(days):
        day = start + timedelta(days=offset)
        choices = FOCUS_DAYS[day.weekday()]
        rows.append((user, day.isoformat(),
                     choices[(offset // 7) % len(choices)]))
    return rows


#: Timetabled blocks that are attendance rather than work, by title.
#:
#: Derived from `WEEK` rather than listed again, so a block whose flag is
#: changed above cannot go on being counted down here.
ATTENDANCE = frozenset(
    title for _d, title, _s, _b, _e, _x, study in WEEK if not study)

#: Subjects that are never deliberate study, whatever they are attached to.
#: The evening and weekend pools have no flag of their own — everything in them
#: is study except the two things that keep a person alive.
NOT_STUDY = frozenset(('planning', 'chores', 'gym'))


def focus_sessions(user: str, tasks, rng: random.Random):
    """Hours actually sat, per day, from the work that was done.

    Counted off the finished rows rather than invented beside them, so the
    focus figures and the task figures cannot disagree about a Tuesday. Only
    the deliberate study counts — sitting in a lecture is not a focus session,
    which is the same line the app draws.
    """
    by_day: dict[str, int] = {}
    for row in tasks:
        title, subject, completed = row[2], row[7], row[11]
        if title in ATTENDANCE or subject in NOT_STUDY:
            continue
        day = completed[:10]
        by_day[day] = by_day.get(day, 0) + int(row[12] or 0)

    return [(user, day, min(seconds, 8 * 3600), 3)
            for day, seconds in sorted(by_day.items())]


def snapshots(user: str, tasks, focus, start: date, days: int):
    """The report card as it would have been recorded, week by week.

    The card writes one row per metric each time it is read, so a year that was
    lived leaves a year of them — and without that the Growth Score has a
    figure and no line. These are computed from the rows above rather than
    drawn as a curve: the productivity score is the week's XP against the
    account's goal, consistency is the days it worked, quality is what it rated
    its own work, and so on. The same five, and the mean of them.
    """
    goal = 300.0
    xp_by_day: dict[str, int] = {}
    rated: dict[str, list[tuple[int, int]]] = {}
    ontime: dict[str, list[int]] = {}
    for row in tasks:
        day = row[11][:10]
        xp_by_day[day] = xp_by_day.get(day, 0) + row[6]
        rated.setdefault(day, []).append((row[14], row[15]))
        ontime.setdefault(day, []).append(row[13])
    focus_by_day = {day: seconds for _u, day, seconds, _g in focus}

    rows = []
    for offset in range(0, days, 7):
        window = [(start + timedelta(days=offset + n)).isoformat()
                  for n in range(7) if offset + n < days]
        day = window[-1]
        worked = [d for d in window if xp_by_day.get(d)]
        if not worked:
            continue

        xp = sum(xp_by_day.get(d, 0) for d in worked) / len(window)
        pairs = [p for d in window for p in rated.get(d, [])]
        flags = [f for d in window for f in ontime.get(d, [])]
        hours = sum(focus_by_day.get(d, 0) for d in worked) / 3600.0

        scores = {
            'productivity': min(100, round(xp / goal * 100)),
            'consistency': round(len(worked) / len(window) * 100),
            'quality': min(100, round(
                sum(e for _d, e in pairs) / len(pairs) / 5 * 100)) if pairs else 0,
            'efficiency': round(sum(flags) / len(flags) * 100) if flags else 0,
            'focus': min(100, round(hours / (len(window) * 2.0) * 100)),
        }
        scores['overall'] = round(sum(scores.values()) / len(scores))

        for metric, score in scores.items():
            rows.append((user, day, metric, score, grade_for_score(score), '{}'))
    return rows


# --------------------------------------------------------------------------
# Writing
# --------------------------------------------------------------------------
TASK_COLUMNS = (
    'id, user_id, title, description, priority, status, xp_value, subject,'
    ' due_date, show_on_calendar, created_at, completed_at, completion_seconds,'
    ' met_deadline, difficulty, execution'
)


#: seed_year.py's window. Not this script's to write, but very much this
#: script's problem: both draw on the same calendar, and a real timetable with
#: an invented one laid over it is two Wednesdays at once. Cleared by default
#: because the two cannot both be Alpha's week; `--keep-seed-year` says
#: otherwise for anyone who wants the density rather than the timetable.
SEED_YEAR_LOW, SEED_YEAR_HIGH = '1000000000000', '1099999999999'


def clear(con, user: str, ahead_from: date, behind_to: date,
          keep_seed_year: bool = False) -> int:
    """Everything this script has ever written for `user`, and nothing else."""
    gone = con.execute('DELETE FROM tasks WHERE ' + OWNED, owned_args(user)).rowcount
    if not keep_seed_year:
        gone += con.execute(
            'DELETE FROM tasks WHERE user_id = ? AND id >= ? AND id <= ?'
            ' AND length(id) = 13', (user, SEED_YEAR_LOW, SEED_YEAR_HIGH)).rowcount
    gone += con.execute('DELETE FROM xp_events WHERE ' + OWNED, owned_args(user)).rowcount
    # Bounded on both sides, and to the window each table is written in.
    for table in ('focus_days', 'metric_snapshots'):
        gone += con.execute(
            'DELETE FROM {} WHERE user_id = ? AND date BETWEEN ? AND ?'.format(table),
            (user, WRITTEN_SINCE, behind_to.isoformat())).rowcount
    # The notes are the year ahead rather than the year behind, so they are the
    # one range measured from today. A --clear run on a later day leaves the
    # few days it has since walked past; they are notes on a calendar, and the
    # alternative is a DELETE with no upper bound, which is what this whole
    # note is about.
    gone += con.execute(
        'DELETE FROM day_focus_notes WHERE user_id = ? AND date BETWEEN ? AND ?',
        (user, ahead_from.isoformat(),
         (ahead_from + timedelta(days=364)).isoformat())).rowcount
    return gone


#: The earliest date any version of this script has written a focus day or a
#: report-card row to, and therefore the floor on what it may delete.
#:
#: Those two tables are keyed by (user, date) and carry no id, so unlike tasks
#: and the ledger there is no mark saying which rows are this script's — the
#: date range *is* the mark. It was `>= BEHIND_FROM` with no upper bound to
#: begin with, which read as "everything from the year I write onwards" and
#: deleted the account's real focus history and every report card the app
#: itself had recorded since. A seeding script may overwrite what it wrote; it
#: may not take the record with it on the way past. So the delete stays bounded
#: on both sides: this floor below, and the run's own last written day above.
WRITTEN_SINCE = '2024-09-07'


def behind_window(today: date) -> tuple[date, date]:
    """The year of record: the 365 days ending yesterday.

    Measured from today rather than frozen into the file. The window used to be
    a pair of literals, and a literal year of record is only correct for the
    twelve months after it is typed — a year later the account has a full
    history that stops dead a year ago, every "this week" panel in the app
    reads empty, and the seed looks like a bug in the app rather than a stale
    constant. It ends yesterday because today belongs to the year *ahead*: the
    calendar's blocks for today are things still to do, and a day cannot
    sensibly be both already lived and still coming.
    """
    last = today - timedelta(days=1)
    return last - timedelta(days=364), last


def streaks(tasks, last_day: date):
    """The streak the written record implies: the run ending `last_day`, and the best.

    The account's streak is a stored counter, not something the app derives on
    read — `current_streak` is bumped as tasks are finished and reset once a
    whole day passes without one. A seed that writes a year of finished work and
    leaves that counter alone therefore produces an account with a year of
    daily effort behind it and a streak of zero on the front page, which reads
    as a broken app rather than as a seeded one. So the counter is written from
    the same rows the rest of the account is written from.

    The current run has to end on the last day written: the record stops
    yesterday, and a streak that ended a week before that is a streak the app
    would have already dropped to zero.
    """
    worked = {row[11][:10] for row in tasks}

    current = 0
    day = last_day
    while day.isoformat() in worked:
        current += 1
        day -= timedelta(days=1)

    best = run = 0
    previous = None
    for iso_day in sorted(worked):
        this = date.fromisoformat(iso_day)
        run = run + 1 if previous and (this - previous).days == 1 else 1
        best = max(best, run)
        previous = this

    return current, max(best, current)


def top_up(con, user: str, target: int, before: str):
    """Raise the ledger to `target` across days the account already worked.

    Alpha's early record was written thinly — 92 XP a day against its own
    300-a-day goal — so the shortfall to a level worth showing is not an
    invention, it is the difference between a seeded account and a lived one.
    It is spread over the days that already have something on them, so no day
    appears that the account did not turn up for, and the consistency figures
    do not move.

    `tasks_completed = 0` on these rows: they add XP and claim no tasks, which
    is what keeps the ledger's task count equal to the tasks that exist.
    """
    total = con.execute(
        'SELECT COALESCE(SUM(amount), 0) FROM xp_events WHERE user_id = ?',
        (user,)).fetchone()[0]
    short = target - total
    if short <= 0:
        return 0, total

    days = [row[0] for row in con.execute(
        'SELECT DISTINCT date(timestamp) FROM xp_events'
        ' WHERE user_id = ? AND date(timestamp) < ? ORDER BY 1', (user, before))]
    if not days:
        return 0, total

    each, spare = divmod(short, len(days))
    rows = []
    for at, day in enumerate(days):
        amount = each + (1 if at < spare else 0)
        if amount <= 0:
            continue
        rows.append((str(EVENT_BASE + 10_000_000 + at), user, amount,
                     'daily_xp', '{}T20:00:00'.format(day), day, 0, 0))
    con.executemany(
        'INSERT INTO xp_events (id, user_id, amount, reason, timestamp, date,'
        ' tasks_completed, avg_task_xp) VALUES (?,?,?,?,?,?,?,?)', rows)
    return short, target


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--user', default='Alpha')
    ap.add_argument('--clear', action='store_true')
    ap.add_argument('--seed', type=int, default=20260907)
    ap.add_argument('--keep-seed-year', action='store_true',
                    help="leave seed_year.py's rows on the calendar")
    ap.add_argument('--level', type=int, default=100,
                    help='level to bring the account to (default 100)')
    args = ap.parse_args()

    rng = random.Random(args.seed)
    today = date.today()
    ahead_from = today
    behind_from, behind_to = behind_window(today)
    behind_days = (behind_to - behind_from).days + 1

    con = sqlite3.connect(DB)
    con.execute('PRAGMA foreign_keys = ON')
    try:
        with con:
            gone = clear(con, args.user, ahead_from, behind_to,
                         keep_seed_year=args.keep_seed_year)
            if args.clear:
                # `users.xp` is the ledger's sum and nothing else, so taking
                # rows out of the ledger has to put the row back in step.
                left = con.execute(
                    'SELECT COALESCE(SUM(amount), 0),'
                    ' COALESCE(SUM(COALESCE(tasks_completed, 1)), 0)'
                    ' FROM xp_events WHERE user_id = ?', (args.user,)).fetchone()
                # The streak counter is written from the record too, so it
                # comes back out with it rather than being left standing over
                # a year of work that is no longer there.
                con.execute(
                    'UPDATE users SET xp = ?, level = ?, tasks_completed = ?,'
                    ' current_streak = 0, day_state = ? WHERE username = ?',
                    (left[0], level_for_total_xp(left[0])['level'], left[1],
                     'newday', args.user))
                print('{}: removed {} rows, ledger back to {:,} XP'.format(
                    args.user, gone, left[0]))
                return

            ahead = forward_rows(args.user, ahead_from, 365, TASK_BASE)
            behind = behind_rows(args.user, behind_from, behind_days,
                                 TASK_BASE + 1_000_000, rng)
            con.executemany(
                'INSERT INTO tasks ({}) VALUES ({})'.format(
                    TASK_COLUMNS, ','.join('?' * 16)), ahead + behind)

            # One ledger row per finished task, carrying the same XP and the
            # same day — the ledger is what the analytics pages count from, so
            # a finished task without one is work the app cannot see.
            events = [
                (str(EVENT_BASE + at), args.user, row[6], 'task_completion',
                 row[11], row[11][:10], 1, row[6])
                for at, row in enumerate(behind)
            ]
            con.executemany(
                'INSERT INTO xp_events (id, user_id, amount, reason, timestamp,'
                ' date, tasks_completed, avg_task_xp) VALUES (?,?,?,?,?,?,?,?)',
                events)

            notes = focus_notes(args.user, ahead_from, 365)
            con.executemany(
                'INSERT OR REPLACE INTO day_focus_notes (user_id, date, text)'
                ' VALUES (?,?,?)', notes)

            focus = focus_sessions(args.user, behind, rng)
            con.executemany(
                'INSERT OR REPLACE INTO focus_days (user_id, date, seconds,'
                ' goal_hours) VALUES (?,?,?,?)', focus)

            cards = snapshots(args.user, behind, focus, behind_from, behind_days)
            con.executemany(
                'INSERT OR REPLACE INTO metric_snapshots (user_id, date, metric,'
                ' score, grade, detail) VALUES (?,?,?,?,?,?)', cards)

            # Level N costs N * 100, so the band for a level is 10,000 wide at
            # 100. Aim at the middle of it rather than the floor: a later task
            # finished in the app should not tip the account back a level.
            floor = 100 * (args.level - 1) * args.level // 2
            added, total = top_up(con, args.user, floor + 4_000,
                                  behind_from.isoformat())

            ledger = con.execute(
                'SELECT COALESCE(SUM(amount), 0), COALESCE(SUM(COALESCE(tasks_completed, 1)), 0)'
                ' FROM xp_events WHERE user_id = ?', (args.user,)).fetchone()
            levels = level_for_total_xp(ledger[0])
            # The streak the year behind implies, alongside the ledger it
            # implies — both are stored counters, and both have to agree with
            # the rows underneath them.
            run, best = streaks(behind, behind_to)
            con.execute(
                'UPDATE users SET xp = ?, level = ?, tasks_completed = ?,'
                ' daily_goal = 300, current_streak = ?, best_streak = ?,'
                ' last_task_date = ?, day_state = ? WHERE username = ?',
                (ledger[0], levels['level'], ledger[1], run, best,
                 behind_to.isoformat(), 'newday', args.user))

        print('{}: cleared {}, wrote {} ahead + {} behind'.format(
            args.user, gone, len(ahead), len(behind)))
        print('  {} focus notes, {} focus days, {} report-card rows'.format(
            len(notes), len(focus), len(cards)))
        print('  ledger {:,} XP ({:,} topped up) -> level {}'.format(
            ledger[0], added, levels['level']))
        print('  record {} to {}, streak {} (best {})'.format(
            behind_from, behind_to, run, best))
    finally:
        con.close()


if __name__ == '__main__':
    main()
