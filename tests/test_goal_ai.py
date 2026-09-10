"""The model's half of the goals page, and the rows it ends up in.

Two kinds of thing are pinned here.

**What the model is told.** A ladder drafted with no deadline is pitched at
no particular pace, and a checklist drafted for one rung with no idea of the
rungs either side of it writes their work into it. Every checkpoint of a new
goal is broken down at once now (frontend/src/components/Goals/plan.ts), each
by its own call, so both of those went from possible to routine. What goes into
the brief is checked where the brief is built, with only the network replaced.

**What the rows look like afterwards.** The model's ladder arrives through
/api/set_milestones, and that endpoint used to write rows with no date and no
checklist — the only rungs in the app like it.
"""
import json
from datetime import date, timedelta

from backend.tracking import planner

STONES = ['Bronze solved unaided', 'Silver greedy fluent', 'Silver DP unassisted',
          'Gold graph theory solid', 'Gold division reached']
STEPS = ['Read the knapsack chapter', 'Solve ten DP problems',
         'Redo every one that failed', 'Time a full contest',
         'Review the editorial afterwards']


def _deadline(days=100):
    return (date.today() + timedelta(days=days)).isoformat()


def _goal(client, **extra):
    body = {'title': 'Reach USACO Gold', 'measure': 'milestones', 'category': 'coding'}
    body.update(extra)
    reply = client.post('/api/add_goal', json=body).json()
    assert reply['success'], reply
    return reply['id']


def _ladder(client, goal_id):
    goals = client.get('/api/get_goals').json()['goals']
    return next(goal for goal in goals if goal['id'] == goal_id)['milestones']


# ---------------------------------------------------------------------------
# The rows
# ---------------------------------------------------------------------------
def test_a_drafted_ladder_arrives_dated_and_with_its_checklist_rows(client):
    deadline = _deadline()
    goal_id = _goal(client, deadline=deadline)

    assert client.post('/api/set_milestones',
                       json={'goal_id': goal_id, 'titles': STONES}).json()['success']
    ladder = _ladder(client, goal_id)

    dates = [stone['target_date'] for stone in ladder]
    assert all(dates), dates
    assert dates == sorted(dates)
    # The last rung is the goal being reached, on the day it is due.
    assert dates[-1] == deadline
    for stone in ladder:
        assert len(stone['steps']) == 3
        assert all(step['placeholder'] for step in stone['steps'])


def test_a_rung_that_keeps_its_place_keeps_its_date(client):
    goal_id = _goal(client, deadline=_deadline())
    client.post('/api/set_milestones', json={'goal_id': goal_id, 'titles': STONES[:2]})
    first = [stone['target_date'] for stone in _ladder(client, goal_id)]

    client.post('/api/set_milestones', json={'goal_id': goal_id, 'titles': STONES})
    after = [stone['target_date'] for stone in _ladder(client, goal_id)]

    # Kept rows are the reader's, and they may have moved them.
    assert after[:2] == first
    assert all(after[2:])


# ---------------------------------------------------------------------------
# What the endpoints pass on
# ---------------------------------------------------------------------------
def test_a_rung_is_broken_down_knowing_the_rungs_either_side(client, monkeypatch):
    seen = {}

    def fake(milestone, **kwargs):
        seen.update(kwargs, milestone=milestone)
        return STEPS

    monkeypatch.setattr(planner, 'suggest_steps', fake)
    goal_id = _goal(client, deadline=_deadline())
    client.post('/api/set_milestones', json={'goal_id': goal_id, 'titles': STONES})
    ladder = _ladder(client, goal_id)

    out = client.post('/api/suggest_steps', json={'milestone_id': ladder[2]['id']}).json()

    assert out['success']
    assert seen['milestone'] == 'Silver DP unassisted'
    assert seen['before'] == 'Silver greedy fluent'
    assert seen['after'] == 'Gold graph theory solid'
    # Its own date, not the goal's: its steps have to land before it does.
    assert seen['deadline'] == ladder[2]['target_date']


def test_the_ends_of_the_ladder_have_one_neighbour(client, monkeypatch):
    seen = []
    monkeypatch.setattr(planner, 'suggest_steps',
                        lambda milestone, **kwargs: seen.append(kwargs) or STEPS)
    goal_id = _goal(client)
    client.post('/api/set_milestones', json={'goal_id': goal_id, 'titles': STONES})
    ladder = _ladder(client, goal_id)

    client.post('/api/suggest_steps', json={'milestone_id': ladder[0]['id']})
    client.post('/api/suggest_steps', json={'milestone_id': ladder[-1]['id']})

    assert (seen[0]['before'], seen[0]['after']) == ('', STONES[1])
    assert (seen[1]['before'], seen[1]['after']) == (STONES[3], '')


def test_a_ladder_is_drafted_against_the_goals_date(client, monkeypatch):
    seen = []
    monkeypatch.setattr(planner, 'suggest_milestones',
                        lambda title, **kwargs: seen.append(kwargs) or STONES)
    deadline = _deadline()
    goal_id = _goal(client, deadline=deadline)

    # An existing goal: read off the row.
    assert client.post('/api/suggest_milestones', json={'goal_id': goal_id}).json()['success']
    # One still in the wizard: sent by the page.
    client.post('/api/suggest_milestones', json={'title': 'Violin ARCT', 'deadline': '2027-06-01'})

    assert seen[0]['deadline'] == deadline
    assert seen[1]['deadline'] == '2027-06-01'


# ---------------------------------------------------------------------------
# What reaches the model
# ---------------------------------------------------------------------------
def _answering(monkeypatch, payload):
    """Anthropic as the provider, with the call replaced. Returns the briefs."""
    briefs = []

    def fake(brief, *rest, **kwargs):
        briefs.append(brief)
        return json.dumps(payload)

    monkeypatch.setattr(planner, 'provider', lambda: 'anthropic')
    monkeypatch.setattr(planner, '_from_anthropic', fake)
    return briefs


def test_the_checklist_brief_names_the_neighbours_and_the_date(monkeypatch):
    briefs = _answering(monkeypatch, {'steps': STEPS})

    steps = planner.suggest_steps(
        'Silver DP unassisted', goal='Reach USACO Gold', deadline='2027-01-10',
        before='Silver greedy fluent', after='Gold graph theory solid')

    assert steps == STEPS
    brief = briefs[0]
    assert 'Checkpoint to break down: Silver DP unassisted' in brief
    assert 'Silver greedy fluent' in brief
    assert 'Gold graph theory solid' in brief
    assert 'Deadline: 2027-01-10' in brief


def test_the_ladder_brief_names_the_date(monkeypatch):
    briefs = _answering(monkeypatch, {'milestones': STONES})

    assert planner.suggest_milestones('Reach USACO Gold', deadline='2027-01-10') == STONES
    assert 'Deadline: 2027-01-10' in briefs[0]


def test_a_brief_with_nothing_to_say_says_nothing(monkeypatch):
    """No empty "Deadline:" line, and no neighbour lines on a rung without any."""
    briefs = _answering(monkeypatch, {'steps': STEPS})

    planner.suggest_steps('Silver DP unassisted', goal='Reach USACO Gold')

    assert 'Deadline' not in briefs[0]
    assert 'before it' not in briefs[0]
    assert 'after it' not in briefs[0]
