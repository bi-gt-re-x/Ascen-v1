"""scripts/plan_backfill.py — filling in the plans that predate the planner.

The model is never called here. `planner.suggest_milestones` and
`planner.suggest_steps` are the seam, monkeypatched in every test that gets
past the dry run, because what this script is responsible for is which rows it
picks, what it writes, and what it refuses to touch — not what a model says.

The two properties worth most of this file are the ones that make a
39-call run over somebody's real account safe to start: it never overwrites,
and one failure is one gap rather than the end of the run.
"""
import json
import os
import sqlite3
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__))), 'scripts'))

import plan_backfill  # noqa: E402
from backend.tracking import planner  # noqa: E402

FIVE_STONES = ['First state', 'Second state', 'Third state',
               'Fourth state', 'Goal reached']
FIVE_STEPS = ['Read the chapter', 'Do ten problems', 'Redo the failures',
              'Time a contest', 'Review the editorial']


@pytest.fixture
def con(fresh_db):
    """A connection to the per-test database, with the accounts these use.

    `goals.user_id` has a foreign key onto `users`, and it is checked as each
    row goes in — so the accounts have to exist before anything is planned for
    them.
    """
    connection = sqlite3.connect(fresh_db)
    connection.execute('PRAGMA foreign_keys = ON')
    for username in ('Alpha', 'Someone'):
        connection.execute(
            'INSERT INTO users (id, username, name, email, password_hash)'
            ' VALUES (?,?,?,?,?)',
            (f'id-{username}', username, username,
             f'{username}@example.test', 'x'))
    connection.commit()
    yield connection
    connection.close()


def _goal(con, goal_id='g1', title='Reach USACO Gold', status='active',
          category='coding'):
    con.execute(
        'INSERT INTO goals (id, user_id, title, description, goal_type,'
        ' status, priority, deadline, created_at, category, why, measure)'
        " VALUES (?,?,?,'','xp',?,5,'','2026-01-01',?,'College apps','milestone')",
        (goal_id, 'Alpha', title, status, category))
    con.commit()
    return goal_id


def _stone(con, stone_id, goal_id='g1', title='Silver DP unassisted', steps=None):
    con.execute(
        'INSERT INTO goal_milestones (id, goal_id, user_id, title, note,'
        " position, status, target_date, created_at, steps)"
        " VALUES (?,?,'Alpha',?,'',0,'pending','','2026-01-01',?)",
        (stone_id, goal_id, title, steps if steps is not None else '[]'))
    con.commit()
    return stone_id


# --------------------------------------------------------------------------
# Which rows are a gap
# --------------------------------------------------------------------------
def test_a_goal_with_no_checkpoints_is_a_gap(con):
    _goal(con)
    _, goals_without, _ = plan_backfill.find_gaps(con, 'Alpha')
    assert [g['id'] for g in goals_without] == ['g1']


def test_a_goal_that_already_has_one_checkpoint_is_left_alone(con):
    """Somebody planned it by hand. Five more is not a favour."""
    _goal(con)
    _stone(con, 'm1')
    _, goals_without, _ = plan_backfill.find_gaps(con, 'Alpha')
    assert goals_without == []


def test_seeded_placeholders_do_not_count_as_steps(con):
    """A checkpoint is created with MIN_STEPS blank rows.

    "Has steps" is therefore never "the column is non-empty" — it is whether
    anything has been written into one of them.
    """
    _goal(con)
    _stone(con, 'm1', steps=json.dumps(
        [{'id': 's1', 'title': '', 'done': False, 'task_id': None, 'due': None}]))
    _, _, stones_without = plan_backfill.find_gaps(con, 'Alpha')
    assert [s['id'] for s in stones_without] == ['m1']


def test_a_half_written_checklist_is_somebody_elses_work(con):
    """One written row is enough to leave the whole checkpoint alone."""
    _goal(con)
    _stone(con, 'm1', steps=json.dumps(
        [{'id': 's1', 'title': 'I typed this', 'done': False,
          'task_id': None, 'due': None}]))
    _, _, stones_without = plan_backfill.find_gaps(con, 'Alpha')
    assert stones_without == []


def test_completed_goals_are_skipped_unless_asked_for(con):
    """A five-step plan for something already finished is noise and a call."""
    _goal(con, 'g1', status='completed')
    _, goals_without, _ = plan_backfill.find_gaps(con, 'Alpha')
    assert goals_without == []

    _, included, _ = plan_backfill.find_gaps(con, 'Alpha', include_completed=True)
    assert [g['id'] for g in included] == ['g1']


def test_a_checkpoint_under_a_completed_goal_is_skipped_too(con):
    """The checkpoint is skipped for the same reason its goal is."""
    _goal(con, 'g1', status='completed')
    _stone(con, 'm1')
    _, _, stones_without = plan_backfill.find_gaps(con, 'Alpha')
    assert stones_without == []


