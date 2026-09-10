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

**The year ahead** (`WEEK`) is the timetable as calendar blocks: the lectures
and sections of the two majors, the research the doctorate is made of, and —
just as timetabled — the violin, the training, the meals with other people and
the two mornings that start in cold water. They are `todo` and they earn
nothing yet, which is the point of a calendar: they are what is going to
happen, and the XP on them is what finishing one will be worth.

**The year behind** is the same week already lived: every block finished, plus
the study that fills an evening, each carrying a subject, a difficulty and an
execution rating so the quality grid and the subject split have something real
underneath them. The focus timer and the report card are written to match, day
by day, so the Growth tab has two comparable years rather than one year and a
blank.

**The level.** Alpha is meant to read as an account five years deep, and its
ledger said 92 XP a day against its own daily goal — the arithmetic of an
account that was seeded thinly, not of a person. The shortfall to level 100 is
spread back across the days it already worked, which leaves every individual
day plausible. The ledger stays the authority: `users.xp` is recomputed from it
at the end, never set beside it.

## Who Alpha is

A machine-learning and mathematics double major on a PhD track at a college
that is hard to get into, in the year the thesis starts. That is a specific
person and it has to be, because a seed is an argument about what this app is
for: every panel in it is drawn from somebody's record, and a record with only
work in it produces a set of pages that can say nothing except that its owner
worked.

So the week is rigorous *and* it is coloured. Math 55, analysis and algebra on
one side; machine learning, algorithms and statistical learning on the other;
a lab meeting, an advisor, a reading group and a thesis block for the part
that is not coursework. And then the violin on Wednesday and the orchestra on
Monday, lifting three mornings and running two, lunch with the lab, dinner out
on Friday, a long run with friends on Saturday, and the ice baths and the
sitting still that are what make the rest of it survivable.

The second half is not decoration. The Habits tab looks for recurring
behaviour, the Insights tab looks for what conditions the better work shows up
under, and both of them need something to find that is not another problem
set — `NOT_STUDY` below is where that distinction is actually drawn.
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
#: Roughly what a day on this week is worth, and therefore the account's goal.
#:
#: One name for a number that was written twice — once as the target stored on
#: the account and once as the divisor the report card scores productivity
#: against — which is two places for the same fact and one of them free to
#: drift.
#:
#: It is 450 rather than the 300 it was, and that is a fix rather than a
#: preference. The timetable plus an evening comes to something like 470 XP on
#: a working day, so against 300 the productivity score was `min(100, 157)` on
#: every single week of the year: a metric that cannot move is a flat line on a
#: chart and a grade that means nothing. At 450 a good week and a thin one are
#: different numbers, which is the whole reason the chart is drawn.
DAILY_GOAL = 450

