"""Seed a year of an account's calendar and task list.

Written for demos and for looking at the app with a real amount of work in it.
Every page in Ascen is shaped by what is on the list — the horizon, the
groupings, the sparklines, the week grid, the XP figures — and all of them read
differently against ten rows than against a life. An account with a year in
front of it is the only way to see what those views actually do.

## What it writes

Tasks, and only tasks. The calendar is not a second store: it draws whatever
carries `show_on_calendar`, taking `created_at` as the start of the block and
`due_date` as its end (see frontend/hooks/useCalendarTasks and
`plannedSeconds` in components/Tasks/board.ts). So a timed block on the grid
and an untimed to-do on the Tasks page are the same row with that one flag
different, and this writes both:

    show_on_calendar = 1   a block, start -> end, drawn on the week and month
    show_on_calendar = 0   a to-do, due that day, never on the grid

`calendar_events` holds only the four built-in session bands and is left
alone.

## The shape of the year

One person: an AI engineer who also runs the marketing, with a family. The
rhythm is theirs rather than a spread of random rows — mornings are for the
model and the inbox, afternoons for campaigns and the people who need an hour,
evenings belong to the house, and the weekend is family with a little side
project in it. Three kinds of entry make that up:

  * daily and weekday recurrences, the spine of the week;
  * weekly and monthly recurrences, the rhythm on top of it — Monday planning,
    Friday retro and newsletter, month-end invoices, the metrics deck;
  * one-offs, scattered across the year: launches, a conference talk, school
    plays, birthdays, two holidays, a performance review.

## The XP floor

Every day is topped up to at least `--min-xp` of open XP. The top-up is drawn
from real work rather than a filler row with a number on it, so a day that
came up short gets another thing this person would plausibly be doing.

## Running it

    python3 scripts/seed_year.py --user Alpha

Idempotent by tag: every row it writes carries a marker in `description`, and
a re-run clears the previous run's rows for that user and window first, so
this can be run repeatedly without stacking. `--clear` removes them and stops.
"""
from __future__ import annotations

import argparse
import os
import random
import sqlite3
import sys
from datetime import date, datetime, timedelta

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'ascen.db')

# How a re-run finds its own work, and nothing else.
#
# This used to be a marker string written into `description`. That was visible:
# `description` is a real field on a real task, the Tasks page searches it
# along with the title, and every row this wrote carried "[seeded:year]" in a
# column the account is entitled to use for its own notes. A bookkeeping mark
# does not belong in the data it is keeping book on.
#
# So the mark is the id instead. `db.new_id` (backend/database/connection.py)
# hands out the current millisecond, which since 2001 has been a 13-digit
# number starting 1.0e12 and today is 1.79e12 and climbing. The window below
# is therefore reserved by construction: it is 13 digits, it sorts and
# compares as one, and no clock will ever land in it again. Ids are never
# shown to anyone, so nothing about the mark reaches the account.
SEED_ID_LOW = '1000000000000'
SEED_ID_HIGH = '1099999999999'

# The old marker, cleared on the next run so the rows it wrote lose it.
LEGACY_TAG = '[seeded:year]'

# What `description` gets now: the same empty string every other task carries
# when nobody wrote a note on it.
TAG = ''

# The WHERE clause matching rows this script owns.
OWNED = (
    "user_id = ? AND ("
    " (id >= ? AND id <= ? AND length(id) = 13)"
    " OR description = ?"
    ")"
)
OWNED_ARGS = lambda user: (user, SEED_ID_LOW, SEED_ID_HIGH, LEGACY_TAG)

# ---------------------------------------------------------------------------
# The week
# ---------------------------------------------------------------------------
# (start, end, title, subject, priority, xp, days)  — days as weekday numbers,
# Monday 0. Times are local and a block ends the same day it starts.
WEEKDAYS = (0, 1, 2, 3, 4)
WEEKEND = (5, 6)
ALL_DAYS = (0, 1, 2, 3, 4, 5, 6)

DEEP_WORK = [
    'Deep work — eval harness for the ranking model',
    'Deep work — retrieval quality pass',
    'Deep work — fine-tune run + error analysis',
    'Deep work — prompt regression suite',
    'Deep work — inference latency profiling',
    'Deep work — feature store cleanup',
    'Deep work — embedding refresh pipeline',
    'Deep work — guardrails and refusal tests',
]
MARKETING = [
    'Campaign — lifecycle email sequence',
    'Campaign — paid search creative refresh',
    'Campaign — landing page copy test',
    'Campaign — case study draft',
    'Campaign — webinar promo plan',
    'Campaign — SEO cluster for "AI evals"',
    'Campaign — partner co-marketing brief',
    'Campaign — pricing page rewrite',
]
BUILD = [
    'Ship — dashboard for model drift',
    'Ship — attribution reporting fix',
    'Ship — onboarding flow instrumentation',
    'Ship — A/B test framework tidy-up',
    'Ship — data warehouse sync job',
    'Ship — customer feedback tagging',
]
MEETINGS = [
    'Customer call — enterprise pilot',
    'Product sync with design',
    'Sales enablement session',
    'Investor update call',
    'Vendor review — annotation tooling',
    'Hiring loop — ML engineer',
]
READING = [
    'Read — new papers from the week',
    'Read — competitor teardown',
    'Read — long-form on positioning',
    'Read — with the kids',
]

