"""scripts/seed_alpha.py — the timetable, and the invariants it must not break.

This one writes into a live account rather than building a fixture, so what is
worth pinning is not the shape of the week — that is a timetable, and it will
change when the timetable does — but the three things that would quietly
corrupt an account if they slipped:

  * it writes inside its own id window, and seed_year's is a different one;
  * `users.xp` is the ledger's sum, never a number set beside it;
  * the tables it cannot mark by id are deleted by a *bounded* range.

The last one is here because it was wrong. `clear` removed focus days and
report cards from the start of the year it writes *onwards*, with no upper
bound, which took the account's real focus history and every report card the
app had recorded since along with it.
"""
import os
import sys
from datetime import date, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__))), 'scripts'))

import seed_alpha  # noqa: E402
import seed_year  # noqa: E402
from backend.config.subjects import BY_ID  # noqa: E402
from backend.tracking.xp import level_for_total_xp  # noqa: E402


def test_the_two_seeders_cannot_write_over_each_other():
    """Both draw on the same calendar, so both reserve their own ids."""
    assert seed_alpha.ID_LOW > int(seed_year.SEED_ID_HIGH)
    assert len(str(seed_alpha.ID_LOW)) == len(str(seed_alpha.ID_HIGH)) == 13


def test_the_id_blocks_inside_the_window_do_not_meet():
    """Tasks and ledger rows share the window and must not share an id."""
    assert seed_alpha.TASK_BASE < seed_alpha.EVENT_BASE
    # 20 billion apart: a year is a few thousand rows, so neither can reach
    # the other even if the week grew by orders of magnitude.
    assert seed_alpha.EVENT_BASE - seed_alpha.TASK_BASE >= 20_000_000_000
    assert seed_alpha.EVENT_BASE + 10_000_000 + 5_000 <= seed_alpha.ID_HIGH


def test_every_subject_on_the_timetable_is_a_real_subject():
    """A subject the catalogue does not know is a task filed under nothing —
    it drops out of the subject split and the skill trees without erroring."""
    named = (
        [row[2] for row in seed_alpha.WEEK]
        + [row[1] for row in seed_alpha.EVENING]
        + [row[1] for row in seed_alpha.WEEKEND]
    )
    unknown = sorted({s for s in named if s not in BY_ID})
    assert unknown == [], unknown


def test_the_timetable_is_the_one_that_was_asked_for():
    """The week, read back as (day, title, start, end). If the timetable
    changes this is the line to change, and changing it should be deliberate."""
    week = {(d, title, begin, end) for d, title, _s, begin, end, _x in seed_alpha.WEEK}
    for day in range(5):
        assert (day, 'Ready Up', '06:45', '07:15') in week
        assert (day, 'School', '07:30', '15:00') in week
    assert (0, 'Swimming', '18:00', '19:00') in week
    assert (2, 'Math Club', '15:00', '16:00') in week
    assert (2, 'Violin lesson', '16:30', '17:00') in week
    assert (2, 'Swimming', '18:00', '19:00') in week
    assert (3, 'SciOly Club', '15:00', '16:00') in week
    assert (4, 'Violin performance', '18:00', '19:00') in week
    # Nothing on a weekend, and nothing else on a weekday.
    assert len(seed_alpha.WEEK) == 16
    assert not [row for row in seed_alpha.WEEK if row[0] > 4]


def test_xp_rises_with_what_a_block_costs():
    """The numbers are a currency, so they have to rank the way effort does."""
    by_title = {row[1]: (row[5], seed_alpha.minutes(row[4]) - seed_alpha.minutes(row[3]))
                for row in seed_alpha.WEEK}
    assert by_title['Ready Up'][0] < by_title['Violin lesson'][0]
    assert by_title['Violin lesson'][0] < by_title['Swimming'][0]
    assert by_title['Swimming'][0] < by_title['Violin performance'][0]
    assert by_title['School'][0] == max(xp for xp, _m in by_title.values())
    for title, (xp, span) in by_title.items():
        assert xp > 0, title


def test_every_day_of_the_week_has_a_focus_subject():
    """The note is written for each of the 365 days ahead, so each weekday
    needs at least one subject to draw from."""
    assert sorted(seed_alpha.FOCUS_DAYS) == list(range(7))
    for day, choices in seed_alpha.FOCUS_DAYS.items():
        assert choices, day
        for name in choices:
            assert 0 < len(name) <= 200, name


def test_the_level_target_is_reachable_from_the_ledger():
    """The script aims at the middle of a level's band, not its floor: a task
    finished in the app afterwards must not tip the account back down."""
    floor = 100 * 99 * 100 // 2
    assert level_for_total_xp(floor)['level'] == 100
    assert level_for_total_xp(floor + 4_000)['level'] == 100
    # And the aim leaves room above it, which is the point of not using floor.
    assert level_for_total_xp(floor + 4_000 + 1_000)['level'] == 100


def test_the_bounded_windows_are_bounded():
    """The bug: an unbounded DELETE on the tables with no id to mark."""
    source = open(seed_alpha.__file__, encoding='utf-8').read()
    body = source[source.index('def clear('):source.index('def streaks(')]
    # Every delete on a date-keyed table names both ends.
    for table in ('focus_days', 'metric_snapshots', 'day_focus_notes'):
        assert table in body, table
    assert 'date >= ?' not in body, 'an unbounded date delete is back'
    assert body.count('BETWEEN ? AND ?') >= 2
    # The floor is a literal and the ceiling is the run's own last written day,
    # so the range is closed at both ends however far the calendar has moved.
    assert 'WRITTEN_SINCE' in body and 'behind_to' in body


def test_the_year_of_record_ends_yesterday():
    """It used to be a pair of literals, and a literal year of record is only
    right for the twelve months after it is typed. A year later the account's
    history stopped dead a year ago and every "this week" panel read empty."""
    for today in (date(2026, 9, 7), date(2027, 3, 1), date(2028, 2, 29)):
        start, last = seed_alpha.behind_window(today)
        assert last == today - timedelta(days=1)
        assert (last - start).days == 364
        # And never into the year ahead, which is what today belongs to.
        assert last < today
        assert seed_alpha.WRITTEN_SINCE < last.isoformat()


def test_the_streak_agrees_with_the_record():
    """A year of finished work and a streak of zero reads as a broken app.
    `streaks` is what stops the two disagreeing."""
    def worked(*days):
        return [(None,) * 11 + ('{}T20:00:00'.format(d),) for d in days]

    last = date(2026, 9, 6)
    # A run ending on the last day written is the current streak.
    assert seed_alpha.streaks(
        worked('2026-09-04', '2026-09-05', '2026-09-06'), last) == (3, 3)
    # A gap before the end means the app would already have dropped it.
    assert seed_alpha.streaks(
        worked('2026-08-01', '2026-08-02', '2026-08-03'), last) == (0, 3)
    # The best is the longest run anywhere, never below the current one.
    assert seed_alpha.streaks(
        worked('2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04',
               '2026-09-05', '2026-09-06'), last) == (2, 4)