#: The week, as (weekday, title, subject, start, end, xp, is_deliberate_study).
#:
#: Monday is 0. The last field is what tells attendance from work — see
#: `ATTENDANCE` below — and it is a flag rather than an inference from the
#: subject, because a machine-learning lecture *is* machine learning and
#: sitting in one is still not an hour of focus.
#:
#: Read down a day and it should look like a day somebody actually has: a sit
#: and a session before it is light, lectures through the middle, the research
#: and the seminars in the afternoon, and the evening spoken for by a person
#: rather than by the degree. That last part is the half that was missing. A
#: week of nothing but lectures and problem sets is not what a rigorous year
#: looks like, it is what one looks like from the outside — and an account
#: seeded that way has nothing to say on the Habits tab except that its owner
#: works, which is the one thing the tab could already see.
WEEK = (
    # ---- Mathematics, the first of the two majors -------------------------
    # Math 55 three mornings a week is the spine of the degree; analysis and
    # algebra are the other two lectures the major actually costs.
    (0, 'Math 55 lecture', 'mathematics', '09:00', '10:30', 45, False),
    (2, 'Math 55 lecture', 'mathematics', '09:00', '10:30', 45, False),
    (4, 'Math 55 lecture', 'mathematics', '09:00', '10:30', 45, False),
    (1, 'Real analysis lecture', 'mathematics', '09:00', '10:15', 45, False),
    (3, 'Abstract algebra lecture', 'algebra', '09:00', '10:15', 45, False),
    (1, 'Math 55 section', 'mathematics', '16:00', '17:00', 35, True),

    # Monday hands the Putnam problems out and Thursday takes the week's
    # attempt apart. Two halves of one thing, three days apart on purpose.
    (0, 'Putnam seminar', 'mathematics', '17:30', '19:00', 55, True),
    (3, 'Putnam problem session', 'mathematics', '19:00', '20:30', 55, True),

    # ---- Machine learning, the second ------------------------------------
    (0, 'Machine Learning lecture', 'machine_learning', '11:00', '12:30', 45, False),
    (2, 'Machine Learning lecture', 'machine_learning', '11:00', '12:30', 45, False),
    (1, 'Algorithms lecture', 'computer_science', '10:30', '12:00', 45, False),
    (3, 'Algorithms lecture', 'computer_science', '10:30', '12:00', 45, False),
    (4, 'Statistical learning lecture', 'statistics', '11:00', '12:15', 45, False),
    (3, 'ML lab', 'machine_learning', '15:00', '17:00', 60, True),

    # ---- The doctorate this is all pointed at -----------------------------
    # The part that is not coursework, and the part an undergraduate on a PhD
    # track spends their credibility on: a group to sit in, an advisor to
    # answer to, a literature to keep up with, and a thesis that is written in
    # blocks or not at all.
    (1, 'Lab meeting', 'research', '14:00', '15:00', 30, False),
    (2, 'Paper reading group', 'research', '15:00', '16:00', 45, True),
    (4, 'Advisor meeting', 'research', '13:00', '13:45', 30, False),
    (4, 'Thesis writing block', 'thesis', '14:00', '16:00', 65, True),

    # ---- The violin, which is not the degree and not negotiable -----------
    (2, 'Violin lesson', 'music', '18:00', '19:00', 40, True),
    (0, 'Orchestra rehearsal', 'music', '19:30', '21:00', 40, True),

    # ---- Training ---------------------------------------------------------
    *[(d, 'Lift', 'gym', '07:30', '08:30', 25, False) for d in (0, 2, 4)],
    *[(d, 'Morning run', 'running', '07:30', '08:15', 20, False) for d in (1, 3)],

    # ---- The head, either end of the day ----------------------------------
    *[(d, 'Morning meditation', 'meditation', '06:45', '07:10', 12, False)
      for d in range(5)],
    *[(d, 'Evening review', 'planning', '22:00', '22:20', 10, False)
      for d in range(5)],

    # ---- People ------------------------------------------------------------
    # Two standing appointments with other human beings, on the calendar for
    # the same reason the lectures are: what is not timetabled does not happen
    # in a week this full.
    (1, 'Lunch with the lab', 'friends', '12:15', '13:00', 12, False),
    (4, 'Dinner out with friends', 'friends', '19:30', '21:30', 20, False),

    # ---- The weekend -------------------------------------------------------
    # It used to be empty, which said that Saturday and Sunday were whatever
    # was left over. They are the recovery this week is affordable *because*
    # of, so they are timetabled like everything else.
    (5, 'Long run with friends', 'running', '08:30', '10:00', 30, False),
    (5, 'Ice bath', 'health', '10:30', '10:50', 15, False),
    (5, 'Brunch out', 'friends', '11:30', '13:00', 15, False),
    (6, 'Long meditation sit', 'meditation', '08:30', '09:15', 20, False),
    (6, 'Ice bath', 'health', '09:30', '09:50', 15, False),
    (6, 'Sunday reset', 'planning', '18:00', '18:45', 20, False),
)

#: The day's subject, written onto the calendar as its Focus note.
#:
#: Tied to what the day actually holds rather than rotated for variety: Monday
#: and Thursday are the Putnam seminar and its problem session, Wednesday is
#: the reading group and the violin, Friday is the thesis. The weekend names
#: what the weekend is for, which on this timetable is people and recovery
#: rather than a sixth and seventh working day.
FOCUS_DAYS = {
    0: ('Putnam',),
    1: ('Algorithms', 'Analysis'),
    2: ('Machine learning',),
    3: ('Putnam', 'ML lab'),
    4: ('Thesis',),
    5: ('Friends and training', 'Deep work'),
    6: ('Rest and reset', 'Reading'),
}