# Blocks that go on the calendar.
#
# The weekday afternoon slots deliberately skip the day their weekly beat owns:
# Thursday's blog post *is* that afternoon's marketing block, Wednesday's 1:1s
# are that afternoon's meeting, and Friday's retro and newsletter are that
# afternoon's build slot. Stacking them instead of swapping them drew two
# blocks over the same hour, which on the week grid is not a busy day — it is
# two rectangles on top of each other.
BLOCKS = [
    # (start, end, title-or-pool, subject, priority, xp, days)
    ('06:45', '07:30', 'Morning run',                  'running',         'medium',  40, (0, 2, 4)),
    ('07:30', '08:15', 'Gym — strength',               'gym',             'medium',  45, (1, 3)),
    ('08:15', '08:45', 'School run',                   'family',          'high',    30, WEEKDAYS),
    ('09:00', '09:15', 'Team standup',                 'meetings',        'medium',  20, WEEKDAYS),
    ('09:15', '11:30', DEEP_WORK,                      'machine_learning','high',   130, WEEKDAYS),
    ('11:30', '12:15', 'Inbox and Slack triage',       'email',           'low',     35, WEEKDAYS),
    ('13:00', '14:30', MARKETING,                      'marketing',       'high',    95, (0, 1, 2, 4)),
    ('14:30', '15:30', MEETINGS,                       'meetings',        'medium',  55, (0, 1, 3, 4)),
    ('15:30', '17:00', BUILD,                          'programming',     'high',   100, (0, 1, 2, 3)),
    ('17:30', '18:30', 'Family dinner',                'family',          'high',    40, ALL_DAYS),
    ('18:30', '19:15', 'Homework help',                'family',          'medium',  35, WEEKDAYS),
    ('19:15', '19:45', 'Bedtime stories',              'family',          'medium',  25, ALL_DAYS),
    ('21:00', '21:45', READING,                        'reading',         'low',     40, (0, 1, 2, 3, 6)),
    # Saturday
    ('09:00', '10:30', 'Family outing',                'family',          'high',    60, (5,)),
    ('11:00', '12:00', 'House and chores',             'chores',          'low',     30, (5,)),
    ('14:00', '15:30', 'Side project — personal site', 'web_design',      'low',     55, (5,)),
    ('16:00', '17:00', 'Kids swimming lesson',         'family',          'medium',  35, (5,)),
    ('20:00', '21:30', 'Film night with the family',   'film',            'low',     30, (5,)),
    # Sunday
    ('08:30', '09:30', 'Long run',                     'running',         'medium',  45, (6,)),
    ('10:00', '11:00', 'Meal prep for the week',       'cooking',         'medium',  35, (6,)),
    ('11:30', '12:30', 'Grocery run',                  'groceries',       'low',     25, (6,)),
    ('13:00', '14:30', 'Family time — park or museum', 'family',          'high',    55, (6,)),
    ('16:00', '17:00', 'Week review and plan',         'planning',        'high',    60, (6,)),
    ('19:45', '20:30', 'Clear the inbox for Monday',   'email',           'low',     30, (6,)),
]

# Weekly beats. Each one owns its slot — see the note on BLOCKS.
WEEKLY = [
    (0, '08:45', '09:00', 'Set the week — three outcomes', 'planning',   'high',   45),
    (2, '14:30', '15:30', '1:1s with the team',            'management', 'medium', 55),
    (3, '13:00', '14:30', 'Write the weekly blog post',    'writing',    'high',   90),
    (4, '15:30', '16:15', 'Sprint retro',                  'meetings',   'medium', 45),
    (4, '16:15', '17:00', 'Send the newsletter',           'marketing',  'high',   70),
]

# Monthly beats, placed in the lunch hour or the evening so they do not land on
# top of the working blocks the rest of the month keeps.
MONTHLY = [
    (1,  '12:15', '13:00', 'Invoices and expenses',        'finance',   'high',   80),
    (12, '12:15', '13:00', 'Monthly metrics deck',         'reports',   'high',   95),
    (18, '19:45', '21:00', 'Date night',                   'family',    'high',   50),
    (25, '20:00', '21:00', 'Household admin and bills',    'admin',     'medium', 40),
]

