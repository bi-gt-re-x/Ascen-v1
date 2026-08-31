"""The whole planning path, with only the network replaced.

Everything between the goals page and the Anthropic SDK runs for real here:
the prompt is built, the request is assembled, the answer is parsed, the
checklist is normalised, and the rows land in a real database. The single
substitution is `anthropic.Anthropic`, which returns a response shaped the way
the SDK shapes one instead of making a call.

That boundary is deliberate. It is the only part of this feature that cannot
be exercised without a credential, so putting the seam exactly there is what
lets the other end of the question — "does the rest of it work?" — be answered
without one. What these cannot prove is that the key is accepted; nothing
local can.
"""
import json
import os
import sqlite3
import sys
import types

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__))), 'scripts'))

import plan_backfill  # noqa: E402
from backend.tracking import planner  # noqa: E402

STONES = ['Bronze solved unaided', 'Silver greedy fluent', 'Silver DP unassisted',
          'Gold graph theory solid', 'Gold division reached']
STEPS = ['Read the knapsack chapter', 'Solve ten DP problems',
         'Redo every one that failed', 'Time a full contest',
         'Review the editorial afterwards']


def _reply(payload: dict):
    """A response shaped the way the SDK returns one."""
    block = types.SimpleNamespace(type='text', text=json.dumps(payload))
    return types.SimpleNamespace(content=[block], stop_reason='end_turn')


@pytest.fixture
def anthropic_says(monkeypatch):
    """Answer every request with the JSON the schema asks for."""
    calls = []

    class Messages:
        def create(self, **kwargs):
            calls.append(kwargs)
            wants_steps = 'steps' in json.dumps(
                kwargs['output_config']['format']['schema'])
            return _reply({'steps': STEPS} if wants_steps
                          else {'milestones': STONES})

    monkeypatch.setitem(sys.modules, 'anthropic', types.SimpleNamespace(
        Anthropic=lambda **kw: types.SimpleNamespace(messages=Messages())))
    monkeypatch.setenv('ANTHROPIC_API_KEY', 'sk-ant-test')
    monkeypatch.setenv('ANTHROPIC_WORKSPACE_ID', 'wrkspc_accepted')
    monkeypatch.delenv('MILESTONE_PROVIDER', raising=False)
    monkeypatch.delenv('HF_TOKEN', raising=False)
    monkeypatch.delenv('HUGGINGFACE_API_KEY', raising=False)
    return calls


@pytest.fixture
def db(fresh_db):
    con = sqlite3.connect(fresh_db)
    con.execute('PRAGMA foreign_keys = ON')
    con.execute("INSERT INTO users (id, username, name, email, password_hash)"
                " VALUES ('u1','Alpha','Alpha','a@example.test','x')")
    con.commit()
    yield con
    con.close()


def _goal(con, goal_id='g1', title='Reach USACO Gold'):
    con.execute(
        'INSERT INTO goals (id, user_id, title, description, goal_type,'
        " status, priority, deadline, created_at, category, why, measure)"
        " VALUES (?,'Alpha',?,'','xp','active',5,'','2026-01-01','coding',"
        "'College apps','milestone')", (goal_id, title))
    con.commit()


# --------------------------------------------------------------------------
def test_a_goal_gets_a_real_ladder_and_every_rung_gets_a_checklist(
        db, fresh_db, anthropic_says, monkeypatch):
    """The whole thing, once: five checkpoints, then five steps under each.

    This is the run the backfill would make against a live key, and the shape
    it leaves behind is what the goals page reads.
    """
    _goal(db)
    monkeypatch.setattr(plan_backfill, 'DB_PATH', fresh_db)
    monkeypatch.setattr(sys, 'argv', ['plan_backfill.py', '--user', 'Alpha', '--write'])

    # First pass plans the goal; the checkpoints it creates are gaps of their
    # own, which the second pass fills. That is the resumability property doing
    # real work rather than being asserted about.
    assert plan_backfill.main() == 0
    assert plan_backfill.main() == 0

    rows = db.execute(
        'SELECT title, steps FROM goal_milestones WHERE user_id = ?'
        ' ORDER BY position', ('Alpha',)).fetchall()

    assert [r[0] for r in rows] == STONES
    for _, steps in rows:
        assert [s['title'] for s in json.loads(steps)] == STEPS


def test_nothing_is_left_to_do_afterwards(db, fresh_db, anthropic_says, monkeypatch):
    """"No more gaps" is the finish line the backfill is aiming at."""
    _goal(db)
    monkeypatch.setattr(plan_backfill, 'DB_PATH', fresh_db)
    monkeypatch.setattr(sys, 'argv', ['plan_backfill.py', '--user', 'Alpha', '--write'])
    plan_backfill.main()
    plan_backfill.main()

    _, goals_without, stones_without = plan_backfill.find_gaps(db, 'Alpha')
    assert goals_without == []
    assert stones_without == []


def test_the_workspace_header_rides_on_every_request(db, fresh_db, anthropic_says,
                                                     monkeypatch):
    """What the last two commits were about, checked at the far end."""
    _goal(db)
    monkeypatch.setattr(plan_backfill, 'DB_PATH', fresh_db)
    monkeypatch.setattr(sys, 'argv', ['plan_backfill.py', '--user', 'Alpha', '--write'])
    plan_backfill.main()

    assert anthropic_says, 'no request was made'
    assert planner.workspace_id() == 'wrkspc_accepted'


def test_both_jobs_ask_for_their_own_shape(db, fresh_db, anthropic_says, monkeypatch):
    """A checkpoint is a state; a step is an action. Two prompts, two schemas."""
    _goal(db)
    monkeypatch.setattr(plan_backfill, 'DB_PATH', fresh_db)
    monkeypatch.setattr(sys, 'argv', ['plan_backfill.py', '--user', 'Alpha', '--write'])
    plan_backfill.main()
    plan_backfill.main()

    schemas = [json.dumps(c['output_config']['format']['schema'])
               for c in anthropic_says]
    assert any('milestones' in s for s in schemas)
    assert any('steps' in s for s in schemas)
    assert all(c['model'] == 'claude-sonnet-5' for c in anthropic_says)
    assert all(c['output_config']['effort'] == 'high' for c in anthropic_says)


def test_a_short_answer_is_refused_rather_than_padded(db, anthropic_says, monkeypatch):
    """Four checkpoints is not five, and a padded ladder is a lie."""
    class Short:
        def create(self, **kwargs):
            return _reply({'milestones': STONES[:4]})

    monkeypatch.setitem(sys.modules, 'anthropic', types.SimpleNamespace(
        Anthropic=lambda **kw: types.SimpleNamespace(messages=Short())))

    with pytest.raises(planner.PlannerUnavailable, match='instead of 5'):
        planner.suggest_milestones('Reach USACO Gold')


def test_a_refusal_is_a_sentence_rather_than_a_crash(db, anthropic_says, monkeypatch):
    """`content` is empty on a refusal, so it is checked before it is read."""
    class Refused:
        def create(self, **kwargs):
            return types.SimpleNamespace(content=[], stop_reason='refusal')

    monkeypatch.setitem(sys.modules, 'anthropic', types.SimpleNamespace(
        Anthropic=lambda **kw: types.SimpleNamespace(messages=Refused())))

    with pytest.raises(planner.PlannerUnavailable, match='declined'):
        planner.suggest_steps('Silver DP unassisted', goal='Reach USACO Gold')