def test_another_accounts_rows_are_not_in_scope(con):
    _goal(con)
    con.execute(
        'INSERT INTO goals (id, user_id, title, description, goal_type,'
        " status, priority, deadline, created_at, measure)"
        " VALUES ('g9','Someone','Their goal','','xp','active',5,'','2026-01-01','milestone')")
    con.commit()
    _, goals_without, _ = plan_backfill.find_gaps(con, 'Alpha')
    assert [g['id'] for g in goals_without] == ['g1']


# --------------------------------------------------------------------------
# What it writes
# --------------------------------------------------------------------------
def test_planning_a_goal_writes_five_checkpoints_in_order(con, monkeypatch):
    monkeypatch.setattr(planner, 'suggest_milestones',
                        lambda title, **kw: list(FIVE_STONES))
    goal_id = _goal(con)
    goals, goals_without, _ = plan_backfill.find_gaps(con, 'Alpha')

    written = plan_backfill.plan_goal(con, 'Alpha', goals_without[0], set())
    con.commit()

    assert written == 5
    rows = con.execute(
        'SELECT title, position, status FROM goal_milestones'
        ' WHERE goal_id = ? ORDER BY position', (goal_id,)).fetchall()
    assert [r[0] for r in rows] == FIVE_STONES
    assert [r[1] for r in rows] == [0, 1, 2, 3, 4]
    assert {r[2] for r in rows} == {'pending'}


def test_the_goals_own_words_are_handed_to_the_model(con, monkeypatch):
    """The brief is what makes the checkpoints about this goal in particular."""
    seen = {}

    def fake(title, **kw):
        seen.update(title=title, **kw)
        return list(FIVE_STONES)

    monkeypatch.setattr(planner, 'suggest_milestones', fake)
    _goal(con)
    _, goals_without, _ = plan_backfill.find_gaps(con, 'Alpha')
    plan_backfill.plan_goal(con, 'Alpha', goals_without[0], set())

    assert seen['title'] == 'Reach USACO Gold'
    assert seen['category'] == 'coding'
    assert seen['why'] == 'College apps'


def test_new_checkpoints_do_not_collide_with_existing_ids(con, monkeypatch):
    """`goal_milestones.id` is the primary key, so uniqueness is global."""
    monkeypatch.setattr(planner, 'suggest_milestones',
                        lambda title, **kw: list(FIVE_STONES))
    _goal(con, 'g1')
    _goal(con, 'g2', title='Second goal')
    _stone(con, 'pb0000001', goal_id='g2')

    _, goals_without, _ = plan_backfill.find_gaps(con, 'Alpha')
    target = next(g for g in goals_without if g['id'] == 'g1')
    taken = {r[0] for r in con.execute('SELECT id FROM goal_milestones')}
    plan_backfill.plan_goal(con, 'Alpha', target, taken)
    con.commit()

    ids = [r[0] for r in con.execute('SELECT id FROM goal_milestones')]
    assert len(ids) == len(set(ids))
    assert 'pb0000001' in ids


def test_planning_steps_writes_them_onto_the_checkpoint(con, monkeypatch):
    monkeypatch.setattr(planner, 'suggest_steps',
                        lambda milestone, **kw: list(FIVE_STEPS))
    _goal(con)
    _stone(con, 'm1')
    goals, _, stones_without = plan_backfill.find_gaps(con, 'Alpha')
    by_id = {g['id']: g for g in goals}

    written = plan_backfill.plan_steps(
        con, 'Alpha', stones_without[0], by_id['g1'])
    con.commit()

    assert written == 5
    stored = json.loads(con.execute(
        'SELECT steps FROM goal_milestones WHERE id = ?', ('m1',)).fetchone()[0])
    assert [s['title'] for s in stored] == FIVE_STEPS
    assert all(s['done'] is False for s in stored)


def test_the_checkpoint_is_broken_down_against_its_goal(con, monkeypatch):
    """A six-word checkpoint title alone is frequently not enough to plan."""
    seen = {}

    def fake(milestone, **kw):
        seen.update(milestone=milestone, **kw)
        return list(FIVE_STEPS)

    monkeypatch.setattr(planner, 'suggest_steps', fake)
    _goal(con)
    _stone(con, 'm1')
    goals, _, stones_without = plan_backfill.find_gaps(con, 'Alpha')
    plan_backfill.plan_steps(con, 'Alpha', stones_without[0],
                             {g['id']: g for g in goals}['g1'])

    assert seen['milestone'] == 'Silver DP unassisted'
    assert seen['goal'] == 'Reach USACO Gold'


def test_a_filled_checkpoint_stops_being_a_gap(con, monkeypatch):
    """What makes the run resumable: a second pass has less to do, not the same."""
    monkeypatch.setattr(planner, 'suggest_steps',
                        lambda milestone, **kw: list(FIVE_STEPS))
    _goal(con)
    _stone(con, 'm1')
    goals, _, before = plan_backfill.find_gaps(con, 'Alpha')
    plan_backfill.plan_steps(con, 'Alpha', before[0],
                             {g['id']: g for g in goals}['g1'])
    con.commit()

    _, _, after = plan_backfill.find_gaps(con, 'Alpha')
    assert len(before) == 1
    assert after == []