# Untimed to-dos — the Tasks page list, never on the grid.
TODOS = [
    ('Review open pull requests',           'programming',      'medium', 35),
    ('Reply to customer questions',         'email',            'medium', 30),
    ('Draft ad copy variants',              'marketing',        'medium', 40),
    ('Update the model card',               'machine_learning', 'low',    30),
    ('Check ad spend pacing',               'marketing',        'medium', 25),
    ('Tidy the analytics dashboard',        'data_science',     'low',    30),
    ('Book the dentist',                    'health',           'low',    15),
    ('Plan the kids weekend activity',      'family',           'medium', 25),
    ('Refill the pantry list',              'groceries',        'low',    15),
    ('Log the week in the journal',         'journaling',       'low',    20),
    ('Follow up with the design contractor','design',           'medium', 30),
    ('Sort receipts for the accountant',    'accounting',       'low',    25),
]

# One-offs across the year: (month-offset, day-of-month, title, subject, priority, xp, hours)
# `hours` is None for an untimed to-do, or (start, end) for a block.
ONE_OFFS = [
    (0,  27, 'Launch — v2 recommendations to 10% of traffic', 'machine_learning', 'high', 180, ('09:00', '12:00')),
    (1,   9, 'Conference talk — "Evals that survive prod"',   'presenting',       'high', 200, ('14:00', '15:30')),
    (1,  22, "School play — Maya's class",                    'family',           'high',  60, ('18:00', '19:30')),
    (2,   5, 'Quarterly board deck',                          'reports',          'high', 150, ('09:00', '12:00')),
    (2,  17, 'Performance reviews for the team',              'management',       'high', 120, ('13:00', '16:00')),
    (3,   3, 'Family holiday — flights and rentals booked',   'travel',           'high',  70, None),
    (3,  14, 'Rebrand kickoff workshop',                      'design',           'high', 140, ('10:00', '13:00')),
    (4,   8, "Ben's birthday party",                          'family',           'high',  80, ('14:00', '17:00')),
    (4,  21, 'Annual pricing review',                         'finance',          'high', 110, ('09:30', '11:30')),
    (5,   6, 'Open-source the eval toolkit',                  'programming',      'high', 160, ('09:00', '12:00')),
    (5,  19, 'Parent-teacher evening',                        'family',           'medium',50, ('17:30', '19:00')),
    (6,   2, 'Summer campaign — big push planning',           'marketing',        'high', 130, ('09:00', '11:30')),
    (6,  15, 'Two weeks off — out of office',                 'travel',           'high',  90, None),
    (7,   9, 'Hiring — close the ML engineer role',           'interviews',       'high', 100, ('10:00', '12:00')),
    (7,  24, 'Website replatform go-live',                    'web_design',       'high', 170, ('08:00', '12:00')),
    (8,  11, 'Customer advisory board',                       'meetings',         'high', 120, ('13:00', '16:00')),
    (8,  26, 'School term starts — supplies and forms',       'family',           'medium',45, None),
    (9,   7, 'Annual security review',                        'cybersecurity',    'high', 110, ('09:00', '11:00')),
    (9,  20, 'Marketing plan for next year',                  'planning',         'high', 140, ('13:00', '16:00')),
    (10,  4, 'Model retrain — full corpus',                   'machine_learning', 'high', 160, ('09:00', '12:00')),
    (10, 16, 'Family photos',                                 'family',           'medium', 50, ('11:00', '12:00')),
    (11,  2, 'Year in review — write it up',                  'writing',          'high', 120, ('13:00', '15:00')),
    (11, 15, 'Holiday shopping',                              'errands',          'medium', 40, None),
]


def stamp(day: date, hhmm: str) -> str:
    return f'{day.isoformat()}T{hhmm}:00'


def pick(pool, turn):
    """A title from a rotating pool.

    Stepped by the day rather than drawn at random. `rng.choice` gave the same
    deep-work topic three days running often enough to notice, which reads less
    like a person's week than like a list being shuffled. Rotating cycles the
    pool so consecutive days differ and the whole pool is used.
    """
    return pool[turn % len(pool)] if isinstance(pool, list) else pool


def minutes(hhmm: str) -> int:
    h, m = hhmm.split(':')
    return int(h) * 60 + int(m)


