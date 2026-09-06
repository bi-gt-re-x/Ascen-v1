"""The report card grades the last ninety days, and grades them fairly.

The page used to tell this repository's own demo account — 4,120 finished
tasks, level 60, a 152-day best streak — **"F: not enough is happening yet to
score"**, while printing "top 1.0% of Ascen users" beside it. Four things were
wrong at once and each of these tests holds one of them shut.
"""
from datetime import date, timedelta

from backend.database import connection as db
from backend.tracking import analytics


def finish(client, xp=10, when=None, difficulty=None, execution=None, due=None):
    """One completed task, optionally back-dated and rated."""
    made = client.post('/api/tasks', json={
        'name': 'task', 'xp_reward': xp, 'due_date': due or '',
    }).json()
    task_id = made['task_id']
    client.post('/api/complete_task', json={'task_id': task_id})
    if when:
        db.update_row('tasks', task_id, {'completed_at': when + 'T12:00:00'},
                      user_id='tester')
        for row in db.rows_for('xp_events', 'tester'):
            if row.get('reason') == 'task_completion' and row.get('date') != when:
                db.update_row('xp_events', row['id'], {'date': when}, user_id='tester')
    if difficulty is not None:
        client.post('/api/rate_task', json={'task_id': task_id,
                                            'difficulty': difficulty,
                                            'execution': execution})
    return task_id


def card(client):
    return client.get('/api/get_growth_ratings').json()


# --------------------------------------------------------------------------
def test_the_window_is_ninety_days_not_the_account_lifetime(client):
    """The bug: a long-dormant account could never recover its average.

    `total_days` was the number of days since the account was created, so an
    account made years ago and taken seriously this month was scored on the
    mean of the whole silence. No amount of work moves an average over 1,840
    days, which is how a very active account came to read F.
    """
    db.update_row('users', db.find_row('users', 'tester', key='username')['id'],
                  {'created_at': '2021-01-01T00:00:00'})
    finish(client, xp=50)

    consistency = card(client)['metrics']['consistency']
    assert consistency['total_days'] == analytics.SCORING_WINDOW_DAYS
    # Not the ~1,700 days since 2021.
    assert consistency['total_days'] < 200


def test_a_young_account_is_scored_on_the_days_it_has_existed(client):
    """A three-day-old account must not be marked down for the other 87."""
    made = date.today() - timedelta(days=2)
    db.update_row('users', db.find_row('users', 'tester', key='username')['id'],
                  {'created_at': made.isoformat() + 'T00:00:00'})
    finish(client, xp=50)
    assert card(client)['metrics']['consistency']['total_days'] == 3


def test_work_outside_the_window_does_not_count(client):
    """Old work is history, not this month's score."""
    long_ago = (date.today() - timedelta(days=200)).isoformat()
    finish(client, xp=500, when=long_ago)
    assert card(client)['metrics']['productivity']['avg_daily_xp'] == 0


# --------------------------------------------------------------------------
def test_productivity_is_scored_against_the_accounts_own_daily_goal(client):
    """It was a flat 300 XP a day for full marks — a number nobody chose."""
    user = db.find_row('users', 'tester', key='username')
    db.update_row('users', user['id'], {'daily_goal': 100})
    finish(client, xp=100)
    assert card(client)['metrics']['productivity']['score'] == 100

    # Same day's work, twice the target: half the score.
    db.update_row('users', user['id'], {'daily_goal': 200})
    assert card(client)['metrics']['productivity']['score'] == 50


def test_productivity_counts_days_worked_not_days_on_the_calendar(client):
    """Turning up is what consistency measures; scoring it twice was the bug.

    One day's work in a ninety-day window is a full day's work on the day it
    happened. It should score the day, and let consistency say it was one day
    out of ninety.
    """
    db.update_row('users', db.find_row('users', 'tester', key='username')['id'],
                  {'daily_goal': 100})
    finish(client, xp=100)
    metrics = card(client)['metrics']
    assert metrics['productivity']['score'] == 100
    assert metrics['consistency']['score'] < 5


# --------------------------------------------------------------------------
def test_an_ordinary_good_rating_is_not_a_failing_quality_score(client):
    """Difficulty x execution is out of 25, and its midpoint is not 50%.

    A task rated 3 and 3 scored 9/25 = 36. Three out of five twice over is an
    ordinary good task, and the scale it is read on has to say so: the
    geometric mean is 3, and 3 out of 5 is 60.
    """
    finish(client, xp=10, difficulty=3, execution=3)
    assert card(client)['metrics']['quality']['score'] == 60


def test_full_marks_still_need_full_marks(client):
    finish(client, xp=10, difficulty=5, execution=5)
    assert card(client)['metrics']['quality']['score'] == 100


# --------------------------------------------------------------------------
def test_efficiency_is_the_number_the_card_prints_beside_it(client):
    """It was half deadlines and half wall-clock "speed".

    `completion_seconds` is the gap between writing a task down and finishing
    it, so a task created Monday for Friday scored as five days of slowness —
    punishing exactly what the calendar and the goals page ask people to do.
    The card's caption always read "N% finished on time"; the score now is it.
    """
    finish(client, xp=10, due='2099-01-01T00:00:00')
    efficiency = card(client)['metrics']['efficiency']
    assert efficiency['score'] == efficiency['on_time_pct'] == 100


def test_a_day_with_no_focus_does_not_count_against_the_focus_score(client):
    """The same double count productivity had, in the last metric.

    A tracked day with zero seconds used to add its goal to the denominator and
    nothing to the numerator. Consistency already counts the days off.
    """
    today = date.today().isoformat()
    idle = (date.today() - timedelta(days=1)).isoformat()
    client.post('/api/focus_sync', json={'date': today, 'focused_seconds': 7200,
                                         'goal_hours': 2})
    client.post('/api/focus_sync', json={'date': idle, 'focused_seconds': 0,
                                         'goal_hours': 2})
    assert card(client)['metrics']['focus']['score'] == 100


# --------------------------------------------------------------------------
def test_a_busy_account_does_not_read_as_a_failing_one(client):
    """The whole point, end to end.

    Ninety days of steady, well-rated, on-time work against the account's own
    stated goal should not come out an F. This is the regression that started
    all of it.
    """
    user = db.find_row('users', 'tester', key='username')
    db.update_row('users', user['id'], {'daily_goal': 100})
    today = date.today()
    for back in range(0, 60):
        day = (today - timedelta(days=back)).isoformat()
        finish(client, xp=100, when=day, difficulty=4, execution=4,
               due='2099-01-01T00:00:00')
        client.post('/api/focus_sync', json={'date': day, 'focused_seconds': 7200,
                                             'goal_hours': 2})

    result = card(client)['overall']
    assert result['grade'] not in ('F', 'D'), result
    assert result['score'] >= 70, result