# --------------------------------------------------------------------------
# The run itself
# --------------------------------------------------------------------------
# These go through `main()`, which is where the money is spent and where the
# safety rails are. `DB_PATH` is read at import, so it is patched on the
# module rather than on the settings it came from.
def _run(monkeypatch, fresh_db, *argv):
    monkeypatch.setattr(plan_backfill, 'DB_PATH', fresh_db)
    monkeypatch.setattr(sys, 'argv', ['plan_backfill.py', *argv])
    return plan_backfill.main()


def test_a_dry_run_calls_nothing_and_writes_nothing(con, fresh_db, monkeypatch):
    """The default, because every gap it finds is a paid call."""
    def explode(*a, **kw):
        raise AssertionError('the model was called during a dry run')

    monkeypatch.setattr(planner, 'suggest_milestones', explode)
    monkeypatch.setattr(planner, 'suggest_steps', explode)
    _goal(con)
    _stone(con, 'm1')

    assert _run(monkeypatch, fresh_db, '--user', 'Alpha') == 0

    assert con.execute('SELECT COUNT(*) FROM goal_milestones').fetchone()[0] == 1
    assert json.loads(con.execute(
        'SELECT steps FROM goal_milestones WHERE id = ?', ('m1',)).fetchone()[0]) == []


def test_limit_caps_how_many_calls_one_run_makes(con, fresh_db, monkeypatch):
    """So a first pass over a large account can be a small one."""
    calls = []

    def counted(milestone, **kw):
        calls.append(milestone)
        return list(FIVE_STEPS)

    monkeypatch.setattr(planner, 'suggest_steps', counted)
    monkeypatch.setattr(planner, 'configured', lambda: True)
    _goal(con)
    for i in range(4):
        _stone(con, f'm{i}', title=f'Checkpoint {i}')

    _run(monkeypatch, fresh_db, '--user', 'Alpha', '--write', '--limit', '2')

    assert len(calls) == 2


def test_one_failure_is_one_gap_and_the_run_carries_on(con, fresh_db, monkeypatch):
    """A batch that stops on the third leaves an account half-planned with no
    way to tell which half is missing."""
    seen = []

    def flaky(milestone, **kw):
        seen.append(milestone)
        if milestone == 'Checkpoint 1':
            raise planner.PlannerUnavailable('the model was unreachable')
        return list(FIVE_STEPS)

    monkeypatch.setattr(planner, 'suggest_steps', flaky)
    monkeypatch.setattr(planner, 'configured', lambda: True)
    _goal(con)
    for i in range(3):
        _stone(con, f'm{i}', title=f'Checkpoint {i}')

    _run(monkeypatch, fresh_db, '--user', 'Alpha', '--write')

    # All three attempted, and the two that could be written were.
    assert seen == ['Checkpoint 0', 'Checkpoint 1', 'Checkpoint 2']
    filled = [row[0] for row in con.execute(
        'SELECT id FROM goal_milestones ORDER BY id')
        if _written(con, row[0])]
    assert filled == ['m0', 'm2']

    # And the one that failed is still a gap, so a second run retries it.
    _, _, stones_without = plan_backfill.find_gaps(con, 'Alpha')
    assert [s['id'] for s in stones_without] == ['m1']


def _written(con, stone_id):
    steps = con.execute('SELECT steps FROM goal_milestones WHERE id = ?',
                        (stone_id,)).fetchone()[0]
    return plan_backfill._written(steps)


def test_a_run_with_no_key_configured_stops_before_writing(con, fresh_db, monkeypatch):
    """It says what to do rather than reporting forty identical failures."""
    monkeypatch.setattr(planner, 'configured', lambda: False)
    _goal(con)
    _stone(con, 'm1')

    assert _run(monkeypatch, fresh_db, '--user', 'Alpha', '--write') == 1
    assert con.execute('SELECT COUNT(*) FROM goal_milestones').fetchone()[0] == 1


def test_the_run_loads_dotenv_before_looking_for_a_key(con, fresh_db, monkeypatch):
    """A standalone script gets no .env for free.

    Regression: without this the run saw only what was already exported, and
    reported "no key configured" however carefully the key had been written
    into .env — which is indistinguishable, from the outside, from a key that
    is genuinely missing.
    """
    from backend.config import settings

    loaded = []
    monkeypatch.setattr(settings, 'load_dotenv', lambda *a, **kw: loaded.append(True))
    monkeypatch.setattr(planner, 'configured', lambda: False)
    _goal(con)

    _run(monkeypatch, fresh_db, '--user', 'Alpha', '--write')

    assert loaded, 'main() did not load .env before reading the environment'