def build(user: str, start: date, days: int, min_xp: int, seed: int):
    rng = random.Random(seed)
    rows = []
    base = int(SEED_ID_LOW)

    def add(day, title, subject, priority, xp, span=None):
        """One task. `span` is (start, end) for a block, None for a to-do."""
        idx = len(rows)
        if span:
            created, due = stamp(day, span[0]), stamp(day, span[1])
            on_cal = 1
        else:
            # A to-do is made the morning of the day it is due and carries no
            # time, which is what an untimed row looks like everywhere else.
            created, due = stamp(day, '08:00'), day.isoformat()
            on_cal = 0
        rows.append((
            str(base + idx), user, title, TAG, priority, 'todo', int(xp),
            subject, due, on_cal, created,
        ))
        return xp

    # One-offs resolved to real dates before the year is walked, because they
    # get first claim on their hours — see the note in the day loop.
    special: dict[date, list] = {}
    for moff, dom, title, subject, priority, xp, span in ONE_OFFS:
        month = start.month - 1 + moff
        year = start.year + month // 12
        try:
            when = date(year, month % 12 + 1, dom)
        except ValueError:
            continue
        if start <= when < start + timedelta(days=days):
            special.setdefault(when, []).append((title, subject, priority, xp, span))

    for offset in range(days):
        day = start + timedelta(days=offset)
        wd = day.weekday()
        earned = 0
        # The hours already spoken for on this day, and the to-do titles
        # already on it.
        booked: list[tuple[int, int]] = []
        taken: set[str] = set()

        def block(title, subject, priority, xp, span):
            """A timed block, if its hours are still free.

            **A day is a day, and two things cannot have the same hour.** The
            one-offs are placed first and the routine fills in around them,
            because that is the direction it goes in life: the morning you ship
            v2 to 10% of traffic is not also a morning of ordinary deep work,
            and the afternoon of the conference talk is not also the afternoon
            of the campaign block. Drawn the other way the week grid showed two
            rectangles over the same hour, which does not read as a busy day —
            it reads as a bug.
            """
            s0, e0 = minutes(span[0]), minutes(span[1])
            if any(s0 < b and e0 > a for a, b in booked):
                return 0
            booked.append((s0, e0))
            return add(day, title, subject, priority, xp, span)

        def todo(entry):
            title, subject, priority, xp = entry
            if title in taken:
                return 0
            taken.add(title)
            return add(day, title, subject, priority, xp)

        # The day's own event first, then the week's shape around it.
        for title, subject, priority, xp, span in special.get(day, []):
            earned += block(title, subject, priority, xp, span) if span else todo(
                (title, subject, priority, xp))

        for wday, s, e, title, subject, priority, xp in WEEKLY:
            if wd == wday:
                earned += block(title, subject, priority, xp, (s, e))

        for dom, s, e, title, subject, priority, xp in MONTHLY:
            if day.day == dom:
                earned += block(title, subject, priority, xp, (s, e))

        for s, e, pool, subject, priority, xp, when in BLOCKS:
            if wd in when:
                earned += block(pick(pool, offset), subject, priority, xp, (s, e))

        # Two or three to-dos, varying by day so the list is not a stencil.
        for entry in rng.sample(TODOS, rng.randint(2, 3)):
            earned += todo(entry)

        # The floor, drawn from the same pool of real work rather than a filler
        # row with a number on it. Ordered by XP so a day that is barely short
        # gets one small thing rather than four.
        for entry in sorted(TODOS, key=lambda t: t[3]):
            if earned >= min_xp:
                break
            earned += todo(entry)

        # If the whole pool ran out and the day is still short, one honest
        # catch-all rather than silently missing the floor.
        if earned < min_xp:
            earned += block('Focus block — clear the backlog', 'work', 'medium',
                            min_xp - earned, ('12:15', '13:00'))
            if earned < min_xp:
                add(day, 'Focus block — clear the backlog', 'work', 'medium',
                    min_xp - earned)

    return rows


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--user', default='Alpha')
    ap.add_argument('--days', type=int, default=365)
    ap.add_argument('--min-xp', type=int, default=500)
    ap.add_argument('--seed', type=int, default=20260818)
    ap.add_argument('--from', dest='start', default=None, help='YYYY-MM-DD, default today')
    ap.add_argument('--clear', action='store_true', help='remove seeded rows and stop')
    args = ap.parse_args()

    start = date.fromisoformat(args.start) if args.start else date.today()
    con = sqlite3.connect(DB)
    try:
        gone = con.execute(
            f'DELETE FROM tasks WHERE {OWNED}', OWNED_ARGS(args.user)
        ).rowcount
        if args.clear:
            con.commit()
            print(f'removed {gone} seeded rows for {args.user}')
            return

        rows = build(args.user, start, args.days, args.min_xp, args.seed)
        con.executemany(
            'INSERT INTO tasks (id, user_id, title, description, priority, status,'
            ' xp_value, subject, due_date, show_on_calendar, created_at)'
            ' VALUES (?,?,?,?,?,?,?,?,?,?,?)', rows)
        con.commit()

        blocks = sum(1 for r in rows if r[9] == 1)
        print(f'{args.user}: replaced {gone} seeded rows with {len(rows)}')
        print(f'  {blocks} calendar blocks, {len(rows) - blocks} untimed to-dos')
        print(f'  {start} to {start + timedelta(days=args.days - 1)}')
    finally:
        con.close()


if __name__ == '__main__':
    sys.exit(main())