# --------------------------------------------------------------------------
# The study that fills the year behind
# --------------------------------------------------------------------------
# (title, subject, minutes, xp). Drawn from to top a finished day up to
# something like a real one — the timetable alone is a little over 200 XP on an
# average weekday, and somebody taking this year seriously is closer to 470.
#
# Weighted toward the four things the evenings actually go on — the problem
# sets, the research, the model that is training, and the violin — and then
# deliberately not only those. Three of the eighteen are other people and two
# are recovery, which is roughly the true ratio for somebody who is doing this
# well rather than doing it until they stop.
EVENING = (
    ('Math 55 problem set', 'mathematics', 120, 110),
    ('Analysis problem set', 'mathematics', 90, 90),
    ('Putnam problems', 'mathematics', 90, 90),
    ('Algorithms problem set', 'computer_science', 90, 85),
    ('Thesis experiments', 'thesis', 90, 90),
    ('Paper replication', 'research', 75, 75),
    ('ML paper reading', 'machine_learning', 60, 60),
    ('Training run + writeup', 'machine_learning', 75, 70),
    ('Model debugging', 'machine_learning', 60, 55),
    ('LeetCode session', 'programming', 60, 55),
    ('Kaggle notebook', 'data_science', 90, 80),
    ('Violin practice', 'music', 45, 40),
    ('Climbing with friends', 'friends', 90, 30),
    ('Board game night', 'friends', 90, 25),
    ('Cooking with housemates', 'cooking', 60, 20),
    ('Evening walk', 'health', 30, 15),
    ('Journalling', 'journaling', 20, 15),
    ('Flashcards', 'flashcards', 20, 20),
)

# The weekend pool. Longer sessions, because two unbroken days is what a Putnam
# mock and a training run need — and a larger share of it is not work at all,
# which is the difference between a weekend and a Wednesday.
WEEKEND = (
    ('Putnam mock', 'mathematics', 240, 180),
    ('Analysis proof grinding', 'mathematics', 150, 130),
    ('Thesis writing', 'thesis', 180, 150),
    ('Research reading', 'research', 120, 100),
    ('ML project training', 'machine_learning', 150, 130),
    ('Open source contribution', 'programming', 120, 110),
    ('Long violin practice', 'music', 90, 70),
    ('Reading', 'reading', 60, 40),
    ('Long lift session', 'gym', 75, 45),
    ('Ice bath and sauna', 'health', 40, 20),
    ('Long meditation', 'meditation', 60, 30),
    ('Hike with friends', 'friends', 180, 45),
    ('Brunch with friends', 'friends', 90, 25),
    ('Cooking a proper meal', 'cooking', 75, 25),
    ('Chores', 'chores', 45, 25),
    ('Laundry and reset', 'laundry', 45, 20),
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

        # Two kinds of day that are not a working day, and they are not the
        # same thing.
        #
        # This used to be one: a 13% chance of the day being skipped outright,
        # no rows at all. That was right when the week was nothing but
        # lectures and problem sets — a day off from a week like that really is
        # an empty day. It is wrong now. Somebody who lifts three mornings,
        # sits for twenty minutes before it is light and gets in cold water on
        # a Saturday does not stop doing those because they are not working;
        # those *are* the rest day. Modelling one as a hole in the record made
        # the app say the account had not turned up at all, and the streak on
        # the front page came out at 1 against a year of daily effort.
        #
        # So: a rest day keeps everything on the timetable that was never work
        # — see `NOT_STUDY`, which is the line this reads — and drops the
        # lectures, the seminars and the evening. Roughly one day in eight.
        #
        # A day *away* is the rarer thing and stays a genuine hole: travel,
        # illness, the weekend somebody actually leaves. One day in
        # twenty-five, which is what leaves the streak worth looking at and the
        # consistency score something other than a flat hundred.
        roll = rng.random()
        if roll < 0.04:
            continue
        resting = roll < 0.16

        for weekday, title, subject, begin, end, xp, _study in WEEK:
            if day.weekday() != weekday:
                continue
            if resting and subject not in NOT_STUDY:
                continue
            finish(day, title, subject, begin,
                   minutes(end) - minutes(begin), xp, 1)

        if resting:
            continue

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
#:
#: The evening and weekend pools carry no flag of their own, so this is the
#: only thing standing between them and the focus figures. It used to be three
#: names because the week held almost nothing but work; now that it holds a
#: life, the list is the whole of that life. An hour in an ice bath, an hour
#: with friends and an hour of sitting still are all worth XP and all belong on
#: the record — and not one of them is an hour of focus, which is the figure
#: the app reports as time spent studying.
#:
#: `reading` is deliberately *not* here. Reading a book is study in the sense
#: this app means; lying in cold water is not.
NOT_STUDY = frozenset((
    'planning', 'chores', 'laundry', 'cooking',
    'gym', 'running', 'health', 'meditation',
    'friends', 'journaling',
))


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
    goal = float(DAILY_GOAL)
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
                ' daily_goal = ?, current_streak = ?, best_streak = ?,'
                ' last_task_date = ?, day_state = ? WHERE username = ?',
                (ledger[0], levels['level'], ledger[1], DAILY_GOAL, run, best,
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
